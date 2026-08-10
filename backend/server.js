require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const { initDB, run, get, all } = require('./db');
const { sendOTPEmail } = require('./email');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'inter-ai-secret-2026-change';

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit auth
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, message: { error: 'Too many attempts, try later' } });

// Serve frontend static (so same origin)
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// Helper: generate 6-digit OTP
function genOTP() { return Math.floor(100000 + Math.random()*900000).toString(); }

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req,res,next){
  const hdr = req.headers.authorization;
  if(!hdr || !hdr.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(hdr.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch(e){ return res.status(401).json({ error: 'Invalid token' }); }
}

// Health
app.get('/api/health', (req,res)=> res.json({ ok:true, time: new Date().toISOString(), db: 'sqlite' }));

// SIGNUP
app.post('/api/auth/signup', authLimiter, async (req,res)=>{
  try{
    const { name, email, password, confirmPassword } = req.body;
    if(!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
    if(password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
    if(password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const normEmail = email.trim().toLowerCase();

    const exists = await get('SELECT id FROM users WHERE email=?', [normEmail]);
    if(exists) return res.status(409).json({ error: 'Email already exists. Please login or use Forgot Password.' });

    const hash = await bcrypt.hash(password, 10);
    const r = await run('INSERT INTO users (name,email,password,is_verified) VALUES (?,?,?,0)', [name.trim(), normEmail, hash]);
    
    // Generate OTP for verification
    const otp = genOTP();
    const expires = new Date(Date.now()+10*60*1000).toISOString();
    await run('INSERT INTO otps (email,otp,purpose,expires_at) VALUES (?,?,?,?)', [normEmail, otp, 'signup', expires]);
    await sendOTPEmail(normEmail, otp, 'signup');

    // Also return OTP in dev mode for testing
    const isDev = !process.env.GMAIL_USER || process.env.GMAIL_USER.includes('your.email');
    res.json({ 
      message: 'Account created. OTP sent to email. Please verify.',
      userId: r.id,
      devOtp: isDev ? otp : undefined,
      email: normEmail
    });
  }catch(e){ console.error('signup',e); res.status(500).json({ error: 'Server error' }); }
});

// VERIFY OTP (signup)
app.post('/api/auth/verify-otp', async (req,res)=>{
  try{
    const { email, otp, purpose='signup' } = req.body;
    if(!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
    const normEmail = email.trim().toLowerCase();
    const row = await get('SELECT * FROM otps WHERE email=? AND otp=? AND purpose=? AND used=0 ORDER BY created_at DESC LIMIT 1', [normEmail, otp, purpose]);
    if(!row) return res.status(400).json({ error: 'Invalid OTP' });
    if(new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired. Request new one.' });

    await run('UPDATE otps SET used=1 WHERE id=?', [row.id]);
    await run('UPDATE users SET is_verified=1 WHERE email=?', [normEmail]);
    const user = await get('SELECT id,name,email FROM users WHERE email=?', [normEmail]);
    const token = signToken(user);
    res.json({ message: 'Email verified successfully!', token, user });
  }catch(e){ console.error('verify',e); res.status(500).json({ error: 'Server error' }); }
});

// RESEND OTP
app.post('/api/auth/resend-otp', authLimiter, async (req,res)=>{
  const { email, purpose='signup' } = req.body;
  if(!email) return res.status(400).json({ error: 'Email required' });
  const normEmail = email.trim().toLowerCase();
  const otp = genOTP();
  const expires = new Date(Date.now()+10*60*1000).toISOString();
  await run('INSERT INTO otps (email,otp,purpose,expires_at) VALUES (?,?,?,?)', [normEmail, otp, purpose, expires]);
  await sendOTPEmail(normEmail, otp, purpose);
  const isDev = !process.env.GMAIL_USER || process.env.GMAIL_USER.includes('your.email');
  res.json({ message: 'OTP resent', devOtp: isDev?otp:undefined });
});

// LOGIN
app.post('/api/auth/login', authLimiter, async (req,res)=>{
  try{
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const normEmail = email.trim().toLowerCase();
    const user = await get('SELECT * FROM users WHERE email=?', [normEmail]);
    if(!user) return res.status(404).json({ error: 'Your account is not found. Please sign up first.' });
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(401).json({ error: 'Incorrect password' });
    if(!user.is_verified) {
      // resend OTP
      const otp = genOTP();
      const expires = new Date(Date.now()+10*60*1000).toISOString();
      await run('INSERT INTO otps (email,otp,purpose,expires_at) VALUES (?,?,?,?)', [normEmail, otp, 'signup', expires]);
      await sendOTPEmail(normEmail, otp, 'signup');
      return res.status(403).json({ error: 'Email not verified. OTP sent to your email. Please verify first.', needVerify: true, email: normEmail });
    }
    await run('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
  }catch(e){ console.error('login',e); res.status(500).json({ error: 'Server error' }); }
});

// FORGOT PASSWORD - send OTP
app.post('/api/auth/forgot-password', authLimiter, async (req,res)=>{
  try{
    const { email } = req.body;
    if(!email) return res.status(400).json({ error: 'Email required' });
    const normEmail = email.trim().toLowerCase();
    const user = await get('SELECT id FROM users WHERE email=?', [normEmail]);
    if(!user) return res.status(404).json({ error: 'Your account is not found.' });
    const otp = genOTP();
    const expires = new Date(Date.now()+10*60*1000).toISOString();
    await run('INSERT INTO otps (email,otp,purpose,expires_at) VALUES (?,?,?,?)', [normEmail, otp, 'forgot', expires]);
    await sendOTPEmail(normEmail, otp, 'forgot');
    const isDev = !process.env.GMAIL_USER || process.env.GMAIL_USER.includes('your.email');
    res.json({ message: 'Verification code sent to your email', devOtp: isDev?otp:undefined, email: normEmail });
  }catch(e){ console.error('forgot',e); res.status(500).json({ error: 'Server error' }); }
});

// RESET PASSWORD with OTP
app.post('/api/auth/reset-password', async (req,res)=>{
  try{
    const { email, otp, newPassword, confirmPassword } = req.body;
    if(!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required' });
    if(newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
    if(newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const normEmail = email.trim().toLowerCase();
    const row = await get('SELECT * FROM otps WHERE email=? AND otp=? AND purpose=? AND used=0 ORDER BY created_at DESC LIMIT 1', [normEmail, otp, 'forgot']);
    if(!row) return res.status(400).json({ error: 'Invalid verification code' });
    if(new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Code expired' });
    const hash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password=? WHERE email=?', [hash, normEmail]);
    await run('UPDATE otps SET used=1 WHERE id=?', [row.id]);
    res.json({ message: 'Password reset successful. You can now login.' });
  }catch(e){ console.error('reset',e); res.status(500).json({ error: 'Server error' }); }
});

// ME
app.get('/api/auth/me', authMiddleware, async (req,res)=>{
  const user = await get('SELECT id,name,email,is_verified,created_at,last_login FROM users WHERE id=?', [req.user.id]);
  if(!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user });
});

// ADMIN: list users (protected)
app.get('/api/admin/users', async (req,res)=>{
  const users = await all('SELECT id,name,email,is_verified,created_at FROM users ORDER BY created_at DESC');
  res.json({ count: users.length, users });
});

// Sitemap for Google Search Console
app.get('/sitemap.xml', (req,res)=>{
  const domain = process.env.DOMAIN || 'https://mahicouragw.github.io';
  const base = `${domain}/Help-studies-fish`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod><priority>1.0</priority></url>
  <url><loc>${base}/#library</loc><priority>0.8</priority></url>
  <url><loc>${base}/#quiz</loc><priority>0.8</priority></url>
  <url><loc>${base}/#scan</loc><priority>0.7</priority></url>
</urlset>`;
  res.header('Content-Type','application/xml').send(xml);
});

app.get('/robots.txt', (req,res)=>{
  const domain = process.env.DOMAIN || 'https://mahicouragw.github.io';
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${domain}/Help-studies-fish/sitemap.xml\n`);
});

// Google Search Console verification file
app.get('/google*.html', (req,res)=>{
  const token = process.env.GSC_VERIFICATION_TOKEN;
  if(token && req.path.includes(token)){
    res.type('text/html').send(`google-site-verification: ${token}`);
  } else {
    res.status(404).send('Not found');
  }
});

// Fallback to frontend
app.get('*', (req,res)=>{
  res.sendFile(path.join(frontendPath, 'index.html'));
});

initDB().then(()=>{
  app.listen(PORT, '0.0.0.0', ()=>{
    console.log(`🚀 Inter AI Backend running on http://0.0.0.0:${PORT}`);
    console.log(`📚 Frontend served from ${frontendPath}`);
    console.log(`🔐 Auth: signup / login / forgot with OTP`);
    console.log(`🗄️  SQLite: ${require('./db').DB_PATH}`);
    if(!process.env.GMAIL_USER || process.env.GMAIL_USER.includes('your.email')){
      console.log('⚠️  Set GMAIL_USER & GMAIL_APP_PASSWORD in backend/.env to send real emails');
    }
  });
});

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
const { sendOTPEmail, cleanCredentials } = require('./email');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'inter-ai-secret-2026-change';

app.use(helmet({ crossOriginEmbedderPolicy: false }));

// CORS configuration for GitHub Pages, Render, preview environments, and local dev
app.use(cors({
  origin: (origin, callback) => {
    // Requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow all GitHub Pages, Render, e2b, localhost, and custom domains
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit auth requests (30 attempts per 15 min window per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many attempts, please try again later.' }
});

// Serve frontend static files
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// Helper: generate 6-digit OTP string
function genOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr || !hdr.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }
  try {
    const decoded = jwt.verify(hdr.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ==========================================
// HEALTH CHECK ENDPOINT
// ==========================================
app.get('/api/health', (req, res) => {
  const { isConfigured, user, pass } = cleanCredentials();
  res.json({
    ok: true,
    time: new Date().toISOString(),
    db: 'sqlite',
    emailConfigured: isConfigured,
    emailUserSet: Boolean(user && !user.includes('your.email')),
    emailPassLength: pass ? pass.length : 0
  });
});

app.get('/api/email-status', (req, res) => {
  const { isConfigured, user, pass } = cleanCredentials();
  res.json({
    configured: isConfigured,
    userConfigured: Boolean(user && !user.includes('your.email')),
    passLength: pass ? pass.length : 0,
    hint: !isConfigured
      ? 'To send real OTP emails, set GMAIL_USER and GMAIL_APP_PASSWORD (16-char app password from https://myaccount.google.com/apppasswords) in Render Environment variables.'
      : 'Gmail SMTP credentials are configured.'
  });
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// SIGNUP
app.post('/api/auth/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Full name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const normEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const existingUser = await get('SELECT id, name, email, is_verified FROM users WHERE email = ?', [normEmail]);

    const isDev = !cleanCredentials().isConfigured;

    // Case 1: Verified user already exists -> Do not allow duplicate signup
    if (existingUser && existingUser.is_verified) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists. Please login.'
      });
    }

    // Case 2: User exists but is NOT verified -> Update credentials and send fresh OTP
    if (existingUser && !existingUser.is_verified) {
      const hash = await bcrypt.hash(password, 10);
      await run('UPDATE users SET name = ?, password = ? WHERE id = ?', [trimmedName, hash, existingUser.id]);

      // Invalidate old signup OTPs
      await run('UPDATE otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0', [normEmail, 'signup']);

      const otp = genOTP();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await run('INSERT INTO otps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)', [normEmail, otp, 'signup', expires]);

      try {
        const emailResult = await sendOTPEmail(normEmail, otp, 'signup');
        return res.json({
          success: true,
          message: 'Account created. OTP sent to your email.',
          requiresOtp: true,
          userId: existingUser.id,
          email: normEmail,
          devOtp: emailResult && emailResult.dev ? otp : (isDev ? otp : undefined)
        });
      } catch (mailErr) {
        console.error('Signup email delivery error:', mailErr.message);
        return res.status(500).json({
          success: false,
          error: 'Unable to send OTP email. Please try again.'
        });
      }
    }

    // Case 3: Brand new user
    const hash = await bcrypt.hash(password, 10);
    const r = await run('INSERT INTO users (name, email, password, is_verified) VALUES (?, ?, ?, 0)', [trimmedName, normEmail, hash]);

    // Invalidate old OTPs for safety
    await run('UPDATE otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0', [normEmail, 'signup']);

    const otp = genOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await run('INSERT INTO otps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)', [normEmail, otp, 'signup', expires]);

    try {
      const emailResult = await sendOTPEmail(normEmail, otp, 'signup');
      return res.json({
        success: true,
        message: 'Account created. OTP sent to your email.',
        requiresOtp: true,
        userId: r.id,
        email: normEmail,
        devOtp: emailResult && emailResult.dev ? otp : (isDev ? otp : undefined)
      });
    } catch (mailErr) {
      console.error('Signup email delivery error:', mailErr.message);
      return res.status(500).json({
        success: false,
        error: 'Unable to send OTP email. Please try again.'
      });
    }
  } catch (e) {
    console.error('Signup error:', e.message);
    return res.status(500).json({ success: false, error: 'Server error during signup' });
  }
});

// VERIFY OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp, purpose = 'signup' } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP required' });
    }
    const normEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const row = await get(
      'SELECT * FROM otps WHERE email = ? AND otp = ? AND purpose = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
      [normEmail, cleanOtp, purpose]
    );
    if (!row) {
      return res.status(400).json({ success: false, error: 'Invalid OTP' });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
    }

    await run('UPDATE otps SET used = 1 WHERE id = ?', [row.id]);
    if (purpose === 'signup' || purpose === 'login') {
      await run('UPDATE users SET is_verified = 1 WHERE email = ?', [normEmail]);
    }
    const user = await get('SELECT id, name, email FROM users WHERE email = ?', [normEmail]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const token = signToken(user);
    return res.json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user
    });
  } catch (e) {
    console.error('Verify OTP error:', e.message);
    return res.status(500).json({ success: false, error: 'Server error during OTP verification' });
  }
});

// RESEND OTP
app.post('/api/auth/resend-otp', authLimiter, async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }
    const normEmail = email.trim().toLowerCase();

    // Invalidate old OTPs for this email/purpose
    await run('UPDATE otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0', [normEmail, purpose]);

    const otp = genOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await run('INSERT INTO otps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)', [normEmail, otp, purpose, expires]);

    const isDev = !cleanCredentials().isConfigured;
    try {
      const emailResult = await sendOTPEmail(normEmail, otp, purpose);
      return res.json({
        success: true,
        message: 'OTP resent successfully.',
        devOtp: emailResult && emailResult.dev ? otp : (isDev ? otp : undefined)
      });
    } catch (mailErr) {
      console.error('Resend OTP email error:', mailErr.message);
      return res.status(500).json({
        success: false,
        error: 'Unable to send OTP email. Please try again.'
      });
    }
  } catch (e) {
    console.error('Resend OTP error:', e.message);
    return res.status(500).json({ success: false, error: 'Server error during OTP resend' });
  }
});

// LOGIN
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !email.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    const normEmail = email.trim().toLowerCase();
    const user = await get('SELECT * FROM users WHERE email = ?', [normEmail]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Your account is not found. Please sign up first.' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Incorrect password' });
    }

    const isDev = !cleanCredentials().isConfigured;

    // If unverified, generate and send fresh OTP
    if (!user.is_verified) {
      await run('UPDATE otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0', [normEmail, 'signup']);

      const otp = genOTP();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await run('INSERT INTO otps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)', [normEmail, otp, 'signup', expires]);

      try {
        const emailResult = await sendOTPEmail(normEmail, otp, 'signup');
        return res.json({
          success: true,
          message: 'Your email is not verified. A new OTP has been sent.',
          requiresOtp: true,
          needVerify: true,
          email: normEmail,
          devOtp: emailResult && emailResult.dev ? otp : (isDev ? otp : undefined)
        });
      } catch (mailErr) {
        console.error('Unverified login email error:', mailErr.message);
        return res.status(500).json({
          success: false,
          error: 'Unable to send OTP email. Please try again.'
        });
      }
    }

    await run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (e) {
    console.error('Login error:', e.message);
    return res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }
    const normEmail = email.trim().toLowerCase();
    const user = await get('SELECT id FROM users WHERE email = ?', [normEmail]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Your account is not found.' });
    }

    await run('UPDATE otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0', [normEmail, 'forgot']);

    const otp = genOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await run('INSERT INTO otps (email, otp, purpose, expires_at) VALUES (?, ?, ?, ?)', [normEmail, otp, 'forgot', expires]);

    const isDev = !cleanCredentials().isConfigured;
    try {
      const emailResult = await sendOTPEmail(normEmail, otp, 'forgot');
      return res.json({
        success: true,
        message: 'Verification code sent to your email.',
        email: normEmail,
        devOtp: emailResult && emailResult.dev ? otp : (isDev ? otp : undefined)
      });
    } catch (mailErr) {
      console.error('Forgot password email error:', mailErr.message);
      return res.status(500).json({
        success: false,
        error: 'Unable to send OTP email. Please try again.'
      });
    }
  } catch (e) {
    console.error('Forgot password error:', e.message);
    return res.status(500).json({ success: false, error: 'Server error during forgot password' });
  }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    const normEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();
    const row = await get(
      'SELECT * FROM otps WHERE email = ? AND otp = ? AND purpose = ? AND used = 0 ORDER BY created_at DESC LIMIT 1',
      [normEmail, cleanOtp, 'forgot']
    );
    if (!row) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Verification code expired' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password = ? WHERE email = ?', [hash, normEmail]);
    await run('UPDATE otps SET used = 1 WHERE id = ?', [row.id]);
    return res.json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (e) {
    console.error('Reset password error:', e.message);
    return res.status(500).json({ success: false, error: 'Server error during password reset' });
  }
});

// CURRENT USER (ME)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await get('SELECT id, name, email, is_verified, created_at, last_login FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({ success: true, user });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ADMIN: list users
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await all('SELECT id, name, email, is_verified, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, count: users.length, users });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// AI Proxy — Secure, uses server's OPENROUTER key
const OPENROUTER_KEY = (process.env.OPENROUTER_API_KEY || '').trim();
const GEMINI_KEY = (process.env.GEMINI_API_KEY || '').trim();

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, context, lang } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
    const fullPrompt = context
      ? `Context document:\n"""${String(context).slice(0, 12000)}"""\n\nTask: ${prompt}\n\nYou are AITutor for Telangana Intermediate (TS Inter) students (MPC/BiPC/CEC/MEC/HEC). Answer clearly with steps, Telugu mix allowed if user used Telugu. Align to board blueprint (2M/4M/8M).`
      : prompt;

    if (!OPENROUTER_KEY && !GEMINI_KEY) {
      return res.json({
        demo: true,
        text: `Demo AITutor: You asked "${prompt.slice(0, 120)}..." — Add OPENROUTER_API_KEY in backend/.env to enable real AI.`
      });
    }

    if (OPENROUTER_KEY) {
      const model = req.body.model || 'openai/gpt-4o-mini';
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': process.env.DOMAIN || 'https://mahicouragw.github.io',
          'X-Title': 'Study Vision AI'
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: fullPrompt }], temperature: 0.7, max_tokens: 2048 })
      });
      if (!r.ok) {
        const t = await r.text();
        console.error('OpenRouter proxy error', t.slice(0, 500));
        return res.status(502).json({ success: false, error: 'AI provider error', detail: t.slice(0, 400) });
      }
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content || '';
      return res.json({ success: true, text, model, provider: 'openrouter' });
    }

    if (GEMINI_KEY) {
      const model = 'gemini-1.5-flash';
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } })
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(502).json({ success: false, error: 'Gemini error', detail: t.slice(0, 400) });
      }
      const j = await r.json();
      const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.json({ success: true, text, model, provider: 'gemini' });
    }
  } catch (e) {
    console.error('AI chat error:', e);
    return res.status(500).json({ success: false, error: 'AI error', detail: e.message });
  }
});

// AI Quiz generator via server
app.post('/api/ai/quiz', async (req, res) => {
  try {
    const { docText, subject, type, count, diff, lang, stream, year } = req.body;
    if (!docText) return res.status(400).json({ success: false, error: 'docText required' });
    const prompt = `You are expert TS/AP Inter ${stream || 'MPC'} ${year || 'Inter'} ${subject || 'General'} teacher. Create ${count || 10} REAL IPE exam-style questions of type "${type || 'mcq'}" in ${lang || 'English'} (difficulty ${diff || 'Medium — Understand+Apply'}). CRITICAL: Read the ENTIRE document below (ALL chapters, all answers) and create blueprint-accurate questions. Generate like real apps: MCQ must have 4 plausible shuffled options (one correct), 2M very short, 4M short with example, 8M long with steps. Return ONLY JSON array with objects {q: "question text in ${lang || 'English'}", options: ["A","B","C","D"] (exactly 4 for MCQ, [] for theory), answerIndex: 0-3, explanation: "concise why correct, in ${lang}", marks: 1 for MCQ else 2/4/8}. Do NOT return "What is main idea of Page 1" — create real conceptual questions. Document: """${String(docText).slice(0, 15000)}"""`;
    if (!OPENROUTER_KEY) return res.status(503).json({ success: false, error: 'AI not configured on server — add OPENROUTER_API_KEY in Render Env', demo: true });

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': process.env.DOMAIN || 'https://mahicouragw.github.io',
        'X-Title': 'Study Vision AI'
      },
      body: JSON.stringify({ model: 'openai/gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.75, max_tokens: 3800 })
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Quiz AI error', t.slice(0, 600));
      return res.status(502).json({ success: false, error: 'Quiz AI error', detail: t.slice(0, 500) });
    }
    const j = await r.json();
    let text = j.choices?.[0]?.message?.content || '[]';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    const toParse = jsonMatch ? jsonMatch[0] : cleaned;
    let parsed;
    try {
      parsed = JSON.parse(toParse);
      if (!Array.isArray(parsed) && parsed.questions) parsed = parsed.questions;
    } catch (e) {
      console.warn('Quiz JSON parse failed', e, text.slice(0, 500));
      return res.json({ text, raw: true, error: 'JSON parse failed' });
    }
    parsed = parsed.slice(0, count || 10).map(q => {
      if (q.options && q.options.length === 4) {
        if (typeof q.answerIndex !== 'number' || q.answerIndex < 0 || q.answerIndex > 3) q.answerIndex = 0;
      }
      return q;
    });
    res.json({ success: true, questions: parsed, provider: 'openrouter', model: 'openai/gpt-4o-mini' });
  } catch (e) {
    console.error('AI quiz error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Sitemap
app.get('/sitemap.xml', (req, res) => {
  const domain = process.env.DOMAIN || 'https://mahicouragw.github.io';
  const base = `${domain}/Help-studies-fish`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><lastmod>${new Date().toISOString().split('T')[0]}</lastmod><priority>1.0</priority></url>
  <url><loc>${base}/#library</loc><priority>0.8</priority></url>
  <url><loc>${base}/#quiz</loc><priority>0.8</priority></url>
  <url><loc>${base}/#scan</loc><priority>0.7</priority></url>
</urlset>`;
  res.header('Content-Type', 'application/xml').send(xml);
});

app.get('/robots.txt', (req, res) => {
  const domain = process.env.DOMAIN || 'https://mahicouragw.github.io';
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${domain}/Help-studies-fish/sitemap.xml\n`);
});

// Google Search Console verification file
app.get('/google*.html', (req, res) => {
  const token = process.env.GSC_VERIFICATION_TOKEN;
  if (token && req.path.includes(token)) {
    res.type('text/html').send(`google-site-verification: ${token}`);
  } else {
    res.status(404).send('Not found');
  }
});

// Fallback to frontend for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Express general error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Study Vision AI Backend running on http://0.0.0.0:${PORT}`);
    console.log(`📚 Frontend served from ${frontendPath}`);
    console.log(`🔐 Auth: signup / login / forgot with OTP`);
    console.log(`🗄️  SQLite: ${require('./db').DB_PATH}`);
    if (!process.env.GMAIL_USER || process.env.GMAIL_USER.includes('your.email')) {
      console.log('⚠️  Set GMAIL_USER & GMAIL_APP_PASSWORD in backend/.env to send real emails (currently in dev mode)');
    }
  });
});

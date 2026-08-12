const nodemailer = require('nodemailer');

function cleanCredentials() {
  const user = (process.env.GMAIL_USER || '').trim().toLowerCase();
  // Strip spaces, dashes, quotes, and newlines
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/[\s\-_"'\r\n]/g, '');
  
  const isPlaceholder = !user || !pass ||
    user.includes('your.email') ||
    user.includes('example.com') ||
    pass.includes('your-app-password') ||
    pass === 'abcdefghijklmnop' ||
    pass.length < 8;

  return { user, pass, isConfigured: !isPlaceholder };
}

function createTransporter() {
  const { user, pass, isConfigured } = cleanCredentials();

  if (!isConfigured) {
    return null;
  }

  // Use service 'gmail' with TLS settings and timeouts
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,   // 10s
    socketTimeout: 15000      // 15s
  });
}

async function sendOTPEmail(to, otp, purpose = 'signup') {
  const { user, pass, isConfigured } = cleanCredentials();

  const subject = purpose === 'forgot'
    ? '🔐 Inter AI Study Buddy — Password Reset OTP'
    : '✅ Inter AI Study Buddy — Verify Your Email';

  const actionText = purpose === 'forgot' ? 'password reset' : 'email verification';

  const html = `
  <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#ffffff">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;color:white;text-align:center">
      <h1 style="margin:0;font-size:22px;font-weight:700">Study Vision AI</h1>
      <p style="margin:6px 0 0;opacity:.95;font-size:13px">AITutor — Accessible Study Companion for TS Inter</p>
    </div>
    <div style="padding:28px 24px;background:#ffffff">
      <p style="font-size:16px;color:#1e293b;margin:0 0 12px">Namaste! 👋</p>
      <p style="font-size:14px;color:#334155;line-height:1.6;margin:0 0 20px">Your 6-digit OTP for <b>${actionText}</b> is:</p>
      <div style="text-align:center;margin:24px 0">
        <span style="font-size:34px;letter-spacing:10px;font-weight:800;color:#4f46e5;background:#eef2ff;padding:14px 24px;border-radius:14px;display:inline-block;border:2px dashed #c7d2fe;font-family:Consolas,Monaco,monospace">${otp}</span>
      </div>
      <p style="font-size:13px;color:#475569;margin:16px 0 6px">⏰ Valid for <b>10 minutes</b>. Please do not share this code with anyone.</p>
      <p style="font-size:13px;color:#64748b;margin:0">If you did not request this OTP, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 16px">
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">Sent via Study Vision AI • Auto email from ${user || 'noreply@inter-ai.dev'}</p>
    </div>
  </div>`;

  const text = `Your Study Vision AI OTP is ${otp} — valid for 10 minutes. Purpose: ${actionText}.`;

  if (!isConfigured) {
    console.log('\n========================================');
    console.log('⚠️  GMAIL not configured or placeholder used — OTP logged (dev mode)');
    console.log(`To: ${to}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`OTP: ${otp}`);
    console.log(`Subject: ${subject}`);
    console.log('========================================\n');
    return { dev: true, otp, success: true };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { dev: true, otp, success: true };
  }

  const mailOptions = {
    from: `"Study Vision AI" <${user}>`,
    to,
    subject,
    html,
    text
  };

  // 12s application timeout
  const timeoutMs = 12000;
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('SMTP timeout: Email sending took longer than 12 seconds'));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  });

  try {
    const info = await Promise.race([
      transporter.sendMail(mailOptions),
      timeoutPromise
    ]);
    console.log(`✅ OTP email sent successfully to ${to} (Message ID: ${info.messageId || 'ok'})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Failed to send OTP email to ${to}:`, err.message);
    throw err;
  }
}

module.exports = { sendOTPEmail, createTransporter, cleanCredentials };

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'');
  if (!user || !pass || user.includes('your.email')) {
    console.log('⚠️  GMAIL not configured — OTP will be logged to console (dev mode)');
    return null;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
  transporter.verify((err) => {
    if (err) console.error('Email verify failed:', err.message);
    else console.log('✅ Gmail SMTP ready for', user);
  });
  return transporter;
}

async function sendOTPEmail(to, otp, purpose='verification') {
  const transporter = getTransporter();
  const subject = purpose === 'forgot'
    ? '🔐 Inter AI Study Buddy — Password Reset OTP'
    : '✅ Inter AI Study Buddy — Verify Your Email';
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:20px;color:white;text-align:center">
      <h1 style="margin:0;font-size:20px">Inter AI Study Buddy</h1>
      <p style="margin:6px 0 0;opacity:.9;font-size:13px">AITutor — TS Inter 1st & 2nd Year</p>
    </div>
    <div style="padding:24px;background:#fff">
      <p style="font-size:15px;color:#1e293b">Namaste! 👋</p>
      <p style="font-size:14px;color:#334155">Your <b>${purpose === 'forgot' ? 'password reset' : 'verification'}</b> OTP is:</p>
      <div style="text-align:center;margin:20px 0">
        <span style="font-size:32px;letter-spacing:8px;font-weight:800;color:#4f46e5;background:#eef2ff;padding:12px 20px;border-radius:12px;display:inline-block;border:1px dashed #c7d2fe">${otp}</span>
      </div>
      <p style="font-size:13px;color:#64748b">⏰ Valid for <b>10 minutes</b>. Don't share with anyone.</p>
      <p style="font-size:13px;color:#64748b">If you didn't request this, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0">
      <p style="font-size:12px;color:#94a3b8;text-align:center">Sent via Inter AI Study Buddy • Secunderabad • Auto email from ${process.env.GMAIL_USER || 'noreply@inter-ai.dev'}</p>
    </div>
  </div>`;

  if (!transporter) {
    console.log(`\n========== DEV OTP EMAIL ==========`);
    console.log(`To: ${to}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`OTP: ${otp}`);
    console.log(`Subject: ${subject}`);
    console.log(`====================================\n`);
    return { dev: true, otp };
  }

  const info = await transporter.sendMail({
    from: `"Inter AI Study Buddy" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text: `Your Inter AI Study Buddy OTP is ${otp} — valid 10 minutes. Purpose: ${purpose}`
  });
  console.log('📧 OTP email sent to', to, 'msgId', info.messageId);
  return info;
}

module.exports = { sendOTPEmail, getTransporter };

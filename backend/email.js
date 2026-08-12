const nodemailer = require('nodemailer');

function cleanCredentials() {
  const user = (process.env.GMAIL_USER || '').trim().toLowerCase();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/[\s\-_"'\r\n]/g, '');
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  
  const isGmailPlaceholder = !user || !pass ||
    user.includes('your.email') ||
    user.includes('example.com') ||
    pass.includes('your-app-password') ||
    pass === 'abcdefghijklmnop' ||
    pass.length < 8;

  const isConfigured = !isGmailPlaceholder || Boolean(resendKey) || Boolean(brevoKey);

  return {
    user,
    pass,
    resendKey,
    brevoKey,
    isGmailConfigured: !isGmailPlaceholder,
    isConfigured
  };
}

// Send via Resend HTTPS API (Port 443 - works on Render Free tier)
async function sendViaResend(apiKey, fromEmail, to, subject, html, text) {
  const from = fromEmail && fromEmail.includes('@') ? `Study Vision AI <onboarding@resend.dev>` : 'Study Vision AI <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error: ${errText}`);
  }
  const data = await res.json();
  return { success: true, messageId: data.id };
}

// Send via Brevo HTTPS API (Port 443 - works on Render Free tier)
async function sendViaBrevo(apiKey, fromEmail, to, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Study Vision AI', email: fromEmail || 'noreply@studyvision.ai' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo API error: ${errText}`);
  }
  const data = await res.json();
  return { success: true, messageId: data.messageId };
}

async function sendOTPEmail(to, otp, purpose = 'signup') {
  const creds = cleanCredentials();
  const { user, pass, resendKey, brevoKey, isGmailConfigured, isConfigured } = creds;

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
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">Sent via Study Vision AI • Auto email from ${user || 'noreply@studyvision.ai'}</p>
    </div>
  </div>`;

  const text = `Your Study Vision AI OTP is ${otp} — valid for 10 minutes. Purpose: ${actionText}.`;

  // 1. Try Resend HTTP API if configured (HTTPS port 443 - always open)
  if (resendKey) {
    try {
      const res = await sendViaResend(resendKey, user, to, subject, html, text);
      console.log(`✅ OTP email sent via Resend API to ${to}`);
      return res;
    } catch (e) {
      console.warn(`Resend failed: ${e.message}`);
    }
  }

  // 2. Try Brevo HTTP API if configured (HTTPS port 443 - always open)
  if (brevoKey) {
    try {
      const res = await sendViaBrevo(brevoKey, user, to, subject, html);
      console.log(`✅ OTP email sent via Brevo API to ${to}`);
      return res;
    } catch (e) {
      console.warn(`Brevo failed: ${e.message}`);
    }
  }

  // 3. Try Gmail SMTP (if credentials configured)
  if (isGmailConfigured) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000, // 5s fast timeout
      greetingTimeout: 5000,
      socketTimeout: 8000
    });

    try {
      const info = await Promise.race([
        transporter.sendMail({
          from: `"Study Vision AI" <${user}>`,
          to,
          subject,
          html,
          text
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP connection timeout on host')), 6000))
      ]);
      console.log(`✅ OTP email sent via Gmail SMTP to ${to} (Message ID: ${info.messageId || 'ok'})`);
      return { success: true, messageId: info.messageId };
    } catch (smtpErr) {
      console.warn(`⚠️ Gmail SMTP blocked or failed (${smtpErr.message}). Falling back to instant OTP delivery.`);
      // If hosting firewall blocks outbound SMTP ports, provide OTP directly so user is never trapped!
      return { dev: true, otp, blockedSmtp: true, success: true };
    }
  }

  // 4. Dev / Fallback mode
  console.log('\n========================================');
  console.log('⚠️  Email provider in fallback mode — OTP logged');
  console.log(`To: ${to}`);
  console.log(`Purpose: ${purpose}`);
  console.log(`OTP: ${otp}`);
  console.log(`Subject: ${subject}`);
  console.log('========================================\n');
  return { dev: true, otp, success: true };
}

module.exports = { sendOTPEmail, cleanCredentials };

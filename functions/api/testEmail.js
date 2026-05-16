import nodemailer from 'nodemailer';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import { adminAuth, assertAuth, HttpsError } from '../lib/firebase.js';

const EMAIL_SMTP_PASSWORD = defineSecret('EMAIL_SMTP_PASSWORD');
const EMAIL_SMTP_USER = defineSecret('EMAIL_SMTP_USER');
const EMAIL_FROM_ADDRESS = defineSecret('EMAIL_FROM_ADDRESS');

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getCallerEmail(request, uid) {
  const tokenEmail = cleanEmail(request.auth?.token?.email);
  if (tokenEmail) return tokenEmail;

  const user = await adminAuth.getUser(uid);
  return cleanEmail(user.email);
}

function getSmtpConfig() {
  const user = cleanEmail(process.env.EMAIL_SMTP_USER || process.env.EMAIL_FROM_ADDRESS);
  const pass = process.env.EMAIL_SMTP_PASSWORD;
  const fromAddress = cleanEmail(process.env.EMAIL_FROM_ADDRESS || user);
  const fromName = String(process.env.EMAIL_FROM_NAME || 'Showmaster').trim();

  if (!user || !pass || !fromAddress) {
    throw new HttpsError(
      'failed-precondition',
      'Email test sender is not configured. Set EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD, and EMAIL_FROM_ADDRESS as Firebase Functions secrets.'
    );
  }

  return {
    host: String(process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com').trim(),
    port: Number(process.env.EMAIL_SMTP_PORT || 465),
    secure: String(process.env.EMAIL_SMTP_SECURE || 'true') !== 'false',
    user,
    pass,
    from: fromName ? `"${fromName.replace(/"/g, '')}" <${fromAddress}>` : fromAddress,
  };
}

function buildTestTemplate({ displayName, toEmail }) {
  const safeName = escapeHtml(displayName || 'there');
  const safeEmail = escapeHtml(toEmail);
  const sentAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Edmonton',
  });

  const subject = 'Showmaster test email';
  const text = [
    `Hi ${displayName || 'there'},`,
    '',
    'This is a Showmaster test email from the Settings page.',
    `Recipient: ${toEmail}`,
    `Sent: ${sentAt} America/Edmonton`,
    '',
    'If this arrived, the temporary email sender is working.',
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:28px;">
        <p style="margin:0 0 12px;font-size:14px;color:#64748b;">Showmaster email test</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0f172a;">Your email setup is working</h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi ${safeName}, this template email was sent from the Settings page.</p>
        <div style="margin:20px 0;padding:16px;background:#f1f5f9;border-radius:8px;font-size:14px;line-height:1.5;">
          <strong>Recipient:</strong> ${safeEmail}<br>
          <strong>Sent:</strong> ${escapeHtml(sentAt)} America/Edmonton
        </div>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#475569;">If this arrived, the temporary SMTP sender is ready for testing templates and transactional email flows.</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

export const sendTestEmail = onCall({
  region: 'us-central1',
  secrets: [EMAIL_SMTP_PASSWORD, EMAIL_SMTP_USER, EMAIL_FROM_ADDRESS],
}, async (request) => {
  const callerUid = assertAuth(request);
  const toEmail = await getCallerEmail(request, callerUid);

  if (!toEmail) {
    throw new HttpsError('failed-precondition', 'Your signed-in account does not have an email address.');
  }

  const config = getSmtpConfig();
  const displayName = String(request.auth?.token?.name || '').trim();
  const template = buildTestTemplate({ displayName, toEmail });
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to: toEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return {
      ok: true,
      to: toEmail,
      messageId: info.messageId || null,
    };
  } catch (err) {
    throw new HttpsError('internal', err?.message || 'Failed to send test email.');
  }
});

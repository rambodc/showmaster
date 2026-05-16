import nodemailer from 'nodemailer';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from './firebase.js';

export const EMAIL_SMTP_PASSWORD = defineSecret('EMAIL_SMTP_PASSWORD');
export const EMAIL_SMTP_USER = defineSecret('EMAIL_SMTP_USER');
export const EMAIL_FROM_ADDRESS = defineSecret('EMAIL_FROM_ADDRESS');
export const EMAIL_SECRETS = [EMAIL_SMTP_PASSWORD, EMAIL_SMTP_USER, EMAIL_FROM_ADDRESS];

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

function getSmtpConfig() {
  const user = cleanEmail(process.env.EMAIL_SMTP_USER || process.env.EMAIL_FROM_ADDRESS);
  const pass = process.env.EMAIL_SMTP_PASSWORD;
  const fromAddress = cleanEmail(process.env.EMAIL_FROM_ADDRESS || user);
  const fromName = String(process.env.EMAIL_FROM_NAME || 'Showmaster').trim();

  if (!user || !pass || !fromAddress) {
    throw new HttpsError(
      'failed-precondition',
      'Email sender is not configured. Set EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD, and EMAIL_FROM_ADDRESS as Firebase Functions secrets.'
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

function shell({ title, body, actionLabel, actionUrl, footer }) {
  const action = actionUrl && actionLabel
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700;">${escapeHtml(actionLabel)}</a></p>`
    : '';
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:28px;">
        <p style="margin:0 0 12px;font-size:14px;color:#64748b;">Showmaster</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0f172a;">${escapeHtml(title)}</h1>
        <div style="font-size:16px;line-height:1.55;color:#334155;">${body}</div>
        ${action}
        <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b;">${escapeHtml(footer || 'This message was sent by Showmaster.')}</p>
      </div>
    </div>
  </body>
</html>`;
}

const templates = {
  inviteRegistration(data = {}) {
    const inviterName = data.inviterName || 'A Showmaster user';
    const context = data.contextLabel ? ` for ${data.contextLabel}` : '';
    const title = `Finish your Showmaster registration${context}`;
    const body = [
      `<p style="margin:0 0 14px;">${escapeHtml(inviterName)} invited you to Showmaster${escapeHtml(context)}.</p>`,
      '<p style="margin:0 0 14px;">Create your password and profile to access your work.</p>',
      '<p style="margin:0;">This invite expires in 7 days and can only be used once.</p>',
    ].join('');
    return {
      subject: title,
      text: [
        `${inviterName} invited you to Showmaster${context}.`,
        '',
        'Finish registration:',
        data.inviteUrl || '',
        '',
        'This invite expires in 7 days and can only be used once.',
      ].join('\n'),
      html: shell({
        title,
        body,
        actionLabel: 'Finish registration',
        actionUrl: data.inviteUrl,
        footer: 'If you were not expecting this invite, you can ignore this email.',
      }),
    };
  },

  existingUserAccess(data = {}) {
    const context = data.contextLabel ? `: ${data.contextLabel}` : '';
    const title = `You have new Showmaster access${context}`;
    const body = [
      `<p style="margin:0 0 14px;">${escapeHtml(data.inviterName || 'A Showmaster user')} granted you access${escapeHtml(context)}.</p>`,
      '<p style="margin:0;">Sign in to Showmaster to continue.</p>',
    ].join('');
    return {
      subject: title,
      text: [
        `${data.inviterName || 'A Showmaster user'} granted you access${context}.`,
        '',
        'Sign in:',
        data.signInUrl || '',
      ].join('\n'),
      html: shell({
        title,
        body,
        actionLabel: 'Open Showmaster',
        actionUrl: data.signInUrl,
      }),
    };
  },

  verificationCode(data = {}) {
    const title = 'Your Showmaster verification code';
    const code = String(data.code || '').trim();
    const body = `<p style="margin:0 0 14px;">Use this code to continue:</p><p style="font-size:28px;letter-spacing:4px;font-weight:700;margin:0;">${escapeHtml(code)}</p>`;
    return {
      subject: title,
      text: `Your Showmaster verification code is ${code}`,
      html: shell({ title, body, footer: 'This code expires shortly.' }),
    };
  },

  notification(data = {}) {
    const title = data.title || 'Showmaster notification';
    const message = data.message || '';
    return {
      subject: title,
      text: message,
      html: shell({
        title,
        body: `<p style="margin:0;">${escapeHtml(message)}</p>`,
        actionLabel: data.actionLabel,
        actionUrl: data.actionUrl,
      }),
    };
  },
};

export async function sendEmail({ to, subject, text, html, replyTo }) {
  const recipient = cleanEmail(to);
  if (!recipient || !subject || (!text && !html)) {
    throw new HttpsError('invalid-argument', 'Email recipient, subject, and body are required.');
  }

  const config = getSmtpConfig();
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
      to: recipient,
      subject,
      text,
      html,
      replyTo,
    });
    return { messageId: info.messageId || null };
  } catch (err) {
    throw new HttpsError('internal', err?.message || 'Failed to send email.');
  }
}

export async function sendTemplatedEmail({ templateId, to, data, replyTo }) {
  const template = templates[templateId];
  if (!template) throw new HttpsError('invalid-argument', 'Unknown email template.');
  return sendEmail({ to, ...template(data), replyTo });
}

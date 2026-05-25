import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canAccessJob, db, FieldValue, HttpsError } from '../lib/firebase.js';
import { EMAIL_SECRETS, sendTemplatedEmail } from '../lib/email.js';

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function publicBaseUrl(request) {
  const configured = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const origin = String(request.rawRequest?.get?.('origin') || '').trim().replace(/\/$/, '');
  return origin || 'https://showmaster1-f1a9f.web.app';
}

async function getJobAccess(uid, showId, jobId) {
  const managerAccess = await canAccessJob(uid, showId, jobId);
  if (managerAccess) return { allowed: true, senderRole: 'manager', member: null };

  const memberSnap = await db.collection('shows').doc(showId)
    .collection('jobs').doc(jobId)
    .collection('members').doc(uid)
    .get();
  if (!memberSnap.exists) return { allowed: false, senderRole: null, member: null };
  return { allowed: true, senderRole: 'company', member: memberSnap.data() || {} };
}

function cleanAttachment(input = {}) {
  const fileName = cleanText(input.fileName, 240);
  const storagePath = cleanText(input.storagePath, 1000);
  const downloadUrl = cleanText(input.downloadUrl, 2000);
  if (!fileName || !storagePath || !downloadUrl) return null;
  return {
    fileId: cleanText(input.fileId, 160) || null,
    fileName,
    contentType: cleanText(input.contentType, 120) || 'application/octet-stream',
    size: Math.max(0, Number(input.size || 0)),
    storagePath,
    downloadUrl,
  };
}

async function userSummary(uid) {
  const snap = await db.collection('users').doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  return {
    email: cleanEmail(data.email),
    name: name || data.email || '',
  };
}

async function managerRecipients(showId, jobId, job = {}) {
  const recipients = new Map();
  if (job.createdBy) {
    const creator = await userSummary(job.createdBy);
    if (creator.email) recipients.set(creator.email, creator.name);
  }

  const managerSnap = await db.collection('shows').doc(showId).collection('managers').get();
  managerSnap.docs.forEach((doc) => {
    const manager = doc.data() || {};
    const hasJobAccess = manager.managerRole === 'full_manager'
      || (manager.featureAccess?.jobs === true && manager.jobAccess?.mode === 'all')
      || (
        manager.featureAccess?.jobs === true
        && Array.isArray(manager.jobAccess?.jobIds)
        && manager.jobAccess.jobIds.includes(jobId)
      );
    const email = cleanEmail(manager.email);
    if (hasJobAccess && email) recipients.set(email, manager.displayName || email);
  });

  return [...recipients.entries()].map(([email, name]) => ({ email, name }));
}

async function companyRecipients(showId, jobId) {
  const memberSnap = await db.collection('shows').doc(showId)
    .collection('jobs').doc(jobId)
    .collection('members')
    .where('status', '==', 'active')
    .get();
  return memberSnap.docs
    .map((doc) => doc.data() || {})
    .map((member) => ({
      email: cleanEmail(member.email),
      name: member.displayName || member.email || '',
    }))
    .filter((item) => item.email);
}

async function notifyRecipients({ recipients, senderName, showName, jobTitle, messageBody, jobUrl }) {
  let sentCount = 0;
  let failedCount = 0;
  const results = [];

  await Promise.all(recipients.map(async (recipient) => {
    try {
      const result = await sendTemplatedEmail({
        templateId: 'jobMessageNotification',
        to: recipient.email,
        data: {
          senderName,
          showName,
          jobTitle,
          messageBody,
          jobUrl,
        },
      });
      sentCount += 1;
      results.push({ email: recipient.email, status: 'sent', messageId: result.messageId || null });
    } catch (err) {
      failedCount += 1;
      results.push({ email: recipient.email, status: 'failed', error: err?.message || 'Failed to send.' });
    }
  }));

  return { sentCount, failedCount, recipients: results };
}

export const sendJobMessage = onCall({
  region: 'us-central1',
  secrets: EMAIL_SECRETS,
}, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);
  const body = cleanText(request.data?.body, 10000);
  const attachments = Array.isArray(request.data?.attachments)
    ? request.data.attachments.slice(0, 12).map(cleanAttachment).filter(Boolean)
    : [];

  if (!showId || !jobId) {
    throw new HttpsError('invalid-argument', 'showId and jobId are required.');
  }
  if (!body && !attachments.length) {
    throw new HttpsError('invalid-argument', 'Message text or attachments are required.');
  }
  const expectedPathPrefix = `shows/${showId}/jobs/${jobId}/message-files/`;
  if (attachments.some((attachment) => !attachment.storagePath.startsWith(expectedPathPrefix))) {
    throw new HttpsError('invalid-argument', 'Attachment path is invalid.');
  }

  const access = await getJobAccess(callerUid, showId, jobId);
  if (!access.allowed) throw new HttpsError('permission-denied', 'Not allowed for this job.');

  const showSnap = await db.collection('shows').doc(showId).get();
  const jobSnap = await db.collection('shows').doc(showId).collection('jobs').doc(jobId).get();
  if (!showSnap.exists || !jobSnap.exists) throw new HttpsError('not-found', 'Job not found.');
  const show = showSnap.data() || {};
  const job = jobSnap.data() || {};
  const user = await userSummary(callerUid);
  const member = access.member || {};
  const senderEmail = user.email || cleanEmail(member.email);
  const senderName = user.name || member.displayName || senderEmail || callerUid;
  const now = FieldValue.serverTimestamp();
  const messageRef = db.collection('shows').doc(showId).collection('jobs').doc(jobId).collection('messages').doc();
  const cleanAttachments = attachments.map((attachment) => ({
    ...attachment,
    fileId: attachment.fileId || db.collection('_').doc().id,
  }));

  const recipients = access.senderRole === 'manager'
    ? await companyRecipients(showId, jobId)
    : await managerRecipients(showId, jobId, job);
  const jobUrl = `${publicBaseUrl(request)}/shows/${showId}/jobs/${jobId}`;
  const emailResult = recipients.length
    ? await notifyRecipients({
      recipients,
      senderName,
      showName: show.name || 'Showmaster',
      jobTitle: job.title || 'Job',
      messageBody: body,
      jobUrl,
    })
    : { sentCount: 0, failedCount: 0, recipients: [] };

  const batch = db.batch();
  batch.set(messageRef, {
    body,
    senderId: callerUid,
    senderEmail,
    senderName,
    senderRole: access.senderRole,
    audience: 'external',
    attachments: cleanAttachments,
    email: {
      attempted: recipients.length > 0,
      sentCount: emailResult.sentCount,
      failedCount: emailResult.failedCount,
      recipients: emailResult.recipients,
      sentAt: recipients.length ? now : null,
    },
    ai: { extracted: false, documentTypes: [], summary: null },
    createdBy: callerUid,
    createdAt: now,
  });

  cleanAttachments.forEach((attachment) => {
    batch.set(db.collection('shows').doc(showId).collection('jobs').doc(jobId).collection('files').doc(attachment.fileId), {
      ...attachment,
      messageId: messageRef.id,
      uploadedBy: callerUid,
      uploadedByRole: access.senderRole,
      ai: { extracted: false, documentType: null, summary: null, fields: null },
      createdAt: now,
    });
  });

  batch.set(db.collection('shows').doc(showId).collection('jobs').doc(jobId), {
    lastMessageAt: now,
    lastMessageBy: callerUid,
    updatedAt: now,
  }, { merge: true });

  await batch.commit();
  return {
    ok: true,
    messageId: messageRef.id,
    email: {
      attempted: recipients.length > 0,
      sentCount: emailResult.sentCount,
      failedCount: emailResult.failedCount,
    },
  };
});

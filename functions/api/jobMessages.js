import { onCall } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { assertAuth, canAccessJob, db, FieldValue, HttpsError } from '../lib/firebase.js';
import { EMAIL_SECRETS, sendTemplatedEmail } from '../lib/email.js';

const MAX_ATTACHMENT_COUNT = 8;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 16 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PDF_TYPE = 'application/pdf';

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
    kind: input.kind === 'image' ? 'image' : (input.kind === 'pdf' ? 'pdf' : 'file'),
    fileName,
    contentType: cleanText(input.contentType, 120) || 'application/octet-stream',
    size: Math.max(0, Number(input.size || 0)),
    storagePath,
    downloadUrl,
    thumbnailPath: cleanText(input.thumbnailPath, 1000) || null,
    thumbnailUrl: cleanText(input.thumbnailUrl, 2000) || null,
    width: Math.max(0, Number(input.width || 0)) || null,
    height: Math.max(0, Number(input.height || 0)) || null,
  };
}

function inferUploadContentType(fileName, contentType) {
  const type = cleanText(contentType, 120).toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(type) || type === PDF_TYPE) return type;
  const name = cleanText(fileName, 240).toLowerCase();
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (/\.png$/.test(name)) return 'image/png';
  if (/\.webp$/.test(name)) return 'image/webp';
  if (/\.gif$/.test(name)) return 'image/gif';
  if (/\.pdf$/.test(name)) return PDF_TYPE;
  return type || 'application/octet-stream';
}

function cleanUpload(input = {}) {
  const fileName = cleanText(input.fileName, 240);
  const contentType = inferUploadContentType(fileName, input.contentType);
  const dataBase64 = cleanText(input.dataBase64, MAX_ATTACHMENT_BYTES * 2);
  const size = Math.max(0, Number(input.size || 0));
  if (!fileName || !dataBase64) return null;
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new HttpsError('invalid-argument', 'Each attachment must be 8 MB or smaller.');
  }
  if (!ALLOWED_IMAGE_TYPES.has(contentType) && contentType !== PDF_TYPE) {
    throw new HttpsError('invalid-argument', 'Only image and PDF attachments are allowed.');
  }
  return {
    fileId: cleanText(input.fileId, 160) || randomUUID(),
    fileName,
    contentType,
    size,
    dataBase64,
  };
}

function cleanFileName(value) {
  const name = cleanText(value, 240).replace(/[^a-zA-Z0-9._-]+/g, '-');
  return name || 'attachment';
}

function fileNameWithExtension(fileName, extension) {
  const safe = cleanFileName(fileName);
  const base = safe.includes('.') ? safe.slice(0, safe.lastIndexOf('.')) : safe;
  return `${base || 'attachment'}.${extension}`;
}

function downloadUrlFor(bucketName, filePath, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

function isPdfBuffer(buffer) {
  return buffer.subarray(0, 5).toString('utf8') === '%PDF-';
}

async function saveFile({ bucket, path, buffer, contentType, cacheControl = 'private,max-age=3600' }) {
  const token = randomUUID();
  await bucket.file(path).save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return downloadUrlFor(bucket.name, path, token);
}

async function buildImageAttachment({ bucket, showId, jobId, batchId, upload, buffer }) {
  let image;
  try {
    image = sharp(buffer, { animated: false, limitInputPixels: 40_000_000 }).rotate();
    await image.metadata();
  } catch (err) {
    throw new HttpsError('invalid-argument', 'Attachment image is invalid or unsupported.');
  }

  const full = await image
    .clone()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumb = await image
    .clone()
    .resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const fileName = fileNameWithExtension(upload.fileName, 'jpg');
  const storagePath = `shows/${showId}/jobs/${jobId}/message-files/${batchId}/${upload.fileId}-${fileName}`;
  const thumbnailPath = `shows/${showId}/jobs/${jobId}/message-files/${batchId}/${upload.fileId}-thumb-${fileName}`;
  const [downloadUrl, thumbnailUrl] = await Promise.all([
    saveFile({ bucket, path: storagePath, buffer: full.data, contentType: 'image/jpeg', cacheControl: 'private,max-age=86400' }),
    saveFile({ bucket, path: thumbnailPath, buffer: thumb, contentType: 'image/jpeg', cacheControl: 'private,max-age=86400' }),
  ]);

  const cid = `${upload.fileId}@showmaster-message`;
  return {
    attachment: {
      fileId: upload.fileId,
      kind: 'image',
      fileName,
      contentType: 'image/jpeg',
      size: full.data.length,
      storagePath,
      downloadUrl,
      thumbnailPath,
      thumbnailUrl,
      width: full.info.width || null,
      height: full.info.height || null,
    },
    emailAttachment: {
      fileId: upload.fileId,
      filename: `thumb-${fileName}`,
      content: thumb,
      contentType: 'image/jpeg',
      cid,
    },
    emailCid: cid,
  };
}

async function buildPdfAttachment({ bucket, showId, jobId, batchId, upload, buffer }) {
  if (!isPdfBuffer(buffer)) {
    throw new HttpsError('invalid-argument', 'Attachment PDF is invalid.');
  }

  const fileName = fileNameWithExtension(upload.fileName, 'pdf');
  const storagePath = `shows/${showId}/jobs/${jobId}/message-files/${batchId}/${upload.fileId}-${fileName}`;
  const downloadUrl = await saveFile({
    bucket,
    path: storagePath,
    buffer,
    contentType: PDF_TYPE,
    cacheControl: 'private,max-age=3600',
  });

  return {
    attachment: {
      fileId: upload.fileId,
      kind: 'pdf',
      fileName,
      contentType: PDF_TYPE,
      size: buffer.length,
      storagePath,
      downloadUrl,
    },
  };
}

function unpackProcessedAttachments(results) {
  return {
    attachments: results.map((item) => item.attachment).filter(Boolean),
    emailAttachments: results.map((item) => item.emailAttachment).filter(Boolean),
    emailCidByFileId: new Map(
      results
        .filter((item) => item.attachment?.fileId && item.emailCid)
        .map((item) => [item.attachment.fileId, item.emailCid])
    ),
  };
}

async function saveUploadedAttachments({ showId, jobId, batchId, uploads }) {
  if (!uploads.length) {
    return { attachments: [], emailAttachments: [], emailCidByFileId: new Map() };
  }

  const totalBytes = uploads.reduce((sum, item) => sum + item.size, 0);
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new HttpsError('invalid-argument', 'Total message attachments must be 16 MB or smaller.');
  }

  const bucket = getStorage().bucket();
  const results = await Promise.all(uploads.map(async (upload) => {
    const buffer = Buffer.from(upload.dataBase64, 'base64');
    if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) {
      throw new HttpsError('invalid-argument', 'Attachment upload is invalid or too large.');
    }

    if (ALLOWED_IMAGE_TYPES.has(upload.contentType)) {
      return buildImageAttachment({ bucket, showId, jobId, batchId, upload, buffer });
    }
    if (upload.contentType === PDF_TYPE) {
      return buildPdfAttachment({ bucket, showId, jobId, batchId, upload, buffer });
    }
    throw new HttpsError('invalid-argument', 'Only image and PDF attachments are allowed.');
  }));

  return unpackProcessedAttachments(results);
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
  const recipients = new Map();
  const jobRef = db.collection('shows').doc(showId).collection('jobs').doc(jobId);

  const companySnap = await jobRef.collection('widgets').doc('company').get();
  const company = companySnap.exists ? companySnap.data() || {} : {};
  const companyEmail = cleanEmail(company.email);
  if (companyEmail) recipients.set(companyEmail, company.name || companyEmail);

  const contactSnap = await jobRef
    .collection('widgets').doc('company')
    .collection('contacts')
    .get();
  contactSnap.docs.forEach((doc) => {
    const contact = doc.data() || {};
    const email = cleanEmail(contact.email);
    if (email) recipients.set(email, contact.displayName || email);
  });

  const memberSnap = await db.collection('shows').doc(showId)
    .collection('jobs').doc(jobId)
    .collection('members')
    .where('status', '==', 'active')
    .get();
  memberSnap.docs.forEach((doc) => {
    const member = doc.data() || {};
    const email = cleanEmail(member.email);
    if (email) recipients.set(email, member.displayName || email);
  });

  return [...recipients.entries()].map(([email, name]) => ({ email, name }));
}

async function notifyRecipients({ recipients, senderName, showName, jobTitle, messageBody, jobUrl, attachments, emailAttachments }) {
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
          attachments,
          emailInlineAttachments: emailAttachments,
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

function withEmailCids(attachments, emailCidByFileId) {
  return attachments.map((attachment) => {
    const emailCid = emailCidByFileId.get(attachment.fileId);
    return emailCid ? { ...attachment, emailCid } : attachment;
  });
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
    ? request.data.attachments.slice(0, MAX_ATTACHMENT_COUNT).map(cleanAttachment).filter(Boolean)
    : [];
  const uploads = Array.isArray(request.data?.fileUploads)
    ? request.data.fileUploads.slice(0, MAX_ATTACHMENT_COUNT).map(cleanUpload).filter(Boolean)
    : [];

  if (!showId || !jobId) {
    throw new HttpsError('invalid-argument', 'showId and jobId are required.');
  }
  if (!body && !attachments.length && !uploads.length) {
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
  const batchId = cleanText(request.data?.batchId, 160) || messageRef.id;
  const uploaded = await saveUploadedAttachments({ showId, jobId, batchId, uploads });
  const cleanAttachments = [...attachments, ...uploaded.attachments].map((attachment) => ({
    ...attachment,
    fileId: attachment.fileId || db.collection('_').doc().id,
  }));
  const emailAttachments = uploaded.emailAttachments || [];
  const emailTemplateAttachments = withEmailCids(cleanAttachments, uploaded.emailCidByFileId || new Map());

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
      attachments: emailTemplateAttachments,
      emailAttachments,
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

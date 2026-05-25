import { onCall } from 'firebase-functions/v2/https';
import { assertAuth, canAccessJob, canUseManagerFeature, db, FieldValue, HttpsError } from '../lib/firebase.js';
import { defaultCompanySummary, defaultJobSummary } from '../lib/jobDefaults.js';

function cleanText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function cleanStatus(value, fallback = 'draft') {
  const status = cleanText(value, 80);
  return status || fallback;
}

function cleanCompany(input = {}) {
  return {
    name: cleanText(input.name, 240),
    legalName: cleanText(input.legalName, 240),
    type: cleanText(input.type, 120),
    email: cleanEmail(input.email),
    phone: cleanText(input.phone, 80),
    website: cleanText(input.website, 240),
    logoUrls: input.logoUrls && typeof input.logoUrls === 'object' ? {
      sm: cleanText(input.logoUrls.sm, 1000),
      md: cleanText(input.logoUrls.md, 1000),
      lg: cleanText(input.logoUrls.lg, 1000),
    } : null,
    address: cleanText(input.address, 1000),
    notes: cleanText(input.notes, 5000),
    status: cleanStatus(input.status),
  };
}

function cleanContact(input = {}) {
  const firstName = cleanText(input.firstName, 120);
  const lastName = cleanText(input.lastName, 120);
  const displayName = cleanText(input.displayName, 240) || `${firstName} ${lastName}`.trim();
  return {
    firstName,
    lastName,
    displayName,
    email: cleanEmail(input.email),
    phone: cleanText(input.phone, 80),
    title: cleanText(input.title, 160),
    notes: cleanText(input.notes, 2000),
    isPrimary: Boolean(input.isPrimary),
  };
}

async function assertCanManageJobs(uid, showId) {
  const allowed = await canUseManagerFeature(uid, showId, 'jobs');
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');
}

async function assertCanManageJob(uid, showId, jobId) {
  const allowed = await canAccessJob(uid, showId, jobId);
  if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this job.');
}

export const createJob = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const title = cleanText(request.data?.title, 240);
  const description = cleanText(request.data?.description, 5000);

  if (!showId || !title) {
    throw new HttpsError('invalid-argument', 'showId and title are required.');
  }

  await assertCanManageJobs(callerUid, showId);

  const now = FieldValue.serverTimestamp();
  const jobRef = db.collection('shows').doc(showId).collection('jobs').doc();
  const batch = db.batch();
  batch.set(jobRef, {
    ...defaultJobSummary(),
    title,
    description,
    type: cleanText(request.data?.type, 120) || 'general',
    status: cleanStatus(request.data?.status),
    priority: cleanText(request.data?.priority, 80) || 'normal',
    createdBy: callerUid,
    updatedBy: callerUid,
    createdAt: now,
    updatedAt: now,
  });

  const company = request.data?.company ? cleanCompany(request.data.company) : null;
  if (company && (company.name || company.email || company.phone || company.website || company.notes)) {
    batch.set(jobRef.collection('widgets').doc('company'), {
      ...company,
      updatedBy: callerUid,
      updatedAt: now,
    }, { merge: true });
    batch.set(jobRef, {
      'widgetSummary.company': {
        ...defaultCompanySummary(),
        name: company.name,
        status: company.status,
        logoUrls: company.logoUrls,
      },
    }, { merge: true });
  }

  await batch.commit();

  return { ok: true, jobId: jobRef.id };
});

export const updateJob = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);

  if (!showId || !jobId) {
    throw new HttpsError('invalid-argument', 'showId and jobId are required.');
  }

  await assertCanManageJob(callerUid, showId, jobId);

  const patch = {
    updatedBy: callerUid,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (request.data?.title !== undefined) patch.title = cleanText(request.data.title, 240);
  if (request.data?.description !== undefined) patch.description = cleanText(request.data.description, 5000);
  if (request.data?.type !== undefined) patch.type = cleanText(request.data.type, 120) || 'general';
  if (request.data?.status !== undefined) patch.status = cleanStatus(request.data.status);
  if (request.data?.priority !== undefined) patch.priority = cleanText(request.data.priority, 80) || 'normal';

  if (patch.title !== undefined && !patch.title) {
    throw new HttpsError('invalid-argument', 'Job title is required.');
  }

  await db.collection('shows').doc(showId).collection('jobs').doc(jobId).set(patch, { merge: true });
  return { ok: true };
});

export const updateJobCompany = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);

  if (!showId || !jobId) {
    throw new HttpsError('invalid-argument', 'showId and jobId are required.');
  }

  await assertCanManageJob(callerUid, showId, jobId);

  const company = cleanCompany(request.data?.company || {});
  const now = FieldValue.serverTimestamp();
  const jobRef = db.collection('shows').doc(showId).collection('jobs').doc(jobId);
  const companyRef = jobRef.collection('widgets').doc('company');

  const batch = db.batch();
  batch.set(companyRef, {
    ...company,
    updatedBy: callerUid,
    updatedAt: now,
  }, { merge: true });
  batch.set(jobRef, {
    'widgetConfig.company': { enabled: true, status: 'active' },
    'widgetSummary.company': {
      ...defaultCompanySummary(),
      name: company.name,
      status: company.status,
      logoUrls: company.logoUrls,
    },
    updatedBy: callerUid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();

  return { ok: true };
});

export const addJobCompanyContact = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);

  if (!showId || !jobId) {
    throw new HttpsError('invalid-argument', 'showId and jobId are required.');
  }

  await assertCanManageJob(callerUid, showId, jobId);

  const contact = cleanContact(request.data?.contact || {});
  if (!contact.displayName && !contact.email) {
    throw new HttpsError('invalid-argument', 'Contact name or email is required.');
  }

  const now = FieldValue.serverTimestamp();
  const jobRef = db.collection('shows').doc(showId).collection('jobs').doc(jobId);
  const contactRef = jobRef.collection('widgets').doc('company').collection('contacts').doc();
  const batch = db.batch();
  batch.set(contactRef, {
    ...contact,
    createdBy: callerUid,
    updatedBy: callerUid,
    createdAt: now,
    updatedAt: now,
  });
  if (contact.isPrimary) {
    batch.set(jobRef, {
      'widgetSummary.company.primaryContactName': contact.displayName,
      'widgetSummary.company.primaryContactEmail': contact.email,
      updatedBy: callerUid,
      updatedAt: now,
    }, { merge: true });
  }
  await batch.commit();
  return { ok: true, contactId: contactRef.id };
});

export const updateJobCompanyContact = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);
  const contactId = cleanText(request.data?.contactId, 160);

  if (!showId || !jobId || !contactId) {
    throw new HttpsError('invalid-argument', 'showId, jobId, and contactId are required.');
  }

  await assertCanManageJob(callerUid, showId, jobId);

  const contact = cleanContact(request.data?.contact || {});
  if (!contact.displayName && !contact.email) {
    throw new HttpsError('invalid-argument', 'Contact name or email is required.');
  }

  const now = FieldValue.serverTimestamp();
  const jobRef = db.collection('shows').doc(showId).collection('jobs').doc(jobId);
  const contactRef = jobRef.collection('widgets').doc('company').collection('contacts').doc(contactId);
  const batch = db.batch();
  batch.set(contactRef, {
    ...contact,
    updatedBy: callerUid,
    updatedAt: now,
  }, { merge: true });
  if (contact.isPrimary) {
    batch.set(jobRef, {
      'widgetSummary.company.primaryContactName': contact.displayName,
      'widgetSummary.company.primaryContactEmail': contact.email,
      updatedBy: callerUid,
      updatedAt: now,
    }, { merge: true });
  }
  await batch.commit();
  return { ok: true };
});

export const removeJobCompanyContact = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  const showId = cleanText(request.data?.showId, 160);
  const jobId = cleanText(request.data?.jobId, 160);
  const contactId = cleanText(request.data?.contactId, 160);

  if (!showId || !jobId || !contactId) {
    throw new HttpsError('invalid-argument', 'showId, jobId, and contactId are required.');
  }

  await assertCanManageJob(callerUid, showId, jobId);

  await db.collection('shows').doc(showId)
    .collection('jobs').doc(jobId)
    .collection('widgets').doc('company')
    .collection('contacts').doc(contactId)
    .delete();

  return { ok: true };
});

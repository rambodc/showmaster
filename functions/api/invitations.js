import crypto from 'crypto';
import { onCall } from 'firebase-functions/v2/https';
import { adminAuth, assertAuth, assertSuperAdmin, canAccessJob, canManageShow, canUseManagerFeature, db, FieldValue, getSystemRole, HttpsError } from '../lib/firebase.js';
import { EMAIL_SECRETS, sendTemplatedEmail } from '../lib/email.js';
import { applyInternalUserAccess, applyJobMemberAccess, applyManagerAccess, cleanEmail, cleanText, ensureUserDoc, findUserByEmail } from '../lib/inviteAccess.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function targetKey(target = {}) {
  if (target.type === 'manager') {
    return ['manager', cleanText(target.showId, 160), cleanText(target.managerRole, 80) || 'custom_manager'].join(':');
  }
  if (target.type === 'job_member') {
    return ['job_member', cleanText(target.showId, 160), cleanText(target.jobId, 160)].join(':');
  }
  return 'internal';
}

function baseUrlFromRequest(request) {
  const configured = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const origin = String(request.rawRequest?.get?.('origin') || '').trim().replace(/\/$/, '');
  return origin || 'https://showmaster1-f1a9f.web.app';
}

async function inviterName(uid) {
  const snap = await db.collection('users').doc(uid).get();
  const user = snap.exists ? snap.data() || {} : {};
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'A Showmaster user';
}

async function contextForTarget(target = {}) {
  if (target.type === 'manager' && target.showId) {
    const showSnap = await db.collection('shows').doc(target.showId).get();
    const show = showSnap.exists ? showSnap.data() || {} : {};
    return {
      label: show.name || 'a show',
      redirectPath: `/shows/${target.showId}/jobs`,
    };
  }
  if (target.type === 'job_member' && target.showId && target.jobId) {
    const showSnap = await db.collection('shows').doc(target.showId).get();
    const jobSnap = await db.collection('shows').doc(target.showId).collection('jobs').doc(target.jobId).get();
    const show = showSnap.exists ? showSnap.data() || {} : {};
    const job = jobSnap.exists ? jobSnap.data() || {} : {};
    return {
      label: [show.name, job.title].filter(Boolean).join(' / ') || 'a job',
      redirectPath: `/shows/${target.showId}/jobs/${target.jobId}`,
    };
  }
  return { label: 'Showmaster', redirectPath: '/shows' };
}

function publicInvite(invite = {}) {
  return {
    email: invite.email || '',
    status: invite.status || 'pending',
    type: invite.type || 'internal',
    expiresAt: invite.expiresAt?.toMillis?.() || null,
    contextLabel: invite.contextLabel || 'Showmaster',
    redirectPath: invite.redirectPath || '/shows',
  };
}

async function assertCanInvite(callerUid, target = {}) {
  const role = await getSystemRole(callerUid);
  if (target.type === 'internal') {
    await assertSuperAdmin(callerUid);
    return;
  }
  if (target.type === 'manager') {
    const showId = cleanText(target.showId, 160);
    if (!showId) throw new HttpsError('invalid-argument', 'showId is required.');
    if (role === 'super_admin') return;
    const allowed = await canUseManagerFeature(callerUid, showId, 'managers');
    if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this show.');
    if (target.managerRole === 'full_manager') {
      const full = await canManageShow(callerUid, showId);
      if (!full) throw new HttpsError('permission-denied', 'Full manager required to assign full manager access.');
    }
    return;
  }
  if (target.type === 'job_member') {
    const showId = cleanText(target.showId, 160);
    const jobId = cleanText(target.jobId, 160);
    if (!showId || !jobId) throw new HttpsError('invalid-argument', 'showId and jobId are required.');
    if (role === 'super_admin') return;
    const hasJobsFeature = await canUseManagerFeature(callerUid, showId, 'jobs');
    if (!hasJobsFeature) throw new HttpsError('permission-denied', 'Only admins and managers can invite job members.');
    const allowed = await canAccessJob(callerUid, showId, jobId);
    if (!allowed) throw new HttpsError('permission-denied', 'Not allowed for this job.');
    return;
  }
  throw new HttpsError('invalid-argument', 'Invalid invite target.');
}

async function applyTargetAccess({ uid, email, target, callerUid, firstName, lastName }) {
  if (target.type === 'internal') {
    await applyInternalUserAccess({ uid, email, firstName, lastName, createdBy: callerUid });
    return { redirectPath: '/shows', contextLabel: 'Showmaster' };
  }
  if (target.type === 'manager') {
    const result = await applyManagerAccess({
      uid,
      showId: cleanText(target.showId, 160),
      managerRole: cleanText(target.managerRole, 80) || 'custom_manager',
      featureAccess: target.featureAccess || {},
      jobAccess: target.jobAccess || {},
      addedBy: callerUid,
    });
    return { redirectPath: `/shows/${target.showId}/jobs`, contextLabel: result.show.name || 'a show' };
  }
  if (target.type === 'job_member') {
    const result = await applyJobMemberAccess({
      uid,
      showId: cleanText(target.showId, 160),
      jobId: cleanText(target.jobId, 160),
      companyName: target.companyName,
      displayName: target.displayName,
      invitedBy: callerUid,
    });
    return {
      redirectPath: `/shows/${target.showId}/jobs/${target.jobId}`,
      contextLabel: [result.show.name, result.job.title].filter(Boolean).join(' / ') || 'a job',
    };
  }
  throw new HttpsError('invalid-argument', 'Invalid invite target.');
}

export const previewInvite = onCall({ region: 'us-central1' }, async (request) => {
  const hash = tokenHash(request.data?.token);
  if (!hash) throw new HttpsError('invalid-argument', 'Invite token is required.');

  const snap = await db.collection('invitations').where('tokenHash', '==', hash).limit(1).get();
  if (snap.empty) throw new HttpsError('not-found', 'Invite not found.');
  const invite = snap.docs[0].data() || {};
  if (invite.status === 'accepted') throw new HttpsError('failed-precondition', 'Invite already accepted.');
  if (invite.status === 'expired') throw new HttpsError('deadline-exceeded', 'Invite expired.');
  if (invite.expiresAt?.toMillis?.() && invite.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('deadline-exceeded', 'Invite expired.');
  }
  return { invite: publicInvite(invite) };
});

export const inviteUser = onCall({
  region: 'us-central1',
  secrets: EMAIL_SECRETS,
}, async (request) => {
  const callerUid = assertAuth(request);
  const email = cleanEmail(request.data?.email);
  const target = request.data?.target || { type: 'internal' };
  if (!email) throw new HttpsError('invalid-argument', 'Email is required.');
  await assertCanInvite(callerUid, target);

  const existing = await findUserByEmail(email);
  const baseUrl = baseUrlFromRequest(request);
  const inviter = await inviterName(callerUid);
  const context = await contextForTarget(target);

  if (existing) {
    await ensureUserDoc(existing.uid, email, existing.user || {});
    const applied = await applyTargetAccess({ uid: existing.uid, email, target, callerUid });
    await sendTemplatedEmail({
      templateId: 'existingUserAccess',
      to: email,
      data: {
        inviterName: inviter,
        contextLabel: applied.contextLabel || context.label,
        signInUrl: `${baseUrl}${applied.redirectPath || context.redirectPath || '/shows'}`,
      },
    });
    return { ok: true, mode: 'existing', uid: existing.uid, email };
  }

  const token = makeToken();
  const key = targetKey(target);
  const pendingSnap = await db.collection('invitations')
    .where('email', '==', email)
    .where('status', '==', 'pending')
    .limit(20)
    .get();
  const existingPending = pendingSnap.docs.find((item) => item.data()?.targetKey === key);
  const inviteId = existingPending ? existingPending.id : crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const inviteUrl = `${baseUrl}/invite/${token}`;
  const invitePayload = {
    inviteId,
    email,
    status: 'pending',
    type: target.type || 'internal',
    target,
    targetKey: key,
    tokenHash: tokenHash(token),
    contextLabel: context.label,
    redirectPath: context.redirectPath,
    createdBy: callerUid,
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt,
  };
  if (!existingPending) invitePayload.createdAt = FieldValue.serverTimestamp();
  else {
    invitePayload.resentAt = FieldValue.serverTimestamp();
    invitePayload.resentBy = callerUid;
  }
  await db.collection('invitations').doc(inviteId).set(invitePayload, { merge: true });
  await sendTemplatedEmail({
    templateId: 'inviteRegistration',
    to: email,
    data: {
      inviterName: inviter,
      contextLabel: context.label,
      inviteUrl,
    },
  });
  return { ok: true, mode: 'invited', inviteId, email };
});

export const resendInvite = onCall({
  region: 'us-central1',
  secrets: EMAIL_SECRETS,
}, async (request) => {
  const callerUid = assertAuth(request);
  const inviteId = cleanText(request.data?.inviteId, 160);
  if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId is required.');
  const ref = db.collection('invitations').doc(inviteId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Invite not found.');
  const invite = snap.data() || {};
  if (invite.status !== 'pending') throw new HttpsError('failed-precondition', 'Only pending invites can be resent.');
  await assertCanInvite(callerUid, invite.target || { type: invite.type });

  const token = makeToken();
  const baseUrl = baseUrlFromRequest(request);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await ref.set({
    tokenHash: tokenHash(token),
    expiresAt,
    updatedAt: FieldValue.serverTimestamp(),
    resentAt: FieldValue.serverTimestamp(),
    resentBy: callerUid,
  }, { merge: true });
  await sendTemplatedEmail({
    templateId: 'inviteRegistration',
    to: invite.email,
    data: {
      inviterName: await inviterName(callerUid),
      contextLabel: invite.contextLabel,
      inviteUrl: `${baseUrl}/invite/${token}`,
    },
  });
  return { ok: true };
});

export const acceptInvite = onCall({ region: 'us-central1' }, async (request) => {
  const hash = tokenHash(request.data?.token);
  const firstName = cleanText(request.data?.firstName, 120);
  const lastName = cleanText(request.data?.lastName, 120);
  const password = String(request.data?.password || '');
  if (!hash || !firstName || !lastName || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Invite token, name, and password are required.');
  }

  const snap = await db.collection('invitations').where('tokenHash', '==', hash).limit(1).get();
  if (snap.empty) throw new HttpsError('not-found', 'Invite not found.');
  const doc = snap.docs[0];
  const invite = doc.data() || {};
  if (invite.status === 'accepted') throw new HttpsError('failed-precondition', 'Invite already accepted.');
  if (invite.status === 'expired') throw new HttpsError('deadline-exceeded', 'Invite expired.');
  if (invite.expiresAt?.toMillis?.() && invite.expiresAt.toMillis() < Date.now()) {
    await doc.ref.set({ status: 'expired', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw new HttpsError('deadline-exceeded', 'Invite expired.');
  }

  const email = cleanEmail(invite.email);
  const existing = await findUserByEmail(email);
  if (existing) throw new HttpsError('already-exists', 'This email is already registered. Sign in instead.');

  const created = await adminAuth.createUser({
    email,
    password,
    emailVerified: false,
    displayName: `${firstName} ${lastName}`.trim(),
  });
  await ensureUserDoc(created.uid, email, { firstName, lastName });
  await applyTargetAccess({
    uid: created.uid,
    email,
    target: invite.target || { type: invite.type || 'internal' },
    callerUid: invite.createdBy,
    firstName,
    lastName,
  });
  await doc.ref.set({
    status: 'accepted',
    acceptedAt: FieldValue.serverTimestamp(),
    acceptedBy: created.uid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  let customToken = null;
  try {
    customToken = await adminAuth.createCustomToken(created.uid);
  } catch (err) {
    console.error('Failed to create invite sign-in token:', err);
  }

  return {
    ok: true,
    uid: created.uid,
    email,
    customToken,
    requiresSignIn: !customToken,
    redirectPath: invite.redirectPath || '/shows',
  };
});

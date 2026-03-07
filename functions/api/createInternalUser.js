import { onCall } from 'firebase-functions/v2/https';
import { adminAuth, assertAuth, assertSuperAdmin, db, FieldValue, HttpsError } from '../lib/firebase.js';

export const createInternalUser = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = assertAuth(request);
  await assertSuperAdmin(callerUid);

  const firstName = String(request.data?.firstName || '').trim();
  const lastName = String(request.data?.lastName || '').trim();
  const email = String(request.data?.email || '').trim().toLowerCase();
  const tempPassword = String(request.data?.tempPassword || '').trim();

  if (!firstName || !lastName || !email || tempPassword.length < 8) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  try {
    const created = await adminAuth.createUser({
      email,
      password: tempPassword,
      emailVerified: false,
      displayName: `${firstName} ${lastName}`.trim(),
    });

    await db.collection('users').doc(created.uid).set({
      uid: created.uid,
      email,
      firstName,
      lastName,
      systemRole: 'user',
      createdBy: callerUid,
      primaryAuthUid: created.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const passwordResetLink = await adminAuth.generatePasswordResetLink(email);

    return {
      uid: created.uid,
      email,
      passwordResetLink,
    };
  } catch (err) {
    const msg = String(err?.message || 'Failed to create user.');
    if (msg.includes('serviceusage.services.use') || msg.includes('USER_PROJECT_DENIED')) {
      throw new HttpsError(
        'failed-precondition',
        'Function service account is missing Service Usage Consumer role (roles/serviceusage.serviceUsageConsumer).'
      );
    }
    throw new HttpsError('internal', msg);
  }
});

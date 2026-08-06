const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc } = require('firebase/firestore');
const { ref, getBytes, uploadString } = require('firebase/storage');

let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-showmaster',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
    storage: { rules: fs.readFileSync('storage.rules', 'utf8') },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/alex'), { uid: 'alex', displayName: 'Alex' });
  });
});

test.after(async () => environment?.cleanup());

test('a user can read only their own server-managed profile', async () => {
  const alex = environment.authenticatedContext('alex').firestore();
  const sam = environment.authenticatedContext('sam').firestore();
  assert.equal((await assertSucceeds(getDoc(doc(alex, 'users/alex')))).data().displayName, 'Alex');
  await assertFails(getDoc(doc(sam, 'users/alex')));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'users/alex')));
});

test('clients cannot create or update profiles', async () => {
  const alex = environment.authenticatedContext('alex').firestore();
  await assertFails(setDoc(doc(alex, 'users/alex'), { displayName: 'Changed' }));
  await assertFails(setDoc(doc(alex, 'users/new'), { uid: 'new' }));
});

test('storage denies every client read and write', async () => {
  const storage = environment.authenticatedContext('alex').storage();
  await assertFails(uploadString(ref(storage, 'users/alex/avatar.txt'), 'nope'));
  await assertFails(getBytes(ref(storage, 'users/alex/avatar.txt')));
});

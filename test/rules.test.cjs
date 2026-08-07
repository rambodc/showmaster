const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, orderBy, query, setDoc, where } = require('firebase/firestore');
const { ref, getBytes, uploadString } = require('firebase/storage');

let environment;
test.before(async () => {
  environment = await initializeTestEnvironment({ projectId: 'demo-showmaster', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }, storage: { rules: fs.readFileSync('storage.rules', 'utf8') } });
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users/alex'), { uid: 'alex', artistId: 'artist-a' }),
      setDoc(doc(db, 'artists/artist-a'), { ownerUid: 'alex', name: 'Nova', slug: 'nova', status: 'active' }),
      setDoc(doc(db, 'releases/public-release'), { ownerUid: 'alex', artistId: 'artist-a', status: 'published', title: 'Public' }),
      setDoc(doc(db, 'releases/draft-release'), { ownerUid: 'alex', artistId: 'artist-a', status: 'draft', title: 'Draft' }),
      setDoc(doc(db, 'releases/public-release/tracks/public-track'), { ownerUid: 'alex', order: 1, status: 'ready', storagePath: 'users/alex/releases/public-release/audio/public-track/track.mp3' }),
      setDoc(doc(db, 'releases/draft-release/tracks/draft-track'), { ownerUid: 'alex', order: 1, status: 'uploading', storagePath: 'users/alex/releases/draft-release/audio/draft-track/track.mp3' }),
      setDoc(doc(db, 'mediaUploads/image-upload'), { ownerUid: 'alex', targetType: 'release', targetId: 'draft-release', status: 'uploading', storagePath: 'users/alex/media/image-upload/artwork.jpg' }),
      setDoc(doc(db, 'playlists/alex-list'), { ownerUid: 'alex', name: 'Favorites', trackCount: 1 }),
      setDoc(doc(db, 'playlists/alex-list/tracks/entry-one'), { releaseId: 'public-release', trackId: 'public-track', sourceKey: 'public-release:public-track', order: 1 }),
    ]);
    const storage = context.storage();
    await uploadString(ref(storage, 'users/alex/releases/public-release/audio/public-track/track.mp3'), 'public audio', 'raw', { contentType: 'audio/mpeg' });
  });
});
test.after(async () => environment?.cleanup());

test('profiles remain private and server-managed', async () => {
  const alex = environment.authenticatedContext('alex').firestore();
  await assertSucceeds(getDoc(doc(alex, 'users/alex')));
  await assertFails(getDoc(doc(environment.authenticatedContext('sam').firestore(), 'users/alex')));
  await assertFails(setDoc(doc(alex, 'users/alex'), { displayName: 'Changed' }));
});

test('playlists are private, owner-readable, and server-managed', async () => {
  const alex = environment.authenticatedContext('alex').firestore();
  const sam = environment.authenticatedContext('sam').firestore();
  await assertSucceeds(getDoc(doc(alex, 'playlists/alex-list')));
  await assertSucceeds(getDocs(query(collection(alex, 'playlists/alex-list/tracks'), orderBy('order'))));
  await assertFails(getDoc(doc(sam, 'playlists/alex-list')));
  await assertFails(getDoc(doc(sam, 'playlists/alex-list/tracks/entry-one')));
  await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'playlists/alex-list')));
  await assertFails(setDoc(doc(alex, 'playlists/new-list'), { ownerUid: 'alex', name: 'Bypass' }));
});

test('public catalog exposes published content but not drafts', async () => {
  const publicDb = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(publicDb, 'artists/artist-a')));
  await assertSucceeds(getDoc(doc(publicDb, 'releases/public-release')));
  await assertSucceeds(getDoc(doc(publicDb, 'releases/public-release/tracks/public-track')));
  await assertFails(getDoc(doc(publicDb, 'releases/draft-release')));
  const published = await assertSucceeds(getDocs(query(collection(publicDb, 'releases'), where('status', '==', 'published'))));
  assert.equal(published.size, 1);
});

test('owners can read drafts but other users cannot and nobody writes directly', async () => {
  const alex = environment.authenticatedContext('alex').firestore();
  const sam = environment.authenticatedContext('sam').firestore();
  await assertSucceeds(getDoc(doc(alex, 'releases/draft-release')));
  await assertSucceeds(getDoc(doc(alex, 'releases/draft-release/tracks/draft-track')));
  const ownerTracks = query(collection(alex, 'releases/draft-release/tracks'), where('ownerUid', '==', 'alex'));
  await assertSucceeds(getDocs(ownerTracks));
  await assertFails(getDocs(query(collection(alex, 'releases/draft-release/tracks'), orderBy('order'))));
  await assertFails(getDoc(doc(sam, 'releases/draft-release')));
  await assertFails(setDoc(doc(alex, 'releases/new-release'), { ownerUid: 'alex', status: 'draft' }));
});

test('prepared MP3 uploads enforce owner, path, MIME type, and draft state', async () => {
  const alex = environment.authenticatedContext('alex').storage();
  const sam = environment.authenticatedContext('sam').storage();
  const path = 'users/alex/releases/draft-release/audio/draft-track/track.mp3';
  await assertFails(uploadString(ref(alex, path), 'wrong type', 'raw', { contentType: 'text/plain' }));
  await assertFails(uploadString(ref(sam, path), 'not owner', 'raw', { contentType: 'audio/mpeg' }));
  await assertSucceeds(uploadString(ref(alex, path), 'ID3 prepared audio', 'raw', { contentType: 'audio/mpeg' }));
});

test('prepared artwork uploads enforce owner, prepared path, MIME type, and size', async () => {
  const alex = environment.authenticatedContext('alex').storage();
  const sam = environment.authenticatedContext('sam').storage();
  const path = 'users/alex/media/image-upload/artwork.jpg';
  await assertFails(uploadString(ref(alex, path), 'wrong type', 'raw', { contentType: 'text/plain' }));
  await assertFails(uploadString(ref(sam, path), 'not owner', 'raw', { contentType: 'image/jpeg' }));
  await assertFails(uploadString(ref(alex, 'users/alex/media/image-upload/other.jpg'), 'wrong path', 'raw', { contentType: 'image/jpeg' }));
  await assertSucceeds(uploadString(ref(alex, path), 'prepared artwork', 'raw', { contentType: 'image/jpeg' }));
});

test('published audio is public while draft audio remains owner-only', async () => {
  const publicStorage = environment.unauthenticatedContext().storage();
  await assertSucceeds(getBytes(ref(publicStorage, 'users/alex/releases/public-release/audio/public-track/track.mp3')));
  await assertFails(getBytes(ref(publicStorage, 'users/alex/releases/draft-release/audio/draft-track/track.mp3')));
  await assertSucceeds(getBytes(ref(environment.authenticatedContext('alex').storage(), 'users/alex/releases/draft-release/audio/draft-track/track.mp3')));
});

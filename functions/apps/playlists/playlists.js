import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { authenticatedCallable } from "../../core/callable.js";
import { db } from "../../core/firebase.js";
import { requireConfirmation, text } from "../../core/validation.js";

export const PLAYLIST_LIMITS = { playlistsPerUser: 20, tracksPerPlaylist: 200 };

const playlistName = (value) => text(value, "name", { min: 1, max: 80 });
const sourceKey = (releaseId, trackId) => `${releaseId}:${trackId}`;
const entryId = (releaseId, trackId) => `${releaseId}_${trackId}`;

async function ownedPlaylist(uid, playlistId) {
  const ref = db.collection("playlists").doc(playlistId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Playlist not found.");
  if (snap.data().ownerUid !== uid)
    throw new HttpsError("permission-denied", "Playlist access denied.");
  return { ref, snap };
}

export async function removePlaylistSource(releaseId, trackId) {
  const key = sourceKey(releaseId, trackId);
  const entries = await db
    .collectionGroup("tracks")
    .where("sourceKey", "==", key)
    .get();
  await Promise.all(
    entries.docs.map((entry) =>
      db.runTransaction(async (transaction) => {
        const playlistRef = entry.ref.parent.parent;
        const [freshEntry, playlist] = await Promise.all([
          transaction.get(entry.ref),
          transaction.get(playlistRef),
        ]);
        if (!freshEntry.exists) return;
        transaction.delete(entry.ref);
        if (playlist.exists)
          transaction.update(playlistRef, {
            trackCount: Math.max(0, (playlist.data().trackCount || 1) - 1),
            updatedAt: FieldValue.serverTimestamp(),
          });
      }),
    ),
  );
}

export async function removeReleaseFromPlaylists(releaseId) {
  const tracks = await db.collection("releases").doc(releaseId).collection("tracks").get();
  await Promise.all(tracks.docs.map((track) => removePlaylistSource(releaseId, track.id)));
}

export const createPlaylist = authenticatedCallable(async (request, auth) => {
  const name = playlistName(request.data?.name);
  const ref = db.collection("playlists").doc();
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(
      db.collection("playlists").where("ownerUid", "==", auth.uid),
    );
    if (existing.size >= PLAYLIST_LIMITS.playlistsPerUser)
      throw new HttpsError("resource-exhausted", "You can create up to 20 playlists.");
    transaction.create(ref, {
      ownerUid: auth.uid,
      name,
      trackCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { playlistId: ref.id, name, trackCount: 0 };
});

export const renamePlaylist = authenticatedCallable(async (request, auth) => {
  const { ref } = await ownedPlaylist(auth.uid, request.data?.playlistId);
  const name = playlistName(request.data?.name);
  await ref.update({ name, updatedAt: FieldValue.serverTimestamp() });
  return { playlistId: ref.id, name };
});

export const deletePlaylist = authenticatedCallable(async (request, auth) => {
  requireConfirmation(request.data?.confirmation, "DELETE PLAYLIST");
  const { ref } = await ownedPlaylist(auth.uid, request.data?.playlistId);
  await db.recursiveDelete(ref);
  return { deleted: true };
});

export const addTrackToPlaylist = authenticatedCallable(async (request, auth) => {
  const { ref } = await ownedPlaylist(auth.uid, request.data?.playlistId);
  const releaseId = text(request.data?.releaseId, "releaseId", { max: 100 });
  const trackId = text(request.data?.trackId, "trackId", { max: 100 });
  const releaseRef = db.collection("releases").doc(releaseId);
  const trackRef = releaseRef.collection("tracks").doc(trackId);
  const destination = ref.collection("tracks").doc(entryId(releaseId, trackId));
  await db.runTransaction(async (transaction) => {
    const [playlist, release, track, existing] = await Promise.all([
      transaction.get(ref), transaction.get(releaseRef),
      transaction.get(trackRef), transaction.get(destination),
    ]);
    if (!playlist.exists || playlist.data().ownerUid !== auth.uid)
      throw new HttpsError("permission-denied", "Playlist access denied.");
    if (!release.exists || release.data().status !== "published")
      throw new HttpsError("failed-precondition", "Only published music can be saved.");
    if (!track.exists || track.data().status !== "ready")
      throw new HttpsError("failed-precondition", "This track is not available.");
    if (existing.exists)
      throw new HttpsError("already-exists", "This track is already in that playlist.");
    const count = playlist.data().trackCount || 0;
    if (count >= PLAYLIST_LIMITS.tracksPerPlaylist)
      throw new HttpsError("resource-exhausted", "A playlist can contain up to 200 tracks.");
    transaction.create(destination, {
      releaseId,
      trackId,
      sourceKey: sourceKey(releaseId, trackId),
      order: count + 1,
      addedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(ref, {
      trackCount: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { playlistId: ref.id, releaseId, trackId };
});

export const removeTrackFromPlaylist = authenticatedCallable(async (request, auth) => {
  const { ref } = await ownedPlaylist(auth.uid, request.data?.playlistId);
  const entry = ref.collection("tracks").doc(request.data?.entryId);
  await db.runTransaction(async (transaction) => {
    const [playlist, snap] = await Promise.all([transaction.get(ref), transaction.get(entry)]);
    if (!snap.exists) throw new HttpsError("not-found", "Playlist track not found.");
    transaction.delete(entry);
    transaction.update(ref, {
      trackCount: Math.max(0, (playlist.data().trackCount || 1) - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { deleted: true };
});

export const reorderPlaylistTracks = authenticatedCallable(async (request, auth) => {
  const { ref } = await ownedPlaylist(auth.uid, request.data?.playlistId);
  const ids = Array.isArray(request.data?.entryIds) ? request.data.entryIds : [];
  const entries = await ref.collection("tracks").get();
  if (ids.length !== entries.size || new Set(ids).size !== ids.length || entries.docs.some((item) => !ids.includes(item.id)))
    throw new HttpsError("invalid-argument", "Playlist order is incomplete.");
  const batch = db.batch();
  ids.forEach((id, index) => batch.update(ref.collection("tracks").doc(id), { order: index + 1 }));
  batch.update(ref, { updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { entryIds: ids };
});

import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { authenticatedCallable } from "../../core/callable.js";
import { getBucket, db } from "../../core/firebase.js";
import {
  genre,
  optionalText,
  requireConfirmation,
  slugify,
  text,
} from "../../core/validation.js";
import { removeReleaseFromPlaylists } from "../playlists/playlists.js";

async function ownedArtist(uid) {
  const user = await db.collection("users").doc(uid).get();
  const artistId = user.data()?.artistId;
  if (!artistId)
    throw new HttpsError(
      "failed-precondition",
      "Create your Virtual Artist first.",
    );
  return artistId;
}
function releasePayload(data) {
  const title = text(data?.title, "title", { min: 1, max: 100 });
  const type = ["single", "album"].includes(data?.type) ? data.type : null;
  if (!type)
    throw new HttpsError("invalid-argument", "Choose single or album.", {
      field: "type",
    });
  return {
    title,
    slug: slugify(title),
    type,
    genre: genre(data?.genre),
    description: optionalText(data?.description, "description", 1000),
    coverPath: optionalText(data?.coverPath, "coverPath", 300),
    rightsConfirmed: data?.rightsConfirmed === true,
  };
}
async function ownedDraft(uid, releaseId) {
  const ref = db.collection("releases").doc(releaseId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Release not found.");
  if (snap.data().ownerUid !== uid)
    throw new HttpsError("permission-denied", "Release access denied.");
  if (snap.data().status !== "draft")
    throw new HttpsError(
      "failed-precondition",
      "Unpublish this release before editing it.",
    );
  return { ref, snap };
}

export const createRelease = authenticatedCallable(async (request, auth) => {
  const artistId = await ownedArtist(auth.uid);
  const payload = releasePayload(request.data);
  const ref = db.collection("releases").doc();
  await ref.create({
    ...payload,
    artistId,
    ownerUid: auth.uid,
    status: "draft",
    trackCount: 0,
    totalBytes: 0,
    publishedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { releaseId: ref.id };
});
export const updateRelease = authenticatedCallable(async (request, auth) => {
  const { ref } = await ownedDraft(auth.uid, request.data?.releaseId);
  const payload = releasePayload(request.data);
  await ref.update({ ...payload, updatedAt: FieldValue.serverTimestamp() });
  return { releaseId: ref.id };
});
export const publishRelease = authenticatedCallable(async (request, auth) => {
  const { ref, snap } = await ownedDraft(auth.uid, request.data?.releaseId);
  const release = snap.data();
  if (!release.rightsConfirmed)
    throw new HttpsError(
      "failed-precondition",
      "Confirm the AI content and rights declaration before publishing.",
      { field: "rightsConfirmed" },
    );
  const tracks = await ref.collection("tracks").orderBy("order").get();
  const ready = tracks.docs.filter((doc) => doc.data().status === "ready");
  if (!ready.length || ready.length !== tracks.size)
    throw new HttpsError(
      "failed-precondition",
      "Every track must finish validation before publishing.",
    );
  if (release.type === "single" && ready.length !== 1)
    throw new HttpsError(
      "failed-precondition",
      "A single must contain exactly one track.",
    );
  const orders = ready.map((doc) => doc.data().order);
  if (new Set(orders).size !== orders.length)
    throw new HttpsError("failed-precondition", "Track order must be unique.");
  await ref.update({
    status: "published",
    trackCount: ready.length,
    totalBytes: ready.reduce((sum, doc) => sum + (doc.data().bytes || 0), 0),
    publishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { releaseId: ref.id, status: "published" };
});
export const unpublishRelease = authenticatedCallable(async (request, auth) => {
  const ref = db.collection("releases").doc(request.data?.releaseId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().ownerUid !== auth.uid)
    throw new HttpsError("permission-denied", "Release access denied.");
  if (snap.data().status !== "published")
    throw new HttpsError(
      "failed-precondition",
      "Only published releases can be unpublished.",
    );
  await ref.update({
    status: "draft",
    publishedAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await removeReleaseFromPlaylists(ref.id);
  return { releaseId: ref.id, status: "draft" };
});
export const deleteRelease = authenticatedCallable(async (request, auth) => {
  requireConfirmation(request.data?.confirmation, "DELETE RELEASE");
  const { ref, snap } = await ownedDraft(auth.uid, request.data?.releaseId);
  const tracks = await ref.collection("tracks").get();
  const storedBytes = tracks.docs.reduce((sum, track) => sum + (track.data().bytes || 0), 0);
  const reservedBytes = tracks.docs.reduce((sum, track) => sum + (track.data().status === "uploading" ? track.data().declaredBytes || 0 : 0), 0);
  let artworkBytes = 0;
  if (snap.data().coverPath) {
    try {
      const [metadata] = await getBucket().file(snap.data().coverPath).getMetadata();
      artworkBytes = Number(metadata.size || 0);
    } catch { artworkBytes = 0; }
  }
  await removeReleaseFromPlaylists(ref.id);
  await getBucket().deleteFiles({
    prefix: `users/${auth.uid}/releases/${ref.id}/`,
  });
  await db.recursiveDelete(ref);
  await db
    .collection("users")
    .doc(auth.uid)
    .set(
      {
        storageBytes: FieldValue.increment(-(storedBytes + artworkBytes)),
        reservedBytes: FieldValue.increment(-reservedBytes),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return { deleted: true };
});

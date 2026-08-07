import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { parseBuffer } from "music-metadata";
import { authenticatedCallable, REGION } from "../../core/callable.js";
import { getBucket, db } from "../../core/firebase.js";
import { LIMITS, text } from "../../core/validation.js";
import { removePlaylistSource } from "../playlists/playlists.js";

async function ownedDraft(uid, releaseId) {
  const ref = db.collection("releases").doc(releaseId);
  const snap = await ref.get();
  if (!snap.exists || snap.data().ownerUid !== uid)
    throw new HttpsError("permission-denied", "Release access denied.");
  if (snap.data().status !== "draft")
    throw new HttpsError(
      "failed-precondition",
      "Unpublish this release before uploading.",
    );
  return ref;
}

export const prepareTrackUpload = authenticatedCallable(
  async (request, auth) => {
    const releaseId = text(request.data?.releaseId, "releaseId", { max: 100 });
    const title = text(request.data?.title, "title", { max: 100 });
    const size = Number(request.data?.size);
    if (!Number.isInteger(size) || size < 1 || size > LIMITS.audioBytes)
      throw new HttpsError(
        "invalid-argument",
        "MP3 files must be 50 MB or smaller.",
        { field: "file" },
      );
    const releaseRef = await ownedDraft(auth.uid, releaseId);
    const trackRef = releaseRef.collection("tracks").doc();
    const userRef = db.collection("users").doc(auth.uid);
    await db.runTransaction(async (transaction) => {
      const [user, tracks] = await Promise.all([
        transaction.get(userRef),
        transaction.get(releaseRef.collection("tracks")),
      ]);
      const used =
        (user.data()?.storageBytes || 0) + (user.data()?.reservedBytes || 0);
      if (used + size > LIMITS.accountBytes)
        throw new HttpsError(
          "resource-exhausted",
          "This upload would exceed your 2 GB account limit.",
        );
      if (tracks.size >= LIMITS.tracksPerRelease)
        throw new HttpsError(
          "resource-exhausted",
          "A release can contain at most 20 tracks.",
        );
      const order = tracks.size + 1;
      const storagePath = `users/${auth.uid}/releases/${releaseId}/audio/${trackRef.id}/track.mp3`;
      transaction.create(trackRef, {
        ownerUid: auth.uid,
        releaseId,
        title,
        order,
        storagePath,
        status: "uploading",
        declaredBytes: size,
        bytes: 0,
        durationSeconds: 0,
        rejectionReason: "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        userRef,
        {
          reservedBytes: FieldValue.increment(size),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return {
      trackId: trackRef.id,
    storagePath: `users/${auth.uid}/releases/${releaseId}/audio/${trackRef.id}/track.mp3`,
      maxBytes: LIMITS.audioBytes,
    };
  },
);

export const prepareImageUpload = authenticatedCallable(
  async (request, auth) => {
    const size = Number(request.data?.size);
    const contentType = request.data?.contentType;
    if (
      !Number.isInteger(size) ||
      size < 1 ||
      size > LIMITS.imageBytes ||
      !["image/jpeg", "image/png", "image/webp"].includes(contentType)
    )
      throw new HttpsError(
        "invalid-argument",
        "Artwork must be a JPEG, PNG, or WebP no larger than 5 MB.",
        { field: "image" },
      );
    const targetType = request.data?.targetType;
    const targetId = request.data?.targetId;
    if (!["artist", "release"].includes(targetType))
      throw new HttpsError("invalid-argument", "Invalid image target.");
    let targetRef;
    if (targetType === "artist") {
      const user = await db.collection("users").doc(auth.uid).get();
      if (user.data()?.artistId !== targetId)
        throw new HttpsError("permission-denied", "Artist access denied.");
      targetRef = db.collection("artists").doc(targetId);
    } else targetRef = await ownedDraft(auth.uid, targetId);
    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[contentType];
    const uploadRef = db.collection("mediaUploads").doc();
  const storagePath = `users/${auth.uid}/media/${uploadRef.id}/artwork.${extension}`;
    const userRef = db.collection("users").doc(auth.uid);
    await db.runTransaction(async (transaction) => {
      const [user, target] = await Promise.all([
        transaction.get(userRef),
        transaction.get(targetRef),
      ]);
      if (!target.exists || target.data().ownerUid !== auth.uid)
        throw new HttpsError("permission-denied", "Media target denied.");
      if (
        (user.data()?.storageBytes || 0) +
          (user.data()?.reservedBytes || 0) +
          size >
        LIMITS.accountBytes
      )
        throw new HttpsError(
          "resource-exhausted",
          "This upload would exceed your 2 GB account limit.",
        );
      transaction.create(uploadRef, {
        ownerUid: auth.uid,
        targetType,
        targetId,
        storagePath,
        contentType,
        declaredBytes: size,
        status: "uploading",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        userRef,
        {
          reservedBytes: FieldValue.increment(size),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return { uploadId: uploadRef.id, storagePath, maxBytes: LIMITS.imageBytes };
  },
);

export const deleteTrack = authenticatedCallable(async (request, auth) => {
  const releaseRef = await ownedDraft(auth.uid, request.data?.releaseId);
  const trackRef = releaseRef.collection("tracks").doc(request.data?.trackId);
  const track = await trackRef.get();
  if (!track.exists || track.data().ownerUid !== auth.uid)
    throw new HttpsError("not-found", "Track not found.");
  await getBucket()
    .file(track.data().storagePath)
    .delete({ ignoreNotFound: true });
  const bytes = track.data().bytes || 0;
  const reserved =
    track.data().status === "uploading" ? track.data().declaredBytes || 0 : 0;
  const batch = db.batch();
  batch.delete(trackRef);
  batch.set(
    db.collection("users").doc(auth.uid),
    {
      storageBytes: FieldValue.increment(-bytes),
      reservedBytes: FieldValue.increment(-reserved),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
  await removePlaylistSource(request.data.releaseId, trackRef.id);
  return { deleted: true };
});

export const updateTrack = authenticatedCallable(async (request, auth) => {
  const releaseRef = await ownedDraft(auth.uid, request.data?.releaseId);
  const trackRef = releaseRef.collection("tracks").doc(request.data?.trackId);
  const track = await trackRef.get();
  if (!track.exists || track.data().ownerUid !== auth.uid)
    throw new HttpsError("not-found", "Track not found.");
  await trackRef.update({
    title: text(request.data?.title, "title", { max: 100 }),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { trackId: trackRef.id };
});

export const reorderTracks = authenticatedCallable(async (request, auth) => {
  const releaseRef = await ownedDraft(auth.uid, request.data?.releaseId);
  const ids = Array.isArray(request.data?.trackIds) ? request.data.trackIds : [];
  const tracks = await releaseRef.collection("tracks").get();
  if (
    ids.length !== tracks.size ||
    new Set(ids).size !== ids.length ||
    tracks.docs.some((track) => !ids.includes(track.id))
  )
    throw new HttpsError("invalid-argument", "Track order is incomplete.");
  const batch = db.batch();
  ids.forEach((id, index) =>
    batch.update(releaseRef.collection("tracks").doc(id), {
      order: index + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );
  await batch.commit();
  return { trackIds: ids };
});

export const validateTrackUpload = onObjectFinalized(
  { region: REGION, memory: "512MiB", timeoutSeconds: 120 },
  async (event) => {
    const bucket = getBucket();
    const match = event.data.name.match(
      /^users\/([^/]+)\/releases\/([^/]+)\/audio\/([^/]+)\/track\.mp3$/,
    );
    if (!match) return;
    const [, uid, releaseId, trackId] = match;
    const trackRef = db
      .collection("releases")
      .doc(releaseId)
      .collection("tracks")
      .doc(trackId);
    const track = await trackRef.get();
    if (!track.exists || track.data().ownerUid !== uid) {
      await bucket.file(event.data.name).delete({ ignoreNotFound: true });
      return;
    }
    const declared = track.data().declaredBytes || 0;
    const actual = Number(event.data.size || 0);
    let durationSeconds = 0;
    let rejectionReason = "";
    try {
      if (
        event.data.contentType !== "audio/mpeg" ||
        actual < 1 ||
        actual > LIMITS.audioBytes
      )
        throw new Error("File must be an MP3 no larger than 50 MB.");
      const [buffer] = await bucket.file(event.data.name).download();
      const metadata = await parseBuffer(buffer, {
        mimeType: "audio/mpeg",
        size: actual,
      });
      durationSeconds = Math.round(metadata.format.duration || 0);
      if (!durationSeconds)
        throw new Error("The MP3 duration could not be read.");
    } catch (error) {
      rejectionReason = error.message || "Invalid MP3 file.";
    }
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(trackRef);
      if (!fresh.exists || fresh.data().status !== "uploading") return;
      transaction.update(trackRef, {
        status: rejectionReason ? "rejected" : "ready",
        bytes: rejectionReason ? 0 : actual,
        durationSeconds,
        rejectionReason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        db.collection("users").doc(uid),
        {
          reservedBytes: FieldValue.increment(-declared),
          storageBytes: FieldValue.increment(rejectionReason ? 0 : actual),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    if (rejectionReason)
      await bucket.file(event.data.name).delete({ ignoreNotFound: true });
  },
);

export const validateImageUpload = onObjectFinalized(
  { region: REGION },
  async (event) => {
    const bucket = getBucket();
    const match = event.data.name.match(
      /^users\/([^/]+)\/media\/([^/]+)\/artwork\.(jpg|png|webp)$/,
    );
    if (!match) return;
    const [, uid, uploadId] = match;
    const uploadRef = db.collection("mediaUploads").doc(uploadId);
    const upload = await uploadRef.get();
    if (
      !upload.exists ||
      upload.data().ownerUid !== uid ||
      upload.data().storagePath !== event.data.name
    ) {
      await bucket.file(event.data.name).delete({ ignoreNotFound: true });
      return;
    }
    const data = upload.data();
    const actual = Number(event.data.size || 0);
    const valid =
      actual > 0 &&
      actual <= LIMITS.imageBytes &&
      ["image/jpeg", "image/png", "image/webp"].includes(
        event.data.contentType,
      );
    if (!valid) {
      await bucket.file(event.data.name).delete({ ignoreNotFound: true });
      const batch = db.batch();
      batch.update(uploadRef, {
        status: "rejected",
        rejectionReason: "Invalid artwork file.",
      });
      batch.set(
        db.collection("users").doc(uid),
        {
          reservedBytes: FieldValue.increment(-data.declaredBytes),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await batch.commit();
      return;
    }
    const targetRef =
      data.targetType === "artist"
        ? db.collection("artists").doc(data.targetId)
        : db.collection("releases").doc(data.targetId);
    const field = data.targetType === "artist" ? "avatarPath" : "coverPath";
    const targetBefore = await targetRef.get();
    const oldPath = targetBefore.data()?.[field] || "";
    let oldBytes = 0;
    if (oldPath && oldPath !== event.data.name) {
      try {
        const [metadata] = await bucket.file(oldPath).getMetadata();
        oldBytes = Number(metadata.size || 0);
      } catch {
        oldBytes = 0;
      }
    }
    await db.runTransaction(async (transaction) => {
      const [fresh, target] = await Promise.all([
        transaction.get(uploadRef),
        transaction.get(targetRef),
      ]);
      if (
        fresh.data()?.status !== "uploading" ||
        target.data()?.ownerUid !== uid
      )
        return;
      transaction.update(targetRef, {
        [field]: event.data.name,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(uploadRef, {
        status: "ready",
        bytes: actual,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        db.collection("users").doc(uid),
        {
          reservedBytes: FieldValue.increment(-data.declaredBytes),
          storageBytes: FieldValue.increment(actual - oldBytes),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    if (oldPath && oldPath !== event.data.name)
      await bucket.file(oldPath).delete({ ignoreNotFound: true });
  },
);

export const cleanupStaleUploads = onSchedule(
  { region: REGION, schedule: "every day 03:00", timeZone: "Etc/UTC" },
  async () => {
    const bucket = getBucket();
    const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const staleTracks = await db
      .collectionGroup("tracks")
      .where("status", "==", "uploading")
      .where("createdAt", "<", cutoff)
      .get();
    const staleMedia = await db
      .collection("mediaUploads")
      .where("status", "==", "uploading")
      .where("createdAt", "<", cutoff)
      .get();
    for (const doc of [...staleTracks.docs, ...staleMedia.docs]) {
      const data = doc.data();
      await bucket.file(data.storagePath).delete({ ignoreNotFound: true });
      const batch = db.batch();
      batch.delete(doc.ref);
      batch.set(
        db.collection("users").doc(data.ownerUid),
        {
          reservedBytes: FieldValue.increment(-(data.declaredBytes || 0)),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await batch.commit();
    }
  },
);

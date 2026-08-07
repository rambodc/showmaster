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

function artistPayload(data) {
  const name = text(data?.name, "name", { min: 2, max: 60 });
  const slug = slugify(name);
  if (slug.length < 2)
    throw new HttpsError(
      "invalid-argument",
      "Artist name must contain at least two letters or numbers.",
      { field: "name" },
    );
  return {
    name,
    normalizedName: slug,
    slug,
    genre: genre(data?.genre),
    bio: text(data?.bio, "bio", { min: 20, max: 500 }),
    avatarPath: optionalText(data?.avatarPath, "avatarPath", 300),
  };
}

export const createVirtualArtist = authenticatedCallable(
  async (request, auth) => {
    const payload = artistPayload(request.data);
    const userRef = db.collection("users").doc(auth.uid);
    const artistRef = db.collection("artists").doc();
    const nameRef = db.collection("artistNames").doc(payload.normalizedName);
    await db.runTransaction(async (transaction) => {
      const [user, reservation] = await Promise.all([
        transaction.get(userRef),
        transaction.get(nameRef),
      ]);
      if (user.data()?.artistId)
        throw new HttpsError(
          "already-exists",
          "This account already has a Virtual Artist.",
        );
      if (reservation.exists)
        throw new HttpsError(
          "already-exists",
          "That Virtual Artist name is already taken.",
          { field: "name" },
        );
      transaction.create(nameRef, {
        artistId: artistRef.id,
        ownerUid: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(artistRef, {
        ...payload,
        ownerUid: auth.uid,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        userRef,
        {
          uid: auth.uid,
          email: auth.token.email || null,
          displayName: auth.token.name || "",
          artistId: artistRef.id,
          storageBytes: 0,
          reservedBytes: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return { artistId: artistRef.id, slug: payload.slug };
  },
);

export const updateVirtualArtist = authenticatedCallable(
  async (request, auth) => {
    const payload = artistPayload(request.data);
    const user = await db.collection("users").doc(auth.uid).get();
    const artistId = user.data()?.artistId;
    if (!artistId)
      throw new HttpsError("not-found", "Create your Virtual Artist first.");
    const artistRef = db.collection("artists").doc(artistId);
    await db.runTransaction(async (transaction) => {
      const artist = await transaction.get(artistRef);
      if (!artist.exists || artist.data().ownerUid !== auth.uid)
        throw new HttpsError("permission-denied", "Artist access denied.");
      const oldName = artist.data().normalizedName;
      if (oldName !== payload.normalizedName) {
        const nextRef = db
          .collection("artistNames")
          .doc(payload.normalizedName);
        if ((await transaction.get(nextRef)).exists)
          throw new HttpsError(
            "already-exists",
            "That Virtual Artist name is already taken.",
            { field: "name" },
          );
        transaction.delete(db.collection("artistNames").doc(oldName));
        transaction.create(nextRef, {
          artistId,
          ownerUid: auth.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(artistRef, {
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { artistId, slug: payload.slug };
  },
);

export const deleteVirtualArtist = authenticatedCallable(
  async (request, auth) => {
    requireConfirmation(request.data?.confirmation, "DELETE ARTIST");
    const userRef = db.collection("users").doc(auth.uid);
    const user = await userRef.get();
    const artistId = user.data()?.artistId;
    if (!artistId)
      throw new HttpsError("not-found", "Virtual Artist not found.");
    const artistRef = db.collection("artists").doc(artistId);
    const artist = await artistRef.get();
    const published = await db
      .collection("releases")
      .where("artistId", "==", artistId)
      .where("status", "==", "published")
      .limit(1)
      .get();
    if (!published.empty)
      throw new HttpsError(
        "failed-precondition",
        "Unpublish every release before deleting the artist.",
      );
    const releases = await db
      .collection("releases")
      .where("artistId", "==", artistId)
      .get();
    for (const release of releases.docs) await db.recursiveDelete(release.ref);
    await getBucket().deleteFiles({ prefix: `users/${auth.uid}/` });
    const uploads = await db
      .collection("mediaUploads")
      .where("ownerUid", "==", auth.uid)
      .get();
    const batch = db.batch();
    for (const upload of uploads.docs) batch.delete(upload.ref);
    batch.delete(
      db.collection("artistNames").doc(artist.data().normalizedName),
    );
    batch.delete(artistRef);
    batch.set(
      userRef,
      {
        artistId: null,
        storageBytes: 0,
        reservedBytes: 0,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await batch.commit();
    return { deleted: true };
  },
);

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { getBlob, getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../core/firebase";

const record = (snap) => ({ id: snap.id, ...snap.data() });
export async function getArtist(id) {
  const snap = await getDoc(doc(db, "artists", id));
  return snap.exists() ? record(snap) : null;
}
export async function getArtistBySlug(slug) {
  const snap = await getDocs(
    query(
      collection(db, "artists"),
      where("slug", "==", slug),
      where("status", "==", "active"),
      limit(1),
    ),
  );
  return snap.empty ? null : record(snap.docs[0]);
}
export async function getPublicReleases({ pageSize = 12, cursor = null } = {}) {
  const constraints = [
    where("status", "==", "published"),
    orderBy("publishedAt", "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize + 1));
  const snap = await getDocs(query(collection(db, "releases"), ...constraints));
  const page = snap.docs.slice(0, pageSize);
  return {
    items: await Promise.all(
      page.map(async (item) => ({
        ...record(item),
        artist: await getArtist(item.data().artistId),
      })),
    ),
    nextCursor: snap.docs.length > pageSize ? page[page.length - 1] : null,
  };
}
export async function getArtistReleases(
  artistId,
  includeDrafts = false,
  ownerUid = "",
) {
  const constraints = includeDrafts
    ? [where("ownerUid", "==", ownerUid), orderBy("updatedAt", "desc")]
    : [
        where("artistId", "==", artistId),
        where("status", "==", "published"),
        orderBy("publishedAt", "desc"),
      ];
  const snap = await getDocs(query(collection(db, "releases"), ...constraints));
  return snap.docs.map(record);
}
export async function getRelease(id) {
  const snap = await getDoc(doc(db, "releases", id));
  return snap.exists() ? record(snap) : null;
}
export async function getReleaseTracks(id, ownerUid = "") {
  const constraints = ownerUid
    ? [where("ownerUid", "==", ownerUid)]
    : [orderBy("order")];
  const snap = await getDocs(
    query(collection(db, "releases", id, "tracks"), ...constraints),
  );
  const tracks = snap.docs.map(record);
  return ownerUid
    ? tracks.sort((left, right) => (left.order || 0) - (right.order || 0))
    : tracks;
}
export async function mediaUrl(path, { privateAccess = false } = {}) {
  if (!path) return "";
  const mediaRef = ref(storage, path);
  if (!privateAccess) return getDownloadURL(mediaRef);
  return URL.createObjectURL(await getBlob(mediaRef));
}

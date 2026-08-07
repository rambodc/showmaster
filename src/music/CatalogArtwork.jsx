import { useEffect, useState } from "react";
import { mediaUrl } from "../lib/catalog";
import MusicArtwork from "./MusicArtwork";

export default function CatalogArtwork({ item, size = "card", previewUrl = "" }) {
  const path = item.coverPath || item.avatarPath;
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    let objectUrl = "";
    if (!path) {
      setUrl("");
      return undefined;
    }
    mediaUrl(path, { privateAccess: item.status === "draft" })
      .then((value) => {
        if (value.startsWith("blob:")) objectUrl = value;
        if (live) setUrl(value);
      })
      .catch(() => live && setUrl(""));
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.status, path]);
  return previewUrl || url ? (
    <img
      className={`catalog-image catalog-image--${size}`}
      src={previewUrl || url}
      alt={`${item.title || item.name} artwork`}
    />
  ) : (
    <MusicArtwork
      release={{
        ...item,
        color: item.color || "art-glass",
        artist: item.artist?.name || item.name || "Virtual Artist",
      }}
      size={size}
    />
  );
}

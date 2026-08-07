import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReleaseCard from "../components/ReleaseCard";
import { getArtistBySlug, getArtistReleases } from "../lib/catalog";
import { PageSkeleton } from "../components/ui/Skeleton";
import CatalogArtwork from "../music/CatalogArtwork";

export default function ArtistPage() {
  const { slug } = useParams();
  const [artist, setArtist] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    (async () => {
      const value = await getArtistBySlug(slug);
      if (!live) return;
      setArtist(value);
      if (value) setReleases(await getArtistReleases(value.id));
    })()
      .catch(() => live && setError("This Virtual Artist could not be loaded."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [slug]);
  if (loading) return <div className="public-shell"><PageSkeleton label="Loading artist" /></div>;
  if (error) return <div className="public-shell"><div className="catalog-state error" role="alert">{error}</div></div>;
  if (!artist) return <div className="public-shell"><div className="catalog-state">Virtual Artist not found.</div></div>;
  return (
    <div className="public-shell">
      <main className="artist-public">
        <section><CatalogArtwork item={artist} size="hero" /><div><span>Virtual Artist</span><h1>{artist.name}</h1><p>{artist.bio}</p><small>{artist.genre} · AI-generated identity</small></div></section>
        <header><span>Published catalog</span><strong>{releases.length} release{releases.length === 1 ? "" : "s"}</strong></header>
        {!releases.length ? <div className="catalog-state">No published releases yet.</div> : <div className="public-release-grid">{releases.map((release) => <ReleaseCard release={{ ...release, artist }} key={release.id} />)}</div>}
      </main>
    </div>
  );
}

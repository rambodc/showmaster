import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import PublicNav from "../components/PublicNav";
import ReleaseCard from "../components/ReleaseCard";
import { getPublicReleases } from "../lib/catalog";

export default function LibraryPage() {
  const [releases, setReleases] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async (nextCursor = null) => {
    setLoading(true);
    try {
      const page = await getPublicReleases({ cursor: nextCursor });
      setReleases((items) =>
        nextCursor ? [...items, ...page.items] : page.items,
      );
      setCursor(page.nextCursor);
    } catch {
      setError("The library could not be loaded.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const genres = ["All", ...new Set(releases.map((item) => item.genre))];
  const filtered = useMemo(
    () =>
      releases.filter(
        (item) =>
          (genre === "All" || item.genre === genre) &&
          `${item.title} ${item.artist?.name || ""} ${item.genre}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [releases, search, genre],
  );
  return (
    <div className="public-shell">
      <PublicNav />
      <main className="library-page">
        <section className="library-hero">
          <span>
            <Sparkles /> Made by virtual artists
          </span>
          <h1>
            Discover music from
            <br />
            <em>imagined worlds.</em>
          </h1>
          <p>
            A living catalog of original AI-assisted music, built and published
            by independent creators.
          </p>
        </section>
        <div className="library-tools">
          <label>
            <Search />
            <span className="sr-only">Search the library</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search releases or virtual artists"
            />
          </label>
          <div>
            {genres.map((item) => (
              <button
                className={genre === item ? "active" : ""}
                onClick={() => setGenre(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {loading && !releases.length && (
          <div className="catalog-state">Loading the catalog…</div>
        )}
        {error && (
          <div className="catalog-state error" role="alert">
            {error}
          </div>
        )}
        {!loading && !error && !filtered.length && (
          <div className="catalog-state">
            No published music matches your search yet.
          </div>
        )}
        <section className="public-release-grid">
          {filtered.map((release) => (
            <ReleaseCard release={release} key={release.id} />
          ))}
        </section>
        {cursor && (
          <button
            className="library-more"
            disabled={loading}
            onClick={() => load(cursor)}
          >
            {loading ? "Loading…" : "Load more releases"}
          </button>
        )}
      </main>
    </div>
  );
}

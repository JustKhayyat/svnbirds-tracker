import { useState } from "react";
import Layout from "../components/Layout";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [artistName, setArtistName] = useState("");
  const [artists, setArtists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchArtists = async () => {
    if (!artistName.trim()) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setArtists([]);
    try {
      const res = await fetch(`/api/fetchSpotify?name=${encodeURIComponent(artistName)}`);
      const data = await res.json();

      if (res.ok && data.length > 0) {
        setArtists(data);
      } else {
        setError(data.error || "No artists found");
      }
    } catch (err) {
      console.error(err);
      setError("Error fetching artists");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className={styles.hero}>
        <h1>Artist Tracker</h1>
        <p>Search any artist on Spotify and get details instantly.</p>
      </div>

      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Enter Spotify Artist Name"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
        />
        <button onClick={fetchArtists}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {!selected && artists.length > 0 && (
        <div className={styles.grid}>
          {artists.map((a) => (
            <div
              key={a.id}
              className={styles.card}
              onClick={() => setSelected(a)}
            >
              <img
                src={a.images?.[0]?.url || "/default-avatar.png"}
                alt={a.name}
              />
              <h3>{a.name}</h3>
              <p>{a.followers?.total?.toLocaleString()} followers</p>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className={styles.detail}>
          <img
            src={selected.images?.[0]?.url || "/default-avatar.png"}
            alt={selected.name}
          />
          <div>
            <h2>{selected.name}</h2>
            <p>Followers: {selected.followers?.total?.toLocaleString() ?? 0}</p>
            <p>Genres: {selected.genres?.join(", ") || "N/A"}</p>
            <a
              href={selected.external_urls?.spotify || "#"}
              target="_blank"
              rel="noreferrer"
              className={styles.button}
            >
              Open in Spotify
            </a>
            <button
              className={styles.secondaryButton}
              onClick={() => setSelected(null)}
            >
              Back to results
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

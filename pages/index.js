import { useState } from "react";
import Layout from "../components/Layout";
import styles from "../styles/Home.module.css";
import Link from "next/link";

export default function Home() {
  const [artistName, setArtistName] = useState("");
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchArtists = async () => {
    if (!artistName.trim()) return;
    setLoading(true);
    setError(null);
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

      {artists.length > 0 && (
        <div className={styles.grid}>
          {artists.map((a) => (
            <Link key={a.id} href={`/artist/${a.id}`} className={styles.card}>
              <img src={a.images?.[0]?.url || "/default-avatar.png"} alt={a.name} />
              <h3>{a.name}</h3>
              <p>{a.followers?.total?.toLocaleString()} followers</p>
              <p>{a.genres?.join(", ") || "N/A"}</p>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}

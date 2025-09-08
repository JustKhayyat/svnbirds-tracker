import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../styles/BirdEye.module.css";

export default function BirdEye() {
  const [artistName, setArtistName] = useState("");
  const [artists, setArtists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [relatedArtists, setRelatedArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchArtists = async () => {
    if (!artistName.trim()) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setArtists([]);
    setTopTracks([]);
    setAlbums([]);
    setRelatedArtists([]);

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

  const fetchFullArtistInfo = async (artistId) => {
    setLoading(true);
    try {
      const [artistRes, topTracksRes, albumsRes, relatedRes] = await Promise.all([
        fetch(`/api/getArtist?id=${artistId}`).then((r) => r.json()),
        fetch(`/api/getTopTracks?id=${artistId}`).then((r) => r.json()),
        fetch(`/api/getAlbums?id=${artistId}`).then((r) => r.json()),
        fetch(`/api/getRelatedArtists?id=${artistId}`).then((r) => r.json()),
      ]);

      setSelected(artistRes);
      setTopTracks(topTracksRes.tracks || []);
      setAlbums(albumsRes.items || []);
      setRelatedArtists(relatedRes.artists || []);
    } catch (err) {
      console.error(err);
      setError("Error fetching full artist info");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.trackerPage}>
      {/* Back to Dashboard */}
      <div style={{ width: "100%", textAlign: "left", marginBottom: "1rem" }}>
        <Link href="/dashboard">
          <button className={styles.backButton}>← Back to Dashboard</button>
        </Link>
      </div>

      {/* Centered Title */}
      <h1 className={styles.pageTitle}>BirdEye – Artist Tracker</h1>

      {/* Search */}
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Enter Spotify Artist Name"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
        />
        <button onClick={fetchArtists}>{loading ? "Searching..." : "Search"}</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Artist cards */}
      {!selected && artists.length > 0 && (
        <div className={styles.grid}>
          {artists.map((a) => (
            <div
              key={a.id}
              className={styles.card}
              onClick={() => fetchFullArtistInfo(a.id)}
            >
              <img src={a.images?.[0]?.url || "/default-avatar.png"} alt={a.name} />
              <h3>{a.name}</h3>
              <p>{a.followers?.total?.toLocaleString()} followers</p>
              <p>{a.genres?.join(", ")}</p>
            </div>
          ))}
        </div>
      )}

      {/* Full artist info */}
      {selected && (
        <div className={styles.detail}>
          <img src={selected.images?.[0]?.url || "/default-avatar.png"} alt={selected.name} />
          <div className={styles.artistInfo}>
            <h2>{selected.name}</h2>
            <p>Followers: {selected.followers?.total?.toLocaleString() ?? 0}</p>
            <p>Genres: {selected.genres?.join(", ") || "N/A"}</p>
            <p>Popularity: {selected.popularity ?? "N/A"}/100</p>
            <a href={selected.external_urls?.spotify} target="_blank" rel="noreferrer" className={styles.button}>
              Open in Spotify
            </a>

            {/* Top Tracks */}
            <div className={styles.section}>
              <h3>Top Tracks</h3>
              {topTracks.map((track) => (
                <div key={track.id} className={styles.track}>
                  <img src={track.album.images[0]?.url} alt={track.name} />
                  <p>{track.name} — {track.album.name}</p>
                  {track.preview_url && <audio controls src={track.preview_url}></audio>}
                  <a href={track.external_urls.spotify} target="_blank" rel="noreferrer">Listen</a>
                </div>
              ))}
            </div>

            {/* Albums */}
            <div className={styles.section}>
              <h3>Albums</h3>
              {albums.map((album) => (
                <div key={album.id} className={styles.albumCard}>
                  <img src={album.images[0]?.url} alt={album.name} />
                  <p>{album.name} ({album.release_date.split("-")[0]})</p>
                  <a href={album.external_urls.spotify} target="_blank" rel="noreferrer">Listen</a>
                </div>
              ))}
            </div>

            {/* Related Artists */}
            <div className={styles.section}>
              <h3>Related Artists</h3>
              {relatedArtists.map((ra) => (
                <div key={ra.id} className={styles.relatedCard}>
                  <img src={ra.images[0]?.url} alt={ra.name} />
                  <p>{ra.name}</p>
                  <p>{ra.genres.join(", ")}</p>
                  <a href={ra.external_urls.spotify} target="_blank" rel="noreferrer">View</a>
                </div>
              ))}
            </div>

            <button className={styles.secondaryButton} onClick={() => setSelected(null)}>
              ← Back to results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

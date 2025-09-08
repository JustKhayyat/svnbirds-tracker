import { useState } from "react";

export default function Artist() {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchArtist = async () => {
    setLoading(true);
    const res = await fetch("/api/fetchSpotify?artistId=0ZymXKuHy9Sqg2X5IEwLut");
    const data = await res.json();
    setArtist(data);
    setLoading(false);
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Spotify Artist Info</h1>
      <button onClick={fetchArtist} style={{ marginBottom: "1rem" }}>
        {loading ? "Loading..." : "Fetch Artist"}
      </button>

      {artist && (
        <div>
          <h2>{artist.name}</h2>
          <img src={artist.images?.[0]?.url} alt={artist.name} width={200} />
          <p>Followers: {artist.followers?.total}</p>
          <p>Genres: {artist.genres?.join(", ")}</p>
          <a href={artist.external_urls?.spotify} target="_blank" rel="noreferrer">
            Open in Spotify
          </a>
        </div>
      )}
    </div>
  );
}

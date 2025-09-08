import { useState } from "react";
import Layout from "../components/Layout";
import ArtistCard from "../components/ArtistCard";

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
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-6xl font-bebas mb-4">Artist Tracker</h1>
        <p className="text-gray-400">Search any artist on Spotify and get details instantly</p>
      </div>

      {/* Search bar */}
      <div className="flex justify-center mb-8 space-x-2">
        <input
          type="text"
          placeholder="Enter Spotify Artist Name"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          className="px-4 py-2 w-64 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
        <button
          onClick={fetchArtists}
          className="bg-yellow-500 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Errors */}
      {error && <p className="text-red-400 text-center mb-6">{error}</p>}

      {/* Multiple search results */}
      {!selected && artists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {artists.map((a) => (
            <ArtistCard key={a.id} artist={a} onSelect={setSelected} />
          ))}
        </div>
      )}

      {/* Selected artist info */}
      {selected && <ArtistCard artist={selected} selected />}

      {!selected && artists.length === 0 && !error && (
        <p className="text-gray-500 mt-10 text-center">
          Enter an artist name above and click "Search" to see results.
        </p>
      )}
    </Layout>
  );
}

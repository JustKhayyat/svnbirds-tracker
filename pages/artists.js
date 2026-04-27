import Image from "next/image";
import { useState } from "react";
import Layout from "../components/Layout";

const DEFAULT_AVATAR = "/default-avatar.svg";

export default function Artist() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchArtists = async (e) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/fetchSpotify?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <header className="mb-10">
        <h1 className="text-4xl font-bebas mb-2 text-yellow-500">BIRDEYE SEARCH</h1>
        <p className="text-gray-400">Search and track artist profiles across Spotify.</p>
      </header>

      {/* Search Bar */}
      <form onSubmit={searchArtists} className="flex gap-2 mb-10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter artist name..."
          className="flex-1 bg-gray-900 border border-gray-700 text-white p-3 rounded focus:outline-none focus:border-yellow-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-yellow-500 text-black px-6 py-3 rounded font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50"
        >
          {loading ? "SEARCHING..." : "SEARCH"}
        </button>
      </form>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((artist) => (
          <div key={artist.id} className="bg-gray-900 border border-gray-800 p-6 rounded-lg flex flex-col items-center text-center shadow-xl">
            <div className="relative w-32 h-32 mb-4">
              <Image
                src={artist.images?.[0]?.url || DEFAULT_AVATAR}
                alt={artist.name}
                fill
                className="rounded-full object-cover border-2 border-gray-700"
              />
            </div>
            
            <h2 className="text-2xl font-bebas text-white mb-1">{artist.name}</h2>
            <p className="text-yellow-500 text-sm font-bold mb-3">
              {artist.followers?.total?.toLocaleString()} Followers
            </p>
            
            <div className="flex flex-wrap justify-center gap-1 mb-4">
              {artist.genres?.slice(0, 3).map((genre) => (
                <span key={genre} className="text-[10px] uppercase bg-gray-800 text-gray-400 px-2 py-1 rounded">
                  {genre}
                </span>
              ))}
            </div>

            <a
              href={artist.external_urls?.spotify}
              target="_blank"
              rel="noreferrer"
              className="mt-auto w-full border border-yellow-500 text-yellow-500 py-2 rounded text-sm font-bold hover:bg-yellow-500 hover:text-black transition-all"
            >
              VIEW PROFILE
            </a>
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && query && (
        <p className="text-center text-gray-500 mt-10">No artists found for "{query}"</p>
      )}
    </Layout>
  );
}

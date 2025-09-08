import { useState } from "react";

export default function Home() {
  const [artistName, setArtistName] = useState(""); // input value
  const [artists, setArtists] = useState([]); // array of search results
  const [selected, setSelected] = useState(null); // chosen artist
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
        setArtists(data); // array of matches
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
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white shadow p-4 flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
        <h1 className="text-xl font-bold">SVNBIRDS Tracker</h1>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Enter Spotify Artist Name"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchArtists}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {error && <p className="text-red-500 mb-4">{error}</p>}

        {/* Multiple search results */}
        {!selected && artists.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {artists.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelected(a)}
                className="cursor-pointer p-4 border rounded hover:shadow"
              >
                <img
                  src={a.images?.[0]?.url || "/default-avatar.png"}
                  alt={a.name}
                  className="w-24 h-24 rounded-full mx-auto"
                />
                <p className="text-center mt-2 font-semibold">{a.name}</p>
              </div>
            ))}
          </div>
        )}

        {/* Selected artist info */}
        {selected && (
          <div className="flex items-center space-x-6 mt-6">
            <img
              src={selected.images?.[0]?.url || "/default-avatar.png"}
              alt={selected.name}
              className="w-32 h-32 rounded-full shadow-md object-cover"
            />
            <div>
              <h2 className="text-2xl font-bold">{selected.name}</h2>
              <p>Followers: {selected.followers?.total ?? 0}</p>
              <p>Genres: {selected.genres?.join(", ") || "N/A"}</p>
              <a
                href={selected.external_urls?.spotify || "#"}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                Open in Spotify
              </a>
              <button
                onClick={() => setSelected(null)}
                className="ml-4 bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
              >
                Back to results
              </button>
            </div>
          </div>
        )}

        {!selected && artists.length === 0 && !error && (
          <p className="text-gray-500 mt-6">
            Enter an artist name above and click "Search" to see results.
          </p>
        )}
      </main>
    </div>
  );
}

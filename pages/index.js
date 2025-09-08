import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch("/api/fetchSpotify?artistId=0ZymXKuHy9Sqg2X5IEwLut");
      const json = await res.json();
      setData(json);
    }
    fetchData();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    );
  }

  const { artist, topTracks } = data;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* HEADER */}
      <header className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center space-x-4">
          <img
            src={artist.images?.[0]?.url}
            alt={artist.name}
            className="w-16 h-16 rounded-full shadow-md"
          />
          <div>
            <h1 className="text-2xl font-bold">{artist.name}</h1>
            <p className="text-gray-600">{artist.followers.total.toLocaleString()} followers</p>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold mb-6">Top Tracks</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {topTracks.map((track, i) => {
            // MOCK STREAMS: Randomized for demo
            const streams = Math.floor(Math.random() * 5000000) + 100000;

            return (
              <div
                key={track.id}
                className="bg-white rounded-2xl shadow hover:shadow-lg transition p-4 flex flex-col"
              >
                <img
                  src={track.album.images?.[0]?.url}
                  alt={track.name}
                  className="rounded-xl mb-4"
                />
                <h3 className="font-semibold text-lg mb-1">{track.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{track.album.name}</p>

                {/* STREAMS + POPULARITY */}
                <p className="text-sm text-gray-800 font-medium">
                  {streams.toLocaleString()} streams
                </p>
                <p className="text-xs text-gray-500">
                  Popularity score: {track.popularity}/100
                </p>

                <a
                  href={track.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-center bg-green-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-600 transition"
                >
                  Open in Spotify
                </a>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

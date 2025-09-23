import { useState } from "react";
import Layout from "../components/Layout";
import AvatarImage from "../components/AvatarImage";

export default function Artist() {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchArtist = async () => {
    setLoading(true);
    const res = await fetch("/api/fetchSpotify?name=Soulja");
    const data = await res.json();
    setArtist(data[0]); // get first result
    setLoading(false);
  };

  return (
    <Layout>
      <h1 className="text-3xl font-bebas mb-6">Artist Demo Page</h1>
      <button
        onClick={fetchArtist}
        className="bg-yellow-500 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400 mb-6"
      >
        {loading ? "Loading..." : "Fetch Soulja"}
      </button>

      {artist && (
        <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bebas mb-4">{artist.name}</h2>
          <AvatarImage
            src={artist.images?.[0]?.url}
            alt={artist.name}
            width={160}
            height={160}
            className="w-40 h-40 rounded-full object-cover border border-gray-700 mb-4"
          />
          <p className="text-gray-400">Followers: {artist.followers?.total?.toLocaleString()}</p>
          <p className="text-gray-400">Genres: {artist.genres?.join(", ")}</p>
          <a
            href={artist.external_urls?.spotify}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-4 bg-yellow-500 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400"
          >
            Open in Spotify
          </a>
        </div>
      )}
    </Layout>
  );
}

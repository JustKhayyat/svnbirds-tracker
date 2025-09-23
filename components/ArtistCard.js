import AvatarImage from "./AvatarImage";

export default function ArtistCard({ artist, onSelect, selected }) {
  if (!artist) return null;

  // If this is the selected artist view
  if (selected) {
    return (
      <div className="flex flex-col md:flex-row items-center md:items-start space-x-0 md:space-x-8 space-y-6 md:space-y-0 bg-gray-800 p-6 rounded-lg shadow-lg">
        <AvatarImage
          src={artist.images?.[0]?.url}
          alt={artist.name}
          width={160}
          height={160}
          className="w-40 h-40 rounded-full shadow-md object-cover border border-gray-700"
        />
        <div>
          <h2 className="text-3xl font-bebas">{artist.name}</h2>
          <p className="text-gray-400">Followers: {artist.followers?.total?.toLocaleString() ?? 0}</p>
          <p className="text-gray-400">Genres: {artist.genres?.join(", ") || "N/A"}</p>
          <a
            href={artist.external_urls?.spotify || "#"}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-4 bg-yellow-500 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400"
          >
            Open in Spotify
          </a>
        </div>
      </div>
    );
  }

  // Default grid card view
  return (
    <div
      onClick={() => onSelect(artist)}
      className="cursor-pointer bg-gray-800 p-6 rounded-lg shadow hover:shadow-xl transition transform hover:-translate-y-1"
    >
      <AvatarImage
        src={artist.images?.[0]?.url}
        alt={artist.name}
        width={128}
        height={128}
        className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border border-gray-700"
      />
      <p className="text-center text-lg font-semibold">{artist.name}</p>
      <p className="text-center text-gray-500 text-sm">{artist.followers?.total?.toLocaleString()} followers</p>
    </div>
  );
}

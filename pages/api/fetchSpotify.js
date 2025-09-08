export default async function handler(req, res) {
  const { name } = req.query; // get artist name from query

  if (!name) {
    return res.status(400).json({ error: "Missing artist name" });
  }

  try {
    // Get Spotify access token
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
          ).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(500).json({ error: "Failed to get Spotify access token" });
    }

    const accessToken = tokenData.access_token;

    // Search for artists by name, limit to 5 results
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        name
      )}&type=artist&limit=5`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const searchData = await searchRes.json();
    const artists = searchData.artists?.items; // array of up to 5 matches

    if (!artists || artists.length === 0) {
      return res.status(404).json({ error: "Artist not found" });
    }

    // Return only necessary fields for the frontend
    const formatted = artists.map((a) => ({
      id: a.id,
      name: a.name,
      followers: a.followers,
      images: a.images,
      genres: a.genres,
      external_urls: a.external_urls,
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching from Spotify API" });
  }
}

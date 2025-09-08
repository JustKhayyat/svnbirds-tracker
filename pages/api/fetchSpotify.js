export default async function handler(req, res) {
  const { artistId } = req.query;

  if (!artistId) {
    return res.status(400).json({ error: "Missing artistId" });
  }

  try {
    // 1. Get access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
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

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch artist profile
    const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const artist = await artistRes.json();

    // 3. Fetch artist top tracks (Spotify requires a market, so use "US" or "MY")
    const tracksRes = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const topTracks = await tracksRes.json();

    // 4. Send combined response
    res.status(200).json({
      artist,
      topTracks: topTracks.tracks || [],
    });
  } catch (error) {
    console.error("Spotify API error:", error);
    res.status(500).json({ error: "Failed to fetch data from Spotify" });
  }
}

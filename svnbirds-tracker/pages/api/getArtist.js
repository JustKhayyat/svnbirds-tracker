import getSpotifyToken from './getSpotifyToken';

export default async function handler(req, res) {
  const { id } = req.query;
  const token = await getSpotifyToken();

  const response = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();
  res.status(200).json(data);
}

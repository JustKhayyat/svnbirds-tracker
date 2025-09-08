// pages/artist/[id].js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/Artists.module.css'; // <- updated import

export default function ArtistPage() {
  const router = useRouter();
  const { id } = router.query;

  const [artist, setArtist] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [relatedArtists, setRelatedArtists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);

      const [artistRes, topTracksRes, albumsRes, relatedRes] = await Promise.all([
        fetch(`/api/getArtist?id=${id}`).then(r => r.json()),
        fetch(`/api/getTopTracks?id=${id}`).then(r => r.json()),
        fetch(`/api/getAlbums?id=${id}`).then(r => r.json()),
        fetch(`/api/getRelatedArtists?id=${id}`).then(r => r.json()),
      ]);

      setArtist(artistRes);
      setTopTracks(topTracksRes.tracks || []);
      setAlbums(albumsRes.items || []);
      setRelatedArtists(relatedRes.artists || []);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) return <p style={{ textAlign: 'center', color: '#fff' }}>Loading...</p>;
  if (!artist) return null;

  return (
    <div className={styles['artist-page']}>
      {/* Artist page content here */}
    </div>
  );
}

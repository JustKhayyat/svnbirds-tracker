import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/ArtistPage.module.css';
import Link from 'next/link';

export default function ArtistPage() {
  const router = useRouter();
  const { id } = router.query;

  const [artist, setArtist] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [relatedArtists, setRelatedArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
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
      } catch (err) {
        console.error(err);
        setError('Failed to load artist data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <p style={{ textAlign: 'center', color: '#fff' }}>Loading...</p>;
  if (error) return <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>;
  if (!artist) return null;

  return (
    <div className={styles['artist-page']}>
      {/* Artist Header */}
      <div className={styles['artist-header']}>
        <img src={artist.images?.[0]?.url || '/default-avatar.png'} alt={artist.name} />
        <h1>{artist.name}</h1>
        <p>{artist.genres?.length > 0 ? artist.genres.join(', ') : 'N/A'}</p>
        <p>Followers: {artist.followers?.total?.toLocaleString() || 0}</p>
        <p>Popularity: {artist.popularity || 0}/100</p>
        <a
          className={styles.button}
          href={artist.external_urls?.spotify || '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          Follow on Spotify
        </a>
        <Link href="/" className={styles.secondaryButton}>
          Back to Search
        </Link>
      </div>

      {/* Top Tracks */}
      <div className={styles.section}>
        <h2>Top Tracks</h2>
        {topTracks.length > 0 ? (
          topTracks.map(track => (
            <div key={track.id} className={styles.track}>
              <img src={track.album.images?.[0]?.url || '/default-album.png'} alt={track.name} />
              <p><strong>{track.name}</strong> — {track.album.name}</p>
              {track.preview_url && <audio controls src={track.preview_url}></audio>}
              <a
                className={styles.button}
                href={track.external_urls?.spotify || '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                Listen
              </a>
            </div>
          ))
        ) : (
          <p>No top tracks available.</p>
        )}
      </div>

      {/* Albums */}
      <div className={styles.section}>
        <h2>Albums</h2>
        {albums.length > 0 ? (
          albums.map(album => (
            <div key={album.id} className={styles['album-card']}>
              <img src={album.images?.[0]?.url || '/default-album.png'} alt={album.name} />
              <p><strong>{album.name}</strong> ({album.release_date?.split('-')[0] || 'N/A'})</p>
              <a
                className={styles.button}
                href={album.external_urls?.spotify || '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                Listen
              </a>
            </div>
          ))
        ) : (
          <p>No albums available.</p>
        )}
      </div>

      {/* Related Artists */}
      <div className={styles.section}>
        <h2>Related Artists</h2>
        {relatedArtists.length > 0 ? (
          relatedArtists.map(ra => (
            <Link
              key={ra.id}
              href={`/artist/${ra.id}`}
              className={styles['related-card']}
            >
              <img src={ra.images?.[0]?.url || '/default-avatar.png'} alt={ra.name} />
              <p><strong>{ra.name}</strong></p>
              <p>{ra.genres?.length > 0 ? ra.genres.join(', ') : 'N/A'}</p>
              <a
                className={styles.button}
                href={ra.external_urls?.spotify || '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Spotify
              </a>
            </Link>
          ))
        ) : (
          <p>No related artists found.</p>
        )}
      </div>
    </div>
  );
}

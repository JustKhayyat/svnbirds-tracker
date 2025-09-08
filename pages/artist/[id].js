import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/ArtistPage.module.css';

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
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) return <p style={{ textAlign: 'center', color: '#fff' }}>Loading...</p>;
  if (!artist) return null;

  return (
    <div className={styles['artist-page']}>
      <div className={styles['artist-header']}>
        <img src={artist.images[0]?.url || '/default-avatar.png'} alt={artist.name} />
        <h1>{artist.name}</h1>
        <p>{artist.genres.join(', ') || 'N/A'}</p>
        <p>Followers: {artist.followers?.total?.toLocaleString() || 0}</p>
        <p>Popularity: {artist.popularity}/100</p>
        <a
          href={artist.external_urls?.spotify || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.button}
        >
          Follow on Spotify
        </a>
      </div>

      {/* Top Tracks */}
      <div className={styles.section}>
        <h2>Top Tracks</h2>
        <div className={styles['scroll-section']}>
          {topTracks.map(track => (
            <div key={track.id} className={styles.track}>
              <img src={track.album.images[0]?.url || '/default-avatar.png'} alt={track.name} />
              <p>{track.name} — {track.album.name}</p>
              {track.preview_url && <audio controls src={track.preview_url}></audio>}
              <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer" className={styles.button}>
                Listen
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Albums */}
      <div className={styles.section}>
        <h2>Albums</h2>
        <div className={styles['scroll-section']}>
          {albums.map(album => (
            <div key={album.id} className={styles['album-card']}>
              <img src={album.images[0]?.url || '/default-avatar.png'} alt={album.name} />
              <p>{album.name} ({album.release_date.split('-')[0]})</p>
              <a href={album.external_urls.spotify} target="_blank" rel="noopener noreferrer" className={styles.button}>
                Listen
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Related Artists */}
      <div className={styles.section}>
        <h2>Related Artists</h2>
        <div className={styles['scroll-section']}>
          {relatedArtists.map(ra => (
            <div key={ra.id} className={styles['related-card']}>
              <img src={ra.images[0]?.url || '/default-avatar.png'} alt={ra.name} />
              <p>{ra.name}</p>
              <p>{ra.genres.join(', ') || 'N/A'}</p>
              <a href={ra.external_urls.spotify} target="_blank" rel="noopener noreferrer" className={styles.button}>
                View
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

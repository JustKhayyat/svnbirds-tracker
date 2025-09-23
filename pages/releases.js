import Image from 'next/image'
import { useState, useEffect } from 'react'
import styles from '../styles/Releases.module.css'

export default function ReleasesPage() {
  const [releases, setReleases] = useState([])
  const [form, setForm] = useState({
    title: '',
    artist: '',
    releaseDate: '',
    type: 'single',
    coverArt: '',
    notes: ''
  })

  // Load releases
  useEffect(() => {
    fetch('/api/releases')
      .then(res => res.json())
      .then(data => setReleases(data))
  }, [])

  // Handle create
  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        status: 'planned',
        platformLinks: {}
      })
    })
    const newRelease = await res.json()
    setReleases(prev => [...prev, newRelease])
    setForm({ title: '', artist: '', releaseDate: '', type: 'single', coverArt: '', notes: '' })
  }

  // Handle status change
  const handleStatusChange = async (id, newStatus) => {
    const res = await fetch('/api/releases', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    })
    const updated = await res.json()
    setReleases(prev => prev.map(r => (r.id === id ? updated : r)))
  }

  // Handle delete
  const handleDelete = async (id) => {
    await fetch('/api/releases', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setReleases(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Releases</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
        />
        <input
          type="text"
          placeholder="Artist(s), comma separated"
          value={form.artist}
          onChange={e => setForm({ ...form, artist: e.target.value })}
        />
        <input
          type="date"
          value={form.releaseDate}
          onChange={e => setForm({ ...form, releaseDate: e.target.value })}
        />
        <select
          value={form.type}
          onChange={e => setForm({ ...form, type: e.target.value })}
        >
          <option value="single">Single</option>
          <option value="EP">EP</option>
          <option value="album">Album</option>
        </select>
        <input
          type="text"
          placeholder="Cover Art URL"
          value={form.coverArt}
          onChange={e => setForm({ ...form, coverArt: e.target.value })}
        />
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
        />
        <button type="submit">Add Release</button>
      </form>

      {/* List */}
      <ul className={styles.list}>
        {releases.map(r => (
          <li key={r.id} className={styles.releaseItem}>
            {r.coverArt ? (
              <Image
                src={r.coverArt}
                alt={
                  r.title ||
                  (Array.isArray(r.artist) && r.artist.length
                    ? `${r.artist.join(', ')} cover`
                    : 'Release cover art')
                }
                width={80}
                height={80}
                className={styles.coverArt}
                unoptimized
              />
            ) : null}
            <div>
              <strong>{r.title}</strong> ({r.type}) <br />
              By {r.artist.join(', ')} <br />
              <span className={styles.meta}>
                Release date: {r.releaseDate}
              </span>

              {/* Status dropdown */}
              <div className={styles.statusRow}>
                <label>Status: </label>
                <select
                  value={r.status}
                  onChange={(e) => handleStatusChange(r.id, e.target.value)}
                >
                  <option value="planned">Planned</option>
                  <option value="submitted">Submitted</option>
                  <option value="live">Live</option>
                </select>
              </div>

              {r.notes && <p className={styles.notes}>{r.notes}</p>}

              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(r.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

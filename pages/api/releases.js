let releases = []

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(releases)
  }

  if (req.method === 'POST') {
    const newRelease = {
      id: Date.now().toString(), // simple unique id
      title: req.body.title,
      artist: req.body.artist ? req.body.artist.split(',').map(a => a.trim()) : [],
      releaseDate: req.body.releaseDate,
      status: req.body.status || 'planned',
      platformLinks: req.body.platformLinks || {},
      coverArt: req.body.coverArt || '',
      type: req.body.type || 'single',
      notes: req.body.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    releases.push(newRelease)
    return res.status(201).json(newRelease)
  }

  if (req.method === 'PUT') {
    const { id, ...update } = req.body
    releases = releases.map(r =>
      r.id === id ? { ...r, ...update, updatedAt: new Date().toISOString() } : r
    )
    const updatedRelease = releases.find(r => r.id === id)
    return res.status(200).json(updatedRelease)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    releases = releases.filter(r => r.id !== id)
    return res.status(200).json({ message: 'Deleted' })
  }

  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
  return res.status(405).end(`Method ${req.method} Not Allowed`)
}

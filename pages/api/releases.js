import prisma from '../../lib/prisma';

function parseArtists(value) {
  if (Array.isArray(value)) {
    return value
      .map((artist) => (typeof artist === 'string' ? artist.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((artist) => artist.trim())
      .filter(Boolean);
  }
  return [];
}

function parsePlatformLinks(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function parseReleaseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeRelease(record) {
  return {
    id: record.id,
    title: record.title || '',
    artist: Array.isArray(record.artists) ? record.artists : [],
    releaseDate: record.releaseDate ? record.releaseDate.toISOString().slice(0, 10) : '',
    status: record.status || 'planned',
    platformLinks: record.platformLinks || {},
    coverArt: record.coverArt || '',
    type: record.type || 'single',
    notes: record.notes || '',
    createdAt: record.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: record.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

async function listReleases() {
  const releases = await prisma.release.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return releases.map(serializeRelease);
}

function buildReleaseData(body, existing = {}) {
  const artists = parseArtists(body.artist ?? existing.artists ?? []);
  const releaseDate = parseReleaseDate(body.releaseDate ?? existing.releaseDate);
  const status = typeof body.status === 'string' ? body.status : existing.status ?? 'planned';
  const type = typeof body.type === 'string' ? body.type : existing.type ?? 'single';
  const coverArt = typeof body.coverArt === 'string' ? body.coverArt : existing.coverArt ?? '';
  const notes = typeof body.notes === 'string' ? body.notes : existing.notes ?? '';

  return {
    title: typeof body.title === 'string' ? body.title : existing.title ?? null,
    primaryArtist:
      typeof body.primaryArtist === 'string'
        ? body.primaryArtist
        : artists.length
          ? artists[0]
          : existing.primaryArtist ?? null,
    artists,
    releaseDate,
    status,
    platformLinks: parsePlatformLinks(body.platformLinks ?? existing.platformLinks ?? {}),
    coverArt,
    type,
    notes,
    label: typeof body.label === 'string' ? body.label : existing.label ?? null,
    upc: typeof body.upc === 'string' ? body.upc : existing.upc ?? null,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const releases = await listReleases();
      return res.status(200).json(releases);
    }

    if (req.method === 'POST') {
      const data = buildReleaseData(req.body || {});
      const created = await prisma.release.create({
        data: {
          ...data,
          status: data.status || 'planned',
          type: data.type || 'single',
          coverArt: data.coverArt || '',
          notes: data.notes || '',
        },
      });

      return res.status(201).json(serializeRelease(created));
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: 'Missing release id for update.' });
      }

      const existing = await prisma.release.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Release not found.' });
      }

      const data = buildReleaseData(updates, existing);
      const updated = await prisma.release.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      return res.status(200).json(serializeRelease(updated));
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: 'Missing release id for deletion.' });
      }

      await prisma.release.delete({ where: { id } });
      return res.status(200).json({ message: 'Deleted' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Releases API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

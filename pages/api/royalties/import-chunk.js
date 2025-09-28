// pages/api/royalties/import-chunk.js
import { startChunkedImport, appendChunkedImport, finishChunkedImport } from '../../../lib/royalties.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

function isAuthorized(req, adminToken) {
  const t = req.headers['x-admin-token'];
  return adminToken && typeof t === 'string' && t === adminToken;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const adminToken = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
  if (!isAuthorized(req, adminToken)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { action } = req.body || {};
    if (action === 'start') {
      const { statement = {}, batchMeta = {} } = req.body || {};
      const ids = await startChunkedImport({ statement, batchMeta });
      return res.status(200).json(ids);
    }
    if (action === 'append') {
      const {
        statementId, batchId,
        releases = [], collaborators = [], lineItems = [],
      } = req.body || {};
      if (!statementId || !batchId) return res.status(400).json({ error: 'statementId and batchId required' });
      const out = await appendChunkedImport({ statementId, batchId, releases, collaborators, lineItems });
      return res.status(200).json(out);
    }
    if (action === 'finish') {
      const { batchId } = req.body || {};
      if (!batchId) return res.status(400).json({ error: 'batchId required' });
      await finishChunkedImport({ batchId });
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'Import failed' });
  }
}

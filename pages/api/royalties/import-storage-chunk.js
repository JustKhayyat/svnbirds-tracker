// pages/api/royalties/import-storage-chunk.js
import { createClient } from '@supabase/supabase-js';
import { parseCsv as parseCsvDefault } from '../../../lib/vendor/papaparse.js';
import { normalizeEmpireRows as normalizeEmpireRowsDefault } from '../../../lib/royalties-normalizer.js';
import { startChunkedImport, appendChunkedImport, finishChunkedImport } from '../../../lib/royalties.js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

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

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const storageBucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';
  const parseCsv = parseCsvDefault;
  const normalizeEmpireRows = normalizeEmpireRowsDefault;

  try {
    const { action } = req.body || {};

    if (action === 'start') {
      const { statement = {}, batchMeta = {} } = req.body || {};
      const ids = await startChunkedImport({ statement, batchMeta });
      return res.status(200).json(ids);
    }

    if (action === 'chunk') {
      const { storagePath, offset = 0, limit = 25, statementId, batchId } = req.body || {};
      if (!storagePath || !statementId || !batchId) return res.status(400).json({ error: 'storagePath, statementId, batchId are required' });
      if (!supabaseUrl || !supabaseServiceKey) return res.status(400).json({ error: 'Supabase env not configured' });

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: blob, error: dlErr } = await supabase.storage.from(storageBucket).download(storagePath);
      if (dlErr) return res.status(400).json({ error: `download failed: ${dlErr.message}` });

      const csvText = await blob.text();
      const parsed = parseCsv(csvText, { header: true, skipEmptyLines: true });
      const rows = parsed.data || [];

      const start = Math.max(0, Number(offset));
      const end = Math.min(rows.length, start + Number(limit));
      const slice = rows.slice(start, end);
      if (slice.length === 0) return res.status(200).json({ appended: 0, revenue: 0, units: 0, done: true, totalRows: rows.length });

      const normalized = normalizeEmpireRows(slice);
      const out = await appendChunkedImport({
        statementId,
        batchId,
        releases: normalized.releases ?? [],
        collaborators: normalized.collaborators ?? [],
        lineItems: normalized.lineItems ?? [],
      });

      return res.status(200).json({ ...out, done: end >= rows.length, nextOffset: end, totalRows: rows.length });
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

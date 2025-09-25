// pages/api/royalties/import.js
import { parseCsv } from '../../../lib/vendor/papaparse';
import { normalizeEmpireRows } from '../../../lib/royalties-normalizer';
import { saveImportBatch, getImportHistory } from '../../../lib/royalties';
import { supabaseAdmin } from '../../../lib/supabaseServer';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'royalty';

function isAuthorized(req) {
  const headerToken = req.headers['x-admin-token'];
  return Boolean(ADMIN_TOKEN) && typeof headerToken === 'string' && headerToken === ADMIN_TOKEN;
}

// JSON body only. No multipart.
export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized: missing or invalid admin token.' });
    return;
  }

  if (req.method === 'GET') {
    const history = await getImportHistory();
    res.status(200).json({ ok: true, history });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    const { path } = req.body || {};
    if (!path) {
      res.status(400).json({ ok: false, error: 'Missing "path" in JSON body.' });
      return;
    }

    // Download CSV from Supabase Storage
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
    if (error) {
      res.status(500).json({ ok: false, error: `Storage download failed: ${error.message}` });
      return;
    }

    // data is a Blob in Node; convert to text
    const csvText = await data.text();

    const parsed = parseCsv(csvText, { header: true, skipEmptyLines: true });
    if (!parsed.data?.length) {
      res.status(400).json({ ok: false, error: 'No data rows detected in the CSV.' });
      return;
    }

    const normalized = normalizeEmpireRows(parsed.data);

    const result = await saveImportBatch({
      ...normalized,
      batchMeta: {
        source: 'EMPIRE',
        originalFilename: path.split('/').pop() || 'uploaded.csv',
        importedBy: 'admin-api',
        status: 'completed',
        warnings: normalized.warnings,
        errors: parsed.errors,
      },
    });

    res.status(200).json({
      ok: true,
      batchId: result.batchId,
      statementId: result.statementId,
      summary: {
        lineItems: result.lineItemCount,
        releases: result.releaseCount,
        collaborators: result.collaboratorCount,
        currency: normalized.statement.currency,
        totalAmount: normalized.statement.totalAmount,
        warnings: normalized.warnings,
        parseErrors: parsed.errors,
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Import failed.' });
  }
}

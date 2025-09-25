import { parseMultipartForm, readRequestBody } from '../../../lib/api/multipart';
import { parseCsv } from '../../../lib/vendor/papaparse';
import { normalizeEmpireRows } from '../../../lib/royalties-normalizer';
import { saveImportBatch, getImportHistory } from '../../../lib/royalties';

const STORAGE_BUCKET =
  process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

function isAuthorized(req) {
  const headerToken = req.headers['x-admin-token'];
  if (!ADMIN_TOKEN) {
    return false;
  }
  return typeof headerToken === 'string' && headerToken === ADMIN_TOKEN;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function importCsvBuffer(buffer, filename) {
  const csvText = buffer.toString('utf8');
  const parsed = parseCsv(csvText, { header: true, skipEmptyLines: true });

  if (!parsed.data.length) {
    throw new Error('No data rows were detected in the uploaded CSV.');
  }

  const normalized = normalizeEmpireRows(parsed.data);
  const result = await saveImportBatch({
    ...normalized,
    batchMeta: {
      source: 'EMPIRE',
      originalFilename: filename,
      importedBy: 'admin-api',
      status: 'completed',
      warnings: normalized.warnings,
      errors: parsed.errors,
    },
  });

  return {
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
  };
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid admin token.' });
    return;
  }

  if (req.method === 'GET') {
    const history = await getImportHistory();
    res.status(200).json({ history });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const contentType = req.headers['content-type'] || '';

  try {
    let importResult = null;

    if (contentType.includes('application/json')) {
      const bodyBuffer = await readRequestBody(req);
      const payload = JSON.parse(bodyBuffer.toString('utf8') || '{}');
      const storagePath = payload.storagePath;
      if (!storagePath) {
        throw new Error('Request missing required "storagePath".');
      }

      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('Supabase environment variables are not configured.');
      }

      const downloadUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(
        STORAGE_BUCKET
      )}/${encodeURIComponent(storagePath)}`;

      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Unable to download CSV from storage: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = storagePath.split('/').pop() || 'uploaded.csv';
      importResult = await importCsvBuffer(buffer, filename);
    } else if (contentType.includes('multipart/form-data')) {
      const { files } = await parseMultipartForm(req);
      if (!files.length) {
        throw new Error('CSV file missing from request. Expected form field "file".');
      }

      const upload = files.find((file) => file.fieldName === 'file') || files[0];
      importResult = await importCsvBuffer(upload.buffer, upload.filename);
    } else {
      throw new Error(
        'Requests must be multipart/form-data with a CSV file or JSON with a "storagePath".'
      );
    }

    res.status(200).json({ success: true, ...importResult });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Import failed.' });
  }
}

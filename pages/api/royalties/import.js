import { parseMultipartForm as parseMultipartFormDefault, readRequestBody as readRequestBodyDefault } from '../../../lib/api/multipart.js';
import { parseCsv as parseCsvDefault } from '../../../lib/vendor/papaparse.js';
import { normalizeEmpireRows as normalizeEmpireRowsDefault } from '../../../lib/royalties-normalizer.js';

let royaltiesModulePromise;
async function loadRoyaltiesModule() {
  if (!royaltiesModulePromise) {
    royaltiesModulePromise = import('../../../lib/royalties.js');
  }
  return royaltiesModulePromise;
}

async function saveImportBatchDefault(payload) {
  const module = await loadRoyaltiesModule();
  return module.saveImportBatch(payload);
}

async function getImportHistoryDefault() {
  const module = await loadRoyaltiesModule();
  return module.getImportHistory();
}

function resolveFetch(fetchImpl) {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch === 'function') return (...args) => fetch(...args);
  throw new Error('Fetch implementation is required');
}

function isAuthorized(req, adminToken) {
  const headerToken = req.headers['x-admin-token'];
  if (!adminToken) {
    return false;
  }
  return typeof headerToken === 'string' && headerToken === adminToken;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export function createImportHandler({
  parseMultipartForm = parseMultipartFormDefault,
  readRequestBody = readRequestBodyDefault,
  parseCsv = parseCsvDefault,
  normalizeEmpireRows = normalizeEmpireRowsDefault,
  saveImportBatch = saveImportBatchDefault,
  getImportHistory = getImportHistoryDefault,
  fetchImpl,
} = {}) {
  const fetcher = resolveFetch(fetchImpl);

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

  return async function handler(req, res) {
    const adminToken = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
    if (!isAuthorized(req, adminToken)) {
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
    const storageBucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');

    try {
      let importResult = null;

      if (contentType.includes('application/json')) {
        const bodyBuffer = await readRequestBody(req);
        const payload = JSON.parse(bodyBuffer.toString('utf8') || '{}');
        const storagePath = payload.storagePath;
        if (!storagePath) {
          throw new Error('Request missing required "storagePath".');
        }

        if (!supabaseUrl || !supabaseServiceKey) {
          throw new Error('Supabase environment variables are not configured.');
        }

        const downloadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(
          storageBucket
        )}/${encodeURIComponent(storagePath)}`;

        const response = await fetcher(downloadUrl, {
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
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
  };
}

export default createImportHandler();

import { parseMultipartForm } from '../../../lib/api/multipart';
import { parseCsv } from '../../../lib/vendor/papaparse';
import { normalizeEmpireRows } from '../../../lib/royalties-normalizer';
import { saveImportBatch, getImportHistory } from '../../../lib/royalties';

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
  if (!contentType.includes('multipart/form-data')) {
    res.status(400).json({ error: 'Requests must be multipart/form-data with a CSV file.' });
    return;
  }

  try {
    const { files } = await parseMultipartForm(req);
    if (!files.length) {
      throw new Error('CSV file missing from request. Expected form field "file".');
    }

    const upload = files.find((file) => file.fieldName === 'file') || files[0];
    const csvText = upload.buffer.toString('utf8');
    const parsed = parseCsv(csvText, { header: true, skipEmptyLines: true });

    if (!parsed.data.length) {
      throw new Error('No data rows were detected in the uploaded CSV.');
    }

    const normalized = normalizeEmpireRows(parsed.data);
    const result = await saveImportBatch({
      ...normalized,
      batchMeta: {
        source: 'EMPIRE',
        originalFilename: upload.filename,
        importedBy: 'admin-api',
        status: 'completed',
        warnings: normalized.warnings,
        errors: parsed.errors,
      },
    });

    res.status(200).json({
      success: true,
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
  } catch (error) {
    res.status(400).json({ error: error.message || 'Import failed.' });
  }
}

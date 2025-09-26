const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, describe, beforeEach, afterEach } = require('node:test');

const ORIGINAL_ENV = { ...process.env };

const createResponse = () => ({
  statusCode: 200,
  jsonPayload: undefined,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.jsonPayload = payload;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  },
});

let factory;
const loadFactory = async () => {
  if (!factory) {
    ({ createImportHandler: factory } = await import(
      pathToFileURL(path.resolve(__dirname, '../../pages/api/royalties/import.js')).href
    ));
  }
  return factory;
};

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('API /api/royalties/import', () => {
  test('rejects missing admin token', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';

    const handler = (await loadFactory())();
    const req = { method: 'GET', headers: {} };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.jsonPayload.error, 'Unauthorized: missing or invalid admin token.');
  });

  test('returns import history when authorized', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';

    const handler = (await loadFactory())({
      getImportHistory: async () => [{ id: 'batch-1' }],
    });
    const req = { method: 'GET', headers: { 'x-admin-token': 'secret' } };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.jsonPayload, { history: [{ id: 'batch-1' }] });
  });

  test('imports CSV from Supabase storage path', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_BUCKET = 'royalty';

    let savedPayload;
    const fetchCalls = [];
    const handler = (await loadFactory())({
      readRequestBody: async () => Buffer.from(JSON.stringify({ storagePath: 'folder/file.csv' })),
      parseCsv: () => ({ data: [{ row: 1 }], errors: [] }),
      normalizeEmpireRows: () => ({
        statement: { currency: 'USD', totalAmount: 100 },
        warnings: [],
        lineItemCount: 1,
        releaseCount: 1,
        collaboratorCount: 1,
      }),
      saveImportBatch: async (payload) => {
        savedPayload = payload;
        return {
          batchId: 'batch-1',
          statementId: 'statement-1',
          lineItemCount: 1,
          releaseCount: 1,
          collaboratorCount: 1,
        };
      },
      fetchImpl: async (...args) => {
        fetchCalls.push(args);
        return {
          ok: true,
          arrayBuffer: async () => Buffer.from('csv'),
        };
      },
    });

    const req = {
      method: 'POST',
      headers: {
        'x-admin-token': 'secret',
        'content-type': 'application/json',
      },
    };
    const res = createResponse();

    await handler(req, res);

    assert.equal(fetchCalls.length, 1);
    assert.equal(
      fetchCalls[0][0],
      'https://example.supabase.co/storage/v1/object/royalty/folder%2Ffile.csv'
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonPayload.success, true);
    assert.equal(res.jsonPayload.batchId, 'batch-1');
    assert.equal(res.jsonPayload.statementId, 'statement-1');
    assert.ok(savedPayload);
  });

  test('validates multipart file uploads include a file', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';

    const handler = (await loadFactory())({
      parseMultipartForm: async () => ({ files: [] }),
    });
    const req = {
      method: 'POST',
      headers: {
        'x-admin-token': 'secret',
        'content-type': 'multipart/form-data; boundary=abc',
      },
    };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(
      res.jsonPayload.error,
      'CSV file missing from request. Expected form field "file".'
    );
  });
});

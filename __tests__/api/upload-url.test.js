const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, beforeEach, afterEach, describe } = require('node:test');

const ORIGINAL_ENV = { ...process.env };

const createResponse = () => ({
  statusCode: 200,
  jsonPayload: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.jsonPayload = payload;
    return this;
  },
});

let factory;
const loadFactory = async () => {
  if (!factory) {
    ({ createUploadUrlHandler: factory } = await import(
      pathToFileURL(path.resolve(__dirname, '../../pages/api/royalties/upload-url.js')).href
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

describe('POST /api/royalties/upload-url', () => {
  test('rejects non-POST methods', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';
    const handler = (await loadFactory())();
    const req = { method: 'GET', headers: { 'x-admin-token': 'secret' } };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.jsonPayload, { error: 'Method not allowed' });
  });

  test('rejects unauthorized callers', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';
    const handler = (await loadFactory())();
    const req = { method: 'POST', headers: {}, body: {} };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
  });

  test('returns signed upload URL with normalized path', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_BUCKET = 'royalty';

    let callCount = 0;
    const handler = (await loadFactory())({
      createClient: () => ({
        storage: {
          from: () => ({
            createSignedUploadUrl: async () => {
              callCount += 1;
              return {
                data: { signedUrl: '/object/sign/royalty/test.csv', token: 'abc123' },
                error: null,
              };
            },
          }),
        },
      }),
    });

    const req = {
      method: 'POST',
      headers: { 'x-admin-token': 'secret' },
      body: {
        filename: 'test csv.csv',
        contentType: 'text/csv',
        path: 'folder/inner/..//test csv.csv',
      },
    };
    const res = createResponse();

    await handler(req, res);

    assert.equal(callCount, 1);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonPayload.path, 'folder/inner/test_csv.csv');
    assert.equal(res.jsonPayload.signedUrl, 'https://example.supabase.co/object/sign/royalty/test.csv');
    assert.equal(res.jsonPayload.token, 'abc123');
  });

  test('surfaces Supabase errors in the response', async () => {
    process.env.ADMIN_API_TOKEN = 'secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    const handler = (await loadFactory())({
      createClient: () => ({
        storage: {
          from: () => ({
            createSignedUploadUrl: async () => ({
              data: null,
              error: { message: 'Bucket not found', statusCode: 404, name: 'StorageError' },
            }),
          }),
        },
      }),
    });

    const req = {
      method: 'POST',
      headers: { 'x-admin-token': 'secret' },
      body: { filename: 'file.csv', contentType: 'text/csv' },
    };
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.jsonPayload, {
      error: 'Supabase createSignedUploadUrl error',
      detail: { message: 'Bucket not found', statusCode: 404, name: 'StorageError' },
    });
  });
});

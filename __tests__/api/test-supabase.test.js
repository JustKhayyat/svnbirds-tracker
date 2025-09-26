const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, describe, beforeEach, afterEach } = require('node:test');

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
    ({ createTestSupabaseHandler: factory } = await import(
      pathToFileURL(path.resolve(__dirname, '../../pages/api/test-supabase.js')).href
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

describe('GET /api/test-supabase', () => {
  test('returns configuration error when env is missing', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';

    const handler = (await loadFactory())({ fetchImpl: async () => ({ ok: true, json: async () => [] }) });
    const res = createResponse();

    await handler({}, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.jsonPayload.error, 'Supabase environment variables are not configured.');
    assert.deepEqual(res.jsonPayload.debug, {
      bucket: 'royalty',
      projectUrlHost: null,
      projectUrlPresent: false,
      hasServiceKey: true,
    });
  });

  test('lists storage objects and returns debug info', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.SUPABASE_BUCKET = 'royalty';

    const calls = [];
    const handler = (await loadFactory())({
      fetchImpl: async (...args) => {
        calls.push(args);
        return {
          ok: true,
          json: async () => [{ name: 'file.csv' }],
        };
      },
    });
    const res = createResponse();

    await handler({}, res);

    assert.equal(res.statusCode, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'https://example.supabase.co/storage/v1/object/list/royalty');
    assert.deepEqual(res.jsonPayload.debug, {
      bucket: 'royalty',
      projectUrlHost: 'example.supabase.co',
      projectUrlPresent: true,
      hasServiceKey: true,
    });
  });

  test('returns Supabase failure details', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    const handler = (await loadFactory())({
      fetchImpl: async () => ({
        ok: false,
        text: async () => 'Bucket not found',
      }),
    });
    const res = createResponse();

    await handler({}, res);

    assert.equal(res.statusCode, 502);
    assert.equal(res.jsonPayload.error, 'Unable to list Supabase storage objects.');
    assert.equal(res.jsonPayload.detail, 'Bucket not found');
  });
});

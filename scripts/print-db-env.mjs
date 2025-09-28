#!/usr/bin/env node
const rawUrl = process.env.DATABASE_URL || '';

if (!rawUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(rawUrl);
} catch (error) {
  console.error('DATABASE_URL is not a valid URL:', error.message);
  process.exit(1);
}

const username = parsed.username || '';
const host = parsed.hostname || '';
const port = parsed.port || '';
const maskedUser = username ? `${username.slice(0, 8)}${username.length > 8 ? '…' : ''}` : '(missing)';
const hostWithPort = port ? `${host}:${port}` : host;

console.log(`DATABASE_URL user (first 8 chars): ${maskedUser}`);
console.log(`DATABASE_URL host: ${hostWithPort}`);

const patternMatches =
  username.includes('.bvywkbqhmtsgeevwzbba') &&
  /pooler/.test(host) &&
  port === '6543';

if (!patternMatches) {
  console.error(
    'Expected pooled Supabase credentials: user should include ".bvywkbqhmtsgeevwzbba" and host should point to the pooler on port 6543.'
  );
  process.exit(1);
}

console.log('DATABASE_URL matches expected pooled Supabase pattern.');

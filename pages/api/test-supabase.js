function resolveFetch(fetchImpl) {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch === 'function') return (...args) => fetch(...args);
  throw new Error('Fetch implementation is required');
}

export function createTestSupabaseHandler({ fetchImpl } = {}) {
  const fetcher = resolveFetch(fetchImpl);

  return async function handler(req, res) {
    const bucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';
    const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseUrl = supabaseUrlEnv.replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    let projectUrlHost = null;
    try {
      projectUrlHost = supabaseUrl ? new URL(supabaseUrl).host : null;
    } catch (error) {
      projectUrlHost = null;
    }

    const debug = {
      bucket,
      projectUrlHost,
      projectUrlPresent: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
    };

    if (!supabaseUrl || !serviceKey) {
      res.status(500).json({ error: 'Supabase environment variables are not configured.', debug });
      return;
    }

    const listUrl = `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`;

    try {
      const response = await fetcher(listUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ prefix: '' }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.status(502).json({
          error: 'Unable to list Supabase storage objects.',
          detail: errorText,
          debug,
        });
        return;
      }

      const data = await response.json();
      res.status(200).json({ ok: true, files: data, debug });
    } catch (error) {
      console.error('test-supabase fetch error', error);
      res.status(502).json({
        error: 'Failed to communicate with Supabase storage.',
        message: error.message,
        debug,
      });
    }
  };
}

export default createTestSupabaseHandler();

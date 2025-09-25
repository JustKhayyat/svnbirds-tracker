const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

function isAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  const headerToken = req.headers['x-admin-token'];
  return typeof headerToken === 'string' && headerToken === ADMIN_TOKEN;
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid admin token.' });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Supabase environment variables are not configured.' });
    return;
  }

  const { filename = 'statement.csv', contentType = 'text/csv', path } = req.body || {};

  const sanitizedName = String(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const objectPath = typeof path === 'string' && path ? path : `${Date.now()}-${sanitizedName}`;

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/upload/sign/${encodeURIComponent(
    bucket
  )}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        expiresIn: 60,
        upsert: true,
        contentType,
        objectName: objectPath,
        path: objectPath,
        name: objectPath,
        bucketId: bucket,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(500).json({ error: errorText || 'Unable to create Supabase upload URL.' });
      return;
    }

    const payload = await response.json();
    res.status(200).json({
      path: objectPath,
      signedUrl: payload.signedUrl || payload.url || '',
      token: payload.token || payload.signedToken || '',
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create Supabase upload URL.' });
  }
}

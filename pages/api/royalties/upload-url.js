const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

function isAuthorized(req) {
  if (!ADMIN_TOKEN) return false;
  const headerToken = req.headers['x-admin-token'];
  return typeof headerToken === 'string' && headerToken === ADMIN_TOKEN;
}

async function ensureBucketExists({ supabaseUrl, serviceKey, bucket }) {
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  const headers = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  };

  try {
    const getResponse = await fetch(`${baseUrl}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
      headers,
    });

    if (getResponse.ok) {
      return true;
    }

    if (getResponse.status !== 404) {
      return false;
    }
  } catch (error) {
    // If fetching the bucket status fails unexpectedly, attempt to create it anyway.
  }

  try {
    const createResponse = await fetch(`${baseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: bucket,
        public: false,
      }),
    });

    if (createResponse.ok || createResponse.status === 409) {
      return true;
    }
  } catch (error) {
    // Ignore and surface failure to caller.
  }

  return false;
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

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';

  console.log('upload-url debug', {
    bucket,
    projectUrlPresent: Boolean(projectUrl),
    hasServiceRole: Boolean(serviceRole),
  });

  if (!projectUrl) {
    res.status(500).json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL' });
    return;
  }

  if (!serviceRole) {
    res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (error) {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }
  }

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return;
  }

  const { filename, contentType, path } = body;

  if (!filename || !contentType) {
    res.status(400).json({ error: 'Both filename and contentType are required.' });
    return;
  }

  const sanitizedName = String(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const objectPath = typeof path === 'string' && path ? path : `${Date.now()}-${sanitizedName}`;

  const supabaseUrl = projectUrl.replace(/\/$/, '');
  const signUrl = `${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(
    objectPath
  )}`;

  try {
    const bucketReady = await ensureBucketExists({ supabaseUrl: projectUrl, serviceKey: serviceRole, bucket });

    if (!bucketReady) {
      res.status(500).json({ error: `Supabase bucket "${bucket}" is not available.` });
      return;
    }

    const response = await fetch(signUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRole}`,
        apikey: serviceRole,
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    });

    if (!response.ok) {
      let errorPayload;
      try {
        errorPayload = await response.json();
      } catch (error) {
        errorPayload = await response.text();
      }
      const message =
        typeof errorPayload === 'string'
          ? errorPayload || 'Unable to create Supabase upload URL.'
          : JSON.stringify(errorPayload);
      res
        .status(response.status >= 400 ? response.status : 500)
        .json({ error: message || 'Unable to create Supabase upload URL.' });
      return;
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      res.status(500).json({ error: 'Invalid response from Supabase sign endpoint.' });
      return;
    }

    res.status(200).json({
      path: objectPath,
      signedUrl: payload.signedUrl || payload.url || '',
      token: payload.token || payload.signedToken || '',
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create Supabase upload URL.' });
  }
}

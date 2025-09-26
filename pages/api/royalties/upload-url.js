// pages/api/royalties/upload-url.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const adminHeader = req.headers['x-admin-token'] || req.headers['x_admin_token'];
    if (!adminHeader || adminHeader !== process.env.ADMIN_API_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';

    if (!projectUrl) return res.status(500).json({ error: 'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL' });
    if (!serviceRole) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON body.' }); }
    }
    const { filename, contentType, path } = body || {};
    if (!filename || !contentType) return res.status(400).json({ error: 'Missing filename or contentType' });

    const sanitizedName = String(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const objectPath = typeof path === 'string' && path ? path : `${Date.now()}-${sanitizedName}`;

    // debug log (safe)
    console.log('upload-url debug', { bucket, projectUrlPresent: Boolean(projectUrl), hasServiceRole: Boolean(serviceRole), objectPath });

    const supabaseAdmin = createClient(projectUrl, serviceRole, { auth: { persistSession: false } });

    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(objectPath);

    if (error) {
      console.error('upload-url createSignedUploadUrl error', error);
      return res.status(502).json({ error: 'Supabase createSignedUploadUrl error', detail: error });
    }

    if (!data) {
      return res.status(502).json({ error: 'Supabase returned no data from createSignedUploadUrl' });
    }

    let signedUrl = data.signedUrl || data.signedURL || data.signed_url || '';
    if (signedUrl && signedUrl.startsWith('/')) signedUrl = `${projectUrl}${signedUrl}`;

    return res.status(200).json({
      path: objectPath,
      signedUrl,
      token: data.token || data.signedToken || null,
    });
  } catch (err) {
    console.error('upload-url error', err);
    return res.status(500).json({ error: 'Internal error', message: err.message || String(err) });
  }
}

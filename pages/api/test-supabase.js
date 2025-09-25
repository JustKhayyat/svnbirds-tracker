export default async function handler(req, res) {
  const bucket = process.env.SUPABASE_BUCKET || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Supabase environment variables are not configured.' });
    return;
  }

  const listUrl = `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`;

  const response = await fetch(listUrl, {
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
    res.status(500).json({ error: errorText || 'Unable to list Supabase storage objects.' });
    return;
  }

  const data = await response.json();
  res.status(200).json({ ok: true, files: data });
}

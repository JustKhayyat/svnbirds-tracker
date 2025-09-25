export async function uploadRoyaltyCSV(file) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const objectPath = `${Date.now()}-${sanitizedName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURIComponent(
    objectPath
  )}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'text/csv',
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Unable to upload CSV to Supabase storage.');
  }

  return { path: objectPath };
}

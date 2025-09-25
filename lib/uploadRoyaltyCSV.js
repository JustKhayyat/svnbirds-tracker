function trimTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function uploadRoyaltyCSV(file, { adminToken } = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Supabase environment variables are not configured.');
  }

  if (!adminToken) {
    throw new Error('Admin token missing for Supabase upload.');
  }

  const sanitizedName = (file.name || 'statement.csv').replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const objectPath = `${Date.now()}-${sanitizedName}`;

  const response = await fetch('/api/royalties/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: JSON.stringify({
      filename: sanitizedName,
      contentType: file.type || 'text/csv',
      path: objectPath,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Unable to create Supabase upload URL.');
  }

  const payload = await response.json();
  const { signedUrl, token } = payload;

  if (!signedUrl || !token) {
    throw new Error('Supabase upload token was not returned.');
  }

  const finalUrl = signedUrl.startsWith('http')
    ? signedUrl
    : `${trimTrailingSlash(supabaseUrl)}${signedUrl.startsWith('/') ? signedUrl : `/${signedUrl}`}`;

  const uploadResponse = await fetch(finalUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'text/csv',
      Authorization: `Bearer ${token}`,
      apikey: token,
      'x-upsert': 'true',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(errorText || 'Unable to upload CSV to Supabase storage.');
  }

  return { path: payload.path || objectPath };
}
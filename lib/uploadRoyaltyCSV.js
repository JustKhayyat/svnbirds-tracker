import { supabase } from '@/lib/supabaseClient';

export async function uploadRoyaltyCSV(file) {
  const r = await fetch('/api/upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name })
  });
  if (!r.ok) throw new Error(await r.text());
  const { path, token } = await r.json();

  const { error } = await supabase
    .storage.from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'royalty')
    .uploadToSignedUrl(path, token, file);
  if (error) throw error;

  return { path };
}

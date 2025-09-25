import { supabaseAdmin } from '@/lib/supabaseServer';
export default async function handler(req, res) {
  const { name } = req.method === 'POST' ? req.body : req.query;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const path = `royalty/${Date.now()}-${name}`;
  const { data, error } = await supabaseAdmin
    .storage.from(process.env.SUPABASE_BUCKET).createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ path, token: data.token });
}

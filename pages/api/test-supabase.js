import { supabaseAdmin } from '@/lib/supabaseServer';

export default async function handler(req, res) {
  const { data, error } = await supabaseAdmin
    .storage.from(process.env.SUPABASE_BUCKET)
    .list('');
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true, files: data });
}

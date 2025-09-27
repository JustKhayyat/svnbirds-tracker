export default async function handler(req, res) {
  try {
    const resolved = require.resolve('@prisma/client');
    const prisma = (await import('../../lib/prisma')).default;
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true, resolved, node: process.version });
  } catch (e) {
    res.status(500).json({ ok: false, message: String(e) });
  }
}

import { PrismaClient } from '@prisma/client';

export const config = { runtime: 'nodejs' };

const prisma = new PrismaClient();

export default async function handler(req, res) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  } finally {
    await prisma.$disconnect();
  }
}

import { PrismaClient } from '@prisma/client';

const g = globalThis;
const prisma = g.__prisma || new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });
if (process.env.NODE_ENV !== 'production') g.__prisma = prisma;

export default prisma;

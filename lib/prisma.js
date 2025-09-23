let PrismaClient;

try {
  const runtimeRequire = eval('require');
  ({ PrismaClient } = runtimeRequire('@prisma/client'));
} catch (error) {
  throw new Error(
    'Prisma Client has not been generated. Install dependencies and run `npx prisma generate` before using the database layer.'
  );
}

const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma__ ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma__ = prisma;
}

module.exports = prisma;
module.exports.default = prisma;

let prisma;

async function main() {
  prisma = (await import('../lib/prisma.js')).default;

  console.log('Clearing existing data...');
  await prisma.statementLineSplit.deleteMany();
  await prisma.statementLine.deleteMany();
  await prisma.royaltyImportBatch.deleteMany();
  await prisma.royaltyStatement.deleteMany();
  await prisma.splitAgreement.deleteMany();
  await prisma.collaborator.deleteMany();
  await prisma.release.deleteMany();

  console.log('Creating seed records...');
  const release = await prisma.release.create({
    data: {
      id: 'seed-release-1',
      title: 'Baseline Release',
      primaryArtist: 'The Baselines',
      artists: ['The Baselines'],
      releaseDate: new Date('2023-01-20T00:00:00Z'),
      status: 'live',
      platformLinks: {
        spotify: 'https://open.spotify.com/album/seed-release-1',
        apple: 'https://music.apple.com/album/seed-release-1',
      },
      coverArt: 'https://example.com/covers/baseline.jpg',
      type: 'single',
      notes: 'Seeded release used for demos and integration tests.',
      label: 'Example Label',
      upc: '000000000001',
    },
  });

  const collaborator = await prisma.collaborator.create({
    data: {
      id: 'seed-collaborator-1',
      name: 'Jamie Seed',
      email: 'jamie.seed@example.com',
      role: 'Writer',
      payeeReference: 'PAYEE-1001',
    },
  });

  await prisma.splitAgreement.create({
    data: {
      id: 'seed-split-1',
      releaseId: release.id,
      collaboratorId: collaborator.id,
      sharePercentage: 50,
      agreementType: 'Master',
      effectiveDate: new Date('2022-12-31T00:00:00Z'),
    },
  });

  const statement = await prisma.royaltyStatement.create({
    data: {
      id: 'seed-statement-1',
      provider: 'Seed Distribution',
      reference: 'STATEMENT-2024-01',
      periodLabel: 'January 2024',
      periodStart: new Date('2024-01-01T00:00:00Z'),
      periodEnd: new Date('2024-01-31T23:59:59Z'),
      statementDate: new Date('2024-02-15T00:00:00Z'),
      currency: 'USD',
      totalAmount: 120.75,
      totalUnits: 3200,
      metadata: {
        sourceFile: 'seed-statement.csv',
      },
      lines: {
        create: [
          {
            id: 'seed-line-1',
            releaseId: release.id,
            sequence: 1,
            trackTitle: 'Baseline Anthem',
            isrc: 'US-EX1-23-00001',
            usageDate: new Date('2024-01-15T00:00:00Z'),
            service: 'Spotify',
            territory: 'US',
            units: 1800,
            netRevenue: 72.5,
            grossRevenue: 90.0,
            fee: 5.0,
            currency: 'USD',
            payoutStatus: 'processing',
            metadata: {
              region: 'North America',
            },
            splits: {
              create: [
                {
                  id: 'seed-split-line-1',
                  collaboratorId: collaborator.id,
                  sharePercentage: 50,
                  amount: 36.25,
                  payoutStatus: 'processing',
                },
              ],
            },
          },
          {
            id: 'seed-line-2',
            releaseId: release.id,
            sequence: 2,
            trackTitle: 'Baseline Anthem (Instrumental)',
            isrc: 'US-EX1-23-00002',
            usageDate: new Date('2024-01-22T00:00:00Z'),
            service: 'Apple Music',
            territory: 'US',
            units: 1400,
            netRevenue: 48.25,
            grossRevenue: 60.0,
            fee: 4.0,
            currency: 'USD',
            payoutStatus: 'pending',
            metadata: {
              region: 'North America',
            },
            splits: {
              create: [
                {
                  id: 'seed-split-line-2',
                  collaboratorId: collaborator.id,
                  sharePercentage: 50,
                  amount: 24.13,
                  payoutStatus: 'pending',
                },
              ],
            },
          },
        ],
      },
    },
    include: {
      lines: true,
    },
  });

  await prisma.royaltyImportBatch.create({
    data: {
      id: 'seed-batch-1',
      statementId: statement.id,
      source: 'Seed Distribution',
      importedAt: new Date('2024-02-20T00:00:00Z'),
      importedBy: 'seed-script',
      originalFilename: 'seed-statement.csv',
      lineItemCount: 2,
      releaseCount: 1,
      collaboratorCount: 1,
      totalRevenue: statement.totalAmount,
      currency: statement.currency,
      status: 'completed',
      warnings: [],
      errors: [],
    },
  });

  console.log('Seed data created successfully.');
}

main()
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

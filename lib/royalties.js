import prisma from './prisma.js';

const TX_TIMEOUT_MS = Number(process.env.ROYALTIES_TX_TIMEOUT_MS ?? 30000);   // 30s per batch
const TX_MAX_WAIT_MS = Number(process.env.ROYALTIES_TX_MAX_WAIT_MS ?? 10000); // wait up to 10s for a pooled conn
const LINE_BATCH_SIZE = Number(process.env.ROYALTIES_LINE_BATCH_SIZE ?? 200); // rows per txn batch

function sanitizeNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (value instanceof Date) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function sanitizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sanitizeString(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

function sanitizeJson(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return fallback;
}

function normalizeArtists(primaryArtist) {
  if (!primaryArtist) return [];
  return primaryArtist.split(',').map((a) => a.trim()).filter(Boolean);
}

// ---------- Resolution helpers (use general client, not long txn) ----------
async function resolveReleaseId(client, release, now, cache) {
  const lookupKey = release.lookupKey;
  if (cache.has(lookupKey)) return cache.get(lookupKey) ?? null;

  const upc = sanitizeString(release.upc);
  const title = sanitizeString(release.title);
  const primaryArtist = sanitizeString(release.primaryArtist);

  let existing = null;
  if (upc) {
    existing = await client.release.findFirst({ where: { upc } });
  }
  if (!existing && title && primaryArtist) {
    existing = await client.release.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        primaryArtist: { equals: primaryArtist, mode: 'insensitive' },
      },
    });
  }
  if (!existing && title) {
    existing = await client.release.findFirst({
      where: { title: { equals: title, mode: 'insensitive' } },
    });
  }

  if (existing) {
    cache.set(lookupKey, existing.id);
    await client.release.update({
      where: { id: existing.id },
      data: {
        title: title ?? existing.title,
        primaryArtist: primaryArtist ?? existing.primaryArtist,
        upc: upc ?? existing.upc,
        label: sanitizeString(release.label) ?? existing.label,
        releaseDate: sanitizeDate(release.releaseDate) ?? existing.releaseDate,
        updatedAt: now,
      },
    });
    return existing.id;
  }

  const created = await client.release.create({
    data: {
      title,
      primaryArtist,
      upc,
      label: sanitizeString(release.label),
      releaseDate: sanitizeDate(release.releaseDate),
      artists: normalizeArtists(primaryArtist ?? undefined),
      status: 'planned',
      platformLinks: {},
      type: 'single',
      notes: null,
      coverArt: null,
      createdAt: now,
      updatedAt: now,
    },
  });

  cache.set(lookupKey, created.id);
  return created.id;
}

async function resolveCollaboratorId(client, collaborator, now, cache) {
  const lookupKey = collaborator.lookupKey;
  if (cache.has(lookupKey)) return cache.get(lookupKey) ?? null;

  const email = sanitizeString(collaborator.email)?.toLowerCase() ?? null;
  const name = sanitizeString(collaborator.name);

  let existing = null;
  if (email) existing = await client.collaborator.findFirst({ where: { email } });
  if (!existing && name) {
    existing = await client.collaborator.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }

  if (existing) {
    cache.set(lookupKey, existing.id);
    await client.collaborator.update({
      where: { id: existing.id },
      data: {
        name: name ?? existing.name,
        email: email ?? existing.email,
        role: sanitizeString(collaborator.role) ?? existing.role,
        payeeReference: sanitizeString(collaborator.payeeReference) ?? existing.payeeReference,
        updatedAt: now,
      },
    });
    return existing.id;
  }

  const created = await client.collaborator.create({
    data: {
      name,
      email,
      role: sanitizeString(collaborator.role),
      payeeReference: sanitizeString(collaborator.payeeReference),
      createdAt: now,
      updatedAt: now,
    },
  });

  cache.set(lookupKey, created.id);
  return created.id;
}

// ---------- Single-call import with batched writes ----------
export async function saveImportBatch(payload) {
  const { statement, releases = [], collaborators = [], lineItems, batchMeta } = payload;
  if (!lineItems || !lineItems.length) throw new Error('No line items were provided for import');

  const now = new Date();

  // Resolve releases and collaborators OUTSIDE long transactions
  const releaseIdMap = new Map();
  const collaboratorIdMap = new Map();

  for (const r of releases) {
    const id = await resolveReleaseId(prisma, r, now, releaseIdMap);
    if (id) releaseIdMap.set(r.lookupKey, id);
  }
  for (const c of collaborators) {
    const id = await resolveCollaboratorId(prisma, c, now, collaboratorIdMap);
    if (id) collaboratorIdMap.set(c.lookupKey, id);
  }

  // Normalize rows
  const normalizedLineItems = lineItems.map((item) => {
    const releaseId = item.releaseLookupKey ? releaseIdMap.get(item.releaseLookupKey) ?? null : null;
    const collaboratorSplits = Array.isArray(item.collaborators)
      ? item.collaborators.map((split) => ({
          collaboratorId: split.collaboratorLookupKey
            ? collaboratorIdMap.get(split.collaboratorLookupKey) ?? null
            : null,
          sharePercentage: split.sharePercentage != null ? sanitizeNumber(split.sharePercentage, 0) : null,
          amount: split.amount != null ? sanitizeNumber(split.amount, 0) : null,
          payoutStatus: sanitizeString(split.payoutStatus) ?? sanitizeString(item.payoutStatus) ?? 'pending',
        }))
      : [];

    return {
      releaseId,
      sequence: item.sequence != null ? sanitizeNumber(item.sequence, 0) : null,
      trackTitle: sanitizeString(item.trackTitle),
      isrc: sanitizeString(item.isrc),
      usageDate: sanitizeDate(item.usageDate ?? null),
      service: sanitizeString(item.service),
      territory: sanitizeString(item.territory),
      units: sanitizeNumber(item.units, 0),
      netRevenue: sanitizeNumber(item.netRevenue, 0),
      grossRevenue: item.grossRevenue != null ? sanitizeNumber(item.grossRevenue, 0) : null,
      fee: item.fee != null ? sanitizeNumber(item.fee, 0) : null,
      currency: sanitizeString(item.currency) ?? sanitizeString(statement?.currency) ?? 'USD',
      payoutStatus: sanitizeString(item.payoutStatus) ?? 'pending',
      metadata: sanitizeJson(item.metadata ?? {}, {}),
      collaboratorSplits,
    };
  });

  const totalRevenue =
    statement && typeof statement.totalAmount === 'number'
      ? sanitizeNumber(statement.totalAmount, 0)
      : normalizedLineItems.reduce((sum, item) => sum + sanitizeNumber(item.netRevenue, 0), 0);

  const totalUnits =
    statement && typeof statement.totalUnits === 'number'
      ? sanitizeNumber(statement.totalUnits, 0)
      : normalizedLineItems.reduce((sum, item) => sum + sanitizeNumber(item.units, 0), 0);

  // Create statement
  const createdStatement = await prisma.royaltyStatement.create({
    data: {
      provider: sanitizeString(statement?.provider) ?? 'EMPIRE',
      reference: sanitizeString(statement?.reference),
      periodLabel: sanitizeString(statement?.periodLabel),
      periodStart: sanitizeDate(statement?.periodStart ?? null),
      periodEnd: sanitizeDate(statement?.periodEnd ?? null),
      statementDate: sanitizeDate(statement?.statementDate ?? null),
      currency: sanitizeString(statement?.currency) ?? 'USD',
      totalAmount: totalRevenue,
      totalUnits,
      metadata: sanitizeJson(statement?.metadata ?? {}, {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Insert lines in batches with short transactions
  for (let i = 0; i < normalizedLineItems.length; i += LINE_BATCH_SIZE) {
    const slice = normalizedLineItems.slice(i, i + LINE_BATCH_SIZE);

    await prisma.$transaction(
      async (tx) => {
        for (const item of slice) {
          await tx.statementLine.create({
            data: {
              statementId: createdStatement.id,
              releaseId: item.releaseId,
              sequence: item.sequence,
              trackTitle: item.trackTitle,
              isrc: item.isrc,
              usageDate: item.usageDate,
              service: item.service,
              territory: item.territory,
              units: item.units,
              netRevenue: item.netRevenue,
              grossRevenue: item.grossRevenue,
              fee: item.fee,
              currency: item.currency,
              payoutStatus: item.payoutStatus,
              metadata: item.metadata,
              createdAt: new Date(),
              updatedAt: new Date(),
              splits: {
                create: item.collaboratorSplits.map((split) => ({
                  collaboratorId: split.collaboratorId,
                  sharePercentage: split.sharePercentage,
                  amount: split.amount,
                  payoutStatus: split.payoutStatus ?? 'pending',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })),
              },
            },
          });
        }
      },
      { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS }
    );
  }

  // Record import meta
  const batchRecord = await prisma.royaltyImportBatch.create({
    data: {
      statementId: createdStatement.id,
      source: sanitizeString(batchMeta?.source) ?? createdStatement.provider,
      importedAt: new Date(),
      importedBy: sanitizeString(batchMeta?.importedBy),
      originalFilename: sanitizeString(batchMeta?.originalFilename),
      lineItemCount: normalizedLineItems.length,
      releaseCount: releases.length,
      collaboratorCount: collaborators.length,
      totalRevenue,
      currency: createdStatement.currency,
      status: sanitizeString(batchMeta?.status) ?? 'completed',
      warnings: Array.isArray(batchMeta?.warnings) ? batchMeta.warnings : [],
      errors: Array.isArray(batchMeta?.errors) ? batchMeta.errors : [],
    },
  });

  return {
    batchId: batchRecord.id,
    statementId: createdStatement.id,
    lineItemCount: normalizedLineItems.length,
    releaseCount: releases.length,
    collaboratorCount: collaborators.length,
    statement: createdStatement,
  };
}

export async function getImportHistory() {
  const batches = await prisma.royaltyImportBatch.findMany({
    orderBy: { importedAt: 'desc' },
    include: {
      statement: {
        select: {
          id: true,
          provider: true,
          reference: true,
          periodLabel: true,
          periodStart: true,
          periodEnd: true,
          statementDate: true,
          currency: true,
          totalAmount: true,
          totalUnits: true,
        },
      },
    },
  });

  return batches.map((batch) => ({
    id: batch.id,
    statementId: batch.statementId,
    importedAt: batch.importedAt,
    importedBy: batch.importedBy,
    originalFilename: batch.originalFilename,
    source: batch.source,
    status: batch.status,
    currency: batch.currency,
    totalRevenue: batch.totalRevenue,
    lineItemCount: batch.lineItemCount,
    releaseCount: batch.releaseCount,
    collaboratorCount: batch.collaboratorCount,
    warnings: batch.warnings,
    errors: batch.errors,
    statement: batch.statement,
  }));
}

export async function getStatementById(id) {
  if (!id) return null;
  return prisma.royaltyStatement.findUnique({ where: { id } });
}

export async function resetRoyaltiesDatabase() {
  await prisma.$transaction([
    prisma.statementLineSplit.deleteMany(),
    prisma.statementLine.deleteMany(),
    prisma.royaltyImportBatch.deleteMany(),
    prisma.royaltyStatement.deleteMany(),
    prisma.splitAgreement.deleteMany(),
    prisma.release.deleteMany(),
    prisma.collaborator.deleteMany(),
  ]);
}

export async function getReleaseById(id) {
  return prisma.release.findUnique({ where: { id } });
}

export async function listReleases() {
  return prisma.release.findMany({ orderBy: { createdAt: 'desc' } });
}

// ---------- Chunked import helpers (append at end) ----------
export async function startChunkedImport({ statement = {}, batchMeta = {} }) {
  const now = new Date();
  const createdStatement = await prisma.royaltyStatement.create({
    data: {
      provider: sanitizeString(statement.provider) ?? 'EMPIRE',
      reference: sanitizeString(statement.reference),
      periodLabel: sanitizeString(statement.periodLabel),
      periodStart: sanitizeDate(statement.periodStart ?? null),
      periodEnd: sanitizeDate(statement.periodEnd ?? null),
      statementDate: sanitizeDate(statement.statementDate ?? null),
      currency: sanitizeString(statement.currency) ?? 'USD',
      totalAmount: 0,
      totalUnits: 0,
      metadata: sanitizeJson(statement.metadata ?? {}, {}),
      createdAt: now,
      updatedAt: now,
    },
  });

  const batch = await prisma.royaltyImportBatch.create({
    data: {
      statementId: createdStatement.id,
      source: sanitizeString(batchMeta.source) ?? createdStatement.provider,
      importedAt: now,
      importedBy: sanitizeString(batchMeta.importedBy) ?? 'admin-api',
      originalFilename: sanitizeString(batchMeta.originalFilename),
      lineItemCount: 0,
      releaseCount: 0,
      collaboratorCount: 0,
      totalRevenue: 0,
      currency: createdStatement.currency,
      status: 'in_progress',
      warnings: Array.isArray(batchMeta.warnings) ? batchMeta.warnings : [],
      errors: Array.isArray(batchMeta.errors) ? batchMeta.errors : [],
    },
  });

  return { statementId: createdStatement.id, batchId: batch.id };
}

export async function appendChunkedImport({ statementId, batchId, releases = [], collaborators = [], lineItems = [] }) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return { appended: 0, revenue: 0, units: 0 };

  const now = new Date();

  // Resolve refs outside txn
  const releaseIdMap = new Map();
  const collaboratorIdMap = new Map();
  for (const r of releases) {
    const id = await resolveReleaseId(prisma, r, now, releaseIdMap);
    if (id) releaseIdMap.set(r.lookupKey, id);
  }
  for (const c of collaborators) {
    const id = await resolveCollaboratorId(prisma, c, now, collaboratorIdMap);
    if (id) collaboratorIdMap.set(c.lookupKey, id);
  }

  // Normalize lines
  const items = lineItems.map((item) => {
    const releaseId = item.releaseLookupKey ? releaseIdMap.get(item.releaseLookupKey) ?? null : null;
    const splits = Array.isArray(item.collaborators)
      ? item.collaborators.map((s) => ({
          collaboratorId: s.collaboratorLookupKey ? collaboratorIdMap.get(s.collaboratorLookupKey) ?? null : null,
          sharePercentage: s.sharePercentage != null ? sanitizeNumber(s.sharePercentage, 0) : null,
          amount: s.amount != null ? sanitizeNumber(s.amount, 0) : null,
          payoutStatus: sanitizeString(s.payoutStatus) ?? sanitizeString(item.payoutStatus) ?? 'pending',
        }))
      : [];

    return {
      releaseId,
      sequence: item.sequence != null ? sanitizeNumber(item.sequence, 0) : null,
      trackTitle: sanitizeString(item.trackTitle),
      isrc: sanitizeString(item.isrc),
      usageDate: sanitizeDate(item.usageDate ?? null),
      service: sanitizeString(item.service),
      territory: sanitizeString(item.territory),
      units: sanitizeNumber(item.units, 0),
      netRevenue: sanitizeNumber(item.netRevenue, 0),
      grossRevenue: item.grossRevenue != null ? sanitizeNumber(item.grossRevenue, 0) : null,
      fee: item.fee != null ? sanitizeNumber(item.fee, 0) : null,
      currency: sanitizeString(item.currency) ?? 'USD',
      payoutStatus: sanitizeString(item.payoutStatus) ?? 'pending',
      metadata: sanitizeJson(item.metadata ?? {}, {}),
      collaboratorSplits: splits,
    };
  });

  const batchSize = Number(process.env.ROYALTIES_LINE_BATCH_SIZE ?? 10);
  const txTimeout = Number(process.env.ROYALTIES_TX_TIMEOUT_MS ?? 60000);
  const txWait = Number(process.env.ROYALTIES_TX_MAX_WAIT_MS ?? 15000);

  let appended = 0;
  let totalRevenue = 0;
  let totalUnits = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);

    // compute per-slice sums to avoid double-counting
    let sliceRevenue = 0;
    let sliceUnits = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const it of slice) {
          sliceRevenue += it.netRevenue || 0;
          sliceUnits += it.units || 0;

          await tx.statementLine.create({
            data: {
              statementId,
              releaseId: it.releaseId,
              sequence: it.sequence,
              trackTitle: it.trackTitle,
              isrc: it.isrc,
              usageDate: it.usageDate,
              service: it.service,
              territory: it.territory,
              units: it.units,
              netRevenue: it.netRevenue,
              grossRevenue: it.grossRevenue,
              fee: it.fee,
              currency: it.currency,
              payoutStatus: it.payoutStatus,
              metadata: it.metadata,
              createdAt: now,
              updatedAt: now,
              splits: {
                create: it.collaboratorSplits.map((s) => ({
                  collaboratorId: s.collaboratorId,
                  sharePercentage: s.sharePercentage,
                  amount: s.amount,
                  payoutStatus: s.payoutStatus ?? 'pending',
                  createdAt: now,
                  updatedAt: now,
                })),
              },
            },
          });
        }

        await tx.royaltyStatement.update({
          where: { id: statementId },
          data: { totalAmount: { increment: sliceRevenue }, totalUnits: { increment: sliceUnits }, updatedAt: now },
        });

        await tx.royaltyImportBatch.update({
          where: { id: batchId },
          data: {
            lineItemCount: { increment: slice.length },
            releaseCount: { increment: releases.length || 0 },
            collaboratorCount: { increment: collaborators.length || 0 },
            totalRevenue: { increment: sliceRevenue },
            updatedAt: now,
          },
        });
      },
      { timeout: txTimeout, maxWait: txWait }
    );

    appended += slice.length;
    totalRevenue += sliceRevenue;
    totalUnits += sliceUnits;
  }

  return { appended, revenue: totalRevenue, units: totalUnits };
}

export async function finishChunkedImport({ batchId }) {
  await prisma.royaltyImportBatch.update({ where: { id: batchId }, data: { status: 'completed' } });
  return { ok: true };
}

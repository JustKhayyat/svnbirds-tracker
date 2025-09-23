import prisma from './prisma';

type ImportCollaborator = {
  lookupKey: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  payeeReference?: string | null;
};

type ImportRelease = {
  lookupKey: string;
  title?: string | null;
  primaryArtist?: string | null;
  upc?: string | null;
  label?: string | null;
  releaseDate?: string | null;
};

type ImportLineCollaborator = {
  collaboratorLookupKey: string;
  sharePercentage?: number | null;
  amount?: number | null;
  payoutStatus?: string | null;
};

type ImportLineItem = {
  id?: string;
  statementId?: string;
  releaseLookupKey?: string;
  sequence?: number | null;
  trackTitle?: string | null;
  isrc?: string | null;
  usageDate?: string | null;
  service?: string | null;
  territory?: string | null;
  units?: number | null;
  netRevenue?: number | null;
  grossRevenue?: number | null;
  fee?: number | null;
  currency?: string | null;
  payoutStatus?: string | null;
  metadata?: Record<string, unknown> | null;
  collaborators?: ImportLineCollaborator[];
};

type ImportStatement = {
  provider?: string | null;
  reference?: string | null;
  periodLabel?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  statementDate?: string | null;
  currency?: string | null;
  totalAmount?: number | null;
  totalUnits?: number | null;
  metadata?: Record<string, unknown> | null;
};

type ImportBatchMeta = {
  source?: string | null;
  importedBy?: string | null;
  originalFilename?: string | null;
  status?: string | null;
  warnings?: unknown[];
  errors?: unknown[];
};

type ImportPayload = {
  statement?: ImportStatement | null;
  releases?: ImportRelease[];
  collaborators?: ImportCollaborator[];
  lineItems: ImportLineItem[];
  batchMeta?: ImportBatchMeta | null;
};

type StatementSummary = {
  batchId: string;
  statementId: string;
  lineItemCount: number;
  releaseCount: number;
  collaboratorCount: number;
  statement: {
    id: string;
    provider: string;
    reference: string | null;
    periodLabel: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    statementDate: Date | null;
    currency: string;
    totalAmount: number;
    totalUnits: number;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  };
};

function sanitizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (value instanceof Date) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function sanitizeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeString(value: string | null | undefined): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function sanitizeJson(value: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return fallback;
}

function normalizeArtists(primaryArtist?: string | null): string[] {
  if (!primaryArtist) return [];
  return primaryArtist
    .split(',')
    .map((artist) => artist.trim())
    .filter(Boolean);
}

async function resolveReleaseId(
  tx: typeof prisma,
  release: ImportRelease,
  now: Date,
  cache: Map<string, string>
): Promise<string | null> {
  const lookupKey = release.lookupKey;
  if (cache.has(lookupKey)) {
    return cache.get(lookupKey) ?? null;
  }

  const upc = sanitizeString(release.upc);
  const title = sanitizeString(release.title);
  const primaryArtist = sanitizeString(release.primaryArtist);

  let existing = null;
  if (upc) {
    existing = await tx.release.findFirst({
      where: { upc: upc },
    });
  }

  if (!existing && title && primaryArtist) {
    existing = await tx.release.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        primaryArtist: { equals: primaryArtist, mode: 'insensitive' },
      },
    });
  }

  if (!existing && title) {
    existing = await tx.release.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
      },
    });
  }

  if (existing) {
    cache.set(lookupKey, existing.id);
    await tx.release.update({
      where: { id: existing.id },
      data: {
        title: title ?? existing.title,
        primaryArtist: primaryArtist ?? existing.primaryArtist,
        upc: upc ?? existing.upc,
        label: sanitizeString(release.label) ?? existing.label,
        releaseDate: sanitizeDate(release.releaseDate) ?? existing.releaseDate,
      },
    });
    return existing.id;
  }

  const created = await tx.release.create({
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

async function resolveCollaboratorId(
  tx: typeof prisma,
  collaborator: ImportCollaborator,
  now: Date,
  cache: Map<string, string>
): Promise<string | null> {
  const lookupKey = collaborator.lookupKey;
  if (cache.has(lookupKey)) {
    return cache.get(lookupKey) ?? null;
  }

  const email = sanitizeString(collaborator.email)?.toLowerCase() ?? null;
  const name = sanitizeString(collaborator.name);

  let existing = null;
  if (email) {
    existing = await tx.collaborator.findFirst({
      where: { email },
    });
  }

  if (!existing && name) {
    existing = await tx.collaborator.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }

  if (existing) {
    cache.set(lookupKey, existing.id);
    await tx.collaborator.update({
      where: { id: existing.id },
      data: {
        name: name ?? existing.name,
        email: email ?? existing.email,
        role: sanitizeString(collaborator.role) ?? existing.role,
        payeeReference: sanitizeString(collaborator.payeeReference) ?? existing.payeeReference,
      },
    });
    return existing.id;
  }

  const created = await tx.collaborator.create({
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

export async function saveImportBatch(payload: ImportPayload): Promise<StatementSummary> {
  const { statement, releases = [], collaborators = [], lineItems, batchMeta } = payload;

  if (!lineItems || !lineItems.length) {
    throw new Error('No line items were provided for import');
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const releaseIdMap = new Map<string, string>();
    const collaboratorIdMap = new Map<string, string>();

    await Promise.all(
      releases.map(async (release) => {
        const id = await resolveReleaseId(tx, release, now, releaseIdMap);
        if (id) {
          releaseIdMap.set(release.lookupKey, id);
        }
      })
    );

    await Promise.all(
      collaborators.map(async (collaborator) => {
        const id = await resolveCollaboratorId(tx, collaborator, now, collaboratorIdMap);
        if (id) {
          collaboratorIdMap.set(collaborator.lookupKey, id);
        }
      })
    );

    const normalizedLineItems = lineItems.map((item) => {
      const releaseId = item.releaseLookupKey ? releaseIdMap.get(item.releaseLookupKey) ?? null : null;
      const collaboratorSplits = (item.collaborators || []).map((split) => ({
        collaboratorId: split.collaboratorLookupKey
          ? collaboratorIdMap.get(split.collaboratorLookupKey) ?? null
          : null,
        sharePercentage: split.sharePercentage != null ? sanitizeNumber(split.sharePercentage, 0) : null,
        amount: split.amount != null ? sanitizeNumber(split.amount, 0) : null,
        payoutStatus: sanitizeString(split.payoutStatus) ?? sanitizeString(item.payoutStatus) ?? 'pending',
      }));

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
        currency: sanitizeString(item.currency) ?? statement?.currency ?? 'USD',
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

    const createdStatement = await tx.royaltyStatement.create({
      data: {
        provider: sanitizeString(statement?.provider) ?? 'EMPIRE',
        reference: sanitizeString(statement?.reference),
        periodLabel: sanitizeString(statement?.periodLabel),
        periodStart: sanitizeDate(statement?.periodStart ?? null),
        periodEnd: sanitizeDate(statement?.periodEnd ?? null),
        statementDate: sanitizeDate(statement?.statementDate ?? null),
        currency: sanitizeString(statement?.currency) ?? 'USD',
        totalAmount: totalRevenue,
        totalUnits: totalUnits,
        metadata: sanitizeJson(statement?.metadata ?? {}, {}),
        createdAt: now,
        updatedAt: now,
      },
    });

    for (const item of normalizedLineItems) {
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
          createdAt: now,
          updatedAt: now,
          splits: {
            create: item.collaboratorSplits.map((split) => ({
              collaboratorId: split.collaboratorId,
              sharePercentage: split.sharePercentage,
              amount: split.amount,
              payoutStatus: split.payoutStatus ?? 'pending',
              createdAt: now,
              updatedAt: now,
            })),
          },
        },
      });
    }

    const batchRecord = await tx.royaltyImportBatch.create({
      data: {
        statementId: createdStatement.id,
        source: sanitizeString(batchMeta?.source) ?? createdStatement.provider,
        importedAt: now,
        importedBy: sanitizeString(batchMeta?.importedBy),
        originalFilename: sanitizeString(batchMeta?.originalFilename),
        lineItemCount: normalizedLineItems.length,
        releaseCount: releases.length,
        collaboratorCount: collaborators.length,
        totalRevenue: totalRevenue,
        currency: createdStatement.currency,
        status: sanitizeString(batchMeta?.status) ?? 'completed',
        warnings: Array.isArray(batchMeta?.warnings) ? batchMeta?.warnings : [],
        errors: Array.isArray(batchMeta?.errors) ? batchMeta?.errors : [],
      },
    });

    return {
      batchId: batchRecord.id,
      statementId: createdStatement.id,
      lineItemCount: normalizedLineItems.length,
      releaseCount: releases.length,
      collaboratorCount: collaborators.length,
      statement: createdStatement,
    } satisfies StatementSummary;
  });
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

export async function getStatementById(id: string) {
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

export async function getReleaseById(id: string) {
  return prisma.release.findUnique({ where: { id } });
}

export async function listReleases() {
  return prisma.release.findMany({ orderBy: { createdAt: 'desc' } });
}

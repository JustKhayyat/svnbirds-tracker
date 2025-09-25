import prisma from './prisma';

const DEFAULT_CURRENCY = 'USD';

/**
 * @typedef {Object} PayableLineItem
 * @property {string} statementLineId
 * @property {string | null | undefined} [splitId]
 * @property {number} amount
 * @property {number | null | undefined} sharePercentage
 */

/**
 * @typedef {Object} PayableRecord
 * @property {string} collaboratorId
 * @property {string} currency
 * @property {number} totalAmount
 * @property {PayableLineItem[]} lineItems
 */

function toNumber(value, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function roundCurrency(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

async function ensureSplitsForLine(client, line, now) {
  const agreements = line.release?.splitAgreements ?? [];
  if (!agreements.length) {
    return;
  }

  const lineUsageDate =
    line.usageDate instanceof Date
      ? line.usageDate
      : line.usageDate
        ? new Date(line.usageDate)
        : null;

  const existingCollaborators = new Set(
    line.splits
      .map((split) => split.collaboratorId)
      .filter((value) => Boolean(value))
  );

  const validAgreements = agreements.filter((agreement) => {
    if (!agreement.collaboratorId || typeof agreement.sharePercentage !== 'number') {
      return false;
    }

    if (!lineUsageDate) {
      return true;
    }

    const effectiveDate =
      agreement.effectiveDate instanceof Date
        ? agreement.effectiveDate
        : agreement.effectiveDate
          ? new Date(agreement.effectiveDate)
          : null;

    if (!effectiveDate) {
      return true;
    }

    return effectiveDate.getTime() <= lineUsageDate.getTime();
  });

  for (const agreement of validAgreements) {
    const collaboratorId = agreement.collaboratorId;
    if (!collaboratorId || existingCollaborators.has(collaboratorId)) {
      continue;
    }

    const share = toNumber(agreement.sharePercentage, 0);
    if (share <= 0) continue;

    const createdSplit = await client.statementLineSplit.create({
      data: {
        statementLineId: line.id,
        collaboratorId,
        sharePercentage: share,
        amount: 0,
        payoutStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      },
    });

    existingCollaborators.add(collaboratorId);
    line.splits.push(createdSplit);
  }
}

function computeSharePercentage(split, netRevenue) {
  const existingShare = typeof split.sharePercentage === 'number' ? split.sharePercentage : null;
  if (existingShare != null) {
    return existingShare;
  }
  const amount = toNumber(split.amount, 0);
  if (!netRevenue) return 0;
  const derived = (amount / netRevenue) * 100;
  return Number.isFinite(derived) ? derived : 0;
}

function normalizeSplitAmount(netRevenue, sharePercentage) {
  if (!netRevenue || !sharePercentage) return 0;
  const raw = (netRevenue * sharePercentage) / 100;
  return roundCurrency(raw);
}

async function processLineSplits(client, line, allowedStatuses, now) {
  const processed = [];
  const eligibleSplits = line.splits.filter((split) => allowedStatuses.includes(split.payoutStatus));

  if (!eligibleSplits.length && !line.splits.length) {
    await ensureSplitsForLine(client, line, now);
  }

  const splitsToUse = line.splits.filter((split) => allowedStatuses.includes(split.payoutStatus));

  for (const split of splitsToUse) {
    if (!split.collaboratorId) continue;

    const share = computeSharePercentage(split, toNumber(line.netRevenue, 0));
    if (!share || share <= 0) continue;

    const amount = normalizeSplitAmount(toNumber(line.netRevenue, 0), share);
    const needsUpdate =
      Math.abs(toNumber(split.amount, 0) - amount) > 0.0001 ||
      split.sharePercentage !== share;

    if (needsUpdate) {
      const updated = await client.statementLineSplit.update({
        where: { id: split.id },
        data: {
          sharePercentage: share,
          amount,
          updatedAt: now,
        },
      });
      processed.push({
        splitId: updated.id,
        collaboratorId: updated.collaboratorId,
        amount,
        sharePercentage: share,
        statementLineId: updated.statementLineId,
      });
    } else {
      processed.push({
        splitId: split.id,
        collaboratorId: split.collaboratorId,
        amount,
        sharePercentage: share,
        statementLineId: split.statementLineId,
      });
    }
  }

  return processed;
}

function foldPayables(payables, split, currency) {
  const key = `${split.collaboratorId}:${currency}`;
  const existing = payables.get(key);
  if (!existing) {
    payables.set(key, {
      collaboratorId: split.collaboratorId,
      currency,
      totalAmount: roundCurrency(split.amount),
      lineItems: [
        {
          statementLineId: split.statementLineId,
          splitId: split.splitId,
          amount: split.amount,
          sharePercentage: split.sharePercentage,
        },
      ],
    });
    return;
  }

  existing.totalAmount = roundCurrency(existing.totalAmount + split.amount);
  existing.lineItems.push({
    statementLineId: split.statementLineId,
    splitId: split.splitId,
    amount: split.amount,
    sharePercentage: split.sharePercentage,
  });
}

/**
 * @typedef {Object} GeneratePayablesOptions
 * @property {string} [statementId]
 * @property {string} [releaseId]
 * @property {boolean} [includeFailed]
 * @property {number} [limit]
 * @property {import('@prisma/client').PrismaClient} [prismaClient]
 */

/**
 * @param {GeneratePayablesOptions} [options]
 * @returns {Promise<{ payables: PayableRecord[]; linesProcessed: number; splitsProcessed: number; skippedLineIds: string[] }>}
 */
export async function generatePayables(options = {}) {
  const client = options.prismaClient ?? prisma;
  const statementId = options.statementId ?? undefined;
  const releaseId = options.releaseId ?? undefined;
  const includeFailed = options.includeFailed ?? false;
  const limit = options.limit ?? 5000;
  const allowedStatuses = includeFailed ? ['pending', 'failed'] : ['pending'];

  return client.$transaction(async (tx) => {
    const lines = await tx.statementLine.findMany({
      where: {
        ...(statementId ? { statementId } : {}),
        ...(releaseId ? { releaseId } : {}),
        netRevenue: { gt: 0 },
      },
      include: {
        splits: true,
        release: {
          include: {
            splitAgreements: true,
          },
        },
        statement: {
          select: { currency: true },
        },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const payables = new Map();
    const skipped = [];
    let processedCount = 0;
    const now = new Date();

    for (const line of lines) {
      await ensureSplitsForLine(tx, line, now);

      const splits = await processLineSplits(tx, line, allowedStatuses, now);
      if (!splits.length) {
        skipped.push(line.id);
        continue;
      }

      processedCount += splits.length;
      const currency = line.currency || line.statement?.currency || DEFAULT_CURRENCY;

      for (const split of splits) {
        foldPayables(payables, split, currency ?? DEFAULT_CURRENCY);
      }
    }

    return {
      payables: Array.from(payables.values()).filter((entry) => entry.totalAmount > 0),
      linesProcessed: lines.length,
      splitsProcessed: processedCount,
      skippedLineIds: skipped,
    };
  });
}

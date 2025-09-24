import prisma from '../../../lib/prisma';
import { generatePayables } from '../../../lib/royaltyEngine';
import { submitPayoutBatch } from '../../../lib/payments/processor';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

function isAuthorized(req) {
  const headerToken = req.headers['x-admin-token'];
  if (!ADMIN_TOKEN) {
    return false;
  }
  return typeof headerToken === 'string' && headerToken === ADMIN_TOKEN;
}

function toNumber(value, fallback = undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

async function createAuditLog(client, payoutId, eventType, message, detail = {}) {
  await client.payoutAuditLog.create({
    data: {
      payoutId,
      eventType,
      message,
      detail,
    },
  });
}

async function refreshStatementLineStatuses(lineIds) {
  for (const lineId of lineIds) {
    const splits = await prisma.statementLineSplit.findMany({
      where: { statementLineId: lineId },
      select: { payoutStatus: true },
    });

    if (!splits.length) {
      continue;
    }

    const statuses = new Set(splits.map((split) => split.payoutStatus));
    let nextStatus = 'pending';
    if (statuses.size === 1 && statuses.has('paid')) {
      nextStatus = 'paid';
    } else if (statuses.has('failed')) {
      nextStatus = 'failed';
    } else if (statuses.has('processing')) {
      nextStatus = 'processing';
    }

    await prisma.statementLine.update({
      where: { id: lineId },
      data: { payoutStatus: nextStatus },
    });
  }
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid admin token.' });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  const {
    statementId,
    releaseId,
    retryFailed = false,
    limit,
    dryRun = false,
    processor = 'stub-processor',
    requestedBy = 'manual-api',
  } = req.body || {};

  const numericLimit = toNumber(limit, undefined);
  const sanitizedLimit =
    numericLimit != null && Number.isFinite(numericLimit)
      ? Math.max(1, Math.floor(numericLimit))
      : undefined;

  const payableResult = await generatePayables({
    statementId: statementId ? String(statementId) : undefined,
    releaseId: releaseId ? String(releaseId) : undefined,
    includeFailed: Boolean(retryFailed),
    limit: sanitizedLimit,
  });

  if (dryRun) {
    res.status(200).json({
      dryRun: true,
      payables: payableResult.payables,
      summary: {
        linesProcessed: payableResult.linesProcessed,
        splitsProcessed: payableResult.splitsProcessed,
        skippedLineIds: payableResult.skippedLineIds,
      },
    });
    return;
  }

  if (!payableResult.payables.length) {
    res.status(200).json({
      success: true,
      message: 'No payables were generated for the provided filters.',
      summary: {
        linesProcessed: payableResult.linesProcessed,
        splitsProcessed: payableResult.splitsProcessed,
        skippedLineIds: payableResult.skippedLineIds,
      },
    });
    return;
  }

  const splitIdsTouched = new Set();
  const lineIdsTouched = new Set();
  const batchMetadata = {
    filters: {
      statementId: statementId ? String(statementId) : null,
      releaseId: releaseId ? String(releaseId) : null,
    },
    retryFailed: Boolean(retryFailed),
  };

  let creation;
  try {
    creation = await prisma.$transaction(async (tx) => {
      const totalAmount = payableResult.payables.reduce((sum, payable) => sum + payable.totalAmount, 0);
      const batch = await tx.payoutBatch.create({
        data: {
          status: 'processing',
          processor,
          requestedBy: requestedBy ? String(requestedBy) : 'manual-api',
          requestedAt: new Date(),
          totalAmount,
          currency: payableResult.payables[0]?.currency || 'USD',
          payoutCount: payableResult.payables.length,
          metadata: batchMetadata,
        },
      });

      const payoutIds = [];

      for (const payable of payableResult.payables) {
        const payout = await tx.payout.create({
          data: {
            batchId: batch.id,
            collaboratorId: payable.collaboratorId,
            amount: payable.totalAmount,
            currency: payable.currency,
            status: 'processing',
          },
        });

        payoutIds.push(payout.id);

        await createAuditLog(tx, payout.id, 'created', 'Payout created for batch run.', {
          amount: payout.amount,
          currency: payout.currency,
        });

        for (const item of payable.lineItems) {
          await tx.payableItem.create({
            data: {
              payoutId: payout.id,
              statementLineId: item.statementLineId,
              statementLineSplitId: item.splitId || null,
              amount: item.amount,
              sharePercentage: item.sharePercentage,
            },
          });

          if (item.splitId) {
            splitIdsTouched.add(item.splitId);
          }
          lineIdsTouched.add(item.statementLineId);
        }
      }

      if (splitIdsTouched.size) {
        await tx.statementLineSplit.updateMany({
          where: { id: { in: Array.from(splitIdsTouched) } },
          data: { payoutStatus: 'processing' },
        });
      }

      if (lineIdsTouched.size) {
        await tx.statementLine.updateMany({
          where: { id: { in: Array.from(lineIdsTouched) } },
          data: { payoutStatus: 'processing' },
        });
      }

      return { batch, payoutIds };
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create payout batch.' });
    return;
  }

  const payouts = await prisma.payout.findMany({
    where: { id: { in: creation.payoutIds } },
    include: {
      collaborator: { select: { id: true, name: true, email: true, payeeReference: true } },
      payableItems: true,
    },
  });

  let submission;
  try {
    submission = await submitPayoutBatch({
      batch: {
        id: creation.batch.id,
        processor,
      },
      payouts: payouts.map((payout) => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        collaborator: payout.collaborator,
      })),
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.payoutBatch.update({
        where: { id: creation.batch.id },
        data: {
          status: 'failed',
          processedAt: new Date(),
          metadata: { ...batchMetadata, error: error.message },
        },
      });

      await tx.payout.updateMany({
        where: { batchId: creation.batch.id },
        data: {
          status: 'failed',
          failureReason: error.message || 'Processor error',
        },
      });

      if (splitIdsTouched.size) {
        await tx.statementLineSplit.updateMany({
          where: { id: { in: Array.from(splitIdsTouched) } },
          data: { payoutStatus: 'failed' },
        });
      }

      if (lineIdsTouched.size) {
        await tx.statementLine.updateMany({
          where: { id: { in: Array.from(lineIdsTouched) } },
          data: { payoutStatus: 'failed' },
        });
      }

      for (const payout of payouts) {
        await createAuditLog(tx, payout.id, 'processor_error', 'Payment processor submission failed.', {
          error: error.message,
        });
      }
    });

    await refreshStatementLineStatuses(Array.from(lineIdsTouched));

    res.status(502).json({ error: 'Payment processor submission failed.', detail: error.message });
    return;
  }

  const successSplitIds = new Set();
  const failedSplitIds = new Set();
  const resultSummaries = [];
  const now = new Date();
  const processorResults = Array.isArray(submission?.results) ? submission.results : [];

  for (const payout of payouts) {
    const result = processorResults.find((entry) => entry.payoutId === payout.id);
    if (!result) {
      // Treat missing result as a failure so it can be retried manually.
      for (const item of payout.payableItems) {
        if (item.statementLineSplitId) {
          failedSplitIds.add(item.statementLineSplitId);
        }
      }
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'failed',
          failureReason: 'Processor response missing for payout.',
          retryCount: payout.retryCount + 1,
          updatedAt: now,
        },
      });
      await createAuditLog(prisma, payout.id, 'failed', 'Processor response missing for payout.', {});
      resultSummaries.push({ payoutId: payout.id, status: 'failed', failureReason: 'Processor response missing for payout.' });
      continue;
    }

    await createAuditLog(prisma, payout.id, 'processor_submitted', 'Payout submitted to processor.', {
      processorBatchId: submission.processorBatchId,
    });

    if (result.status === 'paid') {
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'paid',
          externalId: result.externalId || null,
          failureReason: null,
          updatedAt: now,
        },
      });

      await createAuditLog(prisma, payout.id, 'paid', 'Processor marked payout as paid.', {
        externalId: result.externalId || null,
      });

      for (const item of payout.payableItems) {
        if (item.statementLineSplitId) {
          successSplitIds.add(item.statementLineSplitId);
        }
      }

      resultSummaries.push({ payoutId: payout.id, status: 'paid', externalId: result.externalId || null });
    } else {
      const failureReason = result.failureReason || 'Processor rejected payout.';
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: 'failed',
          failureReason,
          retryCount: payout.retryCount + 1,
          updatedAt: now,
        },
      });

      await createAuditLog(prisma, payout.id, 'failed', failureReason, {});

      for (const item of payout.payableItems) {
        if (item.statementLineSplitId) {
          failedSplitIds.add(item.statementLineSplitId);
        }
      }

      resultSummaries.push({ payoutId: payout.id, status: 'failed', failureReason });
    }
  }

  if (successSplitIds.size) {
    await prisma.statementLineSplit.updateMany({
      where: { id: { in: Array.from(successSplitIds) } },
      data: { payoutStatus: 'paid' },
    });
  }

  if (failedSplitIds.size) {
    await prisma.statementLineSplit.updateMany({
      where: { id: { in: Array.from(failedSplitIds) } },
      data: { payoutStatus: 'failed' },
    });
  }

  await refreshStatementLineStatuses(Array.from(lineIdsTouched));

  const hasFailures = resultSummaries.some((summary) => summary.status !== 'paid');

  await prisma.payoutBatch.update({
    where: { id: creation.batch.id },
    data: {
      status: hasFailures ? 'completed_with_errors' : 'completed',
      processorBatchId: submission.processorBatchId,
      processedAt: new Date(),
      metadata: {
        ...batchMetadata,
        processorBatchId: submission.processorBatchId,
        payoutResults: resultSummaries,
      },
    },
  });

  res.status(200).json({
    success: true,
    batch: {
      id: creation.batch.id,
      status: hasFailures ? 'completed_with_errors' : 'completed',
      processorBatchId: submission.processorBatchId,
      totalAmount: creation.batch.totalAmount,
      payoutCount: creation.batch.payoutCount,
    },
    payouts: resultSummaries,
    summary: {
      linesProcessed: payableResult.linesProcessed,
      splitsProcessed: payableResult.splitsProcessed,
      skippedLineIds: payableResult.skippedLineIds,
    },
  });
}

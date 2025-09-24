import prisma from './prisma';

export const SHARE_CAP = 100;
const SHARE_TOLERANCE = 0.000001;

function normalizeShare(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getReleaseShareTotals({ releaseId, excludeAgreementId } = {}) {
  if (!releaseId) {
    return { utilized: 0, remaining: SHARE_CAP };
  }

  const aggregate = await prisma.splitAgreement.aggregate({
    where: {
      releaseId: String(releaseId),
      ...(excludeAgreementId ? { id: { not: String(excludeAgreementId) } } : {}),
    },
    _sum: { sharePercentage: true },
  });

  const utilizedRaw = aggregate?._sum?.sharePercentage ?? 0;
  const utilized = normalizeShare(utilizedRaw);
  const remaining = Math.max(0, SHARE_CAP - utilized);

  return { utilized, remaining };
}

export function willExceedShareCap(currentUtilized, incomingShare) {
  const nextShare = normalizeShare(incomingShare);
  return currentUtilized + nextShare > SHARE_CAP + SHARE_TOLERANCE;
}

export function formatShareForMessage(value) {
  return normalizeShare(value).toFixed(2);
}

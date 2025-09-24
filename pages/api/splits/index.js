import prisma from '../../../lib/prisma';
import {
  SHARE_CAP,
  getReleaseShareTotals,
  willExceedShareCap,
  formatShareForMessage,
} from '../../../lib/splitAgreements';

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

function isAuthorized(req) {
  const headerToken = req.headers['x-admin-token'];
  if (!ADMIN_TOKEN) {
    return false;
  }
  return typeof headerToken === 'string' && headerToken === ADMIN_TOKEN;
}

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

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serializeAgreement(agreement) {
  return {
    id: agreement.id,
    releaseId: agreement.releaseId,
    collaboratorId: agreement.collaboratorId,
    sharePercentage: agreement.sharePercentage,
    agreementType: agreement.agreementType,
    effectiveDate: agreement.effectiveDate,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    release: agreement.release
      ? {
          id: agreement.release.id,
          title: agreement.release.title,
          primaryArtist: agreement.release.primaryArtist,
          upc: agreement.release.upc,
        }
      : undefined,
    collaborator: agreement.collaborator
      ? {
          id: agreement.collaborator.id,
          name: agreement.collaborator.name,
          email: agreement.collaborator.email,
          role: agreement.collaborator.role,
        }
      : undefined,
  };
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid admin token.' });
    return;
  }

  if (req.method === 'GET') {
    const { releaseId, collaboratorId } = req.query;

    const agreements = await prisma.splitAgreement.findMany({
      where: {
        ...(releaseId ? { releaseId: String(releaseId) } : {}),
        ...(collaboratorId ? { collaboratorId: String(collaboratorId) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        release: { select: { id: true, title: true, primaryArtist: true, upc: true } },
        collaborator: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    res.status(200).json({ splits: agreements.map(serializeAgreement) });
    return;
  }

  if (req.method === 'POST') {
    const { releaseId, collaboratorId, sharePercentage, agreementType, effectiveDate } = req.body || {};

    if (!releaseId || !collaboratorId) {
      res.status(400).json({ error: 'Both releaseId and collaboratorId are required.' });
      return;
    }

    const share = toNumber(sharePercentage, null);
    if (share == null || share < 0 || share > 100) {
      res.status(400).json({ error: 'sharePercentage must be between 0 and 100.' });
      return;
    }

    const { utilized, remaining } = await getReleaseShareTotals({ releaseId: String(releaseId) });
    if (willExceedShareCap(utilized, share)) {
      res.status(400).json({
        error: `Split percentages for this release cannot exceed ${SHARE_CAP}%. Only ${formatShareForMessage(remaining)}% remains available.`,
      });
      return;
    }

    try {
      const created = await prisma.splitAgreement.create({
        data: {
          releaseId: String(releaseId),
          collaboratorId: String(collaboratorId),
          sharePercentage: share,
          agreementType: agreementType ? String(agreementType) : null,
          effectiveDate: parseDate(effectiveDate),
        },
        include: {
          release: { select: { id: true, title: true, primaryArtist: true, upc: true } },
          collaborator: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      res.status(201).json({ split: serializeAgreement(created) });
    } catch (error) {
      if (error?.code === 'P2002') {
        res.status(409).json({
          error: 'A split agreement for this release and collaborator already exists.',
        });
        return;
      }

      res.status(400).json({ error: error.message || 'Failed to create split agreement.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
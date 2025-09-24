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

function toNumber(value, fallback = null) {
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
  if (!agreement) return null;
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

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    res.status(400).json({ error: 'A split agreement id is required in the path.' });
    return;
  }

  if (req.method === 'GET') {
    const agreement = await prisma.splitAgreement.findUnique({
      where: { id },
      include: {
        release: { select: { id: true, title: true, primaryArtist: true, upc: true } },
        collaborator: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!agreement) {
      res.status(404).json({ error: 'Split agreement not found.' });
      return;
    }

    res.status(200).json({ split: serializeAgreement(agreement) });
    return;
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const { sharePercentage, agreementType, effectiveDate } = req.body || {};
    const updates = {};

    if (sharePercentage != null) {
      const share = toNumber(sharePercentage, null);
      if (share == null || share < 0 || share > 100) {
        res.status(400).json({ error: 'sharePercentage must be between 0 and 100.' });
        return;
      }
      updates.sharePercentage = share;
    }

    if (agreementType !== undefined) {
      updates.agreementType = agreementType ? String(agreementType) : null;
    }

    if (effectiveDate !== undefined) {
      updates.effectiveDate = parseDate(effectiveDate);
    }

    if (!Object.keys(updates).length) {
      res.status(400).json({ error: 'No updatable fields were provided.' });
      return;
    }

    const existing = await prisma.splitAgreement.findUnique({
      where: { id },
      select: { releaseId: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Split agreement not found.' });
      return;
    }

    if (updates.sharePercentage != null) {
      const { utilized, remaining } = await getReleaseShareTotals({
        releaseId: existing.releaseId,
        excludeAgreementId: id,
      });

      if (willExceedShareCap(utilized, updates.sharePercentage)) {
        res.status(400).json({
          error: `Split percentages for this release cannot exceed ${SHARE_CAP}%. Only ${formatShareForMessage(remaining)}% remains available.`,
        });
        return;
      }
    }

    try {
      const updated = await prisma.splitAgreement.update({
        where: { id },
        data: updates,
        include: {
          release: { select: { id: true, title: true, primaryArtist: true, upc: true } },
          collaborator: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      res.status(200).json({ split: serializeAgreement(updated) });
    } catch (error) {
      if (error?.code === 'P2025') {
        res.status(404).json({ error: 'Split agreement not found.' });
        return;
      }

      res.status(400).json({ error: error.message || 'Failed to update split agreement.' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.splitAgreement.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      if (error?.code === 'P2025') {
        res.status(404).json({ error: 'Split agreement not found.' });
        return;
      }
      res.status(400).json({ error: error.message || 'Failed to delete split agreement.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET, PATCH, PUT, DELETE');
  res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_PATH = path.join(process.cwd(), 'data', 'royalties.json');

const DEFAULT_DB = {
  statements: [],
  releases: [],
  collaborators: [],
  lineItems: [],
  importBatches: [],
};

async function ensureDatabaseFile() {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch (error) {
    await fs.writeFile(DATA_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

async function loadDatabase() {
  await ensureDatabaseFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  return {
    ...DEFAULT_DB,
    ...parsed,
    statements: Array.isArray(parsed.statements) ? parsed.statements : [],
    releases: Array.isArray(parsed.releases) ? parsed.releases : [],
    collaborators: Array.isArray(parsed.collaborators) ? parsed.collaborators : [],
    lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
    importBatches: Array.isArray(parsed.importBatches) ? parsed.importBatches : [],
  };
}

async function saveDatabase(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

function findExistingRelease(releases, release) {
  if (!release) return null;
  const upc = (release.upc || '').trim().toLowerCase();
  if (upc) {
    const byUpc = releases.find((item) => (item.upc || '').trim().toLowerCase() === upc);
    if (byUpc) return byUpc;
  }
  const title = (release.title || '').trim().toLowerCase();
  const artist = (release.primaryArtist || '').trim().toLowerCase();
  if (title && artist) {
    const byTitle = releases.find(
      (item) =>
        (item.title || '').trim().toLowerCase() === title &&
        (item.primaryArtist || '').trim().toLowerCase() === artist,
    );
    if (byTitle) return byTitle;
  }
  if (title) {
    return releases.find((item) => (item.title || '').trim().toLowerCase() === title) || null;
  }
  return null;
}

function findExistingCollaborator(collaborators, collaborator) {
  if (!collaborator) return null;
  const email = (collaborator.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = collaborators.find((item) => (item.email || '').trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const name = (collaborator.name || '').trim().toLowerCase();
  if (name) {
    return collaborators.find((item) => (item.name || '').trim().toLowerCase() === name) || null;
  }
  return null;
}

function sanitizeNumber(value) {
  if (typeof value !== 'number') return 0;
  if (Number.isNaN(value)) return 0;
  return Number(value);
}

export async function getImportHistory() {
  const db = await loadDatabase();
  return [...db.importBatches].sort((a, b) => {
    const left = new Date(a.importedAt || 0).getTime();
    const right = new Date(b.importedAt || 0).getTime();
    return right - left;
  });
}

export async function saveImportBatch(payload) {
  const { statement, releases, collaborators, lineItems, batchMeta } = payload;
  if (!lineItems || !lineItems.length) {
    throw new Error('No line items were provided for import');
  }

  const db = await loadDatabase();
  const now = new Date().toISOString();

  const statementId = randomUUID();
  const releaseIdMap = new Map();
  const collaboratorIdMap = new Map();

  (releases || []).forEach((release) => {
    const existing = findExistingRelease(db.releases, release);
    if (existing) {
      releaseIdMap.set(release.lookupKey, existing.id);
      const updated = {
        ...existing,
        title: release.title || existing.title,
        primaryArtist: release.primaryArtist || existing.primaryArtist,
        upc: release.upc || existing.upc,
        label: release.label || existing.label,
        releaseDate: release.releaseDate || existing.releaseDate,
        updatedAt: now,
      };
      Object.assign(existing, updated);
    } else {
      const id = randomUUID();
      db.releases.push({
        id,
        title: release.title || null,
        primaryArtist: release.primaryArtist || null,
        upc: release.upc || null,
        label: release.label || null,
        releaseDate: release.releaseDate || null,
        createdAt: now,
        updatedAt: now,
      });
      releaseIdMap.set(release.lookupKey, id);
    }
  });

  (collaborators || []).forEach((collaborator) => {
    const existing = findExistingCollaborator(db.collaborators, collaborator);
    if (existing) {
      collaboratorIdMap.set(collaborator.lookupKey, existing.id);
      const updated = {
        ...existing,
        name: collaborator.name || existing.name,
        email: collaborator.email || existing.email,
        role: collaborator.role || existing.role,
        payeeReference: collaborator.payeeReference || existing.payeeReference,
        updatedAt: now,
      };
      Object.assign(existing, updated);
    } else {
      const id = randomUUID();
      db.collaborators.push({
        id,
        name: collaborator.name || null,
        email: collaborator.email || null,
        role: collaborator.role || null,
        payeeReference: collaborator.payeeReference || null,
        createdAt: now,
        updatedAt: now,
      });
      collaboratorIdMap.set(collaborator.lookupKey, id);
    }
  });

  const normalizedLineItems = lineItems.map((item) => {
    const releaseId = releaseIdMap.get(item.releaseLookupKey) || null;
    const collaboratorSplits = (item.collaborators || []).map((split) => ({
      collaboratorId: collaboratorIdMap.get(split.collaboratorLookupKey) || null,
      sharePercentage: split.sharePercentage ?? null,
      amount: split.amount ?? null,
      payoutStatus: split.payoutStatus || item.payoutStatus || 'pending',
    }));

    return {
      id: randomUUID(),
      statementId,
      releaseId,
      sequence: item.sequence,
      trackTitle: item.trackTitle || null,
      isrc: item.isrc || null,
      usageDate: item.usageDate || null,
      service: item.service || null,
      territory: item.territory || null,
      units: sanitizeNumber(item.units || 0),
      netRevenue: sanitizeNumber(item.netRevenue || 0),
      grossRevenue: item.grossRevenue != null ? sanitizeNumber(item.grossRevenue) : null,
      fee: item.fee != null ? sanitizeNumber(item.fee) : null,
      currency: item.currency || (statement && statement.currency) || 'USD',
      payoutStatus: item.payoutStatus || 'pending',
      collaboratorSplits,
      metadata: item.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
  });

  const totalRevenue =
    statement && typeof statement.totalAmount === 'number'
      ? sanitizeNumber(statement.totalAmount)
      : normalizedLineItems.reduce((sum, item) => sum + sanitizeNumber(item.netRevenue), 0);

  const totalUnits =
    statement && typeof statement.totalUnits === 'number'
      ? sanitizeNumber(statement.totalUnits)
      : normalizedLineItems.reduce((sum, item) => sum + sanitizeNumber(item.units), 0);

  const statementRecord = {
    id: statementId,
    provider: statement?.provider || 'EMPIRE',
    reference: statement?.reference || null,
    periodLabel: statement?.periodLabel || null,
    periodStart: statement?.periodStart || null,
    periodEnd: statement?.periodEnd || null,
    statementDate: statement?.statementDate || null,
    currency: statement?.currency || 'USD',
    totalAmount: sanitizeNumber(totalRevenue),
    totalUnits: sanitizeNumber(totalUnits),
    metadata: statement?.metadata || {},
    createdAt: now,
    updatedAt: now,
  };

  db.statements.push(statementRecord);
  db.lineItems.push(...normalizedLineItems);

  const batchId = randomUUID();
  const batchRecord = {
    id: batchId,
    statementId,
    source: batchMeta?.source || statementRecord.provider,
    importedAt: now,
    importedBy: batchMeta?.importedBy || 'api',
    originalFilename: batchMeta?.originalFilename || null,
    lineItemCount: normalizedLineItems.length,
    releaseCount: (releases || []).length,
    collaboratorCount: (collaborators || []).length,
    totalRevenue: sanitizeNumber(totalRevenue),
    currency: statementRecord.currency,
    status: batchMeta?.status || 'completed',
    warnings: batchMeta?.warnings || [],
    errors: batchMeta?.errors || [],
  };

  db.importBatches.push(batchRecord);

  await saveDatabase(db);

  return {
    batchId,
    statementId,
    lineItemCount: normalizedLineItems.length,
    releaseCount: (releases || []).length,
    collaboratorCount: (collaborators || []).length,
    statement: statementRecord,
  };
}

export async function getStatementById(id) {
  if (!id) return null;
  const db = await loadDatabase();
  return db.statements.find((statement) => statement.id === id) || null;
}

export async function resetRoyaltiesDatabase() {
  await saveDatabase({ ...DEFAULT_DB });
}

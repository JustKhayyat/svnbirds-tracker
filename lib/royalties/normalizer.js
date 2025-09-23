const STATUS_MAP = new Map([
  ['paid', 'paid'],
  ['complete', 'paid'],
  ['processed', 'paid'],
  ['processing', 'processing'],
  ['pending', 'pending'],
  ['unpaid', 'pending'],
  ['awaiting', 'pending'],
]);

function cleanString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  return String(value).trim();
}

function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const stringValue = cleanString(value);
  if (!stringValue) return 0;
  const trimmed = stringValue.trim();
  let negativeFromParentheses = false;
  let normalized = trimmed;

  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    negativeFromParentheses = true;
    normalized = normalized.slice(1, -1);
  }

  const sanitized = normalized.replace(/[^0-9.+\-]/g, '');
  if (!sanitized) return 0;
  const parsed = parseFloat(sanitized);
  if (!Number.isFinite(parsed)) return 0;
  return negativeFromParentheses ? -Math.abs(parsed) : parsed;
}

function parseShare(value) {
  const number = parseNumber(value);
  if (!number) return 0;
  return number > 1 && number <= 100 ? number : number * 100;
}

function parseDate(value) {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'number') {
    const dateFromNumber = new Date(value);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber.toISOString();
  }
  const stringValue = cleanString(value);
  if (!stringValue) return null;

  const isoDate = new Date(stringValue);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  const match = stringValue.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const normalizedYear = year < 100 ? 2000 + year : year;
    const date = new Date(Date.UTC(normalizedYear, month - 1, day));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function normalizeStatus(value) {
  const key = cleanString(value).toLowerCase();
  return STATUS_MAP.get(key) || 'pending';
}

function buildReleaseKey(release) {
  const upc = cleanString(release.upc).toLowerCase();
  if (upc) return `upc:${upc}`;
  const title = cleanString(release.title).toLowerCase();
  const artist = cleanString(release.primaryArtist).toLowerCase();
  if (title && artist) return `title:${title}|artist:${artist}`;
  if (title) return `title:${title}`;
  return '';
}

function buildCollaboratorKey(collaborator) {
  const email = cleanString(collaborator.email).toLowerCase();
  if (email) return `email:${email}`;
  const name = cleanString(collaborator.name).toLowerCase();
  if (name) return `name:${name}`;
  return '';
}

function ensureCurrency(value, fallback = 'USD') {
  const normalized = cleanString(value).toUpperCase();
  if (normalized.length === 3) return normalized;
  return fallback;
}

function addWarning(warnings, message, context = {}) {
  warnings.push({ message, ...context });
}

/**
 * Normalize EMPIRE royalty CSV rows into structured data for persistence.
 */
export function normalizeEmpireRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('CSV data contained no rows');
  }

  const warnings = [];
  const releases = new Map();
  const collaborators = new Map();
  const lineItems = [];

  let detectedCurrency = null;
  let statementReference = null;
  let statementMonth = null;
  let statementStart = null;
  let statementEnd = null;
  let statementDate = null;
  let totalAmount = 0;
  let totalUnits = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // Account for header row
    const releaseTitle = cleanString(
      row['Release Title'] || row['Product Name'] || row['Album'] || row['Release Name'] || row['Title']
    );
    const releaseArtist = cleanString(row['Primary Artist'] || row['Artist'] || row['Performer']);
    const releaseUpc = cleanString(row['Release UPC'] || row['UPC'] || row['Product UPC']);
    const releaseLabel = cleanString(row['Label'] || row['Imprint']);
    const releaseDate = parseDate(row['Release Date'] || row['Product Release Date']);

    const currency = ensureCurrency(row['Currency'] || row['Statement Currency'] || detectedCurrency || 'USD');
    if (!detectedCurrency) {
      detectedCurrency = currency;
    }

    statementReference = statementReference || cleanString(row['Statement ID'] || row['Statement #']);
    statementMonth = statementMonth || cleanString(row['Statement Month'] || row['Statement Period']);
    statementStart = statementStart || parseDate(row['Statement Start Date'] || row['Start Date']);
    statementEnd = statementEnd || parseDate(row['Statement End Date'] || row['End Date']);
    statementDate = statementDate || parseDate(row['Statement Date']);

    const releaseKey = buildReleaseKey({
      upc: releaseUpc,
      title: releaseTitle,
      primaryArtist: releaseArtist,
    });

    if (!releaseKey) {
      addWarning(warnings, 'Missing release identifier; generated temporary key.', { row: rowNumber });
    }
    const resolvedReleaseKey = releaseKey || `row-${rowNumber}`;

    if (!releases.has(resolvedReleaseKey)) {
      releases.set(resolvedReleaseKey, {
        lookupKey: resolvedReleaseKey,
        title: releaseTitle || null,
        primaryArtist: releaseArtist || null,
        upc: releaseUpc || null,
        label: releaseLabel || null,
        releaseDate: releaseDate,
      });
    }

    const collaboratorName = cleanString(
      row['Royalty Recipient'] || row['Participant Name'] || row['Payee Name'] || row['Collaborator']
    );
    const collaboratorEmail = cleanString(row['Recipient Email'] || row['Email']);
    const collaboratorRole = cleanString(row['Role'] || row['Participant Role']);
    const collaboratorReference = cleanString(row['Payee ID'] || row['Account ID'] || row['Recipient ID']);

    let collaboratorKey = '';
    if (collaboratorName || collaboratorEmail) {
      collaboratorKey = buildCollaboratorKey({
        name: collaboratorName,
        email: collaboratorEmail,
      });
    }
    if (collaboratorKey && !collaborators.has(collaboratorKey)) {
      collaborators.set(collaboratorKey, {
        lookupKey: collaboratorKey,
        name: collaboratorName || null,
        email: collaboratorEmail || null,
        role: collaboratorRole || null,
        payeeReference: collaboratorReference || null,
      });
    }

    const units = parseNumber(row['Units'] || row['Quantity'] || row['Units Sold']);
    const netRevenue = parseNumber(
      row['Net Amount'] || row['Net Revenue'] || row['Royalty Amount'] || row['Earnings']
    );
    const grossRevenue = parseNumber(row['Gross Amount'] || row['Gross Revenue'] || row['Sales Amount']);
    const fee = parseNumber(row['Fee'] || row['Deductions'] || row['Distributor Fee']);

    totalAmount += netRevenue;
    totalUnits += units;

    const payoutStatus = normalizeStatus(row['Payout Status'] || row['Status']);
    const sharePercentage = parseShare(row['Recipient Split'] || row['Split %'] || row['Participant Share']);

    const collaboratorSplits = [];
    if (collaboratorKey) {
      collaboratorSplits.push({
        collaboratorLookupKey: collaboratorKey,
        sharePercentage: sharePercentage || null,
        amount: sharePercentage ? (netRevenue * sharePercentage) / 100 : null,
        payoutStatus,
      });
    }

    const usageDate = parseDate(row['Sale Date'] || row['Usage Date'] || row['Activity Date'] || row['Date']);

    lineItems.push({
      releaseLookupKey: resolvedReleaseKey,
      sequence: index + 1,
      trackTitle:
        cleanString(row['Track Title'] || row['Track Name'] || row['Song Title'] || row['Title']) || releaseTitle || null,
      isrc: cleanString(row['ISRC'] || row['Track ISRC'] || row['ISRC Code']) || null,
      usageDate: usageDate,
      service: cleanString(row['Service'] || row['Store'] || row['Retailer'] || row['Platform']) || null,
      territory: cleanString(row['Territory'] || row['Country'] || row['Region']) || null,
      units: units || 0,
      netRevenue: netRevenue || 0,
      grossRevenue: grossRevenue || null,
      fee: fee || null,
      currency,
      payoutStatus,
      collaborators: collaboratorSplits,
      metadata: {
        row: rowNumber,
        raw: row,
      },
    });
  });

  const releaseList = Array.from(releases.values());
  const collaboratorList = Array.from(collaborators.values());

  const statement = {
    provider: 'EMPIRE',
    reference: statementReference || null,
    periodLabel: statementMonth || null,
    periodStart: statementStart,
    periodEnd: statementEnd,
    statementDate,
    currency: detectedCurrency || 'USD',
    totalAmount: Number(totalAmount.toFixed(4)),
    totalUnits,
    metadata: {
      source: 'EMPIRE',
    },
  };

  return {
    statement,
    releases: releaseList,
    collaborators: collaboratorList,
    lineItems,
    warnings,
  };
}

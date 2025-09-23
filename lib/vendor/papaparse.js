/**
 * Minimal CSV parser inspired by Papa Parse's API surface.
 * Supports basic delimiter parsing, quoted fields, escaped quotes,
 * header row normalization, and row-level error reporting.
 */
export function parseCsv(text, options = {}) {
  const config = {
    delimiter: ',',
    header: false,
    skipEmptyLines: false,
    ...options,
  };

  if (typeof text !== 'string') {
    throw new TypeError('CSV input must be a string');
  }

  const errors = [];
  const { rows, linebreak, quoteUnclosed } = tokenizeCsv(text, config.delimiter);

  if (quoteUnclosed) {
    errors.push({
      type: 'Quotes',
      code: 'UnclosedQuote',
      message: 'One or more quoted fields were not properly terminated.',
      row: rows.length,
    });
  }

  const meta = {
    delimiter: config.delimiter,
    linebreak: linebreak || '\n',
    fields: [],
  };

  if (!rows.length) {
    return { data: [], errors, meta };
  }

  let workingRows = rows.slice();
  if (config.skipEmptyLines) {
    workingRows = workingRows.filter((row) => !isRowEmpty(row));
  }

  if (!workingRows.length) {
    return { data: [], errors, meta };
  }

  if (config.header) {
    const headerRow = workingRows.shift() || [];
    meta.fields = headerRow.map((field, index) => {
      const trimmed = (field || '').trim();
      return trimmed || `field${index + 1}`;
    });

    const data = workingRows.map((row, rowIndex) => {
      if (row.length !== meta.fields.length) {
        errors.push({
          type: 'FieldMismatch',
          code: row.length < meta.fields.length ? 'TooFewFields' : 'TooManyFields',
          message: `Row ${rowIndex + 2} has ${row.length} fields but ${meta.fields.length} were expected`,
          row: rowIndex + 2,
        });
      }

      const record = {};
      meta.fields.forEach((field, index) => {
        record[field] = row[index] ?? '';
      });
      return record;
    });

    return { data, errors, meta };
  }

  return { data: workingRows, errors, meta };
}

function tokenizeCsv(text, delimiter) {
  const rows = [];
  let currentRow = [];
  let fieldBuffer = '';
  let inQuotes = false;
  let linebreak = null;
  let quoteUnclosed = false;

  const pushField = () => {
    currentRow.push(fieldBuffer);
    fieldBuffer = '';
  };

  const pushRow = () => {
    // Trim trailing carriage return from field buffer if present
    currentRow = currentRow.map((value) => value);
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          fieldBuffer += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        fieldBuffer += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      pushField();
      continue;
    }

    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') {
        linebreak = linebreak || '\r\n';
        i += 1;
      } else if (!linebreak) {
        linebreak = char;
      }
      pushField();
      pushRow();
      continue;
    }

    fieldBuffer += char;
  }

  pushField();
  if (fieldBuffer.length || currentRow.length) {
    pushRow();
  }

  if (inQuotes) {
    quoteUnclosed = true;
  }

  // Remove trailing empty row caused by a terminating newline
  if (rows.length && isRowEmpty(rows[rows.length - 1])) {
    rows.pop();
  }

  return { rows, linebreak, quoteUnclosed };
}

function isRowEmpty(row) {
  if (!row) return true;
  return row.every((value) => (value ?? '').trim().length === 0);
}

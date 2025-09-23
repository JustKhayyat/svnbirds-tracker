import { Buffer } from 'buffer';

function extractBoundary(contentType) {
  if (!contentType) return null;
  const match = /boundary=([^;]+)/i.exec(contentType);
  return match ? match[1] : null;
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Very small multipart/form-data parser that supports a single file upload
 * field and basic text fields. Designed for CSV ingestion in admin endpoints.
 */
export async function parseMultipartForm(req) {
  const boundary = extractBoundary(req.headers['content-type'] || '');
  if (!boundary) {
    throw new Error('Multipart boundary not found in Content-Type header');
  }

  const bodyBuffer = await readRequestBody(req);
  const body = bodyBuffer.toString('binary');
  const boundaryMarker = `--${boundary}`;
  const parts = body.split(boundaryMarker).filter((part) => part && part !== '--' && part !== '--\r\n');

  const files = [];
  const fields = {};

  parts.forEach((rawPart) => {
    let part = rawPart;
    if (part.startsWith('\r\n')) {
      part = part.slice(2);
    }
    if (part.endsWith('\r\n')) {
      part = part.slice(0, -2);
    }
    if (part === '--') {
      return;
    }

    const headerEndIndex = part.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) {
      return;
    }

    const headerSegment = part.slice(0, headerEndIndex);
    let valueSegment = part.slice(headerEndIndex + 4);
    if (valueSegment.endsWith('\r\n')) {
      valueSegment = valueSegment.slice(0, -2);
    }

    const headerLines = headerSegment.split('\r\n').map((line) => line.trim()).filter(Boolean);
    const dispositionLine = headerLines.find((line) => line.toLowerCase().startsWith('content-disposition'));
    if (!dispositionLine) {
      return;
    }

    const nameMatch = /name="([^"]+)"/.exec(dispositionLine);
    const filenameMatch = /filename="([^"]*)"/.exec(dispositionLine);
    const fieldName = nameMatch ? nameMatch[1] : undefined;
    if (!fieldName) {
      return;
    }

    const contentTypeLine = headerLines.find((line) => line.toLowerCase().startsWith('content-type'));
    const contentType = contentTypeLine ? contentTypeLine.split(':').slice(1).join(':').trim() : 'text/plain';

    if (filenameMatch && filenameMatch[1]) {
      const buffer = Buffer.from(valueSegment, 'binary');
      files.push({
        fieldName,
        filename: filenameMatch[1],
        contentType,
        buffer,
        size: buffer.length,
      });
    } else {
      fields[fieldName] = valueSegment;
    }
  });

  return { files, fields };
}

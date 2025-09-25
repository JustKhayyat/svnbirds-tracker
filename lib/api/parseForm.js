import formidable from 'formidable';
import fs from 'fs/promises';
import { Buffer } from 'buffer';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function parseForm(req) {
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_FILE_SIZE,
    maxTotalFileSize: MAX_FILE_SIZE,
    allowEmptyFiles: false,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        if (err.code === 'ETOOBIG') {
          const error = new Error('File too large');
          error.statusCode = 413;
          reject(error);
          return;
        }
        reject(err);
        return;
      }

      (async () => {
        try {
          const normalizedFiles = [];

          for (const [fieldName, fileValue] of Object.entries(files || {})) {
            const fileArray = Array.isArray(fileValue) ? fileValue : [fileValue];
            for (const file of fileArray) {
              if (!file) continue;
              const buffer = file.buffer
                ? Buffer.isBuffer(file.buffer)
                  ? file.buffer
                  : Buffer.from(file.buffer)
                : await fs.readFile(file.filepath);
              normalizedFiles.push({
                fieldName,
                filename: file.originalFilename || file.newFilename,
                contentType: file.mimetype,
                size: buffer.length,
                buffer,
              });
              if (file.filepath) {
                await fs.unlink(file.filepath).catch(() => {});
              }
            }
          }

          resolve({ fields, files: normalizedFiles });
        } catch (readError) {
          reject(readError);
        }
      })();
    });
  });
}

export { MAX_FILE_SIZE };

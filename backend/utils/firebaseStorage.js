/**
 * Firebase Storage utility
 * Fayl yuklash, o'chirish, URL olish
 */

const path = require('path');
const { bucket } = require('../config/firebase');

/**
 * Faylni Firebase Storage'ga yuklash
 * @param {Buffer|string} fileData — fayl buffer yoki local path
 * @param {string} destination — storage'dagi yo'l (masalan: 'submissions/123_file.py')
 * @param {object} options — { contentType, metadata }
 * @returns {Promise<string>} — public URL
 */
async function uploadFile(fileData, destination, options = {}) {
  const file = bucket.file(destination);

  const stream = file.createWriteStream({
    metadata: {
      contentType: options.contentType || 'application/octet-stream',
      metadata: options.metadata || {},
    },
    resumable: false,
  });

  return new Promise((resolve, reject) => {
    stream.on('error', (err) => {
      console.error('Firebase upload error:', err);
      reject(err);
    });

    stream.on('finish', async () => {
      try {
        // Faylni public qilish
        await file.makePublic();
      } catch (makePublicErr) {
        console.log('makePublic warning (non-fatal):', makePublicErr.message);
      }
      // Public URL — har doim shu formatda
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
      resolve(publicUrl);
    });

    // Buffer yoki string (local path)
    if (Buffer.isBuffer(fileData)) {
      stream.end(fileData);
    } else {
      // Local fayldan o'qish
      const fs = require('fs');
      const readStream = fs.createReadStream(fileData);
      readStream.pipe(stream);
    }
  });
}

/**
 * Multer orqali yuklangan faylni Firebase'ga o'tkazish
 * @param {object} multerFile — req.file (multer)
 * @param {string} folder — storage papkasi ('submissions', 'materials', 'portfolio')
 * @returns {Promise<{url: string, storagePath: string}>}
 */
async function uploadMulterFile(multerFile, folder = 'uploads') {
  const ext = path.extname(multerFile.originalname);
  const safeName = multerFile.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}_${safeName}`;
  const destination = `${folder}/${fileName}`;

  const contentType = multerFile.mimetype || 'application/octet-stream';

  const url = await uploadFile(multerFile.buffer || multerFile.path, destination, {
    contentType,
    metadata: {
      originalName: multerFile.originalname,
      size: String(multerFile.size),
    },
  });

  return { url, storagePath: destination, fileName };
}

/**
 * Firebase Storage'dan fayl o'chirish
 * @param {string} storagePath — storage'dagi yo'l
 */
async function deleteFile(storagePath) {
  try {
    if (!storagePath) return;
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`✓ Firebase: ${storagePath} deleted`);
    }
  } catch (err) {
    console.error('Firebase delete error (non-fatal):', err.message);
  }
}

/**
 * Storage path'dan public URL olish
 * @param {string} storagePath
 * @returns {string}
 */
function getPublicUrl(storagePath) {
  if (!storagePath) return '';
  // Agar allaqachon to'liq URL bo'lsa
  if (storagePath.startsWith('http')) return storagePath;
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

module.exports = {
  uploadFile,
  uploadMulterFile,
  deleteFile,
  getPublicUrl,
};

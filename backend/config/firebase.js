/**
 * Firebase Admin SDK konfiguratsiyasi
 * Storage uchun ishlatiladi (fayl yuklash)
 *
 * Environment variables:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   FIREBASE_STORAGE_BUCKET
 */

const admin = require('firebase-admin');

// Private key yangi qator belgilarini qayta tiklash
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '')
  .replace(/\\n/g, '\n');

// Firebase Admin SDK ni boshlash (faqat 1 marta)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };

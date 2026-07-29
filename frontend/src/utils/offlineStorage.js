/**
 * Offline Storage Utility
 * IndexedDB orqali offline test javoblarini saqlash va sinxronlash
 */

const DB_NAME = 'InfoTestOffline';
const DB_VERSION = 1;
const STORE_NAME = 'submissions';

// ─── IndexedDB ochish ────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('saved_at', 'saved_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Offline javobni saqlash ─────────────────────────────────
export async function saveOfflineSubmission(data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.add({
      ...data,
      saved_at: new Date().toISOString(),
      synced: false
    });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('💾 Offline: Submission saved');
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Offline save error:', error);
    // Fallback: localStorage
    const queue = JSON.parse(localStorage.getItem('offline_submissions') || '[]');
    queue.push({ ...data, saved_at: new Date().toISOString() });
    localStorage.setItem('offline_submissions', JSON.stringify(queue));
    return true;
  }
}

// ─── Saqlangan javoblarni olish ──────────────────────────────
export async function getOfflineSubmissions() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.filter(s => !s.synced));
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    // Fallback: localStorage
    return JSON.parse(localStorage.getItem('offline_submissions') || '[]');
  }
}

// ─── Yuborilgan javoblarni tozalash ──────────────────────────
export async function clearSyncedSubmissions() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    localStorage.removeItem('offline_submissions');
    console.log('🗑️ Offline: Cleared synced submissions');
  } catch (error) {
    localStorage.removeItem('offline_submissions');
  }
}

// ─── Offline javoblarni qo'lda yuborish (sync) ──────────────
export async function syncOfflineSubmissions(apiInstance) {
  const submissions = await getOfflineSubmissions();

  if (submissions.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const sub of submissions) {
    try {
      const { id, saved_at, synced: wasSynced, ...data } = sub;
      await apiInstance.post('/results/submit', data);
      synced++;
    } catch (error) {
      // 403 — allaqachon topshirilgan, shuning uchun ham "synced" deb hisoblaymiz
      if (error.response?.status === 403) {
        synced++;
      } else {
        failed++;
      }
    }
  }

  if (synced > 0) {
    await clearSyncedSubmissions();
  }

  return { synced, failed };
}

// ─── Offline javoblar soni ───────────────────────────────────
export async function getOfflineCount() {
  const submissions = await getOfflineSubmissions();
  return submissions.length;
}

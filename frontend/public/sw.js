/**
 * InfoTest Service Worker
 * PWA Offline rejim — Stale-While-Revalidate strategiyasi
 * CACHE_NAME har deploy'da timestamp bilan yangilanadi
 */

const CACHE_VERSION = Date.now(); // Har yangi SW install'da o'zgaradi
const CACHE_NAME = `infotest-v4-${CACHE_VERSION}`;
const API_CACHE = 'infotest-api-v4';
const OFFLINE_QUEUE = 'infotest-offline-queue';

// ─── INSTALL — darhol faollashtirish ─────────────────────────
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installing (version:', CACHE_VERSION, ')');
  // Eski SW'ni kutmasdan darhol o'z o'rniga o'tish
  self.skipWaiting();
});

// ─── ACTIVATE — eski keshlarni tozalash ──────────────────────
self.addEventListener('activate', (event) => {
  console.log('✅ SW: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Faqat joriy kesh va API keshni saqlash, qolganlarini o'chirish
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            console.log('🗑️ SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Barcha ochiq tab'larga darhol nazoratni olish
  self.clients.claim();
});

// ─── FETCH — so'rovlarni qayta ishlash ──────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Chrome extension va boshqa tashqi so'rovlarni o'tkazib yuborish
  if (!url.protocol.startsWith('http')) return;

  // API so'rovlar — Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Statik fayllar — Stale-While-Revalidate
  event.respondWith(handleStaticRequest(request));
});

/**
 * Stale-While-Revalidate — tez javob berish + fonda yangilash
 * 1. Keshda bo'lsa — darhol qaytaradi
 * 2. Parallel ravishda network'dan yangi versiyani tortadi
 * 3. Yangi versiya keshga yoziladi (keyingi safar yangi bo'ladi)
 * 4. Keshda yo'q bo'lsa — network'dan kutadi
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  // Network'dan tortish (fonda)
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok && networkResponse.type === 'basic') {
      // Yangi versiyani keshga yozish
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  // Keshdan darhol qaytarish
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Keshdan qaytarish, fonda yangilanadi
    // Keyingi safar ochganda yangi versiya bo'ladi
    fetchPromise; // fire-and-forget
    return cachedResponse;
  }

  // Keshda yo'q — network'dan kutish
  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;

  // Offline + keshda yo'q — SPA uchun index.html
  if (request.mode === 'navigate') {
    const indexCached = await caches.match('/index.html');
    if (indexCached) return indexCached;
  }

  return new Response('Offline', { status: 503 });
}

// API so'rovlar: Network First, Cache Fallback
async function handleApiRequest(request) {
  const url = new URL(request.url);

  // GET so'rovlar — Network first, cache fallback
  if (request.method === 'GET') {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(API_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;

      return new Response(JSON.stringify({
        error: 'Offline rejim. Internet qaytganda ma\'lumotlar yangilanadi.',
        offline: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // POST so'rovlar (test submit) — offline saqlash
  if (request.method === 'POST' && url.pathname.includes('/results/submit')) {
    try {
      const response = await fetch(request.clone());
      return response;
    } catch (error) {
      const body = await request.json();
      await saveOfflineSubmission(body);

      return new Response(JSON.stringify({
        message: 'Javoblar saqlandi. Internet qaytganda avtomatik yuboriladi.',
        offline: true,
        saved: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Boshqa POST/PUT so'rovlar
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Offline rejim. Bu amal uchun internet kerak.',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ─── IndexedDB — offline javoblarni saqlash ──────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('InfoTestOffline', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('submissions')) {
        db.createObjectStore('submissions', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOfflineSubmission(data) {
  const db = await openDB();
  const tx = db.transaction('submissions', 'readwrite');
  const store = tx.objectStore('submissions');
  store.add({
    ...data,
    saved_at: new Date().toISOString(),
    synced: false
  });
  console.log('💾 SW: Submission saved offline');
}

async function getOfflineSubmissions() {
  const db = await openDB();
  const tx = db.transaction('submissions', 'readonly');
  const store = tx.objectStore('submissions');
  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve([]);
  });
}

async function clearSyncedSubmissions() {
  const db = await openDB();
  const tx = db.transaction('submissions', 'readwrite');
  const store = tx.objectStore('submissions');
  store.clear();
  console.log('🗑️ SW: Synced submissions cleared');
}

// ─── SYNC — internet qaytganda javoblarni yuborish ───────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-submissions') {
    console.log('🔄 SW: Syncing offline submissions...');
    event.waitUntil(syncOfflineSubmissions());
  }
});

async function syncOfflineSubmissions() {
  const submissions = await getOfflineSubmissions();
  if (submissions.length === 0) return;

  console.log(`📤 SW: Syncing ${submissions.length} offline submission(s)...`);

  for (const sub of submissions) {
    try {
      const { id, saved_at, synced, ...data } = sub;
      const token = await getToken();

      const response = await fetch('/api/results/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        console.log('✅ SW: Submission synced successfully');
      }
    } catch (error) {
      console.error('❌ SW: Sync failed:', error);
      return;
    }
  }

  await clearSyncedSubmissions();

  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      count: submissions.length
    });
  });
}

// Token olish (client dan)
async function getToken() {
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data.token);
      clients[0].postMessage({ type: 'GET_TOKEN' }, [channel.port2]);
      // Timeout — 3 sekund
      setTimeout(() => resolve(null), 3000);
    });
  }
  return null;
}

// ─── MESSAGE — client bilan aloqa ────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});

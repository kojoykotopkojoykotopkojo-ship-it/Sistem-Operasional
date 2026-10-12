/* Service Worker — Sistem Operasional Kendari
   Strategi:
   - Halaman utama (navigasi): jaringan dulu (selalu versi terbaru); bila offline/lambat -> salinan tersimpan.
   - File statis satu origin (ikon, manifest, dll): cache + perbarui di latar belakang.
   - Library CDN (cdnjs, jsdelivr, Google Fonts): cache + perbarui di latar belakang (jalan offline setelah pernah dipakai).
   - Supabase, WhatsApp, OCR, Gemini, dll (API/data): TIDAK disentuh sama sekali -> data selalu langsung ke server.
   - Video latar (.mp4/.webm) & request Range: tidak disentuh.
   Naikkan VERSION setiap kali berkas aplikasi diganti supaya cache lama dibersihkan. */
const VERSION = 'ops-kendari-v6';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-rt';
const PREFIX = 'ops-kendari-';
const PRECACHE = [
  './', 'manifest.webmanifest', 'offline.html', 'bg.jpg', 'pwa.js', 'favicon.ico',
  'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NAV_TIMEOUT_MS = 8000;
// library yang dimuat di <head>: disimpan sejak instalasi supaya kunjungan pertama pun bisa jalan offline berikutnya
const CDN_PRECACHE = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      // satu per satu & toleran gagal: instalasi SW tidak boleh batal hanya karena 1 berkas gagal diunduh
      return Promise.all(PRECACHE.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () {
      return caches.open(RUNTIME).then(function (c) {
        return Promise.all(CDN_PRECACHE.map(function (u) {
          return fetch(new Request(u, { mode: 'cors', credentials: 'omit' }))
            .then(function (r) { if (r && r.ok) return c.put(new Request(u), r); })
            .catch(function () {});
        }));
      });
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== SHELL && k !== RUNTIME; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(function (v) { clearTimeout(t); resolve(v); }, function (err) { clearTimeout(t); reject(err); });
  });
}

async function handleNavigate(req) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match('./', { ignoreSearch: true });
  const offline = function () { return caches.match('offline.html'); };
  try {
    // bila sudah punya salinan -> batasi waktu tunggu; bila belum -> tunggu jaringan sampai selesai
    const net = fetch(req);
    const res = cached ? await withTimeout(net, NAV_TIMEOUT_MS) : await net;
    if (res && res.ok && res.type === 'basic') cache.put('./', res.clone()).catch(function () {});
    return res;
  } catch (err) {
    return cached || (await offline()) || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName, useCors) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = (async function () {
    let res;
    try {
      res = useCors
        ? await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' }))
        : await fetch(req);
    } catch (_) {
      if (!useCors) throw _;
      res = await fetch(req); // host tanpa CORS -> pakai request asli
    }
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(function () {});
    return res;
  })();
  if (hit) { refresh.catch(function () {}); return hit; }
  return refresh;
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  if (url.origin === self.location.origin) {
    if (/\.(mp4|webm|mov|m4v)$/i.test(url.pathname)) return;      // video latar: biarkan browser
    if (req.mode === 'navigate') { e.respondWith(handleNavigate(req)); return; }
    e.respondWith(staleWhileRevalidate(req, SHELL, false).catch(function () { return Response.error(); }));
    return;
  }
  if (CDN_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(staleWhileRevalidate(req, RUNTIME, true).catch(function () { return Response.error(); }));
  }
  // origin lain (Supabase, API, WhatsApp, dll): tidak di-intercept
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});

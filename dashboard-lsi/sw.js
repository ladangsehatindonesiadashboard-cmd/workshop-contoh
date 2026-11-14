/* Service worker shell Dashboard LSI.
   Hanya berkas statis (html/css/js/ikon). Respons Supabase, auth, dan data pengguna tidak pernah masuk cache.
   Naikkan SHELL_VERSION setiap kali isi shell berubah agar klien memuat versi baru. */
const SHELL_VERSION = 'lsi-shell-v1';
const SHELL = [
  '/',
  '/assets/styles.css',
  '/assets/app.js',
  '/assets/loader.js',
  '/assets/config.js',
  '/assets/favicon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-192.png',
  '/assets/icon-maskable-512.png',
  '/assets/apple-touch-icon.png',
  '/manifest.webmanifest'
];

const OFFLINE_HTML = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Dashboard LSI</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F6FA;font-family:Inter,Segoe UI,Arial,sans-serif;color:#14213D;padding:24px"><main style="background:#fff;border:1px solid #E3EAF3;border-radius:16px;padding:28px 22px;max-width:420px;text-align:center"><h1 style="font-size:18px;margin:0 0 8px">Anda sedang offline</h1><p style="font-size:14px;line-height:1.55;color:#6B7A90;margin:0">Data dashboard selalu diambil dari jaringan dan belum tersedia. Sambungkan internet lalu muat ulang.</p><button type="button" onclick="location.reload()" style="margin-top:18px;min-height:44px;background:#1E3A6E;color:#fff;border:0;border-radius:10px;padding:10px 18px;font:inherit;font-weight:800">Coba lagi</button></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skipWaiting') self.skipWaiting();
});

function shellPath(pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/manifest.webmanifest') return true;
  return pathname.startsWith('/assets/') && /\.(css|js|svg|png)$/.test(pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.get('authorization') || req.headers.get('apikey')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(rest|auth|functions|storage|realtime)\//.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigate(req));
    return;
  }
  if (!shellPath(url.pathname) || url.pathname === '/sw.js') return;
  event.respondWith(fromShell(req));
});

async function fromShell(req) {
  const cache = await caches.open(SHELL_VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const fresh = await fetch(req);
  if (fresh && fresh.ok && fresh.type === 'basic') cache.put(req, fresh.clone());
  return fresh;
}

async function navigate(req) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type === 'basic') {
      const cache = await caches.open(SHELL_VERSION);
      cache.put('/', fresh.clone());
    }
    return fresh;
  } catch (e) {
    const cache = await caches.open(SHELL_VERSION);
    const hit = await cache.match('/') || await cache.match('/index.html');
    if (hit) return hit;
    return new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}

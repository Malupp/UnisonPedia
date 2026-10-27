/* Tokens are replaced by the production postbuild. Do not register in ng serve. */
const RELEASE = '__OFFLINE_VERSION__';
const SHELL = __OFFLINE_SHELL__;
const SHELL_CACHE = 'unison-shell-' + RELEASE;
const META = 'unison-offline-meta';
const ACTIVE = '/__offline__/active';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  // No skipWaiting: the old worker keeps its shell until its tabs have closed.
  event.waitUntil((async () => {
    await self.clients.claim();
    for (const name of await caches.keys()) {
      if (name.startsWith('unison-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
  })());
});

function publicConfig(raw) {
  if (!raw || !['supabaseUrl', 'publishableKey', 'appUrl'].every(key => typeof raw[key] === 'string')) return null;
  const { supabaseUrl, publishableKey, appUrl } = raw;
  if (!supabaseUrl && !publishableKey && !appUrl) return { supabaseUrl, publishableKey, appUrl };
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return null;
  try {
    const db = new URL(supabaseUrl), app = new URL(appUrl);
    for (const url of [db, app]) {
      const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
      if ((url.protocol !== 'https:' && !local) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    }
    return { supabaseUrl: db.origin, publishableKey, appUrl: app.origin };
  } catch { return null; }
}

async function cachedPublic(request, pathname) {
  const stateResponse = await (await caches.open(META)).match(ACTIVE);
  const state = stateResponse ? await stateResponse.json() : {};
  const valid = version => typeof version === 'string' && /^[a-f0-9]{24}$/.test(version);
  const key = request.mode === 'navigate' ? '/index.html' : pathname;
  if (valid(state.version)) {
    const response = await (await caches.open('unison-content-' + state.version)).match(key);
    if (response) return response;
    // Old hashed chunks may still be requested by an open tab after applying an update.
    if (valid(state.previous) && /^\/[A-Za-z0-9_-]+\.js$/.test(key)) {
      const previous = await (await caches.open('unison-content-' + state.previous)).match(key);
      if (previous) return previous;
    }
  }
  if (request.mode === 'navigate') {
    try { return await fetch(request); } catch {
      const fallback = await (await caches.open(SHELL_CACHE)).match('/index.html');
      return fallback || Response.error();
    }
  }
  const shell = await (await caches.open(SHELL_CACHE)).match(key);
  return shell || fetch(request);
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/offline/') || url.pathname.startsWith('/__offline__/')) return;
  if (url.pathname === '/app-config.json') {
    event.respondWith((async () => {
      let cache;
      try { cache = await caches.open(META); } catch { return fetch(request); }
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          try {
            const config = publicConfig(await response.clone().json());
            if (config) await cache.put('/app-config.json', Response.json(config));
          } catch { /* Malformed config or denied storage must not replace a valid copy or hide a live response. */ }
        }
        return response;
      } catch { return await cache.match('/app-config.json') || Response.error(); }
    })());
    return;
  }
  // Auth callbacks must always reach the network while online, including query parameters.
  if (request.mode === 'navigate' && url.pathname.startsWith('/auth/')) {
    event.respondWith(fetch(request).catch(() => cachedPublic(request, url.pathname)));
    return;
  }
  if (request.mode === 'navigate' || /^\/(?:assets|data)\//.test(url.pathname) || /^\/(?:index\.html|manifest\.webmanifest|[A-Za-z0-9_-]+\.(?:js|css))$/.test(url.pathname)) event.respondWith(cachedPublic(request, url.pathname).catch(() => fetch(request)));
});

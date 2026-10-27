export interface OfflineFile { url: string; bytes: number; hash: string; type: string }
export interface OfflinePack { url: string; bytes: number; hash: string; files: OfflineFile[] }
export interface OfflineIndex { format: number; version: string; totalFiles: number; unpackedBytes: number; downloadBytes: number; shell: string[]; packs: OfflinePack[] }
export interface OfflineProgress { done: number; total: number }
export const META_CACHE = 'unison-offline-meta';
export const ACTIVE_URL = '/__offline__/active';
export const INDEX_URL = '/__offline__/index';
const COMPLETE_URL = '/__offline__/complete';
export const contentCache = (version: string) => 'unison-content-' + version;
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const validVersion = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
const validHash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const natural = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const mime: Record<string, string> = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' };
function publicPath(path: unknown): path is string {
  return typeof path === 'string' && !path.includes('..') && (/^\/(?:assets|data)\/[A-Za-z0-9_./-]+$/.test(path) || /^\/(?:index\.html|manifest\.webmanifest|[A-Za-z0-9_-]+\.(?:js|css))$/.test(path));
}
export function validateIndex(raw: unknown): OfflineIndex {
  const value = raw as OfflineIndex;
  if (!value || value.format !== 1 || !validVersion(value.version) || !natural(value.totalFiles) || !natural(value.unpackedBytes) || !natural(value.downloadBytes) || !Array.isArray(value.packs) || value.packs.length > 2000 || !Array.isArray(value.shell)) throw Error('Indice offline non valido.');
  const seen = new Set<string>(), packUrls = new Set<string>(); let size = 0, transfer = 0;
  for (const pack of value.packs) {
    if (!pack || !new RegExp(`^/offline/${value.version}/pack-[0-9]+\\.gz$`).test(pack.url) || packUrls.has(pack.url) || !natural(pack.bytes) || pack.bytes > 16 * 1024 * 1024 || !validHash(pack.hash) || !Array.isArray(pack.files) || !pack.files.length) throw Error('Pacchetto offline non valido.');
    packUrls.add(pack.url); transfer += pack.bytes;
    let packSize = 0;
    for (const file of pack.files) {
      if (!file || !publicPath(file.url) || seen.has(file.url) || !natural(file.bytes) || !validHash(file.hash) || mime[file.url.split('.').pop()!] !== file.type) throw Error('Risorsa offline non valida.');
      seen.add(file.url); size += file.bytes; packSize += file.bytes;
    }
    if (packSize > 16 * 1024 * 1024) throw Error('Pacchetto offline troppo grande.');
  }
  if (seen.size !== value.totalFiles || size !== value.unpackedBytes || transfer !== value.downloadBytes || value.shell.some(path => !seen.has(path))) throw Error('Indice offline incompleto.');
  return value;
}
export async function activeVersion(storage: CacheStorage): Promise<string | null> {
  const response = await (await storage.open(META_CACHE)).match(ACTIVE_URL);
  if (!response) return null;
  const state = await response.json();
  return validVersion(state.version) ? state.version : null;
}
async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function unpack(compressed: Uint8Array, limit: number): Promise<Uint8Array> {
  const reader = new Blob([compressed.slice().buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.length;
      if (size > limit) throw Error('Dimensione del pacchetto non valida.');
      chunks.push(result.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export class OfflineDownload {
  constructor(private deps: { storage: CacheStorage; fetchPack: typeof fetch }) {}
  async cachedIndex(version: string): Promise<OfflineIndex | null> {
    const response = await (await this.deps.storage.open(contentCache(version))).match(INDEX_URL);
    try { return response ? validateIndex(await response.json()) : null; } catch { return null; }
  }
  async isComplete(index: OfflineIndex): Promise<boolean> {
    const cache = await this.deps.storage.open(contentCache(index.version));
    if (!(await cache.match(COMPLETE_URL))) return false;
    const present = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
    return index.packs.every(pack => pack.files.every(file => present.has(file.url)));
  }
  async remaining(index: OfflineIndex): Promise<{ files: number; bytes: number }> {
    const cache = await this.deps.storage.open(contentCache(index.version));
    const present = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
    const missing = index.packs.flatMap(pack => pack.files).filter(file => !present.has(file.url));
    return { files: missing.length, bytes: missing.reduce((sum, file) => sum + file.bytes, 0) };
  }
  async download(input: OfflineIndex, signal: AbortSignal, progress: (state: OfflineProgress) => void): Promise<void> {
    const index = validateIndex(input); signal.throwIfAborted();
    const { storage, fetchPack } = this.deps;
    const cache = await storage.open(contentCache(index.version));
    await cache.put(INDEX_URL, json(index));
    const present = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
    let done = 0; progress({ done, total: index.totalFiles });
    for (let number = 0; number < index.packs.length; number++) {
      signal.throwIfAborted();
      const pack = index.packs[number], marker = '/__offline__/pack-' + number;
      if (present.has(marker) && pack.files.every(file => present.has(file.url))) {
        done += pack.files.length; progress({ done, total: index.totalFiles }); continue;
      }
      const response = await fetchPack(pack.url, { cache: 'no-store', signal });
      if (!response.ok) throw Error('Download interrotto. Riprova con una connessione stabile.');
      const zipped = new Uint8Array(await response.arrayBuffer());
      if (zipped.length !== pack.bytes || await digest(zipped) !== pack.hash) throw Error('Pacchetto non valido. Riprova: i dati già verificati restano salvati.');
      const dataBytes = pack.files.reduce((sum, file) => sum + file.bytes, 0);
      const raw = await unpack(zipped, dataBytes + 4 * 1024 * 1024);
      if (raw.length < 4) throw Error('Pacchetto incompleto.');
      const headerSize = new DataView(raw.buffer).getUint32(0, true);
      if (headerSize > raw.length - 4) throw Error('Indice del pacchetto non valido.');
      const entries: (OfflineFile & { offset: number })[] = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + headerSize)));
      if (!Array.isArray(entries) || entries.length !== pack.files.length || raw.length !== 4 + headerSize + dataBytes) throw Error('Contenuto del pacchetto incompleto.');
      let offset = 0;
      for (let i = 0; i < entries.length; i++) {
        signal.throwIfAborted();
        const entry = entries[i], expected = pack.files[i];
        if (entry.url !== expected.url || entry.type !== expected.type || entry.bytes !== expected.bytes || entry.hash !== expected.hash || entry.offset !== offset) throw Error('Indice del pacchetto non valido.');
        const body = raw.subarray(4 + headerSize + offset, 4 + headerSize + offset + entry.bytes);
        if (await digest(body) !== entry.hash) throw Error('Verifica dei dati non riuscita.');
        await cache.put(entry.url, new Response(body.slice().buffer as ArrayBuffer, { headers: { 'Content-Type': entry.type, 'Content-Length': String(entry.bytes) } }));
        offset += entry.bytes; done++;
        if (done % 25 === 0) progress({ done, total: index.totalFiles });
      }
      await cache.put(marker, json({ hash: pack.hash }));
      progress({ done, total: index.totalFiles });
    }
    signal.throwIfAborted();
    const complete = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
    if (!index.packs.every(pack => pack.files.every(file => complete.has(file.url)))) throw Error('Alcuni file non sono stati conservati. Libera spazio e riprova.');
    await cache.put(COMPLETE_URL, json({ version: index.version }));
    if (!(await activeVersion(storage))) await this.activate(index);
  }
  async activate(index: OfflineIndex): Promise<void> {
    if (!(await this.isComplete(index))) throw Error('Completa prima il download.');
    const meta = await this.deps.storage.open(META_CACHE);
    const previous = await activeVersion(this.deps.storage);
    await meta.put(ACTIVE_URL, json({ version: index.version, previous: previous === index.version ? null : previous }));
    // Retain the previous release for bundles still used by already-open tabs.
    for (const name of await this.deps.storage.keys()) {
      if (name.startsWith('unison-content-') && !name.endsWith(index.version) && !(previous && name.endsWith(previous))) await this.deps.storage.delete(name);
    }
  }
}

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const sha = (data) => createHash('sha256').update(data).digest('hex');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

export async function prepareOffline(directory, { maxPackBytes = 2 * 1024 * 1024 } = {}) {
  const files = [];
  async function walk(relative = '') {
    for (const entry of (await readdir(join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = relative ? relative + '/' + entry.name : entry.name;
      if (entry.name === 'offline' || path === 'service-worker.js' || path === 'app-config.json') continue;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && types[extname(path)]) {
        const data = await readFile(join(directory, path));
        files.push({ url: '/' + path, bytes: data.length, hash: sha(data), type: types[extname(path)], data });
      }
    }
  }
  await walk();
  const version = sha(JSON.stringify(files.map(({ data, ...file }) => file))).slice(0, 24);
  const output = join(directory, 'offline', version);
  await mkdir(output, { recursive: true });
  const packs = [];
  let batch = [], bytes = 0;
  async function flush() {
    if (!batch.length) return;
    let offset = 0;
    const entries = batch.map(({ data, ...file }) => {
      const entry = { ...file, offset }; offset += file.bytes; return entry;
    });
    const header = Buffer.from(JSON.stringify(entries));
    const length = Buffer.alloc(4); length.writeUInt32LE(header.length);
    const compressed = gzipSync(Buffer.concat([length, header, ...batch.map(f => f.data)]), { level: 6 });
    const name = `pack-${String(packs.length).padStart(3, '0')}.gz`;
    await writeFile(join(output, name), compressed);
    packs.push({ url: `/offline/${version}/${name}`, bytes: compressed.length, hash: sha(compressed), files: batch.map(({ data, ...file }) => file) });
    batch = []; bytes = 0;
  }
  for (const file of files) {
    if (batch.length && bytes + file.bytes > maxPackBytes) await flush();
    batch.push(file); bytes += file.bytes;
  }
  await flush();
  const shell = files.filter(f => /^\/[^/]+\.(js|css|html|webmanifest)$/.test(f.url) || f.url.startsWith('/assets/brand/')).map(f => f.url);
  const index = { format: 1, version, totalFiles: files.length, unpackedBytes: files.reduce((n, f) => n + f.bytes, 0), downloadBytes: packs.reduce((n, p) => n + p.bytes, 0), shell, packs };
  await writeFile(join(directory, 'offline', 'index.json'), JSON.stringify(index));
  const template = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');
  await writeFile(join(directory, 'service-worker.js'), template.replaceAll('__OFFLINE_VERSION__', version).replace('__OFFLINE_SHELL__', JSON.stringify(shell)));
  return index;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = await prepareOffline(resolve('dist/unisonpedia/browser'));
  console.log(`Offline: ${index.totalFiles} file, ${index.packs.length} pacchetti, ${(index.downloadBytes / 1e6).toFixed(1)} MB da scaricare, ${(index.unpackedBytes / 1e6).toFixed(1)} MB non compressi`);
}

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const release = resolve(dirname(fileURLToPath(import.meta.url)), '../outputs/TigerScoutRelease');
const origin = 'https://tiger-scout.jacobliu1239.workers.dev';
const names = readdirSync(release, { recursive: true }).filter(name => statSync(resolve(release, name)).isFile());
await Promise.all(names.map(async name => {
  const path = name.replaceAll('\\', '/');
  const response = await fetch(`${origin}/${path === 'index.html' ? '' : path}`, {
    headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000)
  });
  assert.equal(response.status, 200, `Live asset unavailable: ${path}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.equals(readFileSync(resolve(release, name))), `Live asset differs from release: ${path}`);
}));
console.log(`Verified ${names.length} live files match the Tiger Scout release, including fuel sliders, defense checkbox, and offline assets.`);
console.log(origin);

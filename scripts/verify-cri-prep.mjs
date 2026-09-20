import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../worker/index.js', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /name: 'CRI 2026'/);
assert.match(source, /fullName: 'Chesapeake Robotics Icebreaker'/);
assert.match(source, /tbaKey: '2026vaale1'/);
assert.match(source, /teams: \[[^\]]*'9072'[^\]]*'9072B'[^\]]*\]/s);
assert.match(source, /removeItem\('tiger-tba-schedule'\)/);
assert.match(source, /tiger-cri-preset-version/);
assert.match(serviceWorker, /tiger-scout-v27-event-setup/);
assert.doesNotMatch(workerSource, /TBA_API_KEY\s*[:=]\s*['"][A-Za-z0-9]{24,}/);

const { default: worker } = await import('../dist/server/index.js');
let requestedUrl = '';
let requestedKey = '';
globalThis.fetch = async (url, options = {}) => {
  requestedUrl = String(url);
  requestedKey = options.headers?.['X-TBA-Auth-Key'] || '';
  return new Response(JSON.stringify([{ key: '2026vaale1_qm1' }]), {
    headers: { 'content-type': 'application/json' }
  });
};

const response = await worker.fetch(
  new Request('https://tiger-scout.test/api/tba/cri/matches'),
  { TBA_API_KEY: 'runtime-only-test-key' }
);
assert.equal(response.status, 200);
assert.match(requestedUrl, /event\/2026vaale1\/matches$/);
assert.equal(requestedKey, 'runtime-only-test-key');
assert.deepEqual(await response.json(), [{ key: '2026vaale1_qm1' }]);

const missingSecret = await worker.fetch(
  new Request('https://tiger-scout.test/api/tba/cri/matches'),
  {}
);
assert.equal(missingSecret.status, 503);

const protectedDatabase = await worker.fetch(
  new Request('https://tiger-scout.test/api/records'),
  { TBA_API_KEY: 'runtime-only-test-key' }
);
assert.equal(protectedDatabase.status, 401);

console.log('CRI preset, protected TBA proxy, stale-schedule reset, roster, and offline cache version verified.');

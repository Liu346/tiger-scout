import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../worker/index.js';

const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  requests.push({ url, init });
  if (url.includes('/api/v3/team/frc9072/media/2026')) {
    assert.equal(init.headers['X-TBA-Auth-Key'], 'secret');
    return Response.json([
      { type:'avatar', preferred:true, direct_url:'https://i.imgur.com/avatar.png' },
      { type:'imgur', preferred:false, direct_url:'https://i.imgur.com/older.png' },
      { type:'imgur', preferred:true, direct_url:'https://i.imgur.com/preferred.png', view_url:'https://imgur.com/preferred' }
    ]);
  }
  if (url === 'https://i.imgur.com/preferred.png') {
    return new Response(new Uint8Array([137, 80, 78, 71]), { headers:{ 'content-type':'image/png' } });
  }
  throw new Error(`Unexpected request: ${url}`);
};

try {
  const response = await worker.fetch(
    new Request('https://tiger.test/api/tba/team-photo?team=9072&year=2026'),
    { TBA_API_KEY:'secret' }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('x-tiger-photo-source'), 'https://i.imgur.com/preferred.png');
  assert.equal((await response.arrayBuffer()).byteLength, 4);
  assert.equal(requests.length, 2);

  const client = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(client, /id="pullTeamPhotoTba"/);
  assert.match(client, /source:'tba-media'/);
  assert.match(client, /resizeTeamPhoto\(photo\.blob\)/);
  assert.match(client, /Connect to the internet to pull a Blue Alliance photo/);
  assert.match(client, /id:`team-photo-\$\{team\}`/);
  assert.match(client, /id\?\.startsWith\('team-logo-'\)/);
  console.log('TBA team photo lookup, preferred-photo selection, offline save, and logo separation verified.');
} finally {
  globalThis.fetch = originalFetch;
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../worker/index.js', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.doesNotMatch(source, /api\.statbotics\.io|tiger-statbotics|STATBOTICS PREDICTION/);
assert.match(source, /MATCH13 XP/);
assert.match(source, /XP RANK/);
assert.match(source, /MATCH13 FORECAST/);
assert.match(source, /tiger-match13-teams/);
assert.match(source, /teamAnalytics: relevantAnalytics/);
assert.match(workerSource, /https:\/\/actions\.match13\.com/);
assert.match(workerSource, /Bearer \$\{env\.MATCH13_API_KEY\}/);
assert.match(serviceWorker, /tiger-scout-v35-wide-qr-scanner/);
assert.match(source, /team-match13-card/);
assert.match(source, /AUTO XP/);
assert.match(source, /TELEOP XP/);
assert.match(source, /ENDGAME XP/);
assert.match(source, /XP VARIANCE/);
assert.match(source, /refreshTeamMatch13/);

const { default: worker } = await import('../dist/server/index.js');
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).includes('/events/')) {
    return new Response(JSON.stringify({ eventKey:'2026vaale1', year:2026, teams:[
      { teamNumber:9072, xpEnd:82.4, xAuto:14.2, xTele:61.1, xEnd:7.1, xVar:21.4 }
    ] }), { headers:{ 'content-type':'application/json' } });
  }
  if (String(url).includes('/matches/')) {
    return new Response(JSON.stringify({ key:'2026vaale1_qm13', pred:{ winProb:.61, redScore:124.2, blueScore:116.8 } }), {
      headers:{ 'content-type':'application/json' }
    });
  }
  return new Response(JSON.stringify({ teamNumber:9072, year:2026, xp:81.6, normXp:1900, rank:55, xVar:19.2 }), {
    headers:{ 'content-type':'application/json' }
  });
};

const env = { MATCH13_API_KEY:'m13_live_runtime-only-test-key' };
const teamResponse = await worker.fetch(new Request('https://tiger-scout.test/api/match13/team?team=9072&year=2026'), env);
assert.equal(teamResponse.status, 200);
assert.match(calls.at(-1).url, /\/v1\/teams\/9072\/years\/2026\?scope=all$/);
assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer m13_live_runtime-only-test-key');
assert.equal((await teamResponse.json()).xp, 81.6);

const eventResponse = await worker.fetch(new Request('https://tiger-scout.test/api/match13/event?eventKey=2026vaale1'), env);
assert.equal(eventResponse.status, 200);
assert.match(calls.at(-1).url, /\/v1\/events\/2026vaale1\/teams$/);

const matchResponse = await worker.fetch(new Request('https://tiger-scout.test/api/match13/match?matchKey=2026vaale1_qm13'), env);
assert.equal(matchResponse.status, 200);
assert.match(calls.at(-1).url, /\/v1\/matches\/2026vaale1_qm13\?scope=all$/);
assert.equal((await matchResponse.json()).pred.winProb, .61);

const missingSecret = await worker.fetch(new Request('https://tiger-scout.test/api/match13/team?team=9072&year=2026'), {});
assert.equal(missingSecret.status, 503);
const invalidTeam = await worker.fetch(new Request('https://tiger-scout.test/api/match13/team?team=9072x&year=2026'), env);
assert.equal(invalidTeam.status, 400);

console.log('Match13 XP, event rankings, match forecasts, private API proxy, and offline cache version verified.');

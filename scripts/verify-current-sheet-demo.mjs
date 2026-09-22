import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const generator = source.match(/async function generateDemoData\(\) \{([\s\S]*?)\n\}\n\nfunction download/)?.[1] || '';

assert.ok(generator, 'Demo generator was not found.');
assert.match(generator, /CRI_EVENT\.teams/);
assert.match(generator, /const matchesPerTeam = 12/);
assert.match(generator, /v: 3, event: CRI_EVENT\.name/);
assert.match(generator, /autoFuelRate, autoFuelSeconds, autoFuel: Math\.round\(autoFuelRate \* autoFuelSeconds\)/);
assert.match(generator, /teleFuelRate, teleFuelSeconds, teleFuel: Math\.round\(teleFuelRate \* teleFuelSeconds\)/);
assert.match(generator, /playedDefense, defense/);
assert.match(generator, /groundIntake, trench, bump/);
assert.match(generator, /fouls, broke: disabled/);
assert.match(generator, /scout: scouts\[/);
assert.match(generator, /startsWith\('demo-2026-'\)/);
assert.doesNotMatch(generator, /TigerBots Invitational|v: 2/);
assert.match(source, /Load competition test data/);
assert.doesNotMatch(source, /Load 360 test records/);
assert.match(serviceWorker, /tiger-scout-v35-wide-qr-scanner/);

console.log('Competition test data matches the current scouting sheet fields and CRI roster.');

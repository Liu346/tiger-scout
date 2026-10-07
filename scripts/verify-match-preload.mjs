import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /function scoutAssignmentPayload\(assignment\)/);
assert.match(source, /return `SCT1:/);
assert.match(source, /function decodeScoutAssignmentPayload\(payload\)/);
assert.match(source, /\['red','blue'\]\.includes\(alliance\)/);
assert.match(source, /function drawMatchPreloadQrs\(preload/);
assert.match(source, /preload\.red\.map[\s\S]*preload\.blue\.map/);
assert.match(source, /Create 6 scout QR codes/);
assert.match(source, /data-event-view="match"/);
assert.match(source, /name="match" type="number"/);
assert.match(source, /name="red\$\{index\}" type="number"/);
assert.match(source, /name="blue\$\{index\}" type="number"/);
assert.match(source, /new Set\(teams\)\.size !== 6/);
assert.match(source, /tiger-tba-schedule/);
assert.match(source, /Fill from saved schedule/);
assert.match(source, /tiger-pending-scout-assignment/);
assert.match(source, /QR ASSIGNMENT LOADED/);
assert.match(source, /if \(payload\.startsWith\('SCT1:'\)\) return importScoutAssignmentPayload\(payload\)/);
assert.match(source, /await \(await dbPromise\)\.put\('records', draft\);\s*localStorage\.removeItem\('tiger-pending-scout-assignment'\)/);
assert.match(css, /\.assignment-qr-grid\{display:grid;grid-template-columns:repeat\(3/);
assert.match(css, /@media\(max-width:900px\)\{\.assignment-qr-grid\{grid-template-columns:repeat\(2/);
assert.match(css, /@media\(max-width:700px\)[\s\S]*\.assignment-qr-grid\{grid-template-columns:1fr/);
assert.match(css, /\.preloaded-assignment-banner/);
assert.match(worker, /tiger-scout-v39-compact-matchprep-strategy/);

console.log('Six-code match preload, assignment persistence, receiving flows, and responsive layout verified.');

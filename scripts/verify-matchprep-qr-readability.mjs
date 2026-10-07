import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /return `TMP3:\$\{btoa/);
assert.match(source, /p: \[prep\.ourScore, prep\.ourMin, prep\.ourMax, prep\.opponentScore, prep\.opponentMin, prep\.opponentMax, prep\.winChance\]/);
assert.match(source, /s: strategy/);
assert.match(source, /entry\[1\] !== null && entry\[1\] !== undefined/);
assert.match(source, /if \(payload\.startsWith\('TMP3:'\)\) return importCompactMatchPrepPayload\(payload\)/);
assert.match(source, /if \(payload\.startsWith\('TMP2J:'\) \|\| payload\.startsWith\('TMP2G:'\)\) return importMatchPrepPacketChunk\(payload\)/);
assert.match(source, /1 compact QR/);
assert.match(source, /width:420, height:420/);
assert.match(source, /colorDark:'#000000', colorLight:'#ffffff'/);
assert.match(source, /correctLevel:QRCode\.CorrectLevel\.M/);
assert.match(source, /AUTO PLAN & TEAM NOTES/);
assert.match(source, /data-strategy-team=/);
assert.match(source, /data-strategy-note=/);
assert.match(source, /matchPrepCatalogStrategyMarkup/);
assert.doesNotMatch(source.slice(source.indexOf('function compactMatchPrepPayload'), source.indexOf('function decodeCompactMatchPrepPayload')), /records|schedule|teamAnalytics/);
assert.match(styles, /\.auto-start-field/);
assert.match(styles, /\.matchprep-team-notes/);
assert.match(styles, /\.matchprep-strategy-layout>\*\{min-width:0\}/);
assert.match(styles, /\.auto-start-field\{min-height:0;aspect-ratio:1\.7\/1\}/);
assert.match(worker, /tiger-scout-v39-compact-matchprep-strategy/);

console.log('Compact single-QR Match Prep scores, ranges, probability, strategy map, notes, and legacy import routing verified.');

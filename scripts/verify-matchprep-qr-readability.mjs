import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /const MATCH_PREP_QR_CHUNK_SIZE = 450/);
assert.match(source, /const MATCH_PREP_QR_SIZE = 360/);
assert.match(source, /new RegExp\(`\.\{1,\$\{MATCH_PREP_QR_CHUNK_SIZE\}\}`/);
assert.match(source, /width: MATCH_PREP_QR_SIZE, height: MATCH_PREP_QR_SIZE/);
assert.match(source, /colorDark: '#000000', colorLight: '#ffffff'/);
assert.match(source, /correctLevel: QRCode\.CorrectLevel\.M/);
assert.match(source, /Each code is camera-optimized/);
assert.doesNotMatch(source, /match\(\/\.\{1,1500\}\/g\)/);
assert.match(source, /if \(payload\.startsWith\('TMP2J:'\) \|\| payload\.startsWith\('TMP2G:'\)\) return importMatchPrepPacketChunk\(payload\)/);
assert.match(worker, /tiger-scout-v38-readable-matchprep-qr/);

console.log('Camera-readable Match Prep packet sizing, contrast, error correction, and scan import routing verified.');

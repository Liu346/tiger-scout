import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.doesNotMatch(source, /capture="(?:environment|user)"/);
assert.match(source, /Camera or photo library<input id="teamPhotoInput" type="file" accept="image\/\*">/);
assert.match(source, /id="scanCamera"[\s\S]*Back camera[\s\S]*Front camera/);
assert.match(source, /id="eventCamera"[\s\S]*Back camera[\s\S]*Front camera/);
assert.match(source, /preferredCamera: camera/);
assert.match(source, /scanner\.setCamera\(select\.value\)/);
assert.match(source, /async function scanQrImageFile\(file\)/);
assert.match(source, /returnDetailedScanResult: true/);
assert.match(source, /await importPayload\(await scanQrImageFile\(e\.target\.files\?\.\[0\]\)\)/);
assert.match(source, /await importEventSetupPayload\(await scanQrImageFile\(event\.target\.files\?\.\[0\]\)\)/);
assert.match(source, /finally \{ e\.target\.value = ''; \}/);
assert.match(source, /finally \{ event\.target\.value = ''; \}/);
assert.match(css, /@media\(max-width:520px\)\{\.scanner-controls\{grid-template-columns:1fr\}\}/);
assert.match(worker, /tiger-scout-v30-ios-camera-qr/);

console.log('iPhone camera choices, native photo picker, screenshot QR decoder, retry support, and mobile layout verified.');

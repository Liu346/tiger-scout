import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /Camera or photo library<input id="teamPhotoInput" type="file" accept="image\/\*">/);
assert.doesNotMatch(source.match(/id="teamPhotoInput"[^>]+/)[0], /capture=/);
assert.match(source, /id="scanCamera"[\s\S]*Back camera[\s\S]*Front camera/);
assert.match(source, /id="eventCamera"[\s\S]*Back camera[\s\S]*Front camera/);
assert.match(source, /preferredCamera: camera/);
assert.match(source, /calculateScanRegion: fullVideoScanRegion/);
assert.match(source, /x: 0, y: 0, width, height/);
assert.match(source, /900 \/ Math\.max\(width, height\)/);
assert.match(source, /scanner\.setInversionMode\('both'\)/);
assert.match(source, /maxScansPerSecond: 20/);
assert.match(source, /scanner\.hasFlash/);
assert.match(source, /scanner\.toggleFlash/);
assert.match(source, /navigator\.wakeLock\.request\('screen'\)/);
assert.match(source, /QR can be anywhere in this view/);
assert.match(source, /scanner\.setCamera\(select\.value\)/);
assert.match(source, /navigator\.mediaDevices\.getUserMedia/);
assert.match(source, /facingMode: \{ ideal: camera \}/);
assert.match(source, /webkit-playsinline/);
assert.match(source, /async function scanQrImageFile\(file\)/);
assert.match(source, /returnDetailedScanResult: true/);
assert.match(source, /id="qrCameraFile"[^>]+capture="environment"/);
assert.match(source, /id="eventQrCameraFile"[^>]+capture="environment"/);
assert.match(source, /wireQrImageInput\(document\.querySelector\('#qrCameraFile'\), importPayload/);
assert.match(source, /wireQrImageInput\(document\.querySelector\('#eventQrCameraFile'\), importEventOrMatchSetupPayload/);
assert.match(source, /Camera permission is blocked/);
assert.match(css, /@media\(max-width:520px\)\{\.scanner-controls,\.qr-image-options\{grid-template-columns:1fr\}/);
assert.match(css, /filter:brightness\(1\.14\) contrast\(1\.18\)/);
assert.match(worker, /tiger-scout-v36-match-preload/);

console.log('Full-frame QR scanning, light and dark QR detection, flashlight support, awake screen, image fallback, and mobile layout verified.');

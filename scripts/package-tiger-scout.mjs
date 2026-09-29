import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, process.argv[2] || 'outputs/TigerScoutRelease');
assert.ok(output.startsWith(`${root}/`) || output.startsWith(`${root}\\`), 'Output must be inside the project');
const vendor = ['qrcode.min.js', 'qr-scanner.umd.min.js', 'qr-scanner-worker.min.js', 'chart.umd.min.js'];
const canonical = [
  'index.html', 'sw.js', 'src/main.js', 'src/style.css',
  'public/manifest.webmanifest', 'public/icon.svg', 'public/team-9072-logo.png', 'public/frc-world-championship.webp', 'public/og.png',
  ...vendor.map(name => `public/vendor/${name}`)
];
// Keep old installed apps working while they fetch the current index and worker.
const aliases = [
  ['src/main.js', 'main.js'], ['src/style.css', 'style.css'],
  ['public/manifest.webmanifest', 'manifest.webmanifest'],
  ['public/icon.svg', 'icon.svg'], ['public/team-9072-logo.png', 'team-9072-logo.png'],
  ['public/frc-world-championship.webp', 'frc-world-championship.webp'],
  ...vendor.map(name => [`public/vendor/${name}`, name])
];
const files = [...canonical.map(name => [name, name]), ...aliases];
const allowed = new Set(files.map(([, target]) => target));

// Never silently ship unrelated files or credentials from a reused output folder.
if (existsSync(output)) {
  for (const name of readdirSync(output, { recursive: true })) {
    const normalized = name.replaceAll('\\', '/');
    const isDirectory = files.some(([, target]) => target.startsWith(`${normalized}/`));
    assert.ok(isDirectory || allowed.has(normalized), `Unexpected release file: ${normalized}`);
  }
}
for (const [source, target] of files) {
  const destination = resolve(output, target);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(resolve(root, source), destination);
  assert.ok(readFileSync(destination).equals(readFileSync(resolve(root, source))), `Copy mismatch: ${target}`);
}

const html = readFileSync(resolve(output, 'index.html'), 'utf8');
assert.ok(html.includes('<title>Tiger Scout | Team 9072</title>'), 'Wrong app in release');
for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert.ok(allowed.has(reference.replace(/^\//, '')), `Missing HTML asset: ${reference}`);
}
const serviceWorker = readFileSync(resolve(output, 'sw.js'), 'utf8');
const assetList = serviceWorker.match(/const ASSETS = \[([\s\S]*?)\];/);
assert.ok(assetList, 'Missing offline cache list');
for (const [, url] of assetList[1].matchAll(/'([^']+)'/g)) {
  assert.ok(url === '/' || allowed.has(url.slice(1)), `Missing offline asset: ${url}`);
}
const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
for (const icon of manifest.icons) assert.ok(allowed.has(icon.src.slice(1)), `Missing app icon: ${icon.src}`);
console.log(`Tiger Scout release ready: ${files.length} verified files; HTML, offline cache, and installed-app aliases checked.`);

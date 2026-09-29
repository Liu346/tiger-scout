import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const image = await stat(new URL('../public/frc-world-championship.webp', import.meta.url));

assert.match(source, /document\.body\.classList\.toggle\('landing-page', page === 'home'\)/);
assert.match(source, /<section class="home-landing" aria-label="9072 Scouting App">\s*<h1><span>9072<\/span> Scouting App<\/h1>\s*<\/section>`;\s*return;/);
assert.match(css, /\.home-landing\{[\s\S]*url\('\/public\/frc-world-championship\.webp'\)/);
assert.match(css, /min-height:100svh/);
assert.match(css, /@media\(max-width:700px\)[\s\S]*\.home-landing/);
assert.ok(image.size > 100_000, 'Championship background image should be a full photographic asset');
assert.match(worker, /tiger-scout-v37-worlds-landing/);
assert.match(worker, /\/public\/frc-world-championship\.webp/);

console.log('Minimal 9072 World Championship landing page and offline image cache verified.');

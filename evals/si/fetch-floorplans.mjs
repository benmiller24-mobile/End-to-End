/**
 * Source a corpus of real kitchen floor-plan images from Wikimedia Commons
 * (freely licensed) for the live-vision self-improving run. Queries several
 * search terms, dedupes, downloads up to N images to the target dir.
 *
 *   node evals/si/fetch-floorplans.mjs <outDir> [N]
 */
import fs from 'fs';
import path from 'path';

const UA = 'EclipseKitchenDesigner/1.0 (dealer tooling; contact ben@pinnaclesales.biz)';
const SEARCHES = [
  'kitchen floor plan', 'kitchen layout plan', 'kitchen plan dimensions',
  'kitchen cabinet plan', 'galley kitchen plan', 'L-shaped kitchen plan',
  'U-shaped kitchen plan', 'cocina plano', 'küche grundriss', 'cuisine plan',
  'kitchen floorplan drawing', 'apartment floor plan kitchen',
];

async function searchImages(term) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=25` +
    `&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1200&format=json`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    const j = await r.json();
    const pages = j.query?.pages || {};
    const out = [];
    for (const k in pages) {
      const ii = pages[k].imageinfo?.[0];
      if (ii && /image\/(png|jpe?g)/.test(ii.mime)) out.push({ url: ii.thumburl || ii.url, mime: ii.mime, title: pages[k].title });
    }
    return out;
  } catch (e) { return []; }
}

async function download(url, dest) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 3000) throw new Error(`too small (${buf.length}B)`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const outDir = process.argv[2];
  const N = parseInt(process.argv[3] || '100', 10);
  if (!outDir) { console.error('usage: node evals/si/fetch-floorplans.mjs <outDir> [N]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });

  const seen = new Set();
  const urls = [];
  for (const term of SEARCHES) {
    const imgs = await searchImages(term);
    for (const im of imgs) { if (!seen.has(im.url)) { seen.add(im.url); urls.push(im); } }
    console.log(`  "${term}": +${imgs.length} (total unique ${urls.length})`);
    await sleep(400);
  }
  console.log(`\nDownloading up to ${N} of ${urls.length} unique images …`);
  let got = 0, i = 0;
  for (const im of urls) {
    if (got >= N) break;
    i++;
    const ext = /png/.test(im.mime) ? 'png' : 'jpg';
    const dest = path.join(outDir, `fp${String(i).padStart(3, '0')}.${ext}`);
    try { const sz = await download(im.url, dest); got++; if (got % 10 === 0) console.log(`  …${got} downloaded`); void sz; }
    catch (e) { /* skip failures */ }
    await sleep(250);
  }
  console.log(`\n✓ ${got} images in ${outDir}`);
}
main();

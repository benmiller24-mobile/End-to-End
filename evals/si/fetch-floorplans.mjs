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
  // whole-home / real-estate plans contain a kitchen the vision model isolates
  'house floor plan', 'apartment floor plan', 'home floor plan dimensions',
  'real estate floor plan', 'architectural floor plan house', 'flat floor plan',
  'bungalow floor plan', 'condo floor plan', 'residential floor plan',
  'floor plan with dimensions', 'floor plan drawing room',
  // more languages broaden the freely-licensed pool
  'cucina planimetria', 'keuken plattegrond', 'cuisine plan amenagement',
  'grundriss wohnung küche', 'planta baja cocina', 'plan appartement cuisine',
  'plattegrond woning', 'planritning kök', 'plan maison cuisine',
];

async function searchImages(term) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=40` +
    `&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1400&format=json`;
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

// Pull file members of a category (one level into subcategories too) — high-yield
// for dimensioned plans: Category:Floor plans of houses, HABS, etc.
async function categoryImages(cat, depth = 1) {
  const api = (params) => `https://commons.wikimedia.org/w/api.php?${params}&format=json`;
  const out = [];
  try {
    const r = await fetch(api(`action=query&list=categorymembers&cmtitle=${encodeURIComponent('Category:' + cat)}&cmtype=file|subcat&cmlimit=200`), { headers: { 'User-Agent': UA } });
    const j = await r.json();
    const members = j.query?.categorymembers || [];
    const files = members.filter(m => m.ns === 6).map(m => m.title);
    const subcats = members.filter(m => m.ns === 14).map(m => m.title.replace(/^Category:/, ''));
    // resolve file URLs in batches of 40
    for (let i = 0; i < files.length; i += 40) {
      const batch = files.slice(i, i + 40);
      const rr = await fetch(api(`action=query&titles=${batch.map(encodeURIComponent).join('|')}&prop=imageinfo&iiprop=url|mime&iiurlwidth=1400`), { headers: { 'User-Agent': UA } });
      const jj = await rr.json();
      const pages = jj.query?.pages || {};
      for (const k in pages) { const ii = pages[k].imageinfo?.[0]; if (ii && /image\/(png|jpe?g)/.test(ii.mime)) out.push({ url: ii.thumburl || ii.url, mime: ii.mime, title: pages[k].title }); }
    }
    if (depth > 0) for (const sc of subcats.slice(0, 12)) out.push(...await categoryImages(sc, depth - 1));
  } catch (e) { /* skip */ }
  return out;
}

async function download(url, dest) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status === 429 || r.status >= 500) { lastErr = new Error(`HTTP ${r.status}`); await sleep(1500 * (attempt + 1)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 3000) throw new Error(`too small (${buf.length}B)`);
      fs.writeFileSync(dest, buf);
      return buf.length;
    } catch (e) { lastErr = e; await sleep(800 * (attempt + 1)); }
  }
  throw lastErr;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const outDir = process.argv[2];
  const N = parseInt(process.argv[3] || '100', 10);
  if (!outDir) { console.error('usage: node evals/si/fetch-floorplans.mjs <outDir> [N]'); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });

  const seen = new Set();
  const urls = [];
  // Dimensioned-plan sources: measured architectural drawings carry printed
  // dimensions + scale bars (HABS, house floor-plan categories), which the vision
  // model reads as printed/scaled rather than guessed.
  const DIM_SEARCHES = process.env.DIM ? [
    'HABS first floor plan', 'measured drawing house floor plan', 'house floor plan dimensions feet',
    'kitchen plan dimensions inches', 'floor plan scale bar kitchen', 'architectural floor plan dimensions',
    'HABS ground floor plan', 'house plan dimensioned', 'cottage floor plan dimensions',
    'bungalow floor plan dimensions', 'cabin floor plan dimensions', 'small house plan dimensions',
  ] : SEARCHES;
  const CATEGORIES = process.env.DIM ? ['Floor plans of houses', 'HABS floor plans'] : [];
  for (const cat of CATEGORIES) {
    const imgs = await categoryImages(cat);
    for (const im of imgs) { if (!seen.has(im.url)) { seen.add(im.url); urls.push(im); } }
    console.log(`  [cat] ${cat}: +${imgs.length} (total unique ${urls.length})`);
    await sleep(300);
  }
  for (const term of DIM_SEARCHES) {
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
    await sleep(600);
  }
  console.log(`\n✓ ${got} images in ${outDir}`);
}
main();

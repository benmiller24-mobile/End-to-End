// Extract the pronorm option taxonomy from the GB proline/classic spec book →
// pronorm-options.json (colours with code/name/ranges/group + range→group map).
// The colour pages are a 6-column swatch grid; parse by column buckets.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const pdfjs = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs', { paths: [join(dirname(fileURLToPath(import.meta.url)), '../frontend')] }));

const BOOK = '/Users/benjaminmiller/Desktop/Brochures & Catalogs/Gesamt-PDF_GB_proline-classic 09-2025.pdf';
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(BOOK)), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

const COLS = [20, 98, 177, 255, 334, 412];   // 6-column swatch grid left edges
const colOf = (x) => { let b = 0, bd = 1e9; COLS.forEach((cx, i) => { const d = Math.abs(cx - x); if (d < bd) { bd = d; b = i; } }); return bd <= 45 ? b : -1; };
const HEADER = /^(Price group|Front colour|Range|wool|P|C|N|see|from page|Subject|with|available|Programme|Handle|Glass|Special)/i;

const colors = [];
for (let pn = 64; pn <= 73; pn++) {
  const tc = await (await doc.getPage(pn)).getTextContent();
  const items = tc.items.filter(t => t.str && t.str.trim()).map(t => ({ s: t.str.trim(), x: Math.round(t.transform[4]), y: Math.round(t.transform[5]) }));
  // bucket into columns
  const cols = [[], [], [], [], [], []];
  for (const it of items) { const c = colOf(it.x); if (c >= 0) cols[c].push(it); }
  for (const col of cols) {
    col.sort((a, b) => b.y - a.y);
    // a colour cell = a name token (lowercase phrase) with the code token(s) just above it
    for (const it of col) {
      if (!/^[a-z][a-zA-Z'’ .-]{3,}$/.test(it.s)) continue;
      if (HEADER.test(it.s)) continue;
      // nearest code (3-4 digits) above within 30px y
      const codeTok = col.filter(t => /^\d{3,4}$/.test(t.s) && t.y > it.y && t.y - it.y < 30).sort((a, b) => a.y - b.y)[0];
      // ranges = 2-3 letter caps tokens in this column near the code's y
      const ranges = codeTok ? [...new Set(col.filter(t => /^[A-Z]{2,3}$/.test(t.s) && Math.abs(t.y - codeTok.y) < 14).map(t => t.s))] : [];
      colors.push({ code: codeTok ? codeTok.s : null, name: it.s.replace(/\s+/g, ' ').trim(), ranges });
    }
  }
}
// dedupe by name
const seen = new Map();
for (const c of colors) { if (!seen.has(c.name)) seen.set(c.name, c); else if (c.ranges.length) seen.get(c.name).ranges = [...new Set([...seen.get(c.name).ranges, ...c.ranges])]; }
const uniq = [...seen.values()].filter(c => c.name.length >= 4);

fs.writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'pronorm-options.json'), JSON.stringify({ colors: uniq }, null, 0));
console.log('unique colours:', uniq.length);
console.log(uniq.slice(0, 24).map(c => `${c.code || '?'}[${c.ranges.join('/')}] ${c.name}`).join(' | '));

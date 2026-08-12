/**
 * The golden Mautz kitchen, two ways (AD-1):
 *  - realDesign(): the professional's actual design rebuilt via the manual
 *    path (positions normalized — drawing labels can stack) → what "right"
 *    looks like, used to calibrate scorer v2.
 *  - roomInput(): the same ROOM as solver input → what auto-design gets asked,
 *    used by the design-diff eval to measure decisions-reproduced.
 * Source of truth: evals/_cross/fixtures/mautz-drawings-pages.json (real
 * Cyncly drawing set; same kitchen as the to-the-penny golden order).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseDesignPdf } from '../../frontend/src/floorplanVector.js';
import { buildManualResult } from '../../frontend/src/manualDesign.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export function parsedMautz() {
  return parseDesignPdf(
    JSON.parse(readFileSync(join(HERE, '../_cross/fixtures/mautz-drawings-pages.json'), 'utf8')),
    'eclipse');
}

/** Drawing-parsed positions can stack (two labels on one x) — walk each wall's
 *  base run left→right and push overlapping items to the previous run end. */
function deOverlap(items) {
  const byWall = {};
  for (const it of items) (byWall[it.wall] ||= []).push({ ...it });
  const out = [];
  for (const arr of Object.values(byWall)) {
    const bases = arr.filter(i => i.zone !== 'upper').sort((a, b) => a.position - b.position);
    let cursor = -1;
    for (const it of bases) {
      if (it.position < cursor - 1) it.position = cursor;
      cursor = Math.max(cursor, it.position + it.width);
    }
    out.push(...bases, ...arr.filter(i => i.zone === 'upper'));
  }
  return out;
}

export function mautzWalls() {
  return parsedMautz().walls.map(w => ({ id: w.id, length: w.length, ceilingHeight: 96 }));
}

/** The professional design as a solver-shaped result (manual path). */
export function realDesign() {
  const mz = parsedMautz();
  const items = deOverlap(mz.wallItems).map((it, i) => ({
    id: `m${i}`, sku: it.sku, wall: it.wall, position: it.position,
    width: it.width, height: it.height, depth: it.zone === 'upper' ? 13 : 24,
    zone: it.zone, ...(it.zone === 'upper' ? { yMount: it.yMount ?? 54 } : {}),
  }));
  const walls = mautzWalls();
  const result = buildManualResult({ walls, items, island: null, roomType: 'kitchen', layoutType: mz.layoutType });
  const sb = items.find(i => /^SB36/.test(i.sku));
  const room = {
    walls: walls.map(w => (sb && w.id === sb.wall)
      ? { ...w, openings: [{ type: 'window', position: sb.position - 3, width: 42 }] }
      : w),
  };
  return { result, room, items };
}

/** The same room as AUTO-design input: walls + appliances by type, positions
 *  inferred from the real design (sink base, over-fridge RW, remaining span). */
export function roomInput() {
  const mz = parsedMautz();
  const items = mz.wallItems;
  const sb = items.find(i => /^SB36/.test(i.sku));
  const rw = items.find(i => /^RW\d/.test(i.sku));
  const sinkWall = sb ? sb.wall : 'A';
  const fridgeWall = rw ? rw.wall : 'C';
  const walls = mz.walls.map(w => ({
    id: w.id, length: w.length, ceilingHeight: 96,
    ...(w.id === sinkWall ? { role: 'sink', openings: [{ type: 'window', position: (sb?.position ?? 24) - 3, width: 42 }] } : {}),
    ...(w.id === fridgeWall ? { role: 'fridge' } : {}),
  }));
  return {
    layoutType: mz.layoutType, roomType: 'kitchen', walls,
    appliances: [
      { type: 'sink', width: 33, wall: sinkWall, pinned: true, position: sb ? sb.position : undefined },
      { type: 'dishwasher', width: 24, wall: sinkWall },
      { type: 'range', width: 30, wall: sinkWall },
      { type: 'refrigerator', width: 36, wall: fridgeWall, position: rw ? rw.position : undefined },
    ],
    prefs: {},
  };
}

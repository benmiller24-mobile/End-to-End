/**
 * Catalog patch — Eclipse v8.8.1 entries the original scrape missed,
 * transcribed from the interactive catalog and verified against the
 * 020526 MAUTZ order acknowledgment:
 *  - Utility Tall height matrix, 24" deep (page 478): heights 87"–114"
 *    (the 84" column was already in the base catalog)
 *  - Wall Square Corner w/ Expandable Leg by height (page 310)
 *  - Flush Decorative Door end panels: UDEP/UTDEP-F (page 665),
 *    WDEP & WDEP-F wall tables (pages 664–665)
 * Sections: L=Utility, E=Wall, S=Accessories & Panels.
 */

const rows = [];
const add = (s, p, r, t) => rows.push({ s, p, r, t });

// ── Utility Tall, 24" deep — heights 87 / 90 / 93 / 96 / 102 / 108 / 114 ──
const UT_HEIGHTS = [87, 90, 93, 96, 102, 108, 114];
const UT_MATRIX = {
  'U12':      [886, 947, 1008, 1069, 1336, 1390, 1443],
  'U15':      [996, 1064, 1134, 1203, 1504, 1564, 1624],
  'U18':      [1109, 1184, 1260, 1336, 1670, 1737, 1804],
  'U21':      [1224, 1308, 1392, 1475, 1844, 1918, 1991],
  'U22 1/2':  [1279, 1367, 1455, 1543, 1929, 2093, 2174],
  'U24':      [1334, 1425, 1518, 1610, 2013, 2295, 2383],
  'U24-2D':   [1450, 1541, 1634, 1726, 2129, 2411, 2499],
  'U27':      [1468, 1567, 1666, 1765, 2206, 2493, 2589],
  'U30':      [1669, 1782, 1895, 2008, 2510, 2610, 2711],
  'U33':      [1707, 1823, 1940, 2056, 2570, 2673, 2776],
  'U36':      [1763, 1883, 2004, 2125, 2656, 2763, 2869],
};
for (const [w, prices] of Object.entries(UT_MATRIX)) {
  prices.forEach((p, i) => add(`${w}-${UT_HEIGHTS[i]}"`, p, 'L2', 'T'));
}

// ── Wall Square Corner Cabinet w/ Expandable Leg (legs ≤54" total) ──
const WSE = { 30: 1517, 33: 1679, 36: 1841, 39: 2006, 42: 2170, 45: 2334, 48: 2498 };
for (const [h, p] of Object.entries(WSE)) add(`WSE-${h}"`, p, 'E13', 'W');

// ── Flush decorative doors on Utility / Utility Tall ends ──
const UDEPF_HEIGHTS = [84, 87, 90, 93, 96, 102];
const UTDEPF_HEIGHTS = [84, 87, 90, 93, 96, 102, 108, 114];
const UDEPF = {
  'UDEP-24-F':  [673, 688, 703, 718, 733, 916],
  'UDEP-27-F':  [808, 826, 844, 862, 880, 960],
  'UDEP-30-F':  [868, 886, 904, 922, 940, 1020],
};
const UTDEPF = {
  'UTDEP-24-F': [673, 688, 703, 718, 733, 916, 953, 990],
  'UTDEP-27-F': [808, 826, 844, 862, 880, 960, 998, 1036],
  'UTDEP-30-F': [868, 886, 904, 922, 940, 1020, 1058, 1096],
};
for (const [fam, prices] of Object.entries(UDEPF)) prices.forEach((p, i) => add(`${fam}-${UDEPF_HEIGHTS[i]}"`, p, 'S6', 'A'));
for (const [fam, prices] of Object.entries(UTDEPF)) prices.forEach((p, i) => add(`${fam}-${UTDEPF_HEIGHTS[i]}"`, p, 'S6', 'A'));

// ── Decorative doors on wall-cabinet ends (heights → price bands) ──
const WDEP_H = [12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 64, 66, 69, 70, 72, 75, 76, 78];
const WDEP_P  = [225, 225, 225, 266, 266, 266, 266, 327, 327, 327, 327, 508, 508, 508, 508, 609, 609, 609, 609, 609, 709, 709, 709, 709, 709, 709];
const WDEPF_P = [265, 265, 265, 306, 306, 306, 306, 367, 367, 367, 367, 548, 548, 548, 548, 649, 649, 749, 749, 749, 809, 809, 809, 809, 809, 809];
WDEP_H.forEach((h, i) => { add(`WDEP-${h}"`, WDEP_P[i], 'S6', 'A'); add(`WDEP-F-${h}"`, WDEPF_P[i], 'S6', 'A'); });

export const CATALOG_PATCH_88 = rows;

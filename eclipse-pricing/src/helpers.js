/**
 * Eclipse Cabinetry — SKU Helper Functions
 * Cabinet width extraction, door count guessing, ROT detection, sq-in pricing logic
 */

// Per-sq-inch SKU catalog refs (bar backs, finished panels, edge-banded panels, slat bar backs, finished tops)
const SQI_REFS = new Set(["S3","S4","S5","S33","S34","S35","S36","S37","S38","S42","C3"]);
// Per-sq-inch items that use FIXED pricing (not per sq-in)
const SQI_FIXED = new Set(["BB1/4","BB1/4-CMP","BB1/4-CMP-Beaded","BB1/2-CMP","TKMSBB","TKMSLBB","DROT5/8","DROT3/4","LROT","SROT5/8","DROT5/8-PAD","DROT3/4-PAD","DROT5/8-FM","DROT3/4-FM","LROT-FM","SROT5/8-FM","DIRF","CNRLG","VAL","BLLG","BRLG","SDI-W","CLC","LCEC","COS","COF","COR"]);
const SQI_SKUS = new Set(["PROFILE FILLER"]);
// Column overlay SKUs
const CO_SKUS = new Set(["COS","COF","COR"]);
export const CO_LABELS = { "COS": "Smooth", "COF": "Fluted", "COR": "Rope" };
// Flat-price refs: samples, displays, stain/touch-up kits, casters
const FLAT_REFS = new Set(["U2","U3","U4","U5","U6","U7","U8","U9","U10","S45","S46","D17"]);

/** Check if a SKU is priced per square inch */
export function isSqIn(sku, ref) {
  return (SQI_REFS.has(ref) && !SQI_FIXED.has(sku)) || SQI_SKUS.has(sku);
}

/** Check if a SKU is a column overlay */
export function isCO(sku) { return CO_SKUS.has(sku); }

/** Check if a SKU is a custom item */
export function isCustom(sku) { return sku === "CUSTOM"; }

/** Check if a SKU is a custom REF panel */
export function isREF(sku) { return sku === "REF"; }

/** Check if item uses flat pricing (no species/construction markups) */
export function isFlat(sku, ref) { return FLAT_REFS.has(ref) && sku !== "SD81/2X11"; }

/** REF panel ice cutout upcharge */
export const REF_ICE_CUTOUT = 200;

/** Floating shelf constants */
export const FLS_DEPTH_MIN = 6;
export const FLS_DEPTH_MAX = 24;
export const FLS_LEN_MIN = 12;
export const FLS_LEN_MAX = 96;

/**
 * Extract cabinet width from SKU string.
 * Strips suffixes (-RT, -FHD, -2D, -1DR, -WS, -MC, -S, -PH, -SS)
 * then reads trailing digits as the width.
 */
export function extractCabinetWidth(sku) {
  let s = sku.toUpperCase().replace(/\s+/g, '');
  for (let i = 0; i < 3; i++) s = s.replace(/-(RT|FHD|2D|2DR|1DR|WS|MC|SS|PH|S)$/, '');
  const m = s.match(/(\d+)$/);
  if (!m) return 0;
  const n = parseInt(m[1]);
  // Valid width on its own (9–84)
  if (n >= 9 && n <= 84) return n;
  // Concatenated width+height (e.g. "1230" = 12 wide × 30 tall)
  const ds = m[1];
  if (ds.length >= 3) {
    const w = parseInt(ds.slice(0, ds.length - 2));
    return (w >= 9 && w <= 84) ? w : 0;
  }
  return 0;
}

/**
 * Guess number of doors for a cabinet SKU
 * @param {string} sku - Cabinet SKU
 * @param {string} typeCode - Type code (B/W/T/V/C/D/A/G/M/F/X)
 * @returns {number} Estimated door count
 */
export function guessDoors(sku, typeCode) {
  const s = sku.toUpperCase().replace(/\s+/g, '');
  if (typeCode && !'BVTW'.includes(typeCode)) return 0;
  // Zero-door types
  if (/^(BBBD\dD|BBD\dD|BBB\dD|B[2-5]D|STB4D)/.test(s)) return 0;
  if (/^(FLVB\dD|VTB\dD|VB\dD)/.test(s)) return 0;
  if (/^(F[36]|EFIL|ECROWN|ETOEKICK|RBS|BNFT|FRLG|SMF|SBAF|EDIK|SMP|LCEC|TKLC)/.test(s)) return 0;
  if (/^(RH|PRH)/.test(s)) return 0;
  if (/^(BA[2-5]D|BA2HD|VBA\dD)/.test(s)) return 0;
  if (/^FLVB\d+HD/.test(s)) return 0;
  if (/^SFDHD/.test(s)) return 0;
  // Utility/Tall 2-section types
  if (/^(UVTD|UVD)\d/.test(s)) { if (s.includes('-2D')) return 2; const w = extractCabinetWidth(sku); return (w > 24) ? 2 : 1; }
  if (/^(UVTH|UVH)\d/.test(s)) return 2;
  if (/^(UVT|UV)\d/.test(s)) { if (s.includes('-2D')) return 4; const w = extractCabinetWidth(sku); return (w > 24) ? 4 : 2; }
  // Suffix-based
  if (s.includes('-2D')) return 2;
  // Wall cabinets
  if (/^(W|SW|RW|WDC|SWDC)/.test(s)) { const w = extractCabinetWidth(sku); return (w > 24) ? 2 : 1; }
  // Sink bases, base blinds
  if (/^(SB|SBA|SBR|SBU|PB|PBBC|BBC|SBBC)/.test(s)) { return 1; }
  // Standard base — check width
  if (/^B/.test(s)) { const w = extractCabinetWidth(sku); return (w > 24) ? 2 : 1; }
  // Tall cabinets
  if (/^(U|O|T)/.test(s) && typeCode === 'T') { const w = extractCabinetWidth(sku); return (w > 24) ? 4 : 2; }
  // Vanity
  if (/^(V|VT|FLVB|VBW)/.test(s)) { const w = extractCabinetWidth(sku); return (w > 24) ? 2 : 1; }
  if (typeCode === 'B' || typeCode === 'V') return 1;
  return 0;
}

/**
 * Guess number of drawer/roll-out count for a cabinet (drawers receiving fronts)
 */
export function guessDrawerCount(sku, typeCode) {
  const s = sku.toUpperCase().replace(/\s+/g, '');
  // Explicit drawer counts in SKU
  const bbbd = s.match(/^BBBD(\d)D/); if (bbbd) return parseInt(bbbd[1]);
  const bbd = s.match(/^BBD(\d)D/); if (bbd) return parseInt(bbd[1]);
  const bbb = s.match(/^BBB(\d)D/); if (bbb) return parseInt(bbb[1]);
  const bd = s.match(/^B(\d)D/); if (bd) return parseInt(bd[1]);
  if (s.startsWith('STB4D')) return 4;
  if (s.startsWith('B2TD')) return 2;
  if (s.startsWith('B2HD')) return 2;
  const bad = s.match(/^(?:VBA|BA)(\d)D/); if (bad) return parseInt(bad[1]);
  if (s.startsWith('BA2HD')) return 2;
  const flvbhd = s.match(/^FLVB(\d+)HD/); if (flvbhd) return parseInt(flvbhd[1]);
  const flvb = s.match(/^FLVB(\d)D/); if (flvb) return parseInt(flvb[1]);
  const vtb = s.match(/^VTB(\d)D/); if (vtb) return parseInt(vtb[1]);
  const vb = s.match(/^VB(\d)D/); if (vb) return parseInt(vb[1]);
  if (s.startsWith('VTSD')) return 2;
  if (s.startsWith('VSD')) return 2;
  if (/-2DR/.test(s)) return 2;
  if (/-1DR/.test(s)) return 1;
  if (/^(BBC|SBBC|PBBC)/.test(s)) return 1;
  // Width-based inference
  const w = extractCabinetWidth(sku);
  if (w > 0 && /^(BA|B|SBA|SBR|SBU|SB|PB|BBB)/.test(s)) return w > 24 ? 2 : 1;
  if (w > 0 && /^(VB|VTB|VTSB|FLVB|VBW|VTBW|VBH|VTHB|VCSD)/.test(s)) return w > 24 ? 2 : 1;
  if (typeCode === 'B' || typeCode === 'V') return 1;
  return 0;
}

/**
 * Guess built-in roll-out trays from SKU
 */
export function guessBuiltInROT(sku) {
  const s = sku.toUpperCase().replace(/\s+/g, '');
  if (/-RT/.test(s)) {
    if (/^SB/.test(s)) return 1;
    if (/^B/.test(s)) return 2;
  }
  if (/^SBU\d/.test(s)) return 1;
  return 0;
}

/** SKU display labels for special items */
export const SKU_LABELS = {
  "F3": "Filler", "OVF3": "Overlay Filler", "PROFILE FILLER": "Profile Filler",
  "LSD": "Loose Standard Doors", "SLBDF": "Slab Drawer Fronts", "5PDF": "5 Piece Drawer Fronts",
  "CUSTOM": "Custom Quote", "REF": "Custom Refrigerator Panel", "DP": "Dishwasher Panel",
  "BCFTA": "Bev Center Front (Natural Aluminum)", "BCFTBL": "Bev Center Front (Matte Black Aluminum)",
  "BCFTMB": "Bev Center Front (Matte Brass)", "BCF": "Beverage Center Front",
  "COS": "Column Overlay — Smooth", "COF": "Column Overlay — Fluted", "COR": "Column Overlay — Rope",
};

/** Room zone definitions */
export const ZONES = [
  { id: "kitchen", l: "Kitchen", i: "K" }, { id: "island", l: "Island", i: "I" },
  { id: "pantry", l: "Pantry", i: "P" }, { id: "bath", l: "Bath", i: "B" },
  { id: "laundry", l: "Laundry", i: "L" }, { id: "mudroom", l: "Mudroom", i: "M" },
  { id: "bar", l: "Bar", i: "Ba" }, { id: "office", l: "Office", i: "O" },
  { id: "other", l: "Other", i: "+" },
];

/** Format a number as currency string */
export function formatCurrency(n) {
  return "$" + Math.round(n || 0).toLocaleString();
}

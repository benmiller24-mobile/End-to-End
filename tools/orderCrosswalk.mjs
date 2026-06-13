/**
 * Cross-manufacturer order normalizer.
 * ====================================
 * An imported competitor order (e.g. Pacific Collection / eVision) uses its own
 * SKU nomenclature, which the fuzzy SKU resolver mis-maps. This translates each
 * imported product code to the canonical W.W. Wood SKU by FUNCTION + SIZE, so it
 * prices correctly in Eclipse / Shiloh and realizes into pronorm. Also parses the
 * cabinet's nominal width (inches) + zone for the pronorm metric mapping.
 *
 * Verified against the Creekside/Pacific "price comparison" order:
 *   B2PO30→B30  BS36→SB36  BTPO18→UTPOP18  BACSS36L→BLSB36-PH
 *   T4PO2796→U27  T1596R→U15  W3924-27→W3924  WAC2442L→WBC2442  VSAH27→VSB27
 */

export function crosswalk(code) {
  let s = String(code || '').toUpperCase().replace(/\s+/g, '');
  // Base N-pullout (2/3 pull-out trays in a 2-door base) → plain base of that width
  s = s.replace(/^B\dPO(\d+)$/, 'B$1');
  // Base sink (Pacific "BS") → W.W. sink base "SB"
  s = s.replace(/^BS(\d+)([LR]?)$/, 'SB$1$2');
  // Base trash pull-out → BASE pull-out trash (NOT the tall UTPOP utility unit);
  // the resolver picks the nearest available base-trash width.
  s = s.replace(/^BTPO(\d+)([LR]?)$/, 'BPTPO$1');
  // Base angled corner w/ super-susan → blind-corner lazy-susan (-PH = pie-hinge)
  s = s.replace(/^BACS+(\d+)[LR]?$/, 'BLSB$1-PH');
  // Tall pull-out pantry "T[n]PO<width><height>" or "T<width>96" → U<width> pantry
  let m = s.match(/^T\d?(?:PO)?(\d{2})96[LR]?$/);
  if (m) s = 'U' + m[1];
  // Wall cabinet with a depth designation suffix (W3924-27 = 27" deep) → base SKU
  s = s.replace(/^(W\d{4})-\d+$/, '$1');
  // Wall angled/blind corner → wall blind corner
  s = s.replace(/^WAC(\d{4})[LR]?$/, 'WBC$1');
  // Vanity sink adult height → vanity sink base
  s = s.replace(/^VSAH(\d+)([LR]?)$/, 'VSB$1');
  // Drop a trailing hinge letter the price catalog omits
  s = s.replace(/([0-9])[LR]$/, '$1');
  return s;
}

// Nominal width (inches) + zone from a canonical W.W. SKU — for pronorm mapping.
export function dims(canonical) {
  const s = String(canonical || '').toUpperCase();
  let m;
  if ((m = s.match(/^W(?:BC)?(\d{2})\d{2}/))) return { widthIn: +m[1], zone: 'wall' };
  if ((m = s.match(/^U(\d{2})/))) return { widthIn: +m[1], zone: 'tall' };
  if ((m = s.match(/^T(\d{2})/))) return { widthIn: +m[1], zone: 'tall' };
  if ((m = s.match(/^(?:SB|VSB|BLSB|UTPOP)(\d{2})/))) return { widthIn: +m[1], zone: 'base' };
  if ((m = s.match(/^B\d?D?(\d{2})/))) return { widthIn: +m[1], zone: 'base' };
  if ((m = s.match(/(\d{2})/))) return { widthIn: +m[1], zone: 'base' };
  return { widthIn: null, zone: 'base' };
}

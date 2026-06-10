// ────────────────────────────────────────────────────────────────────────────
// Construction profiles — the single source of truth for how a cabinet line is
// built (frameless vs framed) and how each overlay/inset variant looks, sizes,
// and prices. The renderer, dimension code, and pricing all read from here.
//
// Eclipse = frameless full-overlay (unchanged behavior). Shiloh = framed, with
// two overlay options and seven inset options. All linear values are INCHES.
// ────────────────────────────────────────────────────────────────────────────

export const CONSTRUCTIONS = {
  // ── Eclipse (frameless) — reproduces today's renderer/pricing exactly ──
  eclipse_frameless: {
    key: 'eclipse_frameless', brand: 'eclipse', label: 'Frameless · Full Overlay',
    frame: false, inset: false,
    stile: 0,            // no face frame
    perim: 0.094,        // 3/32" reveal around every front (full overlay)
    divider: 0.094,      // half the 3/16" between adjacent fronts
    beaded: false, squareBead: false, modern: false, profile38: false,
    wallDepth: 13.875, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: true,
    overlayCharge: { door: 0, drawer: 0 }, insetPremiumPct: 0,
    note: 'Eclipse C3 Frameless',
  },

  // ── Shiloh (framed) — 1½" solid-wood face frame ──
  shiloh_overlay_half: {
    key: 'shiloh_overlay_half', brand: 'shiloh', label: '½" Standard Overlay',
    frame: true, inset: false, stile: 1.5, overlay: 0.5, gap: 0.094,
    beaded: false, squareBead: false, modern: false, profile38: false,
    wallDepth: 12, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 0 }, insetPremiumPct: 0,
    note: 'Shiloh — ½" Overlay (framed)',
  },
  shiloh_overlay_125: {
    key: 'shiloh_overlay_125', brand: 'shiloh', label: '1¼" Full Overlay',
    frame: true, inset: false, stile: 1.5, overlay: 1.25, gap: 0.094,
    beaded: false, squareBead: false, modern: false, profile38: false,
    wallDepth: 12, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    // FOVL (1¼" full overlay) door-style adders verified on three real orders
    // (OC Design Banger island, Ruhi kitchen, WRS Beatty master bath):
    // $26/door + $67/drawer front. The earlier $12 drawer figure was wrong.
    overlayCharge: { door: 26, drawer: 67 }, insetPremiumPct: 0,
    note: 'Shiloh — 1¼" Overlay (framed); FOVL +$26/door, +$67/drawer front',
  },

  // ── Shiloh inset pricing, calibrated against the Soderstrom project quotes
  //    (SHI342 catalog, June 2026): the catalog's list prices already cover
  //    inset construction — the quote's "Inset Overlay {INS}" charge line is
  //    $0.00, doors carry no inset charge, and inset DRAWER FRONTS carry a
  //    flat $55/each upcharge (Malibu Inset Drwr Frnt, consistent across all
  //    5 rooms). The earlier 40–45% blanket premium overpriced inset jobs by
  //    ~40%; per-drawer-front $55 reproduces the real quotes. Confirm rates
  //    per door style when the official Shiloh price CSV lands. ──
  shiloh_flush_inset: {
    key: 'shiloh_flush_inset', brand: 'shiloh', label: 'Flush Inset',
    frame: true, inset: true, stile: 1.5, gap: 0.094,
    beaded: false, squareBead: false, modern: false, profile38: false,
    wallDepth: 13, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 55 }, insetPremiumPct: 0,
    note: 'Shiloh — Flush Inset (framed); inset drawer fronts +$55/ea per Soderstrom quotes',
  },
  shiloh_beaded_inset: {
    key: 'shiloh_beaded_inset', brand: 'shiloh', label: 'Beaded Inset',
    frame: true, inset: true, stile: 1.5, gap: 0.094,
    beaded: true, squareBead: false, modern: false, profile38: false,
    wallDepth: 13, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 55 }, insetPremiumPct: 0,  // was 42% — recalibrated per Soderstrom quotes
    note: 'Shiloh — Beaded Inset (framed)',
  },
  shiloh_square_bead_inset: {
    key: 'shiloh_square_bead_inset', brand: 'shiloh', label: 'Square Beaded Inset',
    frame: true, inset: true, stile: 1.5, gap: 0.094,
    beaded: true, squareBead: true, modern: false, profile38: false,
    wallDepth: 13, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 55 }, insetPremiumPct: 0,  // was 42% — recalibrated per Soderstrom quotes
    note: 'Shiloh — Square Beaded Inset (framed)',
  },
  shiloh_38_inset: {
    key: 'shiloh_38_inset', brand: 'shiloh', label: '3/8" Inset',
    frame: true, inset: true, stile: 1.5, gap: 0.094,
    beaded: false, squareBead: false, modern: false, profile38: true,
    wallDepth: 13, baseDepth: 24,
    hinge: 'knife', softClose: false,           // 3/8" inset uses a knife hinge (no soft close)
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 55 }, insetPremiumPct: 0,  // was 45% — recalibrated per Soderstrom quotes
    note: 'Shiloh — 3/8" Inset (knife hinge)',
  },
  shiloh_modern_flush_inset: {
    key: 'shiloh_modern_flush_inset', brand: 'shiloh', label: 'Modern Flush Inset',
    frame: true, inset: true, stile: 1.5, gap: 0.094,
    beaded: false, squareBead: false, modern: true, profile38: false,
    wallDepth: 13, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 55 }, insetPremiumPct: 0,  // was 42% — recalibrated per Soderstrom quotes
    note: 'Shiloh — Modern Flush Inset (full-height frame reveal)',
  },
  shiloh_modern_beaded_inset: {
    key: 'shiloh_modern_beaded_inset', brand: 'shiloh', label: 'Modern Beaded Inset',
    frame: true, inset: true, stile: 1.5, gap: 0.094,
    beaded: true, squareBead: false, modern: true, profile38: false,
    wallDepth: 13, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 55 }, insetPremiumPct: 0,  // was 44% — recalibrated per Soderstrom quotes
    note: 'Shiloh — Modern Beaded Inset',
  },
  shiloh_modern_square_bead_inset: {
    key: 'shiloh_modern_square_bead_inset', brand: 'shiloh', label: 'Modern Square Beaded Inset',
    frame: true, inset: true, stile: 1.5, gap: 0.094,
    beaded: true, squareBead: true, modern: true, profile38: false,
    wallDepth: 13, baseDepth: 24,
    hinge: 'concealed', softClose: true,
    fillerGoldenRule: false,
    overlayCharge: { door: 0, drawer: 55 }, insetPremiumPct: 0,  // was 44% — recalibrated per Soderstrom quotes
    note: 'Shiloh — Modern Square Beaded Inset',
  },
};

export const BRANDS = [
  { id: 'eclipse', label: 'Eclipse', sub: 'Frameless (European)' },
  { id: 'shiloh',  label: 'Shiloh',  sub: 'Framed (face-frame)' },
];

export const CONSTRUCTIONS_BY_BRAND = {
  eclipse: ['eclipse_frameless'],
  shiloh: [
    'shiloh_overlay_half', 'shiloh_overlay_125',
    'shiloh_flush_inset', 'shiloh_beaded_inset', 'shiloh_square_bead_inset',
    'shiloh_38_inset',
    'shiloh_modern_flush_inset', 'shiloh_modern_beaded_inset', 'shiloh_modern_square_bead_inset',
  ],
};

export const DEFAULT_CONSTRUCTION_BY_BRAND = {
  eclipse: 'eclipse_frameless',
  shiloh: 'shiloh_overlay_half',
};

export function getConstruction(key) {
  return CONSTRUCTIONS[key] || CONSTRUCTIONS.eclipse_frameless;
}

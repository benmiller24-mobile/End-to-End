/**
 * W.W. Wood Cabinet Modifications & Roll-Out Tray Options
 * Pricing verified against the Eclipse v8.8.1 catalog (pages C1–C2) and the
 * Shiloh v3.4.2 catalog (pages C1–C2). Mods shared by both lines carry no
 * `brands` field; line-exclusive mods are tagged (lighting prep, tip-on,
 * Legrabox/sim-metal divided drawers are Eclipse-only; front-only, peninsula,
 * finished-bottom prep, beaded finished ends, extended top are Shiloh-only).
 *
 * `draw` names the elevation/3D effect for mods that change how the cabinet
 * face reads (toe treatments, stiles, full-height doors, glass prep);
 * `fit` lists the dimensions a mod lets the designer change (Design Studio
 * writes the new numbers straight onto the item so placement, collision,
 * floor plan, and elevation geometry all see them).
 */

export const CABINET_MODS = [
  { code: "RMK", label: "Removable Toe Kick", price: 146, unit: "/cab", types: ["B","V","C","D","T"], group: "Toe Kick", input: "check", excGroup: "tk" },
  { code: "FTK", label: "Flush Toe Kick", price: 89, unit: "/face", types: ["B","V","C","D","T"], group: "Toe Kick", input: "qty", max: 4, excGroup: "tk", draw: "flushToe" },
  { code: "NTK", label: "No Toe Kick (box reduced 4\")", price: 89, unit: "/cab", types: ["B","V","C","D","T"], group: "Toe Kick", input: "check", excGroup: "tk", draw: "noToe" },
  { code: "RCK", label: "Custom Recessed Toe Kick", price: 146, unit: "/side", types: ["B","V","C","D","T"], group: "Toe Kick", input: "side", excGroup: "tk" },
  { code: "FWBA", label: "Fill Wall Blind Area", price: 146, unit: "/cab", types: ["W"], group: "Blind Area", input: "check", skuMatch: /BL|BC|WBC/i },
  { code: "FBBA", label: "Fill Base Blind Area", price: 232, unit: "/cab", types: ["B"], group: "Blind Area", input: "check", skuMatch: /BL|BC|BBC/i },
  { code: "FDS", label: "Upgrade to Full Depth Shelves", price: 89, unit: "/cab", types: ["B","V","C","D","T","W"], group: "Shelves & ROT", input: "check" },
  { code: "CROT", label: "Custom Height ROT (4\" & 7\")", price: 42, unit: "/ROT", types: ["B","V","C","D","T"], group: "Shelves & ROT", input: "qty", max: 10 },
  { code: "FHD", label: "Full Height Door", price: 0, unit: "", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "check", draw: "fullHeightDoor" },
  { code: "SEND_LOOSE", label: "Ship Doors/Drawer Fronts Loose", price: 100, unit: "/ea", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "qty", max: 20 },
  { code: "TIP_OND", label: "Tip-On for Doors", price: 42, unit: "/door", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "qty", max: 10, brands: ["eclipse"] },
  { code: "PFG", label: "Prep for Glass (door prep)", price: 0, unit: "/door", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "check", draw: "glass" },
  { code: "PAD", label: "Plumbing Access Drawer (24\"-42\" wide)", price: 130, unit: "/drw", types: ["B","V","C","D"], group: "Drawer Mods", input: "qty", max: 6 },
  { code: "SMPDD", label: "Sim Metal Plumbing Divided Drawer", price: 130, unit: "/drw", types: ["B","V","C","D"], group: "Drawer Mods", input: "qty", max: 6, brands: ["eclipse"] },
  { code: "LPDD", label: "Legrabox Plumbing Divided Drawer", price: 874, unit: "/drw", types: ["B","V","C","D"], group: "Drawer Mods", input: "qty", max: 6, brands: ["eclipse"] },
  { code: "TIP_ONDR", label: "Tip-On for Drawers (15\"+ wide/deep)", price: 189, unit: "/drw", types: ["B","V","C","D","T"], group: "Drawer Mods", input: "qty", max: 10, brands: ["eclipse"] },
  { code: "MXDF", label: "Mixed Drawer Front", price: 105, unit: "/position", types: ["B","V","T"], group: "Drawer Mods", input: "mxdf", max: 3 },
  { code: "BBP", label: "Beaded Back Panel (req. FI, not TFL/HPL)", price: 100, unit: "/cab", types: ["B","V","C","D","T","W"], group: "Structure", input: "check" },
  { code: "MOD_SQ", label: "Square Cabinet Mod (h,d,w) — 30% min", price: 0, unit: "%", types: ["B","V","C","D","T","W"], group: "Structure", input: "dims", pct: 30, excGroup: "mod", fit: ["h","d","w"] },
  { code: "MOD_ANG", label: "Angle Cabinet Mod (h,d,w) — 50% min", price: 0, unit: "%", types: ["B","V","C","D","T","W"], group: "Structure", input: "dims", pct: 50, excGroup: "mod", fit: ["h","d","w"] },
  { code: "FREE_W", label: "Free Width Modification", price: 0, unit: "", types: ["B","V","C","D","T","W"], group: "Structure", input: "width", fit: ["w"] },
  { code: "FREE_D", label: "Free Depth Modification", price: 0, unit: "", types: ["B","T"], group: "Structure", input: "select", options: ["13\"","15\"","18\"","21\""], fit: ["d"] },
  { code: "ESFL", label: "Extended Side to Floor — Left", price: 89, unit: "/side", types: ["B","V","C","D","T"], group: "Side Mods", input: "check", draw: "extSideL" },
  { code: "ESFR", label: "Extended Side to Floor — Right", price: 89, unit: "/side", types: ["B","V","C","D","T"], group: "Side Mods", input: "check", draw: "extSideR" },
  { code: "WSL", label: "Wide Stile Left (up to 6\")", price: 290, unit: "/side", types: ["B","V","C","D","T","W"], group: "Side Mods", input: "check", draw: "wideStileL" },
  { code: "WSR", label: "Wide Stile Right (up to 6\")", price: 290, unit: "/side", types: ["B","V","C","D","T","W"], group: "Side Mods", input: "check", draw: "wideStileR" },
  { code: "CENTER_STILE", label: "Add Center Stile (3\")", price: 200, unit: "/cab", types: ["B","V","C","D","T","W"], group: "Side Mods", input: "check", draw: "centerStile" },
  { code: "PTKL", label: "Prep Toe Kick Lighting", price: 60, unit: "/cab", types: ["B","V","C","D","T"], group: "Lighting Prep", input: "check", brands: ["eclipse"] },
  { code: "PFSL", label: "Prep Floating Shelf Lighting", price: 100, unit: "/shelf", types: ["W"], group: "Lighting Prep", input: "check", skuMatch: /FL/i, brands: ["eclipse"] },
  { code: "PWL", label: "Prep Wall Cabinet Lighting", price: 60, unit: "/cab", types: ["W"], group: "Lighting Prep", input: "check", brands: ["eclipse"] },
  { code: "FWC", label: "Prep Wall LED Continuous Pull", price: 60, unit: "/cab", types: ["W"], group: "Lighting Prep", input: "check", brands: ["eclipse"] },
  { code: "FLED_FEP", label: "LED Lighting Prep — Flush End Panel", price: 60, unit: "/panel", types: ["A"], group: "Lighting Prep", input: "check", skuMatch: /^F(WEP|BEP|VEP|VTEP|REP)/, brands: ["eclipse"] },
  { code: "FF_TOP", label: "False Front Top (removes top drawer)", price: 100, unit: "/cab", types: ["B","V","C","D","T"], group: "Other", input: "check", draw: "falseFrontTop" },
  { code: "FI", label: "Finished Interior (excl. drawers/ROT/accessories)", price: 0, unit: "%", types: ["B","V","C","D","T","W"], group: "Structure", input: "check", pct: 25 },
  { code: "FR", label: "Cabinet Front Only (no frame mods)", price: 0, unit: "%", types: ["B","V","C","D","T","W"], group: "Structure", input: "check", pct: -30, brands: ["shiloh"] },
  { code: "P", label: "Convert to Peninsula Cabinet", price: 0, unit: "%", types: ["B","V","C","D"], group: "Structure", input: "check", pct: 75, brands: ["shiloh"] },
  { code: "PFB", label: "Prep for Finished Bottom (sides cut 1/4\" short)", price: 59, unit: "/cab", types: ["W"], group: "Structure", input: "check", brands: ["shiloh"] },
  { code: "BFE", label: "Beaded Finished Ends", price: 0, unit: "/sq-in", types: ["B","V","C","D","T","W"], group: "Structure", input: "side", perSqIn: 0.114, brands: ["shiloh"] },
  { code: "ET", label: "Extended Top up to 6\" (front / L / R)", price: 300, unit: "/cab", types: ["B","V","C","D"], group: "Side Mods", input: "select", options: ["ET","ET.L","ET.R"], brands: ["shiloh"] },
  { code: "AVENTOS_HK", label: "Aventos HK Stay Lift Door", price: 435, unit: "/door", types: ["W"], group: "Aventos Top Hinge", input: "qty", max: 10, excGroup: "aventos" },
  { code: "AVENTOS_HKSD", label: "Aventos HK w/ Servo-Drive", price: 1695, unit: "/door", types: ["W"], group: "Aventos Top Hinge", input: "qty", max: 10, excGroup: "aventos" },
  { code: "AVENTOS_HL", label: "Aventos HL Lift Up Door", price: 680, unit: "/door", types: ["W"], group: "Aventos Top Hinge", input: "qty", max: 10, excGroup: "aventos" },
  { code: "AVENTOS_HLSD", label: "Aventos HL w/ Servo-Drive", price: 1940, unit: "/door", types: ["W"], group: "Aventos Top Hinge", input: "qty", max: 10, excGroup: "aventos" },
  { code: "AVENTOS_HF", label: "Aventos HF Bi-Fold Door", price: 782, unit: "/cab", types: ["W"], group: "Aventos Top Hinge", input: "check", excGroup: "aventos" },
  { code: "AVENTOS_HFSD", label: "Aventos HF w/ Servo-Drive", price: 2042, unit: "/cab", types: ["W"], group: "Aventos Top Hinge", input: "check", excGroup: "aventos" },
];

export const ROT_OPTIONS = [
  { v: "DROT5/8", l: '5/8" Hardwood Dovetail', price: 268 },
  { v: "DROT3/4", l: '3/4" Premium Dovetail', price: 325 },
  { v: "SROT5/8", l: '5/8" Simulated Metal', price: 268 },
  { v: "LROT", l: 'Legrabox Stainless Steel', price: 432 },
  { v: "DROT5/8-PAD", l: '5/8" Plumbing Access', price: 398 },
  { v: "DROT3/4-PAD", l: '3/4" Plumbing Access', price: 455 },
  { v: "DROT5/8-FM", l: '5/8" Floor Mounted', price: 388 },
  { v: "DROT3/4-FM", l: '3/4" Floor Mounted', price: 445 },
  { v: "LROT-FM", l: 'Legrabox Floor Mounted', price: 552 },
  { v: "SROT5/8-FM", l: '5/8" Sim Metal Floor Mounted', price: 388 },
];

export const ROT_FEG_UPCHARGE = 72;

export const MODS_BY_CODE = Object.fromEntries(CABINET_MODS.map(m => [m.code, m]));

export function getApplicableMods(item, brand = 'eclipse') {
  return CABINET_MODS.filter(m => {
    if (m.brands && !m.brands.includes(brand)) return false;
    if (!m.types.includes(item.t)) return false;
    if (m.skuMatch && !m.skuMatch.test(item.s)) return false;
    return true;
  });
}

/** Charge for ONE selected mod. `v` is the stored selection value; `item`
 *  supplies dims for per-sq-in mods (BFE: side area = depth × height). */
export function modCharge(m, v, item = {}, baseUnitPrice = 0) {
  if (!m || !v) return 0;
  if (m.pct) return baseUnitPrice * (m.pct / 100);
  if (m.perSqIn) {
    const area = (item.d || item.depth || 24) * (item.hgt || item.height || 34.5);
    return m.perSqIn * area * (v === "B" ? 2 : 1);
  }
  if (m.input === "side") return m.price * (v === "B" ? 2 : 1);
  if (m.input === "mxdf") return Array.isArray(v) ? m.price * v.filter(p => p.on).length : 0;
  if (m.input === "check" || m.input === "dims" || m.input === "width" || m.input === "select") return m.price;
  return m.price * (+v || 0);
}

/** Selection object {CODE: value} → pricing-engine mod lines [{code, flat, pct}].
 *  Percent mods pass `pct` as a fraction so the engine applies them to the
 *  line's own list base; everything else resolves to a flat charge here. */
export function modChargeList(modsSel, item = {}) {
  const out = [];
  for (const [code, v] of Object.entries(modsSel || {})) {
    if (!v) continue;
    const m = MODS_BY_CODE[code];
    if (!m) continue;
    if (m.pct) out.push({ code, pct: m.pct / 100 });
    else { const flat = modCharge(m, v, item); if (flat > 0 || m.price === 0) out.push({ code, flat }); }
  }
  return out;
}

export function calcModCost(item, mods, baseUnitPrice) {
  let cost = 0;
  if (mods) {
    CABINET_MODS.forEach(m => {
      const v = mods[m.code];
      if (!v) return;
      cost += modCharge(m, v, item, baseUnitPrice);
    });
  }
  if (item.rot && item.rotQ > 0) {
    const ro = ROT_OPTIONS.find(r => r.v === item.rot);
    if (ro) { cost += ro.price * item.rotQ; if (item.rotFeg) cost += ROT_FEG_UPCHARGE * item.rotQ; }
  }
  if (item.rot2 && item.rot2Q > 0) {
    const ro2 = ROT_OPTIONS.find(r => r.v === item.rot2);
    if (ro2) { cost += ro2.price * item.rot2Q; if (item.rot2Feg) cost += ROT_FEG_UPCHARGE * item.rot2Q; }
  }
  return cost;
}

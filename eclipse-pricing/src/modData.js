/**
 * Eclipse Cabinetry — Cabinet Modifications & Roll-Out Tray Options
 * All modification pricing from Eclipse v8.8.0 catalog
 */

export const CABINET_MODS = [
  { code: "RMK", label: "Removable Toe Kick", price: 146, unit: "/cab", types: ["B","V","C","D","T"], group: "Toe Kick", input: "check", excGroup: "tk" },
  { code: "FTK", label: "Flush Toe Kick", price: 89, unit: "/face", types: ["B","V","C","D","T"], group: "Toe Kick", input: "qty", max: 4, excGroup: "tk" },
  { code: "NTK", label: "No Toe Kick (box reduced 4\")", price: 89, unit: "/cab", types: ["B","V","C","D","T"], group: "Toe Kick", input: "check", excGroup: "tk" },
  { code: "RCK", label: "Custom Recessed Toe Kick", price: 146, unit: "/side", types: ["B","V","C","D","T"], group: "Toe Kick", input: "side", excGroup: "tk" },
  { code: "FWBA", label: "Fill Wall Blind Area", price: 146, unit: "/cab", types: ["W"], group: "Blind Area", input: "check", skuMatch: /BL|BC|WBC/i },
  { code: "FBBA", label: "Fill Base Blind Area", price: 232, unit: "/cab", types: ["B"], group: "Blind Area", input: "check", skuMatch: /BL|BC|BBC/i },
  { code: "FDS", label: "Upgrade to Full Depth Shelves", price: 89, unit: "/cab", types: ["B","V","C","D","T","W"], group: "Shelves & ROT", input: "check" },
  { code: "CROT", label: "Custom Height ROT (4\" & 7\")", price: 42, unit: "/ROT", types: ["B","V","C","D","T"], group: "Shelves & ROT", input: "qty", max: 10 },
  { code: "FHD", label: "Full Height Door", price: 0, unit: "", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "check" },
  { code: "SEND_LOOSE", label: "Ship Doors/Drawer Fronts Loose", price: 100, unit: "/ea", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "qty", max: 20 },
  { code: "TIP_OND", label: "Tip-On for Doors", price: 42, unit: "/door", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "qty", max: 10 },
  { code: "PFG", label: "Prep for Glass (door prep)", price: 0, unit: "/door", types: ["B","V","C","D","T","W"], group: "Door Mods", input: "check" },
  { code: "PAD", label: "Plumbing Access Drawer (24\"-42\" wide)", price: 130, unit: "/drw", types: ["B","V","C","D"], group: "Drawer Mods", input: "qty", max: 6 },
  { code: "SMPDD", label: "Sim Metal Plumbing Divided Drawer", price: 130, unit: "/drw", types: ["B","V","C","D"], group: "Drawer Mods", input: "qty", max: 6 },
  { code: "LPDD", label: "Legrabox Plumbing Divided Drawer", price: 874, unit: "/drw", types: ["B","V","C","D"], group: "Drawer Mods", input: "qty", max: 6 },
  { code: "TIP_ONDR", label: "Tip-On for Drawers (15\"+ wide/deep)", price: 189, unit: "/drw", types: ["B","V","C","D","T"], group: "Drawer Mods", input: "qty", max: 10 },
  { code: "MXDF", label: "Mixed Drawer Front", price: 105, unit: "/position", types: ["B","V","T"], group: "Drawer Mods", input: "mxdf", max: 3 },
  { code: "BBP", label: "Beaded Back Panel (req. FI, not TFL/HPL)", price: 100, unit: "/cab", types: ["B","V","C","D","T","W"], group: "Structure", input: "check" },
  { code: "MOD_SQ", label: "Square Cabinet Mod (h,d) — 30% min", price: 0, unit: "%", types: ["B","V","C","D","T","W"], group: "Structure", input: "dims", pct: 30, excGroup: "mod" },
  { code: "MOD_ANG", label: "Angle Cabinet Mod (h,d,w) — 50% min", price: 0, unit: "%", types: ["B","V","C","D","T","W"], group: "Structure", input: "dims", pct: 50, excGroup: "mod" },
  { code: "FREE_W", label: "Free Width Modification", price: 0, unit: "", types: ["B","V","C","D","T","W"], group: "Structure", input: "width" },
  { code: "FREE_D", label: "Free Depth Modification", price: 0, unit: "", types: ["B","T"], group: "Structure", input: "select", options: ["13\"","15\"","18\"","21\""] },
  { code: "ESFL", label: "Extended Side to Floor — Left", price: 89, unit: "/side", types: ["B","V","C","D","T"], group: "Side Mods", input: "check" },
  { code: "ESFR", label: "Extended Side to Floor — Right", price: 89, unit: "/side", types: ["B","V","C","D","T"], group: "Side Mods", input: "check" },
  { code: "WSL", label: "Wide Stile Left (up to 6\")", price: 290, unit: "/side", types: ["B","V","C","D","T","W"], group: "Side Mods", input: "check" },
  { code: "WSR", label: "Wide Stile Right (up to 6\")", price: 290, unit: "/side", types: ["B","V","C","D","T","W"], group: "Side Mods", input: "check" },
  { code: "CENTER_STILE", label: "Add Center Stile (3\")", price: 200, unit: "/cab", types: ["B","V","C","D","T","W"], group: "Side Mods", input: "check" },
  { code: "PTKL", label: "Prep Toe Kick Lighting", price: 60, unit: "/cab", types: ["B","V","C","D","T"], group: "Lighting Prep", input: "check" },
  { code: "PFSL", label: "Prep Floating Shelf Lighting", price: 100, unit: "/shelf", types: ["W"], group: "Lighting Prep", input: "check", skuMatch: /FL/i },
  { code: "PWL", label: "Prep Wall Cabinet Lighting", price: 60, unit: "/cab", types: ["W"], group: "Lighting Prep", input: "check" },
  { code: "FWC", label: "Prep Wall LED Continuous Pull", price: 60, unit: "/cab", types: ["W"], group: "Lighting Prep", input: "check" },
  { code: "FLED_FEP", label: "LED Lighting Prep — Flush End Panel", price: 60, unit: "/panel", types: ["A"], group: "Lighting Prep", input: "check", skuMatch: /^F(WEP|BEP|VEP|VTEP|REP)/ },
  { code: "FF_TOP", label: "False Front Top (removes top drawer)", price: 100, unit: "/cab", types: ["B","V","C","D","T"], group: "Other", input: "check" },
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

export function getApplicableMods(item) {
  return CABINET_MODS.filter(m => {
    if (!m.types.includes(item.t)) return false;
    if (m.skuMatch && !m.skuMatch.test(item.s)) return false;
    return true;
  });
}

export function calcModCost(item, mods, baseUnitPrice) {
  let cost = 0;
  if (mods) {
    CABINET_MODS.forEach(m => {
      const v = mods[m.code];
      if (!v) return;
      if (m.pct) { cost += baseUnitPrice * (m.pct / 100); }
      else if (m.input === "side") { cost += m.price * (v === "B" ? 2 : 1); }
      else if (m.input === "mxdf") { if (Array.isArray(v)) cost += m.price * v.filter(p => p.on).length; }
      else { cost += m.price * (m.input === "check" || m.input === "dims" || m.input === "width" || m.input === "select" ? 1 : +v || 0); }
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

/**
 * Built-in tenants: Eclipse and Shiloh, assembled from the existing data
 * modules. These are adapters — the underlying catalog files stay untouched
 * so every existing import keeps working; the tenant layer is additive.
 */
import { registerTenant } from './registry.js';
import { CATALOG, findSku, searchSkus, SECTIONS, TYPE_NAMES } from '../skuCatalog.js';
import { SHILOH_CATALOG, findShilohSku } from '../shilohSkuCatalog.js';
import { OFFICIAL_V88, findOfficial } from '../officialV88.js';

registerTenant({
  id: 'eclipse',
  branding: {
    displayName: 'Eclipse Kitchen Designer',
    manufacturerName: 'Eclipse Cabinetry',
    lineLabel: 'Eclipse',
    lineSub: 'Frameless (European)',
    lineDescriptor: 'Eclipse (frameless)',
    companyName: 'Pinnacle Sales',
    formCodePrefix: 'ECL',
    scheduleHeader: 'Eclipse C3 Frameless',
    catalogNote: '',
    palette: { accent: '#b8944e', gold: '#c8a96e', primary: '#1a1a1a' },
  },
  catalog: {
    find: findSku,
    search: searchSkus,
    list: () => CATALOG,
    count: CATALOG.length,
    sections: SECTIONS,
    typeNames: TYPE_NAMES,
  },
  official: {
    find: findOfficial,
    list: () => OFFICIAL_V88.entries(),
  },
  constructions: ['eclipse_frameless'],
  defaultConstruction: 'eclipse_frameless',
  validation: { styleCompat: true },
  pricing: { fallbackTenant: null },
  coverSheet: {
    // ECL-SO-CS — option lists verified against the Eclipse v8.8.1 catalog
    // (edge profiles p239/B26; boxes & guides section C3). Keys with null
    // options use the app's dynamic datasets (glazes, highlights, character,
    // interiors, door styles) which ARE the Eclipse v8.8 lists.
    fields: ['glaze', 'highlight', 'charTechniques', 'interiorFinish', 'upperDoor', 'edgeProfile', 'drawerBox', 'drawerGuide', 'tipOn'],
    options: {
      edgeProfile: ['Match door style', '100 Edge', '150 Edge', '350 Edge', '400 Edge', '750 Edge'],
      edgeNote: 'Not available on Glenbrook, Savannah, Asherville, Essex, Shelby, Manchester, Landes, Metro, Bradford, Kendal, Portland, or Dalton doors; 100/350/400 also exclude Napa & Malibu.',
      drawerBox: ['5/8" Hdwd Dovetail', '5/8" Simulated Metal', '3/4" Premium Dovetail (+$57/drw)', 'Legrabox Stainless (+$372/drw)'],
      drawerGuide: ['Blum Tandem Edge w/ Blumotion', 'Blum Tandem Full Extension w/ Blumotion (+$72/drw)'],
    },
  },
});

registerTenant({
  id: 'shiloh',
  branding: {
    displayName: 'Eclipse Kitchen Designer',
    manufacturerName: 'Shiloh Cabinetry',
    lineLabel: 'Shiloh',
    lineSub: 'Framed (face-frame)',
    lineDescriptor: 'Shiloh (framed)',
    companyName: 'Pinnacle Sales',
    formCodePrefix: 'SHI',
    scheduleHeader: 'Shiloh Framed',
    catalogNote: 'Pricing from Shiloh catalog v3.42 (scraped) — interim, pending CSV verification.',
    palette: { accent: '#b8944e', gold: '#c8a96e', primary: '#1a1a1a' },
  },
  catalog: {
    find: findShilohSku,                         // carries the eclipse _fallback flag
    search: (q, limit = 20) => {
      const u = String(q).toUpperCase();
      const out = [];
      for (const [sku, e] of SHILOH_CATALOG) {
        if (sku.toUpperCase().includes(u)) { out.push(e.s ? e : { s: sku, ...e }); if (out.length >= limit) break; }
      }
      return out;
    },
    list: () => [...SHILOH_CATALOG.entries()].map(([s, e]) => (e && e.s ? e : { s, ...e })),
    count: SHILOH_CATALOG.size,
    sections: { SHILOH: 'Shiloh Cabinetry' },
    typeNames: TYPE_NAMES,
  },
  official: null,
  constructions: [
    'shiloh_overlay_half', 'shiloh_overlay_125', 'shiloh_flush_inset', 'shiloh_beaded_inset',
    'shiloh_square_bead_inset', 'shiloh_38_inset',
    'shiloh_modern_flush_inset', 'shiloh_modern_beaded_inset', 'shiloh_modern_square_bead_inset',
  ],
  defaultConstruction: 'shiloh_overlay_half',
  validation: { styleCompat: false },            // style matrix is Eclipse v8.8 data
  pricing: { fallbackTenant: 'eclipse' },
  coverFields: { field10Label: '10. Hinge / Cabinet Style', field10Key: 'hingeStyle' },
  coverSheet: {
    // SHI-SO-CS — option lists read directly from the interactive order
    // form's own widgets (standard-order-form-shiloh.pdf rev 11/25).
    fields: ['glaze', 'highlight', 'charTechniques', 'interiorFinish', 'upperDoor', 'edgeProfile', 'hingeStyle', 'drawerBox', 'drawerGuide', 'metroGfdTrim', 'jobType'],
    options: {
      glaze: ['No Glazes', 'Black Glaze', 'Mocha Glaze', 'Van Dyke Glaze', 'Nickel Glaze'],
      highlight: ['No Highlight', 'Café Highlight', 'Slate Highlight', 'Graphite Highlight'],
      charTechniques: ['No Character Technique', 'Aged (includes Wearing)', 'Wearing', 'Sand-Through (requires Wearing)'],
      edgeProfile: ['100', '150', '200 (CN ½" overlay only)', '350', '400', '500 (⅜" inset only)', '700 (flush & beaded inset only)', '750'],
      hingeStyle: [
        'CN — Concealed ½" Overlay (soft-close)', 'EN — Concealed 1¼" Overlay (soft-close)',
        'Flush Inset (soft-close)', 'Beaded Inset (soft-close)', 'Square Bead Inset (soft-close)',
        'Modern Flush Inset (soft-close)', 'Modern Beaded Inset (soft-close)', 'Modern Square Bead Inset (soft-close)',
        'AKN — Antique Knife ½" Overlay', 'ASD — Antique Single Demountable ½" OL',
        'BKN — ⅜" Inset Oil Rubbed Bronze', 'NKN — ⅜" Inset Bright Nickel', 'WKN — ⅜" Inset White',
      ],
      drawerBox: ['⅝" Hardwood Dovetail', '¾" Hardwood Dovetail (+$57/drw)'],
      drawerGuide: ['Blum Tandem Edge (soft-close)', 'Blum Tandem Full Extension (soft-close) (+$72/drw)'],
      metroGfdTrim: ['N/A', 'Natural Aluminum', 'Black Aluminum', 'Matte Brass'],
      jobType: ['New', 'Remodel'],
    },
  },
});

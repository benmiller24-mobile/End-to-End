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
  coverFields: { field10Label: '10. Hinge / Cabinet Style', field10Key: 'constructionNote' },
});

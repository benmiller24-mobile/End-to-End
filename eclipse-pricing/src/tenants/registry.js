/**
 * Tenant registry — the single switchboard for manufacturer product lines.
 * ========================================================================
 * A tenant = one product line (Eclipse, Shiloh, Pronorm, …) with its own
 * branding, catalog, pricing rules, construction set, and locale. ALL
 * manufacturer-specific behavior lives in the tenant object (data), never
 * in code: if you are about to write `if (brand === 'x')`, the answer is a
 * field on this object instead.
 *
 * Tenant shape (every field is plain data or a closure over plain data):
 *   {
 *     id: 'eclipse',
 *     branding: {
 *       displayName,        // app title       e.g. 'Eclipse Kitchen Designer'
 *       manufacturerName,   // order header    e.g. 'Eclipse Cabinetry'
 *       lineLabel,          // picker label    e.g. 'Eclipse'
 *       lineSub,            // picker subtitle e.g. 'Frameless · full overlay'
 *       lineDescriptor,     // quote label     e.g. 'Eclipse (frameless)'
 *       companyName,        // dealer header   e.g. 'Pinnacle Sales'
 *       formCodePrefix,     // order forms     e.g. 'ECL' → ECL-SO-CS
 *       scheduleHeader,     // schedule title  e.g. 'Eclipse C3 Frameless'
 *       catalogNote,        // provenance note shown next to the picker ('' = verified)
 *       palette: { accent, gold, primary },
 *     },
 *     locale: { units: 'in', currency: 'USD' },
 *     catalog: { find(sku), search(q, limit), list(), count, sections, typeNames },
 *     official: { find(sku), list() } | null,   // authoritative dims/door counts
 *     constructions: [profileKey…],             // keys into constructionProfiles
 *     defaultConstruction: profileKey,
 *     validation: { styleCompat: bool },        // run door×species×finish matrix?
 *     pricing: { fallbackTenant: id|null },     // price-fallback line (flagged on quotes)
 *     coverFields: { field10Label, field10Key },// order cover-sheet field variants
 *   }
 */

const _tenants = new Map();
let _activeId = 'eclipse';

export function registerTenant(t) {
  if (!t || !t.id) throw new Error('tenant requires an id');
  if (!t.catalog || typeof t.catalog.find !== 'function') throw new Error(`tenant ${t.id} requires catalog.find`);
  _tenants.set(t.id, {
    locale: { units: 'in', currency: 'USD' },
    official: null,
    validation: { styleCompat: false },
    pricing: { fallbackTenant: null },
    coverFields: { field10Label: '10. Drawer Box Type', field10Key: 'drawerBox' },
    coverSheet: { fields: ['glaze', 'highlight', 'charTechniques', 'interiorFinish', 'upperDoor', 'edgeProfile', 'drawerBox', 'drawerGuide'], options: {} },
    ...t,
    branding: {
      displayName: 'Kitchen Designer', manufacturerName: t.id, lineLabel: t.id,
      lineSub: '', lineDescriptor: t.id, companyName: '', formCodePrefix: t.id.slice(0, 3).toUpperCase(),
      scheduleHeader: '', catalogNote: '',
      palette: { accent: '#b8944e', gold: '#c8a96e', primary: '#1a1a1a' },
      ...(t.branding || {}),
    },
  });
}

export function getTenant(id) { return _tenants.get(id) || _tenants.get(_activeId) || _tenants.values().next().value; }
export function listTenants() { return [..._tenants.values()]; }
export function hasTenant(id) { return _tenants.has(id); }
export function setActiveTenant(id) { if (_tenants.has(id)) _activeId = id; return _activeId; }
export function getActiveTenant() { return getTenant(_activeId); }
export function activeTenantId() { return _activeId; }

/**
 * Build a tenant from a PLAIN-DATA package (JSON-able — what the spec-book
 * ingest pipeline emits). This is the zero-code onboarding path: a package
 * is data + configuration only.
 *
 * pkg = {
 *   id, branding?, locale?, constructions?, defaultConstruction?,
 *   validation?, pricing?, coverFields?,
 *   catalog: { sections?, typeNames?, rows: [{ s, p, r?, t?, w?, h?, d? }…] },
 *   official?: [{ s, w, h, d, dc?, drc?, cat? }…],
 * }
 */
export function buildTenantFromPackage(pkg) {
  const rows = (pkg.catalog && pkg.catalog.rows) || [];
  const byCode = new Map(rows.map(e => [e.s, e]));
  const officialRows = pkg.official || [];
  const officialMap = new Map(officialRows.map(e => [e.s, e]));
  return {
    ...pkg,
    catalog: {
      find: (sku) => byCode.get(sku),
      search: (q, limit = 20) => {
        const u = String(q).toUpperCase();
        return rows.filter(e => e.s.toUpperCase().includes(u)).slice(0, limit);
      },
      list: () => rows,
      count: rows.length,
      sections: (pkg.catalog && pkg.catalog.sections) || {},
      typeNames: (pkg.catalog && pkg.catalog.typeNames) || {},
    },
    official: officialRows.length ? {
      find: (sku) => officialMap.get(sku),
      list: () => officialRows.map(e => [e.s, e]),
    } : null,
  };
}

export function registerTenantPackage(pkg) { registerTenant(buildTenantFromPackage(pkg)); }

/** Remove a tenant (used by the in-app product-line manager for locally
 *  added lines). Falls back to the first remaining tenant if it was active. */
export function removeTenant(id) {
  _tenants.delete(id);
  if (_activeId === id) _activeId = _tenants.keys().next().value || 'eclipse';
}

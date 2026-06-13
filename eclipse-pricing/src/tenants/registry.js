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

  // ── Price-group resolution (generic European-modular capability) ──────────
  // A row may carry `pg: {N, '0'..'10'}` — a price per finish/price-group. The
  // tenant's runtime `pricing.activeGroup` (chosen from the front range) selects
  // which column is the effective `.p`, so every existing `.p` consumer works
  // unchanged. Rows without `pg` (Eclipse/Shiloh/Aspect) are returned as-is —
  // no brand names, no conditionals: the behavior keys purely on the data shape.
  const hasGroups = rows.some(e => e.pg);
  const tenantRef = {};   // late-bound so closures see the built tenant's pricing
  const effPrice = (e) => {
    if (!e || !e.pg) return e;
    const g = tenantRef.t?.pricing?.activeGroup ?? pkg.pricing?.defaultGroup ?? '0';
    const p = e.pg[g] ?? e.pg.N ?? e.p;
    return p == null ? e : { ...e, p };
  };
  const wrapFind = hasGroups ? (e) => effPrice(e) : (e) => e;
  const wrapList = hasGroups ? (arr) => arr.map(effPrice) : (arr) => arr;

  const tenant = {
    ...pkg,
    catalog: {
      find: (sku) => wrapFind(byCode.get(sku)),
      search: (q, limit = 20) => {
        const u = String(q).toUpperCase();
        return wrapList(rows.filter(e => e.s.toUpperCase().includes(u)).slice(0, limit));
      },
      list: () => wrapList(rows),
      count: rows.length,
      sections: (pkg.catalog && pkg.catalog.sections) || {},
      typeNames: (pkg.catalog && pkg.catalog.typeNames) || {},
    },
    official: officialRows.length ? {
      find: (sku) => officialMap.get(sku),
      list: () => officialRows.map(e => [e.s, e]),
    } : null,
  };
  tenantRef.t = tenant;
  return tenant;
}

/** Set the active price group on a tenant (chosen from its front range, e.g.
 *  pronorm range MP → group 2). Generic: any tenant whose catalog carries `pg`
 *  vectors reprices through this. No-op for single-price catalogs. */
export function setTenantPriceGroup(id, group) {
  const t = _tenants.get(id);
  if (t && t.pricing) t.pricing.activeGroup = group != null ? String(group) : undefined;
}
/** Resolve a tenant's front-range code (e.g. 'MP') to its price group. */
export function priceGroupForRange(id, range) {
  const t = _tenants.get(id);
  return t?.pricing?.frontRanges?.[range] ?? null;
}

export function registerTenantPackage(pkg) { registerTenant(buildTenantFromPackage(pkg)); }

/** Remove a tenant (used by the in-app product-line manager for locally
 *  added lines). Falls back to the first remaining tenant if it was active. */
export function removeTenant(id) {
  _tenants.delete(id);
  if (_activeId === id) _activeId = _tenants.keys().next().value || 'eclipse';
}

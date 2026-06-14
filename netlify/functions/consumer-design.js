// Consumer design + price-RANGE API for the FAKS / Showroom Atlas site.
// ====================================================================
// Same engine as the dealer tools (configureProject = solve + price), but the
// response is CONSUMER-SAFE: a price RANGE only — no SKUs, no dealer cost,
// no margins, no order package. The homeowner gets a ballpark + a simple plan,
// then becomes a lead routed to a local dealer that carries the chosen line.
// CORS-open so the separate Next.js consumer site can call it.
import { configureProject, priceRange } from '../../eclipse-engine/src/index.js';
import { solve } from '../../eclipse-engine/src/solver.js';
import { realizeInTenant } from '../../eclipse-engine/src/tenantRealize.js';
import { getTenant, hasTenant, setTenantPriceGroup, priceGroupForRange } from '../../eclipse-pricing/src/tenants/index.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: CORS });
  try {
    const body = await req.json();
    const {
      walls, appliances = [], prefs = {}, layoutType, roomType = 'kitchen',
      island, peninsula, brand = 'eclipse', style = {},
    } = body;
    if (!walls || !walls.length) return new Response(JSON.stringify({ error: 'walls required' }), { status: 400, headers: CORS });

    const line = hasTenant(brand) ? getTenant(brand) : getTenant('eclipse');
    const currency = line.locale?.currency || 'USD';

    // Solve + price with the engine (let the solver place appliances by type).
    const result = configureProject({
      // applyApplianceRec lets the solver PLACE appliances given only their types
      // (the consumer picks "I have a fridge/range/sink/DW", not positions).
      room: { walls, appliances, prefs, layoutType, roomType, island, peninsula, applyApplianceRec: true },
      materials: { brand, species: style.species, door: style.door, construction: style.construction },
    });
    let total = result.quote?.projectTotal || result.pricing?.projectTotal || 0;

    // Price-group tenants (e.g. pronorm) are NOT priced by configureProject — it
    // prices every brand from the Eclipse list table. Reprice them from their OWN
    // catalogue at the chosen price group via realize-in-tenant, so the finish
    // (front range → group) actually drives the number. Dealer-safe: this only
    // reads the tenant catalog; the Eclipse/dealer engine path is untouched.
    if (line?.realize && line?.catalog && line?.pricing?.priceGroups) {
      const reqGroup = body.priceGroup != null ? String(body.priceGroup)
        : (style.frontRange ? priceGroupForRange(brand, style.frontRange) : null);
      const group = reqGroup ?? line.pricing.defaultGroup ?? '0';
      try {
        setTenantPriceGroup(brand, group);
        const sr = solve({ walls, appliances, prefs, layoutType, roomType, island, peninsula, applyApplianceRec: true });
        realizeInTenant(sr, line, group);
        const pgTotal = (sr.placements || []).reduce((a, c) => a + (c._price || 0), 0);
        if (pgTotal > 0) total = pgTotal;
      } catch {
        // keep the configureProject fallback total if catalog pricing fails
      }
    }

    const range = priceRange(total, { pct: body.uncertaintyPct ?? 0.15, currency });

    // Consumer-safe payload — strictly NO sku / cost / margin fields.
    // configureProject exposes the count at result.layout.totalCabinets (the
    // per-wall counts live in result.layout.walls[].cabinetCount).
    const layout = result.layout || {};
    const cabinetCount = layout.totalCabinets
      || (layout.walls || []).reduce((a, w) => a + (w.cabinetCount || 0), 0) || 0;
    const wallRun = (walls || []).reduce((a, w) => a + (w.length || 0), 0);
    const out = {
      brand,
      lineLabel: line.branding?.lineLabel || brand,
      currency,
      layoutType: layout.layoutType || layoutType || null,
      cabinetCount,
      linearFeet: Math.round(wallRun / 12),
      priceRange: range,                          // { low, high, mid, display }
      // a minimal plan for a friendly visual (positions only, no SKUs)
      plan: (walls || []).map(w => ({ id: w.id, length: w.length })),
      appliances: (appliances || []).map(a => ({ type: a.type })),   // echo what the customer has
      disclaimer: 'Estimated range for cabinetry only — a local dealer confirms your exact quote.',
    };
    return new Response(JSON.stringify(out), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: CORS });
  }
};

export const config = { path: '/api/consumer-design' };

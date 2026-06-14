// Consumer design + price-RANGE API for the FAKS / Showroom Atlas site.
// ====================================================================
// Same engine as the dealer tools (configureProject = solve + price), but the
// response is CONSUMER-SAFE: a price RANGE only — no SKUs, no dealer cost,
// no margins, no order package. The homeowner gets a ballpark + a simple plan,
// then becomes a lead routed to a local dealer that carries the chosen line.
// CORS-open so the separate Next.js consumer site can call it.
import { configureProject, priceRange } from '../../eclipse-engine/src/index.js';
import { getTenant, hasTenant } from '../../eclipse-pricing/src/tenants/index.js';

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
    const total = result.quote?.projectTotal || result.pricing?.projectTotal || 0;
    const range = priceRange(total, { pct: body.uncertaintyPct ?? 0.15, currency });

    // Consumer-safe payload — strictly NO sku / cost / margin fields.
    const layout = result.layout || {};
    const cabinetCount = layout.metadata?.totalCabinets || (layout.placements || []).filter(p => p.type !== 'appliance').length;
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
      appliances: (layout.placements || []).filter(p => p.type === 'appliance').map(p => ({ type: p.applianceType, wall: p.wall })),
      disclaimer: 'Estimated range for cabinetry only — a local dealer confirms your exact quote.',
    };
    return new Response(JSON.stringify(out), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: CORS });
  }
};

export const config = { path: '/api/consumer-design' };

/**
 * Order-Readiness Gate
 * ====================
 * Mirrors the Pinnacle Dealer Hub ordering SOP: a design may be QUOTED at any
 * time, but it is only ORDER-GRADE when every check below passes. Until then
 * the order package carries a BUDGET watermark and this module says exactly
 * what's missing — the same discipline a careful designer applies by hand.
 */
import { cutoutFormFor } from './orderPackage.js';

/**
 * @returns {{ ready: boolean, grade: 'order'|'budget', checks: [{id,label,pass,detail,severity}] }}
 */
export function evaluateOrderReadiness({ solverResult, quote, walls = [], selectedAppliances = [], projectMeta = {}, orderSpec = {}, construction = {} }) {
  const checks = [];
  const add = (id, label, pass, detail, severity = 'blocker') => checks.push({ id, label, pass: !!pass, detail, severity });
  const placements = solverResult?.placements || [];

  // 1. Field-verified dimensions (T1 grades) — every wall must be verified.
  const unverified = walls.filter(w => !w.fieldVerified);
  add('dims', 'All wall dimensions field-verified',
    walls.length > 0 && unverified.length === 0,
    unverified.length ? `${unverified.length} of ${walls.length} walls are customer-supplied (budget grade): ${unverified.map(w => w.id).join(', ')}` : 'Professional measure recorded for every wall');

  // 2. Ceiling capture — verified walls should carry 3-point ceiling readings.
  const noCeil = walls.filter(w => w.fieldVerified && !(w.ceilingReadings || []).filter(Boolean).length && !w.ceilingHeight);
  add('ceiling', 'Ceiling heights recorded', noCeil.length === 0,
    noCeil.length ? `No ceiling readings on wall(s) ${noCeil.map(w => w.id).join(', ')}` : 'Ceiling readings present (lowest governs)', 'warning');

  // 3. Built-in appliances have complete model numbers (cutout sheets demand it).
  const inset = !!construction?.inset;
  const cutoutCabs = placements.filter(p => p.sku && cutoutFormFor(p.sku, inset));
  const typeOf = (a) => a.type;
  const haveTypes = new Set(selectedAppliances.map(typeOf));
  const missingModels = [];
  for (const c of cutoutCabs) {
    const form = cutoutFormFor(c.sku, inset);
    if (!form.appTypes.some(t => haveTypes.has(t))) missingModels.push(`${c.sku} needs ${form.appTypes.join('/')}`);
  }
  add('cutouts', 'Every cutout cabinet has an appliance model',
    missingModels.length === 0,
    missingModels.length ? missingModels.join(' · ') : (cutoutCabs.length ? `${cutoutCabs.length} cutout sheet(s) ready` : 'No built-in cutout cabinets'));

  // 4. Built-in width fit: hosting cabinet vs selected appliance (T5).
  const fitIssues = [];
  for (const c of cutoutCabs) {
    const form = cutoutFormFor(c.sku, inset);
    const app = selectedAppliances.find(a => form.appTypes.includes(a.type));
    if (app?.width && c.width && app.width > c.width + 0.01) {
      fitIssues.push(`${c.sku} is ${c.width}" but ${app.brandName || app.brand || ''} ${app.model} is ${app.width}"`);
    }
  }
  add('fit', 'Appliances fit their cutout cabinets', fitIssues.length === 0,
    fitIssues.length ? fitIssues.join(' · ') : 'Widths compatible (verify cutout dims against manufacturer install specs)');

  // 5. Freestanding appliances specified (range/fridge/DW models for the record).
  const solverTypes = new Set(placements.filter(p => p.type === 'appliance').map(p => (p.applianceType || '').toLowerCase()));
  const wantModels = ['range', 'cooktop', 'refrigerator', 'dishwasher'].filter(t => solverTypes.has(t));
  const missingFree = wantModels.filter(t => !selectedAppliances.some(a => (a.type || '').toLowerCase() === t));
  add('appliances', 'Freestanding appliance models selected', missingFree.length === 0,
    missingFree.length ? `No model chosen for: ${missingFree.join(', ')}` : 'All design appliances have real models', 'warning');

  // 6. No silent SKU substitutions (T4) and no Shiloh→Eclipse fallbacks.
  const subs = (quote?.items || []).filter(i => i._resolution === 'substituted' || i.error);
  const fallbacks = quote?.fallbackCount || 0;
  add('skus', 'Every SKU resolved exactly from the catalog',
    subs.length === 0 && fallbacks === 0,
    [subs.length ? `${subs.length} substituted/unresolved` : '', fallbacks ? `${fallbacks} priced via Eclipse fallback` : ''].filter(Boolean).join(' · ') || 'Clean catalog resolution');

  // 7. Custom-quote items routed (not silently unpriced).
  const nq = quote?.fabrication?.items?.filter(i => i.needsQuote) || [];
  add('customQuote', 'Non-standard items have a Custom Quote Worksheet', true,
    nq.length ? `${nq.length} item(s) on the worksheet — email quotes@wwinc.com BEFORE ordering: ${nq.map(i => i.sku).join(', ')}` : 'None required',
    nq.length ? 'warning' : 'info');

  // 8. Solver validation errors (collisions, soffits) resolved.
  const errs = (solverResult?.validation || []).filter(v => v.severity === 'error' && !v.advisory);
  add('validation', 'No unresolved design errors', errs.length === 0,
    errs.length ? errs.map(e => e.rule).join(', ') : 'Validation clean');

  // 9. Cover sheet complete.
  const coverMissing = [];
  if (!orderSpec.businessName) coverMissing.push('business name');
  if (!orderSpec.customerNumber) coverMissing.push('customer #');
  if (!projectMeta.jobNumber && !projectMeta.name) coverMissing.push('PO / job name');
  if (!orderSpec.contactEmail) coverMissing.push('contact email');
  add('cover', 'Cover sheet fields complete', coverMissing.length === 0,
    coverMissing.length ? `Missing: ${coverMissing.join(', ')}` : 'All global style fields present');

  const blockers = checks.filter(c => !c.pass && c.severity === 'blocker');
  const ready = blockers.length === 0;
  return { ready, grade: ready ? 'order' : 'budget', checks, blockers };
}

/**
 * Self-improving corpus runner.
 * =============================
 * Solves every kitchen in the corpus across all three lines (Eclipse, Shiloh,
 * pronorm), realizes metric tenants, scores the 5 metrics, and reports per-brand
 * pass rates plus the failure histogram that drives the fix loop. This is the
 * engine of the self-improving system: run → see what fails → fix → re-run.
 *
 *   node evals/si/run-corpus.mjs [N] [--brand=eclipse] [--fail] [--json out.json]
 */
import { solve } from '../../eclipse-engine/src/index.js';
import { realizeInTenant } from '../../eclipse-engine/src/tenantRealize.js';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';
import { scoreKitchen } from './scoreKitchen.mjs';
import { corpusArray } from './corpus.mjs';

const BRANDS = ['eclipse', 'shiloh', 'pronorm'];

export function runOne(kitchen, brand) {
  const tenant = getTenant(brand);
  const ceilH = kitchen.ceiling || 96;
  const walls = kitchen.walls.map(w => ({ ...w, ceilingHeight: w.ceilingHeight || ceilH }));
  const input = {
    layoutType: kitchen.layoutType, roomType: 'kitchen', walls,
    appliances: kitchen.appliances, prefs: kitchen.prefs || {},
    applyApplianceRec: true,   // appliances carry types only; solver positions them
    ...(kitchen.island ? { island: kitchen.island } : {}),
  };
  let result, err = null;
  try {
    result = solve(input);
    // Metric tenants: realize into the tenant catalogue at its default group.
    if (tenant?.realize) {
      const group = tenant.pricing?.defaultGroup ?? '0';
      realizeInTenant(result, tenant, group);
    }
  } catch (e) { err = e; }
  if (err) {
    return { kitchen: kitchen.id, brand, crashed: true, error: err.message,
      score: { pass: false, overall: 0, failed: ['crash'], metrics: {} } };
  }
  const priceGroup = tenant?.pricing?.defaultGroup;
  const score = scoreKitchen(result, { brand, room: kitchen, prefs: kitchen.prefs, priceGroup });
  return { kitchen: kitchen.id, label: kitchen.label, brand, crashed: false, score };
}

export function runCorpus(n = 100, brands = BRANDS) {
  const corpus = corpusArray(n);
  const rows = [];
  for (const k of corpus) for (const b of brands) rows.push(runOne(k, b));
  return { corpus, rows };
}

function aggregate(rows, brands) {
  const out = {};
  for (const b of brands) {
    const br = rows.filter(r => r.brand === b);
    const passed = br.filter(r => r.score.pass).length;
    const crashed = br.filter(r => r.crashed).length;
    const byMetric = {};
    const issueHist = {};
    for (const r of br) {
      for (const m of (r.score.failed || [])) byMetric[m] = (byMetric[m] || 0) + 1;
      for (const [mk, mv] of Object.entries(r.score.metrics || {})) {
        for (const iss of (mv.issues || [])) {
          const key = `${mk}: ${iss.replace(/\d+/g, '#').replace(/\(e\.g\.[^)]*\)/, '').trim()}`;
          issueHist[key] = (issueHist[key] || 0) + 1;
        }
      }
    }
    out[b] = { total: br.length, passed, crashed, rate: br.length ? passed / br.length : 0, byMetric, issueHist };
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const n = parseInt(args.find(a => /^\d+$/.test(a)) || '60', 10);
  const brandArg = args.find(a => a.startsWith('--brand='));
  const brands = brandArg ? [brandArg.split('=')[1]] : BRANDS;
  const showFail = args.includes('--fail');
  const { rows } = runCorpus(n, brands);
  const agg = aggregate(rows, brands);

  console.log(`\n══ Self-improving corpus: ${n} kitchens × ${brands.length} brand(s) = ${rows.length} runs ══\n`);
  for (const b of brands) {
    const a = agg[b];
    console.log(`■ ${b.toUpperCase()}  —  ${a.passed}/${a.total} pass (${(a.rate * 100).toFixed(1)}%)${a.crashed ? `  · ${a.crashed} CRASHED` : ''}`);
    const mk = Object.entries(a.byMetric).sort((x, y) => y[1] - x[1]);
    if (mk.length) console.log('   failing metrics:', mk.map(([k, v]) => `${k}×${v}`).join('  '));
    const ih = Object.entries(a.issueHist).sort((x, y) => y[1] - x[1]).slice(0, 10);
    if (ih.length) { console.log('   top issues:'); ih.forEach(([k, v]) => console.log(`     ${String(v).padStart(3)}×  ${k}`)); }
    console.log('');
  }

  if (showFail) {
    console.log('── individual failures ──');
    for (const r of rows.filter(r => !r.score.pass)) {
      console.log(`  ✗ ${r.kitchen} ${r.brand} [${r.label || ''}] overall=${r.score.overall} failed=${(r.score.failed || []).join(',')}`);
    }
  }

  const overall = rows.filter(r => r.score.pass).length;
  console.log(`\n══ TOTAL: ${overall}/${rows.length} runs pass (${(overall / rows.length * 100).toFixed(1)}%) ══`);
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) main();

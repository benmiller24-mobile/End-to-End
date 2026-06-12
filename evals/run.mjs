#!/usr/bin/env node
/**
 * Per-tenant eval runner.
 * =======================
 *   node evals/run.mjs            # all tenants
 *   node evals/run.mjs aspect     # one tenant
 *
 * Two layers:
 *   1. GENERIC suite — runs for EVERY registered tenant (registry contract,
 *      catalog integrity, resolver round-trip). A new tenant gets this free.
 *   2. FIXTURES — evals/<tenantId>/*.eval.mjs (golden orders, spot prices).
 *      Onboarding a tenant means adding fixtures for its catalog here.
 *
 * Exit code 1 on any failure — wire into CI / pre-deploy.
 */
import { readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { suite } from './_lib.mjs';
import { listTenants, setActiveTenant } from '../eclipse-pricing/src/tenants/index.js';
import { findSkuNormalized, setPricingBrand } from '../frontend/src/skuResolver.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];

// ── 1. generic suite, every tenant ──────────────────────────────────────
function genericSuite(t) {
  const s = suite(`${t.id} · generic`);
  // registry contract
  s.ok('branding.lineLabel present', !!t.branding.lineLabel);
  s.ok('branding.manufacturerName present', !!t.branding.manufacturerName);
  s.ok('branding.formCodePrefix present', !!t.branding.formCodePrefix);
  s.ok('constructions non-empty', Array.isArray(t.constructions) && t.constructions.length > 0);
  s.ok('defaultConstruction in constructions', t.constructions.includes(t.defaultConstruction));
  s.ok('catalog count > 0', t.catalog.count > 0);
  // catalog integrity: every Nth row priced and findable
  const rows = t.catalog.list();
  const step = Math.max(1, Math.floor(rows.length / 50));
  let sampled = 0, found = 0, priced = 0;
  for (let i = 0; i < rows.length; i += step) {
    const e = rows[i];
    if (!e || !e.s) continue;
    sampled++;
    if (t.catalog.find(e.s)) found++;
    if (e.p > 0) priced++;
  }
  s.eq('sampled rows findable', found, sampled, 0.5);
  s.eq('sampled rows priced > 0', priced, sampled, 0.5);
  // resolver round-trip under this tenant
  setPricingBrand(t.id);
  let exact = 0, n = 0;
  for (let i = 0; i < rows.length && n < 25; i += step * 2) {
    const e = rows[i];
    if (!e || !e.s) continue;
    n++;
    const r = findSkuNormalized(e.s);
    if (r && r._resolution === 'exact' && Math.abs(r.p - e.p) < 0.005) exact++;
  }
  s.eq(`resolver round-trip exact (${n} sampled)`, exact, n, 0.5);
  // search returns its own catalog's entries
  const probe = rows[0] && rows[0].s ? rows[0].s.slice(0, 2) : 'B';
  s.ok('search returns results', (t.catalog.search(probe, 5) || []).length > 0);
  setPricingBrand('eclipse');
  return s.done();
}

// ── 2. fixture files per tenant ─────────────────────────────────────────
async function fixtureSuites(tenantId) {
  const dir = join(HERE, tenantId);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.eval.mjs')).sort()) {
    const mod = await import(join(dir, f));
    out.push({ file: `${tenantId}/${f}`, ...(await mod.default()) });
  }
  return out;
}

let totalPass = 0, totalFail = 0;
for (const t of listTenants()) {
  if (only && t.id !== only) continue;
  console.log(`\n━━ tenant: ${t.id} (${t.catalog.count} SKUs) ━━`);
  const results = [{ file: 'generic', ...genericSuite(t) }, ...(await fixtureSuites(t.id))];
  for (const r of results) {
    totalPass += r.pass; totalFail += r.fail;
    console.log(`  ${r.fail ? '✗' : '✓'} ${r.file}: ${r.pass} passed${r.fail ? `, ${r.fail} FAILED` : ''}`);
    for (const f of (r.failures || []).slice(0, 8)) console.log(`      ✗ ${f}`);
  }
}
console.log(`\n══════════════════════════════════════`);
console.log(`evals: ${totalPass} passed, ${totalFail} failed`);
process.exit(totalFail ? 1 : 0);

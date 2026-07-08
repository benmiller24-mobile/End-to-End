/**
 * Locally-added product lines (in-app PDF onboarding) — team-shared when
 * Supabase is configured.
 * =====================================================
 * Tenant packages created by the in-app uploader persist in localStorage on
 * THIS device and register into the tenant registry at startup — the same
 * zero-code package format the repo manifest uses, so a local line can be
 * promoted to a permanent one by downloading its JSON and committing it to
 * eclipse-pricing/src/tenants/packages/.
 *
 * TEAM LAYER (additive, env-gated): when VITE_SUPABASE_* is set, every saved
 * package also upserts to the `tenant_packages` table, and startup pulls the
 * team's packages down (syncTeamTenantPackages) — a line onboarded on one
 * device exists for the whole dealership. The synchronous localStorage API is
 * unchanged; the offline path never degrades.
 */
import { registerTenantPackage, removeTenant, hasTenant } from '../../eclipse-pricing/src/tenants/index.js';
import { getSupabase } from './lib/supabase.js';

const KEY = 'ekd.tenantPackages';

function readStore() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function writeStore(pkgs) {
  try { localStorage.setItem(KEY, JSON.stringify(pkgs)); } catch { /* private mode / quota */ }
}

/** Register every locally-stored package (called once at app startup). */
export function loadLocalTenantPackages() {
  const pkgs = readStore();
  for (const pkg of pkgs) {
    try { if (!hasTenant(pkg.id)) registerTenantPackage(pkg); } catch { /* corrupt entry — skip */ }
  }
  return pkgs.map(p => p.id);
}

export function saveLocalTenantPackage(pkg) {
  const pkgs = readStore().filter(p => p.id !== pkg.id);
  pkgs.push(pkg);
  writeStore(pkgs);
  registerTenantPackage(pkg);
  // Team layer: fire-and-forget upsert; local save already succeeded.
  const sb = getSupabase();
  if (sb) {
    sb.from('tenant_packages')
      .upsert({ id: pkg.id, name: pkg.branding?.manufacturerName || pkg.id, package: pkg }, { onConflict: 'id' })
      .then(({ error }) => { if (error) console.warn('tenant package team-sync failed:', error.message); });
  }
}

export function removeLocalTenantPackage(id) {
  writeStore(readStore().filter(p => p.id !== id));
  removeTenant(id);
  const sb = getSupabase();
  if (sb) {
    sb.from('tenant_packages').delete().eq('id', id)
      .then(({ error }) => { if (error) console.warn('tenant package team-delete failed:', error.message); });
  }
}

/**
 * Pull the team's packages down and register any this device doesn't have.
 * Returns the newly-registered ids (empty when Supabase isn't configured, on
 * error, or when everything already matched). Call once at startup; callers
 * may re-render brand pickers when ids come back.
 */
export async function syncTeamTenantPackages() {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('tenant_packages').select('id, package');
    if (error || !Array.isArray(data)) return [];
    const local = readStore();
    const added = [];
    for (const row of data) {
      const pkg = row.package;
      if (!pkg || !pkg.id || !pkg.catalog) continue;
      if (!hasTenant(pkg.id)) { try { registerTenantPackage(pkg); added.push(pkg.id); } catch { continue; } }
      if (!local.some(p => p.id === pkg.id)) local.push(pkg);
    }
    if (added.length) writeStore(local);
    return added;
  } catch {
    return [];
  }
}

export function localTenantIds() { return readStore().map(p => p.id); }
export function getLocalTenantPackage(id) { return readStore().find(p => p.id === id) || null; }

/**
 * Browser PDF text extraction (pdf.js): returns Map(pageNo → text) in the
 * shape ingestCore expects. Lines are reconstructed from glyph positions
 * (grouped by Y, ordered by X) so the matrix parser's header detection works.
 */
export async function extractPdfPages(file, onProgress) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = new Map();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const lines = new Map();    // rounded y → [{x, str}]
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      (lines.get(y) || lines.set(y, []).get(y)).push({ x: item.transform[4], str: item.str });
    }
    const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(it => it.str).join(' '));
    pages.set(i, ordered.join('\n'));
    if (onProgress) onProgress(i, doc.numPages);
  }
  return pages;
}

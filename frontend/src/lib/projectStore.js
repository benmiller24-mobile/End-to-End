/**
 * Project store — save/load/revision persistence for the designer.
 *
 * Backend: localStorage (always available, no infrastructure). The record
 * shape deliberately mirrors supabase/schema.sql (projects → rooms → revisions)
 * so a Supabase adapter can replace `readAll`/`writeAll` once a project is
 * provisioned (frontend/src/lib/supabase.js is the placeholder client).
 *
 * project := {
 *   id, name,
 *   meta:   { customer, jobNumber, address, designer },
 *   state:  full designer state snapshot (see App.jsx collectState),
 *   revisions: [{ at, label, cabinetCount, subtotal, state }],   // newest first
 *   createdAt, updatedAt,
 * }
 */
import { getSupabase } from './supabase.js';

const KEY = 'ekd.projects.v1';
const MAX_REVISIONS = 20;

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}
function writeAll(projects) {
  try { localStorage.setItem(KEY, JSON.stringify(projects)); return true; }
  catch (e) { console.warn('Project save failed (storage quota?):', e); return false; }
}

// ── CLOUD LAYER (Supabase, env- and auth-gated; additive) ─────────────────
// localStorage stays the source of truth for the running session; every write
// mirrors to `project_snapshots` when a user is signed in, and sign-in pulls
// the account's projects down (newer updatedAt wins). Offline never degrades.
async function cloudUser() {
  const sb = getSupabase();
  if (!sb) return null;
  try { const { data } = await sb.auth.getUser(); return data?.user || null; }
  catch { return null; }
}

async function cloudUpsert(project) {
  const sb = getSupabase();
  const user = await cloudUser();
  if (!sb || !user) return;
  const { error } = await sb.from('project_snapshots').upsert({
    id: project.id, user_id: user.id, name: project.name,
    meta: project.meta || {}, state: project.state || {},
    revisions: project.revisions || [], updated_at_ms: project.updatedAt || Date.now(),
  }, { onConflict: 'id' });
  if (error) console.warn('project cloud-sync failed:', error.message);
}

async function cloudDelete(id) {
  const sb = getSupabase();
  const user = await cloudUser();
  if (!sb || !user) return;
  const { error } = await sb.from('project_snapshots').delete().eq('id', id);
  if (error) console.warn('project cloud-delete failed:', error.message);
}

/** Pull the signed-in account's projects; newer updatedAt wins per project.
 *  Returns how many local records changed (0 when signed out/unconfigured). */
export async function syncProjectsFromCloud() {
  const sb = getSupabase();
  const user = await cloudUser();
  if (!sb || !user) return 0;
  try {
    const { data, error } = await sb.from('project_snapshots').select('*');
    if (error || !Array.isArray(data)) return 0;
    const all = readAll();
    let changed = 0;
    for (const row of data) {
      const remote = {
        id: row.id, name: row.name, meta: row.meta || {}, state: row.state || {},
        revisions: row.revisions || [], createdAt: row.updated_at_ms, updatedAt: row.updated_at_ms,
      };
      const i = all.findIndex(p => p.id === row.id);
      if (i === -1) { all.push(remote); changed++; }
      else if ((row.updated_at_ms || 0) > (all[i].updatedAt || 0)) { all[i] = { ...all[i], ...remote, createdAt: all[i].createdAt }; changed++; }
    }
    if (changed) writeAll(all);
    // Push local projects the cloud doesn't have yet (first sign-in on a device).
    const remoteIds = new Set(data.map(r => r.id));
    for (const p of all) if (!remoteIds.has(p.id)) cloudUpsert(p);
    return changed;
  } catch {
    return 0;
  }
}

export function newProjectId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function listProjects() {
  return readAll()
    .map(({ id, name, meta, createdAt, updatedAt, revisions }) => ({
      id, name, meta: meta || {}, createdAt, updatedAt,
      revisionCount: (revisions || []).length,
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function loadProject(id) {
  return readAll().find(p => p.id === id) || null;
}

export function saveProject({ id, name, meta, state }) {
  const all = readAll();
  const now = Date.now();
  const i = all.findIndex(p => p.id === id);
  if (i >= 0) {
    all[i] = { ...all[i], name, meta, state, updatedAt: now };
  } else {
    all.push({ id, name, meta, state, revisions: [], createdAt: now, updatedAt: now });
  }
  const ok = writeAll(all);
  cloudUpsert(all.find(p => p.id === id));
  return ok;
}

export function deleteProject(id) {
  const ok = writeAll(readAll().filter(p => p.id !== id));
  cloudDelete(id);
  return ok;
}

/** Record a solve as a revision snapshot (newest first, capped). */
export function addRevision(projectId, snapshot) {
  const all = readAll();
  const p = all.find(x => x.id === projectId);
  if (!p) return false;
  p.revisions = [{ at: Date.now(), ...snapshot }, ...(p.revisions || [])].slice(0, MAX_REVISIONS);
  p.updatedAt = Date.now();
  const ok = writeAll(all);
  cloudUpsert(p);
  return ok;
}

export function getRevisions(projectId) {
  return loadProject(projectId)?.revisions || [];
}

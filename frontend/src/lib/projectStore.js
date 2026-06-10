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
  return writeAll(all);
}

export function deleteProject(id) {
  return writeAll(readAll().filter(p => p.id !== id));
}

/** Record a solve as a revision snapshot (newest first, capped). */
export function addRevision(projectId, snapshot) {
  const all = readAll();
  const p = all.find(x => x.id === projectId);
  if (!p) return false;
  p.revisions = [{ at: Date.now(), ...snapshot }, ...(p.revisions || [])].slice(0, MAX_REVISIONS);
  p.updatedAt = Date.now();
  return writeAll(all);
}

export function getRevisions(projectId) {
  return loadProject(projectId)?.revisions || [];
}

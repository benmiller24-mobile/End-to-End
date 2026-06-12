/**
 * Product Lines manager — multi-tenant onboarding from the app.
 * ==============================================================
 * Lists every registered line and adds new ones from a PDF price/spec book:
 * upload → parse (same ingest core the CLI uses) → validation report →
 * register. New lines persist on this device (localStorage) and can be
 * downloaded as a package JSON to commit into the repo manifest for all
 * devices. Shiloh and Eclipse were onboarded from exactly these books.
 */
import React, { useState } from 'react';
import { listTenants } from '../../eclipse-pricing/src/tenants/index.js';
import { ingestPages } from '../../eclipse-pricing/src/tenants/ingestCore.js';
import { saveLocalTenantPackage, removeLocalTenantPackage, localTenantIds, getLocalTenantPackage, extractPdfPages } from './tenantLocal.js';

const C = { accent: '#b8944e', danger: '#c0392b', dim: '#8a8a8a', border: '#e4ddd2', text: '#1a1a1a' };
const input = { width: '100%', padding: '6px 9px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 12, boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 10.5, color: C.dim, marginBottom: 3 };

export default function ProductLinesManager({ activeBrand, onBrandChange }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', construction: 'frameless', fallback: '', pages: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState(null);   // { pkg, report }
  const [bump, setBump] = useState(0);          // re-render after add/remove
  const locals = localTenantIds();

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

  const runIngest = async () => {
    if (!file || !form.name.trim()) { setBusy('Pick a PDF and name the line first.'); return; }
    const id = slug(form.name);
    if (listTenants().some(t => t.id === id)) { setBusy(`A line with id "${id}" already exists.`); return; }
    setReport(null);
    try {
      setBusy('Reading PDF…');
      const pages = await extractPdfPages(file, (i, n) => setBusy(`Extracting page ${i}/${n}…`));
      setBusy('Parsing price tables…');
      const cfg = {
        id,
        sourceName: file.name,
        branding: {
          displayName: 'Eclipse Kitchen Designer',
          manufacturerName: form.name.trim(),
          lineLabel: form.name.trim().split(' ')[0],
          lineSub: form.construction === 'framed' ? 'Framed (face-frame)' : 'Frameless',
          lineDescriptor: `${form.name.trim().split(' ')[0]} (${form.construction})`,
          companyName: 'Pinnacle Sales',
          formCodePrefix: id.slice(0, 3).toUpperCase(),
          scheduleHeader: `${form.name.trim()} ${form.construction === 'framed' ? 'Framed' : 'Frameless'}`,
          catalogNote: `Pricing ingested in-app from ${file.name} — verify against acknowledgments before ordering.`,
        },
        constructions: form.construction === 'framed'
          ? ['shiloh_overlay_half', 'shiloh_flush_inset']
          : ['eclipse_frameless'],
        pricing: { fallbackTenant: form.fallback || null },
        extract: { pages: form.pages.trim() || undefined, minRows: 25 },
      };
      const out = ingestPages(pages, cfg);
      setReport(out);
      setBusy(out.report.problems.length
        ? `Ingest found ${out.report.problems.length} problem(s) — fix the book/pages and retry.`
        : `Parsed ${out.report.count} SKUs — review and save.`);
    } catch (e) {
      setBusy(`Failed: ${e.message || e}`);
    }
  };

  const save = () => {
    if (!report || report.report.problems.length) return;
    report.pkg._meta.generated = new Date().toISOString();
    saveLocalTenantPackage(report.pkg);
    onBrandChange && onBrandChange(report.pkg.id);
    setReport(null); setFile(null); setForm({ name: '', construction: 'frameless', fallback: '', pages: '' });
    setOpen(false); setBusy(''); setBump(b => b + 1);
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report.pkg, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${report.pkg.id}.package.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div data-bump={bump} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, color: C.dim }}>
          {listTenants().length} product lines{locals.length ? ` · ${locals.length} added on this device` : ''}
        </span>
        {locals.includes(activeBrand) && (
          <>
            <button onClick={() => {
              const pkg = getLocalTenantPackage(activeBrand);
              if (pkg) { const blob = new Blob([JSON.stringify(pkg, null, 1)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${pkg.id}.package.json`; a.click(); URL.revokeObjectURL(a.href); }
            }} style={{ fontSize: 10.5, padding: '2px 8px', cursor: 'pointer', border: `1px solid ${C.border}`, borderRadius: 4, background: '#fff' }}>
              ⤓ Download package
            </button>
            <button onClick={() => { if (confirm(`Remove the "${activeBrand}" line from this device?`)) { removeLocalTenantPackage(activeBrand); onBrandChange && onBrandChange('eclipse'); setBump(b => b + 1); } }}
              style={{ fontSize: 10.5, padding: '2px 8px', cursor: 'pointer', border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 4, background: '#fff' }}>
              ✕ Remove line
            </button>
          </>
        )}
        <button onClick={() => setOpen(o => !o)}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '3px 10px', cursor: 'pointer', border: `1px solid ${C.accent}`, color: '#7a5c1e', borderRadius: 4, background: open ? '#c8a96e22' : '#fff' }}>
          {open ? '× Close' : '+ Add product line (PDF)'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10, padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, background: '#fbf9f4' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr', gap: 8 }}>
            <div><label style={lbl}>Line name</label>
              <input style={input} placeholder="e.g. Pronorm Kitchens" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label style={lbl}>Construction</label>
              <select style={input} value={form.construction} onChange={e => setForm(f => ({ ...f, construction: e.target.value }))}>
                <option value="frameless">Frameless (European)</option>
                <option value="framed">Framed (face-frame)</option>
              </select></div>
            <div><label style={lbl}>Price fallback line</label>
              <select style={input} value={form.fallback} onChange={e => setForm(f => ({ ...f, fallback: e.target.value }))}>
                <option value="">None (native prices only)</option>
                {listTenants().map(t => <option key={t.id} value={t.id}>{t.branding.lineLabel}</option>)}
              </select></div>
            <div><label style={lbl}>Pages (optional)</label>
              <input style={input} placeholder="e.g. 109-262" value={form.pages} onChange={e => setForm(f => ({ ...f, pages: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: 11 }} />
            <button onClick={runIngest} disabled={!file || !form.name.trim()}
              style={{ fontSize: 11, fontWeight: 700, padding: '5px 14px', cursor: 'pointer', border: 'none', borderRadius: 4, background: C.accent, color: '#fff' }}>
              Ingest price book
            </button>
            {busy && <span style={{ fontSize: 11, color: report?.report?.problems?.length ? C.danger : C.dim }}>{busy}</span>}
          </div>
          <p style={{ fontSize: 10, color: C.dim, margin: '8px 0 0' }}>
            Parses W.W.-style width × height price matrices (the format Eclipse, Shiloh and Aspect ship). The validator
            rejects duplicate-price conflicts and thin extractions. New lines live on this device — download the package
            JSON to make one permanent for every device.
          </p>

          {report && (
            <div style={{ marginTop: 10, padding: 8, border: `1px solid ${report.report.problems.length ? C.danger : '#9bb88f'}`, borderRadius: 6, background: '#fff', fontSize: 11.5 }}>
              <b>{report.report.count} SKUs</b> · by type {Object.entries(report.report.byType).map(([k, v]) => `${k}:${v}`).join(' ')}
              <div style={{ color: C.dim, marginTop: 3 }}>samples: {report.report.samples.join(' · ')}</div>
              {report.report.problems.slice(0, 6).map((p, i) => <div key={i} style={{ color: C.danger }}>✗ {p}</div>)}
              {!report.report.problems.length && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={save} style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 16px', cursor: 'pointer', border: 'none', borderRadius: 4, background: '#3a7d44', color: '#fff' }}>
                    ✓ Save &amp; switch to this line
                  </button>
                  <button onClick={download} style={{ fontSize: 11.5, padding: '5px 12px', cursor: 'pointer', border: `1px solid ${C.border}`, borderRadius: 4, background: '#fff' }}>
                    ⤓ Download package JSON
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

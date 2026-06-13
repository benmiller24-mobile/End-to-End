/**
 * Floorplan import — photo / scan / design-PDF → room input (or full design).
 * ===========================================================================
 * Two engines behind one uploader:
 *  · Design PDFs with a text layer (Cyncly/2020 exports) parse DETERMINISTICALLY
 *    via floorplanVector — walls, lengths, and every placed cabinet — enabling
 *    the competitive re-quote workflow with zero AI cost.
 *  · Everything else (photos, scans, raster plans) goes to /api/floorplan
 *    (Claude vision) with per-measurement confidence grades.
 * Either way the result lands in a REVIEW step the designer edits and applies;
 * imported dimensions arrive as customer-supplied (not field-verified), so the
 * order-readiness gate keeps protecting the order.
 */
import React, { useRef, useState } from 'react';
import { extractPositionedPages, looksLikeDesignPdf, parseDesignPdf } from './floorplanVector.js';

const C = { accent: '#b8944e', danger: '#c0392b', ok: '#3a7d44', dim: '#8a8a8a', border: '#e4ddd2' };
const btn = (solid) => ({
  fontSize: 11.5, fontWeight: 700, padding: '5px 14px', cursor: 'pointer', borderRadius: 4,
  border: solid ? 'none' : `1px solid ${C.border}`, background: solid ? C.accent : '#fff', color: solid ? '#fff' : '#444',
});
const GRADE = {
  printed: { label: 'printed', bg: '#e7f0e4', fg: '#3a7d44' },
  scaled: { label: 'scaled', bg: '#fdf3e0', fg: '#9a6d1a' },
  guessed: { label: 'guessed', bg: '#fbe9e7', fg: '#c0392b' },
  vector: { label: 'from drawing', bg: '#e7f0e4', fg: '#3a7d44' },
};
const Badge = ({ g }) => {
  const s = GRADE[g] || GRADE.guessed;
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: s.bg, color: s.fg, textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</span>;
};

async function pdfDoc(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
}
async function renderPage(doc, pageNo, targetLongEdge) {
  const page = await doc.getPage(pageNo);
  const v1 = page.getViewport({ scale: 1 });
  const scale = targetLongEdge / Math.max(v1.width, v1.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}
async function imageToCanvas(file, targetLongEdge) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, targetLongEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

/** Mini SVG preview of the wall chain (right-angle walk) + island. */
function ChainPreview({ walls, island }) {
  if (!walls.length) return null;
  // Walk: wall A heads +x, each next wall turns left (counterclockwise room).
  const pts = [{ x: 0, y: 0 }];
  let dir = 0; // 0:+x 1:-y(up in svg) 2:-x 3:+y
  const D = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  const segs = [];
  for (const w of walls) {
    const p = pts[pts.length - 1];
    const q = { x: p.x + D[dir][0] * w.length, y: p.y + D[dir][1] * w.length };
    segs.push({ p, q, id: w.id, len: w.length });
    pts.push(q); dir = (dir + 1) % 4;
  }
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const pad = 18, w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys) || 40;
  const sc = 200 / Math.max(w, h, 1);
  const ox = -Math.min(...xs), oy = -Math.min(...ys);
  return (
    <svg width={(w * sc) + pad * 2} height={(h * sc) + pad * 2} style={{ background: '#fcfaf6', border: `1px solid ${C.border}`, borderRadius: 4 }}>
      {segs.map(s => (
        <g key={s.id}>
          <line x1={(s.p.x + ox) * sc + pad} y1={(s.p.y + oy) * sc + pad} x2={(s.q.x + ox) * sc + pad} y2={(s.q.y + oy) * sc + pad}
            stroke="#6b5b3e" strokeWidth={5} strokeLinecap="square" />
          <text x={((s.p.x + s.q.x) / 2 + ox) * sc + pad} y={((s.p.y + s.q.y) / 2 + oy) * sc + pad - 6}
            fontSize={10} fill="#6b5b3e" textAnchor="middle">{s.id}: {s.len}"</text>
        </g>
      ))}
      {island && <rect x={(w * sc) / 2 + pad - (island.length * sc) / 2} y={(h * sc) / 2 + pad - (island.depth * sc) / 2}
        width={island.length * sc} height={island.depth * sc} fill="#e9dfc8" stroke="#6b5b3e" />}
    </svg>
  );
}

export default function FloorplanImport({ brand, onApplyRoom, onApplyDesign }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [mode, setMode] = useState('idle');       // idle | pages | image | review
  const [pages, setPages] = useState([]);         // [{pageNo, thumbUrl}]
  const [docRef, setDocRef] = useState(null);
  const [canvas, setCanvas] = useState(null);     // chosen page / image canvas
  const [calib, setCalib] = useState({ pts: [], inches: '' });
  const [hints, setHints] = useState('');
  const [review, setReview] = useState(null);     // { source, walls, appliances, island, items?, notes, problems }
  const imgRef = useRef(null);

  const reset = () => { setMode('idle'); setPages([]); setDocRef(null); setCanvas(null); setCalib({ pts: [], inches: '' }); setReview(null); setBusy(''); };

  const onFile = async (file) => {
    if (!file) return;
    reset(); setOpen(true);
    try {
      if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
        setBusy('Reading PDF…');
        const positioned = await extractPositionedPages(file, (i, n) => setBusy(`Reading page ${i}/${n}…`));
        if (looksLikeDesignPdf(positioned, brand)) {
          setBusy('Design drawing detected — rebuilding the kitchen from its labels…');
          const r = parseDesignPdf(positioned, brand);
          if (r.walls.length) {
            setReview({
              source: 'vector',
              layoutType: r.layoutType,
              walls: r.walls.map(w => ({ ...w, confidence: 'vector' })),
              appliances: [], island: r.island,
              items: [...r.wallItems, ...r.islandItems.map(it => ({ ...it, wall: '__island__' }))],
              notes: 'Rebuilt deterministically from the drawing’s cabinet labels and printed dimension chains.',
              problems: r.report.problems,
              edges: r.report.edges,
            });
            setMode('review'); setBusy('');
            return;
          }
        }
        // Raster / no labels → page picker for the vision path.
        const doc = await pdfDoc(file);
        const thumbs = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const c = await renderPage(doc, i, 180);
          thumbs.push({ pageNo: i, thumbUrl: c.toDataURL('image/png') });
          setBusy(`Preparing page ${i}/${doc.numPages}…`);
        }
        setDocRef(doc); setPages(thumbs); setMode('pages'); setBusy('Pick the floor-plan page.');
      } else {
        setBusy('Loading image…');
        setCanvas(await imageToCanvas(file, 2000));
        setMode('image'); setBusy('');
      }
    } catch (e) { setBusy(`Failed: ${e.message || e}`); }
  };

  const pickPage = async (pageNo) => {
    setBusy(`Rendering page ${pageNo}…`);
    setCanvas(await renderPage(docRef, pageNo, 2000));
    setMode('image'); setBusy('');
  };

  const onPreviewClick = (e) => {
    if (!imgRef.current || !canvas) return;
    const r = imgRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    setCalib(c => ({ ...c, pts: c.pts.length >= 2 ? [{ x: px, y: py }] : [...c.pts, { x: px, y: py }] }));
  };

  const runVision = async () => {
    try {
      setBusy('Sending to the design assistant…');
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);   // JPEG: ~10x smaller upload than PNG for scans
      const calibration = (calib.pts.length === 2 && Number(calib.inches) > 0)
        ? { pixels: Math.hypot(calib.pts[1].x - calib.pts[0].x, calib.pts[1].y - calib.pts[0].y), inches: Number(calib.inches) }
        : null;
      const payload = { image: dataUrl.split(',')[1], mediaType: 'image/jpeg', calibration, hints: hints || undefined };

      // Background job first (dense sheets can take 30-90s — past the sync
      // function limit); poll for the result. Falls back to the streaming
      // synchronous endpoint when background functions aren't available.
      let out = null;
      const id = (crypto.randomUUID && crypto.randomUUID()) || `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const job = await fetch('/api/floorplan-job-background', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      }).catch(() => null);
      if (job && (job.status === 202 || job.ok)) {
        const t0 = Date.now();
        while (Date.now() - t0 < 180000) {
          await new Promise(r => setTimeout(r, 2500));
          setBusy(`Reading the plan… ${Math.round((Date.now() - t0) / 1000)}s`);
          const res = await fetch(`/api/floorplan-result?id=${id}`).catch(() => null);
          if (!res) continue;
          const o = await res.json().catch(() => null);
          if (o && o.status !== 'pending') { out = o; break; }
        }
        if (!out) throw new Error('Extraction timed out after 3 minutes — try cropping to just the kitchen area.');
      } else {
        const res = await fetch('/api/floorplan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        out = await res.json();   // tolerant of the function's keep-alive whitespace prefix
        if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
      }
      if (out.error) throw new Error(out.error);
      const x = out.extraction;
      setReview({
        source: 'vision',
        layoutType: x.layoutType,
        walls: (x.walls || []).map(w => ({
          id: w.id, length: Math.round(w.lengthIn * 8) / 8, role: w.role, confidence: w.confidence,
          openings: (w.openings || []).map(o => ({
            type: o.type === 'archway' ? 'arch' : o.type,
            position: Math.round(o.positionIn * 8) / 8, width: Math.round(o.widthIn * 8) / 8,
            ...(o.sillHeightIn != null ? { sillHeight: o.sillHeightIn } : {}),
            ...(o.headHeightIn != null ? { headHeight: o.headHeightIn } : {}),
          })),
        })),
        appliances: (x.appliances || []).map(a => ({ type: a.type, width: Math.round(a.widthIn), wall: a.wall })),
        island: x.island ? { length: Math.round(x.island.lengthIn), depth: Math.round(x.island.depthIn) } : null,
        notes: x.notes, problems: [], ceilingHeight: x.ceilingHeightIn || null,
      });
      setMode('review'); setBusy('');
    } catch (e) { setBusy(`Extraction failed: ${e.message || e}`); }
  };

  const setWallField = (i, field, val) => setReview(r => {
    const walls = [...r.walls];
    walls[i] = { ...walls[i], [field]: field === 'length' ? Math.max(1, Number(val) || walls[i].length) : val };
    return { ...r, walls };
  });

  const apply = (withCabinets) => {
    if (!review) return;
    const KNOWN = ['range', 'cooktop', 'wall_oven', 'refrigerator', 'dishwasher', 'sink', 'microwave'];
    const payload = {
      layoutType: review.layoutType,
      walls: review.walls.map(w => ({ id: w.id, length: w.length, role: w.role || 'general', openings: w.openings || [] })),
      appliances: review.appliances.filter(a => KNOWN.includes(a.type)),
      island: review.island, ceilingHeight: review.ceilingHeight || null,
    };
    if (withCabinets && review.items?.length) onApplyDesign({ ...payload, items: review.items });
    else onApplyRoom(payload);
    reset(); setOpen(false);
  };

  return (
    <div style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fbf9f4', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#5d4d2e' }}>📐 Import a floorplan</span>
        <span style={{ fontSize: 10.5, color: C.dim }}>photo, scan, builder plan, or a competitor’s design PDF</span>
        <label style={{ ...btn(true), marginLeft: 'auto' }}>
          Choose file…
          <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
            onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {open && <button onClick={() => { reset(); setOpen(false); }} style={btn(false)}>× Close</button>}
      </div>
      {busy && <div style={{ fontSize: 11, color: busy.startsWith('Failed') || busy.startsWith('Extraction failed') ? C.danger : C.dim, marginTop: 6 }}>{busy}</div>}

      {open && mode === 'pages' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {pages.map(p => (
            <div key={p.pageNo} onClick={() => pickPage(p.pageNo)} style={{ cursor: 'pointer', textAlign: 'center' }}>
              <img src={p.thumbUrl} alt={`page ${p.pageNo}`} style={{ border: `1px solid ${C.border}`, borderRadius: 4, display: 'block' }} />
              <span style={{ fontSize: 10, color: C.dim }}>page {p.pageNo}</span>
            </div>
          ))}
        </div>
      )}

      {open && mode === 'image' && canvas && (
        <div style={{ marginTop: 10 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img ref={imgRef} src={canvas.toDataURL('image/png')} alt="floorplan"
              onClick={onPreviewClick}
              style={{ maxWidth: '100%', maxHeight: 420, border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'crosshair' }} />
            {imgRef.current && calib.pts.map((p, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: p.x / (canvas.width / imgRef.current.getBoundingClientRect().width) - 5,
                top: p.y / (canvas.height / imgRef.current.getBoundingClientRect().height) - 5,
                width: 10, height: 10, borderRadius: 5, background: C.accent, border: '2px solid #fff', pointerEvents: 'none',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, color: C.dim }}>
              Optional scale: click two points a known distance apart{calib.pts.length === 2 ? ' ✓' : ` (${calib.pts.length}/2)`}, then
            </span>
            <input type="number" placeholder='inches' value={calib.inches} onChange={e => setCalib(c => ({ ...c, inches: e.target.value }))}
              style={{ width: 70, fontSize: 11, padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 4 }} />
            <input placeholder="notes for the assistant (e.g. ceiling is 9 ft)" value={hints} onChange={e => setHints(e.target.value)}
              style={{ flex: 1, minWidth: 180, fontSize: 11, padding: '3px 8px', border: `1px solid ${C.border}`, borderRadius: 4 }} />
            <button onClick={runVision} style={btn(true)}>Extract with AI →</button>
          </div>
        </div>
      )}

      {open && mode === 'review' && review && (
        <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', minWidth: 280 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11.5 }}>
              <thead><tr style={{ color: C.dim, fontSize: 10, textAlign: 'left' }}>
                <th style={{ padding: 3 }}>Wall</th><th>Length (in)</th><th>Role</th><th>Openings</th><th>Source</th></tr></thead>
              <tbody>
                {review.walls.map((w, i) => (
                  <tr key={w.id}>
                    <td style={{ padding: 3, fontWeight: 700 }}>{w.id}</td>
                    <td><input type="number" step="0.125" value={w.length} onChange={e => setWallField(i, 'length', e.target.value)}
                      style={{ width: 78, fontSize: 11.5, padding: '2px 5px', border: `1px solid ${C.border}`, borderRadius: 4 }} /></td>
                    <td><select value={w.role || 'general'} onChange={e => setWallField(i, 'role', e.target.value)}
                      style={{ fontSize: 11, padding: '2px 4px', border: `1px solid ${C.border}`, borderRadius: 4 }}>
                      {['general', 'sink', 'range', 'fridge'].map(r => <option key={r}>{r}</option>)}</select></td>
                    <td style={{ textAlign: 'center' }}>{(w.openings || []).length || '—'}</td>
                    <td><Badge g={w.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!!review.appliances.length && (
              <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
                Appliances: {review.appliances.map(a => `${a.type} ${a.width}" → ${a.wall}`).join(' · ')}
              </div>
            )}
            {review.island && <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>Island: {review.island.length}" × {review.island.depth}"</div>}
            {review.items && <div style={{ fontSize: 11, color: C.ok, marginTop: 3 }}>✓ {review.items.length} cabinets recovered from the drawing</div>}
            {review.notes && <div style={{ fontSize: 10.5, color: C.dim, marginTop: 6 }}>{review.notes}</div>}
            {review.problems?.map((p, i) => <div key={i} style={{ fontSize: 10.5, color: C.danger }}>✗ {p}</div>)}
            <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
              Imported dimensions are customer-supplied until field-verified — quotes stay budget-grade and the order gate stays closed, exactly like hand-typed measurements.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {review.walls.length ? (<>
                {review.items?.length
                  ? <button onClick={() => apply(true)} style={{ ...btn(true), background: C.ok }}>✓ Rebuild room + cabinets</button>
                  : null}
                <button onClick={() => apply(false)} style={btn(true)}>✓ Apply room{review.items?.length ? ' only' : ''}</button>
              </>) : (
                <span style={{ fontSize: 11, color: C.danger, fontWeight: 700 }}>No walls recognized — this doesn’t look like a floorplan. See the note above.</span>
              )}
              <button onClick={reset} style={btn(false)}>Start over</button>
            </div>
          </div>
          <div><ChainPreview walls={review.walls} island={review.island} /></div>
        </div>
      )}
    </div>
  );
}

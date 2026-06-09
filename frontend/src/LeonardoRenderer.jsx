import React, { useState, useCallback } from 'react';

/**
 * LeonardoRenderer — AI Kitchen/Bath Rendering via Leonardo.ai API
 *
 * Generates a photorealistic rendering of the designed space using
 * Leonardo AI's image generation API. Builds a detailed prompt from
 * the solver output, material selections, appliance choices, and
 * countertop selection.
 *
 * The Leonardo API key is embedded server-side in the /api/leonardo Netlify
 * function (env var LEONARDO_API_KEY, with a fallback). The user never enters a
 * key; this component just POSTs the prompt and polls for the image — and only
 * when the user clicks "Generate AI Rendering".
 */

// ── Theme colors (match App.jsx) ──
const C = {
  bg: '#0f172a', surface: '#1e293b', border: '#334155',
  primary: '#3b82f6', accent: '#10b981', warn: '#f59e0b',
  text: '#f1f5f9', muted: '#94a3b8', dim: '#64748b', purple: '#8b5cf6',
};

/**
 * Build a design-ACCURATE Leonardo prompt from the actual solved layout —
 * the real construction, door style, finish, hood, island, appliances, windows
 * and countertop — plus a chosen camera viewpoint. This is what makes the
 * render depict THIS kitchen rather than a generic one.
 */
const DOOR_NAMES = {
  'MET-V': 'flat-panel slab', 'MET-H': 'horizontal-grain slab',
  'SHKR': 'classic shaker', 'SHK-M': 'shaker', 'ESSX': 'wide-rail shaker',
  'HNVR': 'recessed flat-panel', 'CONCORD': 'flat-panel', 'BRADFORD': 'shaker',
  'OXRP': 'raised-panel', 'KENDALL': 'beaded shaker', 'MALIBU': 'reeded',
};

function buildPrompt({ solverResult, materials, appliances, countertop, prefs, trim, construction, viewpoint }) {
  const P = [];
  const layout = solverResult?.layoutType || 'l-shape';
  const roomType = solverResult?.roomType || 'kitchen';
  const hasIsland = !!solverResult?.island || /island/.test(layout);
  const placements = solverResult?.placements || [];
  const appAt = (re) => placements.some(p => re.test((p.applianceType || p.sku || '').toLowerCase()));
  const hasWallOven = appAt(/oven|ov\d|^o\d/);
  const hasRange = appAt(/range/);
  const hasCooktop = appAt(/cooktop/);
  // windows
  const winCount = (solverResult?._inputWalls || solverResult?.walls || [])
    .reduce((n, w) => n + ((w.openings || []).filter(o => /window/.test(o.type || 'window')).length), 0);
  // seating stools
  const seats = solverResult?.seatingLayout?.seats || solverResult?.island?.seats ||
    (hasIsland ? Math.max(2, Math.floor(((solverResult?.island?.length) || 84) / 26)) : 0);

  // ── Camera / viewpoint ──
  const vp = {
    three_quarter: 'wide-angle three-quarter interior perspective from the room entrance showing the full layout',
    island_to_range: 'eye-level view from behind the island looking toward the cooking wall',
    straight_on: 'straight-on, perfectly frontal architectural elevation view of the cooking wall, symmetrical, no perspective distortion',
  }[viewpoint] || 'wide-angle three-quarter interior perspective';
  const roomDesc = /bath/.test(roomType) ? 'luxury bathroom' : 'high-end residential kitchen';
  P.push(`Professional architectural interior photograph, ${vp}, of a ${roomDesc}`);

  // ── Layout ──
  const layoutDesc = {
    'l-shape': 'L-shaped cabinet layout', 'u-shape': 'U-shaped cabinet layout',
    'galley': 'galley layout with parallel runs', 'single-wall': 'single-wall linear layout',
    'peninsula': 'layout with a breakfast peninsula', 'island': 'layout centered on a large island',
    'g-shape': 'G-shaped layout',
  }[layout] || layout;
  P.push(hasIsland && !/island|peninsula/.test(layout) ? `${layoutDesc} with a large central island` : layoutDesc);

  // ── Cabinetry construction + door + finish ──
  const wood = (materials?.species || 'white oak').toLowerCase();
  const finish = materials?.finishColor ? ` in a ${materials.finishColor.toLowerCase()} finish` : '';
  let constr;
  if (construction?.frame) {
    constr = construction.inset
      ? `framed inset cabinetry with doors set flush inside a visible face frame (${construction.label.toLowerCase()})`
      : `framed full-overlay cabinetry with a slim face-frame reveal`;
  } else {
    constr = prefs?.golaChannel
      ? 'frameless handleless slab cabinetry with integrated finger-pull (gola) channels, European style'
      : 'frameless full-overlay cabinetry, sleek European style';
  }
  const doorName = DOOR_NAMES[materials?.door] || 'shaker';
  P.push(`${constr}, ${doorName} ${wood} doors${finish}`);

  // ── Hood (the focal point) ──
  const hs = trim?.hoodStyle;
  let hood;
  if (hs === 'plaster') hood = 'a sculptural hand-troweled matte plaster range hood as the focal point';
  else hood = 'a stainless steel chimney range hood';
  if (trim?.rangeNiche === 'arched') hood += ', the range set into an arched plaster niche clad in handmade zellige tile';
  if (prefs?.featureHood) hood += ', featured on open wall with no cabinets flanking it';
  P.push(hood);

  // ── Backsplash ──
  P.push(trim?.backsplashStyle === 'full_slab'
    ? 'a full-height stone slab backsplash running counter to ceiling behind the cooktop'
    : 'a stone or tile backsplash');

  // ── Countertops ──
  if (countertop?.name) P.push(`${countertop.brand ? countertop.brand + ' ' : ''}${countertop.name} stone countertops`);
  else P.push('natural stone countertops');

  // ── Island detail ──
  if (hasIsland) {
    const islSpecies = (materials?.islandSpecies || materials?.species || wood).toLowerCase();
    let isl = `a large kitchen island in ${islSpecies}`;
    if (trim?.backsplashStyle === 'full_slab' || solverResult?.island?.endTreatment === 'waterfall') isl += ' with a waterfall stone edge';
    if (seats > 0) isl += `, ${seats} upholstered counter stools tucked under the overhang`;
    P.push(isl);
  }

  // ── Appliances + placement ──
  const brandNames = { subzero: 'Sub-Zero', wolf: 'Wolf', thermador: 'Thermador', fisherpaykel: 'Fisher & Paykel', miele: 'Miele', kitchenaid: 'KitchenAid', cove: 'Cove', gaggenau: 'Gaggenau' };
  const brands = [...new Set((appliances || []).map(a => brandNames[a.brand] || a.brand).filter(Boolean))];
  const fridgePaneled = prefs?.fridgePaneled !== false;
  const appBits = [];
  if (hasRange) appBits.push('a professional range under the hood');
  else if (hasCooktop) appBits.push('a cooktop under the hood');
  if (hasWallOven) appBits.push('double wall ovens stacked in a tall cabinet');
  appBits.push(fridgePaneled ? 'a panel-ready integrated refrigerator flush with the cabinetry' : 'a stainless steel refrigerator');
  if (appAt(/dishwasher/)) appBits.push(fridgePaneled ? 'a panel-ready dishwasher' : 'a stainless dishwasher');
  P.push(appBits.join(', ') + (brands.length ? ` (${brands.slice(0, 3).join(', ')})` : ''));

  // ── Windows + atmosphere ──
  if (winCount > 0) P.push(`${winCount === 1 ? 'a large window' : winCount + ' large windows'} bringing in natural daylight`);
  P.push('hardwood flooring, soft natural lighting, realistic shadows');
  P.push('architectural photography, photorealistic, 8K, interior design magazine quality');

  return P.join(', ');
}

/**
 * Generate an image via the server-side /api/leonardo proxy (key stays on the
 * server). Creates a generation, then polls until the image is ready.
 */
async function generateImage(prompt) {
  const createRes = await fetch('/api/leonardo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!createRes.ok) {
    const e = await createRes.json().catch(() => ({}));
    throw new Error(e.error || `Generation request failed (${createRes.status})`);
  }
  const { generationId } = await createRes.json();
  if (!generationId) throw new Error('No generation ID returned');

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`/api/leonardo?id=${encodeURIComponent(generationId)}`);
    if (!pollRes.ok) continue;
    const pd = await pollRes.json();
    if (pd.status === 'COMPLETE' && pd.url) return pd.url;
    if (pd.status === 'FAILED') throw new Error('Leonardo generation failed');
  }
  throw new Error('Generation timed out after ~2 minutes');
}

export default function LeonardoRenderer({ solverResult, materials, selectedAppliances, countertopColor, prefs, trim, construction }) {
  const [viewpoint, setViewpoint] = useState('three_quarter');
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState('');

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);

    const generatedPrompt = buildPrompt({
      solverResult,
      materials,
      appliances: selectedAppliances,
      countertop: countertopColor,
      prefs, trim, construction, viewpoint,
    });
    setPrompt(generatedPrompt);

    try {
      const url = await generateImage(generatedPrompt);
      setImageUrl(url);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [solverResult, materials, selectedAppliances, countertopColor, prefs, trim, construction, viewpoint]);

  const panelStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 };
  const inputStyle = { width: '100%', padding: '7px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        AI Rendering — Leonardo.ai
      </div>

      {/* Viewpoint selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, color: C.dim, marginBottom: 4 }}>Camera viewpoint</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'three_quarter', label: '3/4 Perspective' },
            { v: 'island_to_range', label: 'From Island' },
            { v: 'straight_on', label: 'Front Elevation' },
          ].map(o => {
            const active = viewpoint === o.v;
            return (
              <button key={o.v} onClick={() => setViewpoint(o.v)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${active ? C.primary : C.border}`, background: active ? '#1e3a5f' : 'transparent', color: active ? C.text : C.muted }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 5 }}>
          The prompt is built from your actual design — construction, door style, finish, hood, island, appliances, windows and countertop.
          Note: AI image generation depicts the design faithfully but is not a dimensionally-exact CAD render.
        </div>
      </div>

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={loading}
        style={{
          width: '100%', padding: 12, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? C.border : `linear-gradient(135deg, ${C.purple}, ${C.primary})`,
          color: '#fff', opacity: 1,
        }}>
        {loading ? 'Generating rendering... (30-60 seconds)' : 'Generate AI Rendering'}
      </button>

      {/* Prompt preview */}
      {prompt && (
        <div style={{ marginTop: 12, padding: 10, background: C.bg, borderRadius: 6, fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
          <strong style={{ color: C.muted }}>Prompt:</strong> {prompt}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 12, padding: 10, background: '#451a1a', border: `1px solid ${C.warn}`, borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Result image */}
      {imageUrl && (
        <div style={{ marginTop: 16 }}>
          <img src={imageUrl} alt="AI Kitchen Rendering"
            style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: C.dim }}>Generated by Leonardo AI — Kino XL (PhotoReal v2)</span>
            <a href={imageUrl} download="eclipse_rendering.jpg" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: C.primary, textDecoration: 'none', fontWeight: 600 }}>
              Download Full Resolution
            </a>
          </div>
        </div>
      )}

      {/* Placeholder when no image yet */}
      {!imageUrl && !loading && (
        <div style={{
          marginTop: 16, padding: 40, background: C.bg, borderRadius: 8,
          border: `2px dashed ${C.border}`, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🎨</div>
          <div style={{ fontSize: 13, color: C.dim }}>AI rendering will appear here</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            Uses your layout, materials, appliances, and countertop selections to generate a photorealistic visualization
          </div>
        </div>
      )}
    </div>
  );
}

// Export the prompt builder for testing
export { buildPrompt };

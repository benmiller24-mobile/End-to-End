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
 * Build a detailed Leonardo AI prompt from design selections
 */
function buildPrompt({ layoutType, roomType, materials, appliances, countertop, prefs }) {
  const parts = [];

  // Scene type
  const roomDesc = roomType === 'master_bath' ? 'luxury master bathroom'
    : roomType === 'vanity' ? 'elegant bathroom'
    : 'high-end residential kitchen';
  parts.push(`Professional interior design photograph of a ${roomDesc}`);

  // Layout
  const layoutDesc = {
    'l-shape': 'L-shaped layout',
    'u-shape': 'U-shaped layout',
    'galley': 'galley-style parallel layout',
    'single-wall': 'single-wall linear layout',
    'peninsula': 'layout with breakfast peninsula',
  }[layoutType] || layoutType;
  parts.push(`with ${layoutDesc}`);

  // Cabinetry
  if (materials?.species) {
    const wood = materials.species.toLowerCase();
    const isGola = prefs?.golaChannel;
    const style = isGola ? 'sleek handleless Gola-channel' : 'shaker-style';
    parts.push(`featuring ${style} cabinetry in ${wood}`);
  }

  // Construction detail
  if (materials?.door) {
    const doorMap = {
      'MET-V': 'flat-panel modern doors',
      'ESX-M': 'European slab doors with J-pull detail',
      'HNVR-FP': 'Hanover flat-panel thermofoil doors',
      'SHK-M': 'classic shaker doors',
    };
    const doorDesc = doorMap[materials.door] || 'custom door style';
    parts.push(`with ${doorDesc}`);
  }

  // Countertops
  if (countertop?.name && countertop?.brand) {
    parts.push(`${countertop.brand} ${countertop.name} countertops`);
  }

  // Appliances
  if (appliances?.length > 0) {
    const brands = [...new Set(appliances.map(a => a.brand))];
    const brandNames = brands.map(b => {
      const nameMap = { subzero: 'Sub-Zero', wolf: 'Wolf', thermador: 'Thermador', fisherpaykel: 'Fisher & Paykel', miele: 'Miele', kitchenaid: 'KitchenAid' };
      return nameMap[b] || b;
    });
    const finish = appliances[0]?.finish === 'panel' ? 'panel-ready integrated' : 'stainless steel';
    parts.push(`with ${brandNames.join(' and ')} ${finish} appliances`);
  }

  // Atmosphere
  parts.push('natural lighting from large windows');
  parts.push('hardwood flooring');
  parts.push('professional architectural photography');
  parts.push('8K resolution, photorealistic, interior design magazine quality');

  return parts.join(', ');
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

export default function LeonardoRenderer({ solverResult, materials, selectedAppliances, countertopColor, prefs }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState('');

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImageUrl(null);

    const generatedPrompt = buildPrompt({
      layoutType: solverResult?.layoutType,
      roomType: solverResult?.roomType,
      materials,
      appliances: selectedAppliances,
      countertop: countertopColor,
      prefs,
    });
    setPrompt(generatedPrompt);

    try {
      const url = await generateImage(generatedPrompt);
      setImageUrl(url);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [solverResult, materials, selectedAppliances, countertopColor, prefs]);

  const panelStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 };
  const inputStyle = { width: '100%', padding: '7px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        AI Rendering — Leonardo.ai
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

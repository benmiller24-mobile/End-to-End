import React, { useState, useCallback } from 'react';

/**
 * LeonardoRenderer — AI Kitchen/Bath Rendering via Leonardo.ai API
 *
 * Generates a photorealistic rendering of the designed space using
 * Leonardo AI's image generation API. Builds a detailed prompt from
 * the solver output, material selections, appliance choices, and
 * countertop selection.
 *
 * SETUP: Set your Leonardo AI API key in the LEONARDO_API_KEY constant
 * or provide it via the UI input. Get a key at https://leonardo.ai
 */

// ── Placeholder: Replace with your Leonardo AI API key ──
const LEONARDO_API_KEY = '';

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
 * Call Leonardo AI API to generate an image
 */
async function generateImage(apiKey, prompt) {
  // Step 1: Create generation
  const createRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      modelId: 'e71a1c2f-4f80-4800-934f-2c68979d8cc8', // Leonardo Kino XL
      width: 1360,
      height: 768,
      num_images: 1,
      guidance_scale: 7,
      alchemy: true,
      photoReal: true,
      photoRealVersion: 'v2',
      presetStyle: 'CINEMATIC',
      negative_prompt: 'blurry, low quality, distorted, cartoon, anime, illustration, painting, sketch, watermark, text, logo',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Leonardo API error: ${createRes.status} — ${err}`);
  }

  const createData = await createRes.json();
  const generationId = createData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error('No generation ID returned');

  // Step 2: Poll for result
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const images = pollData.generations_by_pk?.generated_images;
    if (images && images.length > 0) {
      return images[0].url;
    }

    const status = pollData.generations_by_pk?.status;
    if (status === 'FAILED') throw new Error('Leonardo generation failed');
  }

  throw new Error('Generation timed out after 90 seconds');
}

export default function LeonardoRenderer({ solverResult, materials, selectedAppliances, countertopColor, prefs }) {
  const [apiKey, setApiKey] = useState(LEONARDO_API_KEY);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prompt, setPrompt] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      setError('Please enter your Leonardo AI API key');
      return;
    }

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
      const url = await generateImage(apiKey, generatedPrompt);
      setImageUrl(url);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [apiKey, solverResult, materials, selectedAppliances, countertopColor, prefs]);

  const panelStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 };
  const inputStyle = { width: '100%', padding: '7px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        AI Rendering — Leonardo.ai
      </div>

      {/* API Key input */}
      {!LEONARDO_API_KEY && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, color: C.dim, marginBottom: 4 }}>Leonardo AI API Key</label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            placeholder="Enter your Leonardo AI API key..."
            style={inputStyle} />
          <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
            Get your API key at <a href="https://leonardo.ai" target="_blank" rel="noopener noreferrer" style={{ color: C.primary }}>leonardo.ai</a> — Keys are not stored or transmitted anywhere except to Leonardo's API.
          </div>
        </div>
      )}

      {/* Generate button */}
      <button onClick={handleGenerate} disabled={loading || !apiKey}
        style={{
          width: '100%', padding: 12, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
          background: loading ? C.border : `linear-gradient(135deg, ${C.purple}, ${C.primary})`,
          color: '#fff', opacity: !apiKey ? 0.5 : 1,
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

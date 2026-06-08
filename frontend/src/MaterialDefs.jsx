import React from 'react';
import textureManifest from './textureManifest.json';

// Real Cyncly finish photo for a species + finish color (else null → procedural).
const _cn = (x) => (x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function textureURL(species, finishColor, horizontal = false) {
  const sp = textureManifest[species];
  if (!sp) return null;
  const k = _cn(finishColor);
  const e = (k && sp[k]) ? sp[k] : Object.values(sp)[0];   // {f, g} ; g = V|H|F grain
  if (!e) return null;
  // Doors want VERTICAL grain by default; rotate a swatch 90° when its native
  // grain doesn't match the requested direction (toggle → horizontal).
  const rotate = horizontal ? (e.g === 'H' ? 0 : 90) : (e.g === 'H' ? 90 : 0);
  return { url: '/textures/' + e.f, rotate };
}

// ════════════════════════════════════════════════════════════════════════
// MaterialDefs — rich (PRONORM-style) SVG <pattern>/<gradient> fills for
// elevations: per-species wood grain, per-stone countertop, stainless steel.
// All deterministic (seeded) so SSR + re-render are stable. IDs are suffixed
// per wall so multiple wall <svg>s never collide.
// ════════════════════════════════════════════════════════════════════════

// Small deterministic RNG so grain/veins are stable across renders.
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5; let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ── Wood species → tones + family ───────────────────────────────────────
// base/light/dark = vertical sheen gradient; grain = streak color.
const WOOD = {
  walnut:   { base: '#6b4f3a', light: '#876749', dark: '#473325', grain: '#3a2a1d', cathedral: false },
  oak:      { base: '#c7a877', light: '#dcc298', dark: '#a4865c', grain: '#8f7048', cathedral: true  },
  redoak:   { base: '#c99a78', light: '#e0b894', dark: '#a4785a', grain: '#8e6446', cathedral: true  },
  maple:    { base: '#e4cda4', light: '#f1e2c4', dark: '#d2b687', grain: '#c0a478', cathedral: false },
  cherry:   { base: '#9a5640', light: '#b67355', dark: '#793f2c', grain: '#622f20', cathedral: false },
  hickory:  { base: '#caa173', light: '#e7c89b', dark: '#8a5e3c', grain: '#7a4e30', cathedral: true  },
  alder:    { base: '#bf8a64', light: '#d6a884', dark: '#9c6c49', grain: '#84583a', cathedral: false },
  poplar:   { base: '#d7d1ae', light: '#e8e4c7', dark: '#beb994', grain: '#aaa682', cathedral: false },
  painted:  { base: '#eceae5', light: '#f6f5f2', dark: '#dcd9d3', grain: '#cfccc5', cathedral: false, solid: true },
  laminate: { base: '#d9d4ce', light: '#e7e3de', dark: '#c4bfb8', grain: '#b6b1aa', cathedral: false, solid: true },
  noir:     { base: '#2b2b2e', light: '#3c3c40', dark: '#1b1b1d', grain: '#141416', cathedral: false, solid: true },
};
const SPECIES_FAMILY = (sp = '') => {
  const s = sp.toLowerCase();
  if (s.includes('walnut')) return 'walnut';
  if (s.includes('rift') || s.includes('qs ') || s.includes('quarter') || s.includes('white oak')) return 'oak';
  if (s.includes('red oak')) return 'redoak';
  if (s.includes('oak')) return 'oak';
  if (s.includes('maple')) return 'maple';
  if (s.includes('cherry')) return 'cherry';
  if (s.includes('hickory')) return 'hickory';
  if (s.includes('alder')) return 'alder';
  if (s.includes('poplar')) return 'poplar';
  if (s.includes('noir') || s.includes('black')) return 'noir';
  if (s.includes('paint')) return 'painted';
  if (s.includes('tfl') || s.includes('hpl') || s.includes('acrylic') || s === 'pv' || s.includes('laminate') || s.includes('polymer')) return 'laminate';
  return 'oak';
};
export const speciesTone = (sp) => WOOD[SPECIES_FAMILY(sp)] || WOOD.oak;

// ── Countertop classification ───────────────────────────────────────────
const lum = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0.8;
  const n = parseInt(m[1], 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const shade = (hex, f) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '#cccccc'); const n = parseInt((m ? m[1] : 'cccccc'), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= (1 + f); g *= (1 + f); b *= (1 + f); }
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
};
export function classifyStone(color) {
  if (!color) return null;
  const t = `${color.collection || ''} ${color.name || ''}`.toLowerCase();
  const base = color.hex || '#eeeeee';
  let type = 'quartz';
  if (/marble|calacatta|statuario|carrara|brittanicca|torquay|inverness|empira|estatuario|alexandra/.test(t)) type = 'marble';
  else if (/faux wood|boho|summerdale|wood/.test(t)) type = 'wood';
  else if (/industrial|concrete|steel|iron/.test(t)) type = 'concrete';
  else if (lum(base) < 0.28) type = 'dark';
  return { type, base, name: color.name, brand: color.brand };
}

// Fill-string helpers (reference the per-wall ids below)
export const woodFill   = (sfx) => `url(#wood-${sfx})`;
export const stoneFill  = (sfx) => `url(#stone-${sfx})`;
export const steelFill  = (sfx) => `url(#steel-${sfx})`;

// ── Wood <pattern> (vertical grain, continuous via userSpaceOnUse) ──────
function WoodPattern({ sfx, tone }) {
  const W = 46, H = 150;
  const r = rng(hashStr(sfx + tone.base) || 7);
  const streaks = [];
  if (!tone.solid) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (W / n) + (r() - 0.5) * 2.2;
      const amp = 0.8 + r() * 1.8, ph = r() * 6.28;
      const d = `M ${x.toFixed(1)} 0 C ${(x + Math.sin(ph) * amp).toFixed(1)} ${H * 0.33}, ${(x + Math.sin(ph + 1.7) * amp).toFixed(1)} ${H * 0.66}, ${(x + Math.sin(ph + 3.1) * amp * 0.6).toFixed(1)} ${H}`;
      const dark = r() > 0.45;
      streaks.push(<path key={`g${i}`} d={d} fill="none"
        stroke={dark ? tone.grain : tone.light}
        strokeWidth={(0.35 + r() * 0.8).toFixed(2)}
        opacity={dark ? (0.18 + r() * 0.22).toFixed(2) : (0.12 + r() * 0.16).toFixed(2)} />);
    }
    if (tone.cathedral) {
      for (let c = 0; c < 2; c++) {
        const cx = 8 + c * 26, cy = 20 + c * 70;
        for (let a = 0; a < 4; a++) {
          const rr = 4 + a * 3.2;
          streaks.push(<path key={`c${c}_${a}`}
            d={`M ${cx - rr} ${cy + rr * 2} Q ${cx} ${cy - rr * 1.3} ${cx + rr} ${cy + rr * 2}`}
            fill="none" stroke={tone.grain} strokeWidth={0.35} opacity={0.14} />);
        }
      }
    }
  }
  return (
    <pattern id={`wood-${sfx}`} patternUnits="userSpaceOnUse" width={W} height={H}>
      <rect x="0" y="0" width={W} height={H} fill={`url(#woodgrad-${sfx})`} />
      {streaks}
    </pattern>
  );
}

// ── Stone <pattern> per type ────────────────────────────────────────────
function StonePattern({ sfx, stone }) {
  const W = 160, H = 160;
  const base = stone.base, type = stone.type;
  const seed = (hashStr(sfx + base) % 90) + 1;
  // Per-type feTurbulence params: [baseFreqX, baseFreqY, octaves, alphaSlope, opacity]
  const P = {
    marble:   [0.015, 0.022, 5, -2.4, 0.55],
    quartz:   [0.085, 0.085, 3, -3.2, 0.45],
    concrete: [0.012, 0.012, 4, -1.4, 0.35],
    dark:     [0.020, 0.026, 5, -2.0, 0.45],
    solid:    [0.010, 0.010, 3, -1.2, 0.25],
  }[type] || [0.05, 0.05, 3, -2.5, 0.4];
  const [bfx, bfy, oct, slope, op] = P;
  const veinColor = type === 'marble'
    ? (lum(base) > 0.6 ? shade(base, -0.32) : shade(base, 0.4))
    : shade(base, lum(base) > 0.5 ? -0.22 : 0.25);
  const fxId = `stonefx-${sfx}`;
  return (
    <>
      <filter id={fxId} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={`${bfx} ${bfy}`} numOctaves={oct} seed={seed} result="n" />
        <feColorMatrix in="n" type="matrix"
          values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${slope} 1.05`} result="a" />
        <feFlood floodColor={veinColor} result="c" />
        <feComposite in="c" in2="a" operator="in" />
      </filter>
      <pattern id={`stone-${sfx}`} patternUnits="userSpaceOnUse" width={W} height={H}>
        <rect x="0" y="0" width={W} height={H} fill={`url(#stonegrad-${sfx})`} />
        <rect x="0" y="0" width={W} height={H} filter={`url(#${fxId})`} opacity={op} />
      </pattern>
    </>
  );
}

export function MaterialDefs({ sfx, species, stone, finishColor, grainHorizontal = false }) {
  const tone = speciesTone(species);
  const st = stone || { type: 'quartz', base: '#e9e6e1' };
  const sBaseLt = shade(st.base, 0.06), sBaseDk = shade(st.base, -0.08);
  return (
    <defs>
      {/* wood: real Cyncly finish photo when available, else procedural grain */}
      {(() => {
        const tex = textureURL(species, finishColor, grainHorizontal);
        if (tex) {
          // square swatch tiled at ~36" so a door shows most of one photo;
          // rotate 90° around the tile centre to force the grain direction.
          const T = 80;
          const tr = tex.rotate ? `rotate(${tex.rotate} ${T / 2} ${T / 2})` : undefined;
          return (
            <pattern id={`wood-${sfx}`} patternUnits="userSpaceOnUse" width={T} height={T}>
              <image href={tex.url} x="0" y="0" width={T} height={T} transform={tr} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          );
        }
        return (
          <>
            <linearGradient id={`woodgrad-${sfx}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={tone.dark} />
              <stop offset="0.35" stopColor={tone.base} />
              <stop offset="0.6" stopColor={tone.light} />
              <stop offset="1" stopColor={tone.base} />
            </linearGradient>
            <WoodPattern sfx={sfx} tone={tone} />
          </>
        );
      })()}
      {/* stone base sheen */}
      <linearGradient id={`stonegrad-${sfx}`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor={sBaseLt} />
        <stop offset="0.5" stopColor={st.base} />
        <stop offset="1" stopColor={sBaseDk} />
      </linearGradient>
      <StonePattern sfx={sfx} stone={st} />
      {/* ambient-occlusion gradient: dark at an edge → transparent (light from top) */}
      <linearGradient id={`aoDown-${sfx}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity="0.55" />
        <stop offset="1" stopColor="#000000" stopOpacity="0" />
      </linearGradient>
      {/* brushed stainless */}
      <linearGradient id={`steel-${sfx}`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c4c8cc" />
        <stop offset="0.18" stopColor="#eef1f3" />
        <stop offset="0.5" stopColor="#d0d4d8" />
        <stop offset="0.82" stopColor="#eef1f3" />
        <stop offset="1" stopColor="#bcc0c4" />
      </linearGradient>
    </defs>
  );
}

export default MaterialDefs;

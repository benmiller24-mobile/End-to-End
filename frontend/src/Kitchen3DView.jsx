import React, { useRef, useEffect, useState, useCallback } from 'react';
import { buildPrompt } from './LeonardoRenderer.jsx';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Deterministic 3D view built straight from the solver geometry. Every cabinet
//    is a box at its exact solved position/size, so the massing is 100% faithful
//    to the floor plan + elevations (no AI guessing). Reuses the floor plan's
//    per-wall world frames so placement matches the 2D views exactly.

const WALL_T = 6, BASE_D = 24.875, UPPER_D = 13.875, AISLE = 42;
const TOE = 4.5, BASE_TOP = 34.5, CTR = 1.5, COUNTER_AFF = 36;
const UPPER_BOT = 54;

// Finish/species → approximate wood color
const WOOD_HEX = {
  'soft white': '#eae6dc', 'arctic': '#eef0ee', 'polar': '#e9ebe7', 'pure white': '#f2f1ec',
  'dovetail gray': '#9a9a93', 'repose gray': '#b9b4ab', 'iron ore': '#3b3b3d', 'naval': '#2c3b4d',
  'evergreen fog': '#9aa08c', 'clary sage': '#9aa183', 'natural': '#c8a26a', 'walnut': '#6b4a30',
  'white oak': '#c9a877', 'rift cut white oak': '#caa97a', 'cherry': '#8a4f33', 'maple': '#d8b483',
  'espresso': '#3a2a20', 'carbon': '#33312e',
};
function woodColor(species, finish) {
  const f = (finish || '').toLowerCase().trim();
  if (WOOD_HEX[f]) return WOOD_HEX[f];
  const s = (species || 'white oak').toLowerCase();
  if (s.includes('walnut')) return '#6b4a30';
  if (s.includes('cherry')) return '#8a4f33';
  if (s.includes('maple')) return '#d8b483';
  if (s.includes('oak')) return '#c9a877';
  return '#c8a26a';
}

export default function Kitchen3DView({ solverResult, materials, construction, countertopColor, trim, prefs, selectedAppliances }) {
  const mountRef = useRef(null);
  const [err, setErr] = useState(null);
  const [aiUrl, setAiUrl] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState(null);
  const [strength, setStrength] = useState(0.45);

  // Photoreal pass: capture the accurate 3D render and img2img it through Leonardo
  // (keeps geometry, adds realism). Server holds the key + does upload/poll proxy.
  const generatePhotoreal = useCallback(async () => {
    setAiErr(null); setAiUrl(null);
    const three = mountRef.current && mountRef.current._three;
    if (!three) { setAiErr('3D view not ready yet.'); return; }
    setAiLoading(true);
    try {
      three.renderer.render(three.scene, three.camera);
      const b64 = three.renderer.domElement.toDataURL('image/png').split(',')[1];
      const prompt = buildPrompt({
        solverResult, materials, appliances: selectedAppliances || [],
        countertop: countertopColor, prefs: prefs || {}, trim, construction, viewpoint: 'three_quarter',
      });
      const cr = await fetch('/api/leonardo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, initImage: b64, mode: 'img2img', controlnetWeight: strength }),
      });
      if (!cr.ok) { const e = await cr.json().catch(() => ({})); throw new Error(e.error || `Request failed (${cr.status})`); }
      const { generationId } = await cr.json();
      if (!generationId) throw new Error('No generation id');
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const pr = await fetch(`/api/leonardo?id=${encodeURIComponent(generationId)}`);
        if (!pr.ok) continue;
        const pd = await pr.json();
        if (pd.status === 'COMPLETE' && pd.url) { setAiUrl(pd.url); break; }
        if (pd.status === 'FAILED') throw new Error('Leonardo generation failed');
      }
    } catch (e) { setAiErr(e.message); }
    setAiLoading(false);
  }, [solverResult, materials, construction, countertopColor, trim, prefs, selectedAppliances, strength]);

  useEffect(() => {
    if (!solverResult || !mountRef.current) return;
    const mount = mountRef.current;
    let raf, renderer, controls;
    try {
      const W = mount.clientWidth || 900, H = Math.max(480, Math.round((mount.clientWidth || 900) * 0.6));

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#eceae6');

      const camera = new THREE.PerspectiveCamera(45, W / H, 1, 5000);
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      // ── Materials ──
      const woodCol = woodColor(materials?.species, materials?.finishColor);
      const islandCol = materials?.islandSpecies ? woodColor(materials.islandSpecies, null) : woodCol;
      const woodMat = new THREE.MeshStandardMaterial({ color: woodCol, roughness: 0.62, metalness: 0.04 });
      const islandMat = new THREE.MeshStandardMaterial({ color: islandCol, roughness: 0.62, metalness: 0.04 });
      const stoneCol = (countertopColor && /black|carbon|soap|honed/i.test(countertopColor.name || '')) ? '#3c3f43' : '#ece9e2';
      const stoneMat = new THREE.MeshStandardMaterial({ color: stoneCol, roughness: 0.22, metalness: 0.02 });
      const steelMat = new THREE.MeshStandardMaterial({ color: '#cdd2d6', roughness: 0.34, metalness: 0.85 });
      const wallMat = new THREE.MeshStandardMaterial({ color: '#efece6', roughness: 0.95 });
      const floorMat = new THREE.MeshStandardMaterial({ color: '#b08a5e', roughness: 0.7 });
      const plasterMat = new THREE.MeshStandardMaterial({ color: '#efe9e1', roughness: 0.9 });

      // ── Wall world frames (matches FloorPlanView) ──
      const walls = (solverResult.walls || []).map(w => ({ id: w.wallId || w.id, length: w.length || 0, cabinets: w.cabinets || [], openings: w.openings || [] }));
      const layoutType = solverResult.layoutType || 'l-shape';
      const margin = 0;
      const wp = [];
      if (walls.length === 1) wp.push({ id: walls[0].id, x: margin, y: margin, angle: 0, length: walls[0].length });
      else if (walls.length === 2) {
        const [wA, wB] = walls;
        if (/galley/.test(layoutType)) { wp.push({ id: wA.id, x: 0, y: 0, angle: 0, length: wA.length }); wp.push({ id: wB.id, x: 0, y: BASE_D + AISLE + BASE_D + WALL_T, angle: 0, length: wB.length }); }
        else { wp.push({ id: wA.id, x: 0, y: 0, angle: 0, length: wA.length }); wp.push({ id: wB.id, x: wA.length, y: 0, angle: 90, length: wB.length }); }
      } else if (walls.length >= 3) {
        const [wA, wB, wC] = walls;
        wp.push({ id: wA.id, x: 0, y: 0, angle: 0, length: wA.length });
        wp.push({ id: wB.id, x: wA.length, y: 0, angle: 90, length: wB.length });
        wp.push({ id: wC.id, x: wA.length, y: wB.length, angle: 180, length: wC.length });
      }
      const frameOf = id => wp.find(f => f.id === id);

      // room bounds
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      wp.forEach(f => {
        const a = f.angle * Math.PI / 180, ex = f.x + Math.cos(a) * f.length, ez = f.y + Math.sin(a) * f.length;
        minX = Math.min(minX, f.x, ex); maxX = Math.max(maxX, f.x, ex);
        minZ = Math.min(minZ, f.y, ez); maxZ = Math.max(maxZ, f.y, ez);
      });
      if (!isFinite(minX)) { minX = 0; maxX = 144; minZ = 0; maxZ = 120; }
      const roomW = maxX - minX || 144, roomD = (maxZ - minZ) || 120;
      // extend room interior for floor/back walls
      const cx0 = (minX + maxX) / 2, cz0 = (minZ + maxZ) / 2;
      const CEIL = solverResult.metadata?.ceilingHeight || 96;

      const root = new THREE.Group();
      // center the whole room at origin
      root.position.set(-cx0, 0, -cz0);
      scene.add(root);

      const addBox = (w, h, d, cx, cy, cz, rotY, mat, cast = true) => {
        if (w <= 0 || h <= 0 || d <= 0) return null;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(cx, cy, cz); m.rotation.y = rotY; m.castShadow = cast; m.receiveShadow = true;
        root.add(m); return m;
      };

      // place a box defined along a wall: pos along wall, width along wall, depth into room
      const placeOnWall = (f, posInch, widthInch, depthInch, yBot, yTop, mat) => {
        const a = f.angle * Math.PI / 180;
        const nx = -Math.sin(a), nz = Math.cos(a);           // inward normal
        const along = posInch + widthInch / 2;
        const cx = f.x + Math.cos(a) * along + nx * (depthInch / 2);
        const cz = f.y + Math.sin(a) * along + nz * (depthInch / 2);
        return addBox(widthInch, yTop - yBot, depthInch, cx, (yBot + yTop) / 2, cz, -a, mat);
      };

      // floor + a couple of back walls
      const floorPad = 40;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW + roomD + 240, roomD + roomW + 240), floorMat);
      floor.rotation.x = -Math.PI / 2; floor.position.set(cx0, 0, cz0); floor.receiveShadow = true; root.add(floor);
      // back wall planes behind each run
      wp.forEach(f => {
        const a = f.angle * Math.PI / 180, nx = -Math.sin(a), nz = Math.cos(a);
        const midAlong = f.length / 2;
        const cx = f.x + Math.cos(a) * midAlong - nx * (WALL_T / 2);
        const cz = f.y + Math.sin(a) * midAlong - nz * (WALL_T / 2);
        addBox(f.length, CEIL, WALL_T, cx, CEIL / 2, cz, -a, wallMat, false);
      });

      const isApp = c => !!(c.applianceType || c.type === 'appliance');
      const appType = c => (c.applianceType || '').toLowerCase();

      // ── BASE cabinets + appliances + counters ──
      walls.forEach(wd => {
        const f = frameOf(wd.id); if (!f) return;
        (wd.cabinets || []).filter(c => typeof c.position === 'number' && c.width > 0).forEach(c => {
          const at = appType(c);
          if (/refrigerator|fridge/.test(at)) {
            placeOnWall(f, c.position, c.width, BASE_D, 0, 84, (construction && materials && /panel/.test(materials?.fridge || '')) ? woodMat : steelMat);
            return;
          }
          if (/range|cooktop|dishwasher|oven/.test(at)) {
            const top = /dishwasher/.test(at) ? BASE_TOP : (/range/.test(at) ? 36 : BASE_TOP);
            placeOnWall(f, c.position, c.width, BASE_D, TOE, top, steelMat);
            if (!/range|cooktop/.test(at)) placeOnWall(f, c.position, c.width, BASE_D, BASE_TOP, COUNTER_AFF, stoneMat); // counter over DW
            return;
          }
          // wood base cabinet box (toe recess) + counter slab
          placeOnWall(f, c.position, c.width, BASE_D, TOE, BASE_TOP, woodMat);
          placeOnWall(f, c.position - 0.5, c.width + 1, BASE_D + 1, BASE_TOP, COUNTER_AFF, stoneMat);
        });
      });

      // ── UPPER cabinets ──
      (solverResult.uppers || []).forEach(u => {
        const f = frameOf(u.wallId || u.id); if (!f) return;
        (u.cabinets || []).filter(c => typeof c.position === 'number' && c.width > 0).forEach(c => {
          if (/^RH|range_hood|rangeHood/i.test(c.sku || '') || appType(c) === 'hood') return; // hood handled below
          const h = c._elev?.height || c.height || 30;
          placeOnWall(f, c.position, c.width, UPPER_D, UPPER_BOT, UPPER_BOT + h, woodMat);
        });
      });

      // ── TALL cabinets ──
      (solverResult.talls || []).forEach(t => {
        if (typeof t.position !== 'number') return;
        const f = frameOf(t.wall || t.wallId); if (!f) return;
        const h = t._elev?.height || t.height || 90;
        placeOnWall(f, t.position, t.width || 24, BASE_D, 0, h, /refrigerator|fridge/.test(appType(t)) ? steelMat : woodMat);
      });

      // ── HOOD (plaster or steel) over the range ──
      (solverResult.uppers || []).forEach(u => {
        const f = frameOf(u.wallId || u.id); if (!f) return;
        (u.cabinets || []).filter(c => /^RH|range_hood|rangeHood/i.test(c.sku || '') || appType(c) === 'hood').forEach(c => {
          const isPlaster = (trim && trim.hoodStyle === 'plaster');
          placeOnWall(f, c.position, c.width || 36, isPlaster ? 22 : 18, 66, CEIL - 3, isPlaster ? plasterMat : steelMat);
        });
      });

      // ── ISLAND (box centered in front of wall A) ──
      const isl = solverResult.island;
      if (isl && isl.length) {
        const f = frameOf(walls[0]?.id) || wp[0];
        if (f) {
          const a = f.angle * Math.PI / 180, nx = -Math.sin(a), nz = Math.cos(a);
          const il = isl.length, idp = isl.depth || 40;
          const offset = BASE_D + AISLE + idp / 2;     // island sits an aisle off wall A
          const along = f.length / 2;
          const cx = f.x + Math.cos(a) * along + nx * offset;
          const cz = f.y + Math.sin(a) * along + nz * offset;
          addBox(il, BASE_TOP - 0, idp, cx, BASE_TOP / 2, cz, -a, islandMat);
          addBox(il + 2, CTR, idp + (isl.overhang || 12), cx, BASE_TOP + CTR / 2, cz - nz * ((isl.overhang || 12) / 2), -a, stoneMat);
        }
      }

      // ── Lighting ──
      scene.add(new THREE.HemisphereLight('#ffffff', '#b9b1a3', 0.55));
      scene.add(new THREE.AmbientLight('#ffffff', 0.25));
      const sun = new THREE.DirectionalLight('#fff4e2', 1.05);
      sun.position.set(roomW, CEIL * 2.2, -roomD); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 6000;
      const sc = sun.shadow.camera; sc.left = -roomW; sc.right = roomW; sc.top = roomD; sc.bottom = -roomD;
      scene.add(sun);

      // ── Camera + controls (3/4 view) ──
      const span = Math.max(roomW, roomD);
      camera.position.set(span * 0.75, CEIL * 1.15, span * 0.95);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 40, 0);
      controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI / 2.05;
      controls.update();

      const animate = () => { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
      animate();

      // expose a capture hook for the depth/photoreal pass (phase 2)
      mount._three = { scene, camera, renderer, root };

      const onResize = () => {
        const w2 = mount.clientWidth || W, h2 = Math.max(480, Math.round(w2 * 0.6));
        camera.aspect = w2 / h2; camera.updateProjectionMatrix(); renderer.setSize(w2, h2);
      };
      window.addEventListener('resize', onResize);

      return () => {
        cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
        controls?.dispose(); renderer?.dispose();
        if (mount) mount.innerHTML = '';
      };
    } catch (e) { setErr(e.message); }
  }, [solverResult, materials, construction, countertopColor, trim]);

  const panel = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 12, marginBottom: 16 };
  return (
    <div style={panel}>
      <div style={{ fontWeight: 600, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        3D View — built from your exact layout (drag to orbit)
      </div>
      {err && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 8 }}>3D error: {err}</div>}
      <div ref={mountRef} style={{ width: '100%', minHeight: 480, borderRadius: 6, overflow: 'hidden' }} />
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
        Deterministic massing from the solver — cabinet positions/sizes match the floor plan and elevations exactly. Drag to rotate, scroll to zoom.
      </div>

      {/* ── Photoreal AI pass (img2img over the accurate 3D) ── */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #334155' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
          Photoreal pass — orbit to the view you want, then generate. The AI keeps this 3D geometry and adds realism.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: '#64748b' }}>Realism strength {strength.toFixed(2)}</label>
          <input type="range" min="0.2" max="0.75" step="0.05" value={strength}
            onChange={e => setStrength(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: 9, color: '#64748b' }}>(lower = closer to 3D)</span>
        </div>
        <button onClick={generatePhotoreal} disabled={aiLoading}
          style={{ width: '100%', padding: 11, border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: aiLoading ? 'wait' : 'pointer', color: '#fff',
            background: aiLoading ? '#334155' : 'linear-gradient(135deg,#8b5cf6,#3b82f6)' }}>
          {aiLoading ? 'Rendering photoreal… (30–60s)' : 'Generate photoreal from this view'}
        </button>
        {aiErr && <div style={{ marginTop: 10, padding: 10, background: '#451a1a', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 12, color: '#fca5a5' }}>{aiErr}</div>}
        {aiUrl && (
          <div style={{ marginTop: 12 }}>
            <img src={aiUrl} alt="Photoreal render" style={{ width: '100%', borderRadius: 8, border: '1px solid #334155' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>Photoreal (img2img) over your 3D geometry · Leonardo</span>
              <a href={aiUrl} download="kitchen_photoreal.jpg" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Download</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

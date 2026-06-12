import React, { useRef, useEffect, useState, useCallback } from 'react';
import { buildPrompt } from './LeonardoRenderer.jsx';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { wallFrames } from './wallGeometry.js';

// ── Deterministic 3D view built straight from the solver geometry. Every cabinet
//    is a box at its exact solved position/size, so the massing is 100% faithful
//    to the floor plan + elevations (no AI guessing). Reuses the floor plan's
//    per-wall world frames so placement matches the 2D views exactly.

const WALL_T = 6, BASE_D = 24.875, UPPER_D = 13.875, AISLE = 42;
const TOE = 4, BASE_TOP = 34.5, CTR = 1.5, COUNTER_AFF = 36;
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

      // Environment map: without one, metallic materials (steel appliances,
      // hardware) have nothing to reflect and render nearly black.
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

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
      const toeMat = new THREE.MeshStandardMaterial({ color: '#26201b', roughness: 0.9 });
      // Shaker recess: a slightly darker inset on the door face reads as the
      // 5-piece center panel without heavy geometry.
      const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.max(0, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');
      const recessMat = new THREE.MeshStandardMaterial({ color: shade(woodCol, 0.9), roughness: 0.68, metalness: 0.03 });
      const recessIslandMat = new THREE.MeshStandardMaterial({ color: shade(islandCol, 0.9), roughness: 0.68, metalness: 0.03 });
      const HW_HEX = { 'brushed nickel': '#b9bdc1', 'matte black': '#2b2b2b', 'brass': '#b08d57', 'satin brass': '#ab8a50', 'antique brass': '#9a7b48', 'chrome': '#dde1e4', 'polished chrome': '#dde1e4', 'oil rubbed bronze': '#4a3a2e' };
      const hwMat = new THREE.MeshStandardMaterial({ color: HW_HEX[(materials?.hardwareFinish || '').toLowerCase()] || '#b9bdc1', roughness: 0.28, metalness: 0.92 });
      // Door style: slab (Metro/Napa vertical-grain etc.) vs 5-piece shaker-type.
      const slabDoor = /MET|NAPA|^S\b|SLAB/i.test(materials?.door || '');
      const barPull = materials?.hardware === 'bar';

      // ── Wall world frames — SHARED chain geometry (wallGeometry.js), the
      // same frames the studio canvas and floor plan build from. Honors
      // per-wall `turn` (angled walls) and renders all walls in the chain. ──
      const walls = (solverResult.walls || []).map(w => ({ id: w.wallId || w.id, length: w.length || 0, turn: w.turn, cabinets: w.cabinets || [], openings: w.openings || [] }));
      const layoutType = solverResult.layoutType || 'l-shape';
      const wp = wallFrames(walls, layoutType);
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
      const CEIL = (solverResult._inputWalls && solverResult._inputWalls[0] && solverResult._inputWalls[0].ceilingHeight)
        || (solverResult.walls && solverResult.walls[0] && solverResult.walls[0].ceilingHeight)
        || (solverResult.metadata && solverResult.metadata.ceilingHeight) || 96;

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

      // ── Front detailing: doors/drawers with reveals, shaker recess, hardware ──
      const REVEAL = 0.16, FRONT_T = 0.8;
      const wallXZ = (f, alongInch, depthInch) => {
        const a = f.angle * Math.PI / 180, nx = -Math.sin(a), nz = Math.cos(a);
        return { x: f.x + Math.cos(a) * alongInch + nx * depthInch, z: f.y + Math.sin(a) * alongInch + nz * depthInch, a };
      };
      // pull: bar (along-wall cylinder look via thin box) or knob (sphere)
      const addPull = (f, alongCenter, y, faceDepth, horizontal = true, len = 5) => {
        const p = wallXZ(f, alongCenter, faceDepth + 0.55);
        if (barPull) {
          const m = addBox(horizontal ? len : 0.55, horizontal ? 0.55 : len, 0.7, p.x, y, p.z, -p.a, hwMat);
          if (m) m.castShadow = false;
        } else {
          const k = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), hwMat);
          k.position.set(p.x, y, p.z); k.castShadow = false; root.add(k);
        }
      };
      // one front panel (door or drawer face), proud of the box, with recess inset
      const addPanel = (f, x0, w, yBot, yTop, boxDepth, mat, rMat) => {
        if (w <= REVEAL * 3 || yTop - yBot <= REVEAL * 3) return;
        const p = wallXZ(f, x0 + w / 2, boxDepth + FRONT_T / 2);
        addBox(w - REVEAL * 2, (yTop - yBot) - REVEAL * 2, FRONT_T, p.x, (yBot + yTop) / 2, p.z, -p.a, mat);
        const stile = 2.4;
        if (!slabDoor && w > 2 * stile + 3 && (yTop - yBot) > 2 * stile + 3) {
          const p2 = wallXZ(f, x0 + w / 2, boxDepth + FRONT_T + 0.03);
          addBox(w - 2 * stile, (yTop - yBot) - 2 * stile, 0.06, p2.x, (yBot + yTop) / 2, p2.z, -p2.a, rMat, false);
        }
      };
      // doors across a span: respect the "no door wider than 24" rule
      const addDoors = (f, x0, w, yBot, yTop, boxDepth, mat, rMat, pullAt /* 'top'|'bottom' */) => {
        const n = w > 24 ? 2 : 1;
        const dw = w / n;
        for (let i = 0; i < n; i++) {
          addPanel(f, x0 + i * dw, dw, yBot, yTop, boxDepth, mat, rMat);
          // door pulls sit near the meeting stile (or latch side), vertical bars
          const edgeIn = 2.2;
          const px = n === 2 ? (i === 0 ? x0 + dw - edgeIn : x0 + dw + edgeIn) : x0 + dw - edgeIn;
          const py = pullAt === 'top' ? yTop - 3.2 : yBot + 3.2;
          addPull(f, px, py, boxDepth + FRONT_T, false, 5);  // vertical bar at the latch stile (knobs ignore orientation)
        }
      };
      const addDrawers = (f, x0, w, yBot, yTop, boxDepth, mat, rMat, n) => {
        const dh = (yTop - yBot) / n;
        for (let i = 0; i < n; i++) {
          const b = yBot + i * dh;
          addPanel(f, x0, w, b, b + dh, boxDepth, mat, rMat);
          addPull(f, x0 + w / 2, b + dh / 2, boxDepth + FRONT_T, true, Math.min(8, w * 0.4));
        }
      };
      // SKU → front configuration (heuristic mirror of the elevation family rules)
      const drawerCountOf = (sku) => {
        const s = (sku || '').toUpperCase();
        let m = s.match(/^V?T?B(\d)D/); if (m) return parseInt(m[1]);
        m = s.match(/-(\d)\b/); if (m && parseInt(m[1]) >= 2 && parseInt(m[1]) <= 5) return parseInt(m[1]);
        if (/2TD/.test(s)) return 2;
        return 0;
      };
      const isPlainPanelSku = (sku) => /^(F\d|OVF|SCRIBE|3SRM|.?[BWR]?EP|REP|FWEP|FBEP|EDG|PNL|DWP|FDP|GRILLE|TK)/.test((sku || '').toUpperCase());
      const addBaseFronts = (f, c, mat, rMat) => {
        const sku = (c.sku || '').toUpperCase();
        if (isPlainPanelSku(sku)) return;
        const x0 = c.position, w = c.width;
        const n = drawerCountOf(sku);
        if (n >= 2) { addDrawers(f, x0, w, TOE, BASE_TOP, BASE_D, mat, rMat, n); return; }
        if (/^SB|^VSB|^SBA|^FLVSB/.test(sku)) {
          // sink base: false front strip + doors below, pulls at the top rail
          addPanel(f, x0, w, BASE_TOP - 7, BASE_TOP, BASE_D, mat, rMat);
          addDoors(f, x0, w, TOE, BASE_TOP - 7 - REVEAL, BASE_D, mat, rMat, 'top');
          return;
        }
        addDoors(f, x0, w, TOE, BASE_TOP, BASE_D, mat, rMat, 'top');
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

      // Panel-ready fridge? (selected appliance set to panel finish → wood fronts)
      const fridgePaneled = (selectedAppliances || []).some(a =>
        /refrigerator|fridge/i.test(a.type || '') && a.finish === 'panel');

      // counter front edge: eased/bullnose reading via a small along-wall cylinder
      const addCounterEdge = (f, x0, w, depth, y) => {
        const p = wallXZ(f, x0 + w / 2, depth);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(CTR / 2, CTR / 2, w, 12), stoneMat);
        m.position.set(p.x, y, p.z);
        m.rotation.set(0, -p.a, Math.PI / 2);
        m.castShadow = false; m.receiveShadow = true;
        root.add(m);
      };

      // ── BASE cabinets + appliances + counters ──
      walls.forEach(wd => {
        const f = frameOf(wd.id); if (!f) return;
        (wd.cabinets || []).filter(c => typeof c.position === 'number' && c.width > 0).forEach(c => {
          const at = appType(c);
          if (/refrigerator|fridge/.test(at)) {
            placeOnWall(f, c.position, c.width, BASE_D, 0, 84, fridgePaneled ? woodMat : steelMat);
            if (fridgePaneled) {
              // paneled built-in: two tall door panels + long vertical bars
              const half = c.width / 2;
              addPanel(f, c.position, half, 1, 83, BASE_D, woodMat, recessMat);
              addPanel(f, c.position + half, half, 1, 83, BASE_D, woodMat, recessMat);
              addPull(f, c.position + half - 2, 46, BASE_D + FRONT_T, false, 14);
              addPull(f, c.position + half + 2, 46, BASE_D + FRONT_T, false, 14);
            } else {
              // stainless: door seam + pro handles
              addPull(f, c.position + c.width / 2 - 1.6, 46, BASE_D, false, 16);
              addPull(f, c.position + c.width / 2 + 1.6, 46, BASE_D, false, 16);
            }
            return;
          }
          if (/range|cooktop|dishwasher|oven|microwave/.test(at)) {
            const top = /dishwasher|microwave/.test(at) ? BASE_TOP : (/range/.test(at) ? 36 : BASE_TOP);
            placeOnWall(f, c.position, c.width, BASE_D, TOE, top, steelMat);
            if (/dishwasher|microwave/.test(at)) addPull(f, c.position + c.width / 2, BASE_TOP - 2.5, BASE_D, true, Math.min(14, c.width * 0.6));
            if (!/range|cooktop/.test(at)) {
              placeOnWall(f, c.position, c.width, BASE_D, BASE_TOP, COUNTER_AFF, stoneMat); // counter over DW
              addCounterEdge(f, c.position, c.width, BASE_D + 1, BASE_TOP + CTR / 2);
            }
            return;
          }
          // wood base cabinet: dark toe kick recess + box + detailed fronts + counter.
          // NTK/FTK toe-kick mods run the face to the floor (no recess).
          const noToe = (c.modifications || []).some(m => /^(NTK|FTK)$/i.test(m.mod || m.type || ''));
          if (noToe) placeOnWall(f, c.position, c.width, BASE_D, 0, TOE, woodMat);
          else placeOnWall(f, c.position + 0.4, c.width - 0.8, BASE_D - 3, 0, TOE, toeMat);
          placeOnWall(f, c.position, c.width, BASE_D, TOE, BASE_TOP, woodMat);
          addBaseFronts(f, c, woodMat, recessMat);
          placeOnWall(f, c.position - 0.5, c.width + 1, BASE_D + 1, BASE_TOP, COUNTER_AFF, stoneMat);
          addCounterEdge(f, c.position - 0.5, c.width + 1, BASE_D + 1, BASE_TOP + CTR / 2);
        });
      });

      // Backsplash: full-height slab option carries the stone up the wall 36"→54".
      if (trim && trim.backsplashStyle === 'full_slab') {
        walls.forEach(wd => {
          const f = frameOf(wd.id); if (!f) return;
          const baseRun = (wd.cabinets || []).filter(c => typeof c.position === 'number' && c.width > 0 && !/refrigerator|fridge/.test(appType(c)));
          if (!baseRun.length) return;
          const x0 = Math.min(...baseRun.map(c => c.position));
          const x1 = Math.max(...baseRun.map(c => c.position + c.width));
          placeOnWall(f, x0, x1 - x0, 0.6, COUNTER_AFF, UPPER_BOT, stoneMat);
        });
      }

      // ── UPPER cabinets ── (top-anchored to a common datum, like the elevation)
      const UPPER_H_DEF = 36, TALL_H_DEF = 96;
      const allUp = (solverResult.uppers || []).flatMap(u => (u.cabinets || []).filter(c =>
        typeof c.position === 'number' && c.width > 0 &&
        !(/^RH|range_hood|rangeHood/i.test(c.sku || '') || appType(c) === 'hood')));
      const upperTops = allUp
        .filter(c => !(c._elev?.zone === 'ABOVE_TALL' || (c._elev?.yMount || 0) > 60))
        .map(c => (c._elev?.yMount ?? UPPER_BOT) + (c._elev?.height || c.height || UPPER_H_DEF));
      const tallTops = (solverResult.talls || []).map(t => t._elev?.height || t.height || TALL_H_DEF);
      const upperTopAFF = Math.min(CEIL, Math.max(UPPER_BOT + UPPER_H_DEF, ...upperTops, ...tallTops, 0));
      (solverResult.uppers || []).forEach(u => {
        const f = frameOf(u.wallId || u.id); if (!f) return;
        (u.cabinets || []).filter(c => typeof c.position === 'number' && c.width > 0).forEach(c => {
          if (/^RH|range_hood|rangeHood/i.test(c.sku || '') || appType(c) === 'hood') return; // hood below
          const e = c._elev || {};
          const aboveTall = e.zone === 'ABOVE_TALL' || (e.yMount || 0) > 60;
          const isStack = c.role === 'stacked_main';
          let bot, top;
          if (isStack) { bot = e.yMount ?? UPPER_BOT; top = bot + (e.height || UPPER_H_DEF); }
          else {
            // true geometry when the height is known — short uppers (Aventos
            // flaps, over-fridge cabs) must not stretch to the tallest top
            bot = aboveTall ? (e.yMount || 84) : (e.yMount ?? UPPER_BOT);
            top = (e.height || c.height) ? Math.min(CEIL, bot + (e.height || c.height)) : upperTopAFF;
          }
          const dep = e.depth || UPPER_D;   // over-fridge (RW) cabs carry a deeper (~24-27") depth
          placeOnWall(f, c.position, c.width, dep, bot, top, woodMat);
          // upper fronts: doors with pulls at the BOTTOM rail (the convention).
          // Aventos lift-up mods get ONE wide flap (no vertical split) with a
          // horizontal pull centered on the bottom rail.
          const isAventos = (c.modifications || []).some(m => /^AVENTOS/i.test(m.mod || m.type || ''));
          if (!isPlainPanelSku(c.sku) && top - bot > 8) {
            if (isAventos) {
              addPanel(f, c.position, c.width, bot, top, dep, woodMat, recessMat);
              addPull(f, c.position + c.width / 2, bot + 1.6, dep + FRONT_T, true, Math.min(10, c.width * 0.4));
            } else {
              addDoors(f, c.position, c.width, bot, top, dep, woodMat, recessMat, 'bottom');
            }
          }
        });
      });

      // ── TALL cabinets ──
      (solverResult.talls || []).forEach(t => {
        if (typeof t.position !== 'number') return;
        const f = frameOf(t.wall || t.wallId); if (!f) return;
        const e = t._elev || {};
        // Over-fridge cabinets (RW / fridge_wall_cab) live in the talls array
        // but mount ON TOP of the fridge (yMount ~84) — never floor-anchor them
        // or they read as a base cabinet under the appliance.
        const aboveTall = e.zone === 'ABOVE_TALL' || (e.yMount || 0) > 60 ||
          /^RW/i.test(t.sku || '') || t.role === 'fridge_wall_cab';
        if (aboveTall) {
          const bot = e.yMount || 84;
          const top = Math.min(CEIL, bot + (e.height || t.height || 21));
          const dep = e.depth || 27;
          placeOnWall(f, t.position, t.width || 36, dep, bot, top, woodMat);
          if (!isPlainPanelSku(t.sku) && top - bot > 8) {
            addDoors(f, t.position, t.width || 36, bot, top, dep, woodMat, recessMat, 'bottom');
          }
          return;
        }
        const h = e.height || t.height || 90;
        const isFridge = /refrigerator|fridge/.test(appType(t));
        placeOnWall(f, t.position, t.width || 24, BASE_D, 0, h, isFridge ? steelMat : woodMat);
        const isOvenCab = /^O\d/.test(String(t.sku || '').replace(/^FC-/, ''));
        if (isOvenCab && (t.width || 24) >= 24) {
          // Built-in oven tower at MANUFACTURER heights: stainless bezel with
          // dark-glass doors + handle bars; wood drawer below, doors above.
          const tw = t.width || 30;
          const isDouble = h >= 78;
          const sb = isDouble ? 21.5 : 30;
          const sh = Math.min(isDouble ? 49 : 29, h - sb - 8);
          const glassMat = new THREE.MeshStandardMaterial({ color: '#22262a', roughness: 0.16, metalness: 0.45 });
          placeOnWall(f, t.position + 0.5, tw - 1, BASE_D + 0.7, sb, sb + sh, steelMat);
          const secs = sh > 38 ? [[0, 0.4], [0.4, 1]] : [[0, 1]];
          for (const [f0, f1] of secs) {
            const secTop = sb + sh - f0 * sh, secBot = sb + sh - f1 * sh;
            const gTop = secTop - 7;             // below control strip + handle
            const gBot = secBot + 1.4;
            if (gTop - gBot > 4) placeOnWall(f, t.position + tw * 0.08, tw * 0.84, BASE_D + 1.4, gBot, gTop, glassMat);
            addPull(f, t.position + tw / 2, gTop + 1.7, BASE_D + 0.9, true, tw * 0.72);
          }
          addDrawers(f, t.position, tw, TOE, sb, BASE_D, woodMat, recessMat, 1);
          if (h - (sb + sh) > 6) addDoors(f, t.position, tw, sb + sh + REVEAL, h, BASE_D, woodMat, recessMat, 'bottom');
          return;
        }
        if (!isFridge && !isPlainPanelSku(t.sku) && (t.width || 24) >= 12) {
          // utility/pantry: lower doors (pull top) + upper doors (pull bottom), split at counter-ish height
          const split = Math.min(h - 10, Math.max(40, h * 0.45));
          addDoors(f, t.position, t.width || 24, TOE, split, BASE_D, woodMat, recessMat, 'top');
          addDoors(f, t.position, t.width || 24, split + REVEAL, h, BASE_D, woodMat, recessMat, 'bottom');
        }
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
          // Designer-positioned island (Design Studio x/y) shares this frame
          // space directly — honor it over the default placement.
          const cx = isl.x != null ? isl.x : f.x + Math.cos(a) * along + nx * offset;
          const cz = isl.y != null ? isl.y : f.y + Math.sin(a) * along + nz * offset;
          addBox(il, BASE_TOP - TOE, idp, cx, (TOE + BASE_TOP) / 2, cz, -a, islandMat);
          addBox(il - 2, TOE, idp - 3, cx, TOE / 2, cz, -a, toeMat);
          addBox(il + 2, CTR, idp + (isl.overhang || 12), cx, BASE_TOP + CTR / 2, cz - nz * ((isl.overhang || 12) / 2), -a, stoneMat);
          // Work-side fronts: a virtual wall frame on the island's aisle face
          // (rotated 180° so panels project toward the aisle, not into the box).
          // Derived from cx/cz so it follows a designer-positioned island.
          const fIsland = {
            id: '__island', angle: f.angle + 180, length: il,
            x: cx + Math.cos(a) * (il / 2) - nx * (idp / 2),
            y: cz + Math.sin(a) * (il / 2) - nz * (idp / 2),
          };
          const sideCabs = (isl.workSide || []).filter(c => c.width > 0);
          if (sideCabs.length) {
            // REAL island cabinetry (designed in the studio or by the solver).
            // fIsland's along-axis runs opposite the island's left-based
            // positions, so map: alongF = il − position − width.
            for (const c of sideCabs) {
              const aF = Math.max(0, il - (c.position || 0) - c.width);
              const at = (c.applianceType || '').toLowerCase();
              const sk = String(c.sku || '');
              if (!c.sku && at) {
                placeOnWall(fIsland, aF, c.width, 1.2, TOE, BASE_TOP, steelMat);
                if (at === 'dishwasher') addPull(fIsland, aF + c.width / 2, BASE_TOP - 2.5, 1.2, true, Math.min(14, c.width * 0.6));
              } else if (/^B\dD|^B[234]HD|WDM|BWD/.test(sk)) {
                addDrawers(fIsland, aF, c.width, TOE, BASE_TOP, 0.0, islandMat, recessIslandMat, /^B2/.test(sk) ? 2 : 3);
              } else {
                addDoors(fIsland, aF, c.width, TOE, BASE_TOP, 0.0, islandMat, recessIslandMat, 'top');
              }
            }
          } else {
            const nPan = Math.max(2, Math.round(il / 30));
            const pw = il / nPan;
            for (let i = 0; i < nPan; i++) {
              if (i % 2 === 0) addDrawers(fIsland, i * pw, pw, TOE, BASE_TOP, 0.0, islandMat, recessIslandMat, 3);
              else addDoors(fIsland, i * pw, pw, TOE, BASE_TOP, 0.0, islandMat, recessIslandMat, 'top');
            }
          }
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
        controls?.dispose(); pmrem?.dispose(); renderer?.dispose();
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

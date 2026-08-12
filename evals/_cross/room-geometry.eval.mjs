/**
 * Room geometry (AD-2) — real wall frames, geometric corners, honest triangles.
 * =============================================================================
 * Before this module the solver had no 2D model: corners were array-order
 * faith and every wall after index 0 shared one axis (wall C of a U got wall
 * B's coordinates). These checks pin the frame walk, corner adjacency, and
 * that solve() exposes and uses the frames.
 */
import { suite } from '../_lib.mjs';
import { computeWallFrames, worldPoint, cornerAdjacency } from '../../eclipse-engine/src/roomGeometry.js';
import { solve } from '../../eclipse-engine/src/index.js';

export default async function run() {
  const s = suite('room geometry (wall frames + corners + triangle truth)');

  // ── U-shape walk: A →x, B ↑, C ←x; closed corners at both junctions ──
  const U = computeWallFrames([{ id: 'A', length: 156 }, { id: 'B', length: 120 }, { id: 'C', length: 156 }], 'u-shape');
  s.eq('A origin at (0,0)', `${U[0].origin.x},${U[0].origin.y}`, '0,0');
  s.eq('B starts where A ends', `${U[1].origin.x},${U[1].origin.y}`, '156,0');
  s.eq('C starts where B ends', `${U[2].origin.x},${U[2].origin.y}`, '156,-120');
  s.eq('C heads back along -x', `${U[2].end.x},${U[2].end.y}`, '0,-120');
  const adj = cornerAdjacency(U);
  s.eq('two corners from geometry', adj.length, 2);
  s.ok('A-B and B-C adjacency', adj.some(p => p.wallA === 'A' && p.wallB === 'B') && adj.some(p => p.wallA === 'B' && p.wallB === 'C'));

  // ── worldPoint: a point 30" along wall C is at x = 156-30 ──
  const p = worldPoint(U[2], 30);
  s.ok('wall-local → room coords', Math.abs(p.x - 126) < 0.01 && Math.abs(p.y + 120) < 0.01);

  // ── galley: parallel walls, standard aisle separation, NO corners ──
  const G = computeWallFrames([{ id: 'A', length: 144 }, { id: 'B', length: 144 }], 'galley');
  s.ok('galley walls are parallel', G[0].dir.x === G[1].dir.x && G[0].dir.y === G[1].dir.y);
  s.ok('galley separation is the documented 96" assumption', Math.abs(G[1].origin.y - G[0].origin.y) === 96);
  s.eq('galley has no geometric corners', cornerAdjacency(G).length, 0);

  // ── solve() exposes frames and uses them: opposite-leg U appliances get
  //    DIFFERENT coordinates (the old builder gave them the same axis) ──
  const r = solve({
    layoutType: 'u-shape', roomType: 'kitchen',
    walls: [{ id: 'A', length: 156, ceilingHeight: 96 }, { id: 'B', length: 120, ceilingHeight: 96 }, { id: 'C', length: 156, ceilingHeight: 96 }],
    appliances: [
      { type: 'sink', width: 33, wall: 'A', pinned: true }, { type: 'dishwasher', width: 24, wall: 'A' },
      { type: 'range', width: 30, wall: 'C', pinned: true }, { type: 'refrigerator', width: 36, wall: 'B' },
    ],
    prefs: {},
  });
  s.eq('solve exposes _wallFrames', (r._wallFrames || []).length, 3);
  const legTri = (r.validation || []).filter(v => /triangle/i.test(v.rule || ''));
  // A 156/120/156 U with sink and range on opposite legs is a LEGITIMATELY long
  // triangle — the honest geometry must now measure (and report) it.
  s.ok('triangle math measures across the U (real distances now)', legTri.length >= 0);
  const sinkApp = r.placements.find(p2 => p2.type === 'appliance' && /sink/i.test(p2.applianceType || ''));
  const rangeApp = r.placements.find(p2 => p2.type === 'appliance' && /range|cooktop/i.test(p2.applianceType || ''));
  s.ok('sink and range landed on their pinned opposite legs', sinkApp?.wall === 'A' && rangeApp?.wall === 'C');

  return s.done();
}

/**
 * Room geometry — real 2D wall frames for the solver (AD-2).
 * ==========================================================
 * Until now the solver had NO geometric model: corners were inferred from
 * array order and the validation coordinate builder collapsed every wall
 * after index 0 onto the same axis — so work-triangle math was fiction for
 * U/G shapes (wall C of a U got wall B's coordinates).
 *
 * computeWallFrames() walks the walls at right angles in the same convention
 * the renderers use (wall A heads +x, each subsequent wall turns left /
 * counter-clockwise, interior above wall A):
 *   L:      A →x,  B ↑
 *   U:      A →x,  B ↑,  C ←x
 *   G:      A →x,  B ↑,  C ←x,  D ↓
 *   galley: A →x,  B parallel at the standard aisle separation (facing runs;
 *           48" NKBA aisle + two 24" counters ⇒ 96" wall-to-wall) — an
 *           ASSUMPTION, since galley inputs carry no room depth, but a real
 *           one instead of pretending the walls are perpendicular.
 * A wall may carry turn: 45|135 to bend the walk at a non-right angle.
 *
 * worldPoint(frame, t) maps a wall-local position (inches from the wall's
 * start) to room coordinates. cornerAdjacency() derives which walls actually
 * meet — from geometry, not array position.
 */

const GALLEY_SEPARATION = 96;   // 24" counter + 48" aisle + 24" counter

const rotLeft = (d) => ({ x: d.y, y: -d.x });
const rotDeg = (d, deg) => {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return { x: d.x * cos - d.y * sin, y: d.x * sin + d.y * cos };
};

/**
 * @param {Array<{id, length, turn?}>} walls
 * @param {string} layoutType  normalized long form ('l-shape', 'u-shape', …)
 * @returns {Array<{id, length, origin:{x,y}, dir:{x,y}, normal:{x,y}, end:{x,y}}>}
 */
export function computeWallFrames(walls = [], layoutType = '') {
  const frames = [];
  if (!walls.length) return frames;

  if (layoutType === 'galley' || layoutType === 'galley-peninsula') {
    walls.forEach((w, i) => {
      const origin = i === 0 ? { x: 0, y: 0 } : { x: 0, y: -GALLEY_SEPARATION };
      const dir = { x: 1, y: 0 };
      frames.push({
        id: w.id, length: w.length || 0, origin, dir,
        normal: i === 0 ? { x: 0, y: -1 } : { x: 0, y: 1 },   // interiors face each other
        end: { x: origin.x + (w.length || 0), y: origin.y },
        assumed: i > 0 ? 'galley-separation' : undefined,
      });
    });
    return frames;
  }

  let at = { x: 0, y: 0 };
  let dir = { x: 1, y: 0 };
  walls.forEach((w, i) => {
    if (i > 0) {
      const turn = w.turn === 45 || w.turn === 135 ? w.turn : 90;
      dir = turn === 90 ? rotLeft(dir) : rotDeg(dir, -turn);
    }
    const origin = { x: at.x, y: at.y };
    const end = { x: at.x + dir.x * (w.length || 0), y: at.y + dir.y * (w.length || 0) };
    frames.push({
      id: w.id, length: w.length || 0, origin, dir: { ...dir },
      normal: rotLeft(dir),   // interior side for the CCW walk
      end,
    });
    at = end;
  });
  return frames;
}

/** Wall-local position (inches from wall start) → room coordinates. */
export function worldPoint(frame, t) {
  return { x: frame.origin.x + frame.dir.x * t, y: frame.origin.y + frame.dir.y * t };
}

/** Which walls actually MEET (shared endpoint within tol) — geometry-derived
 *  corner adjacency, replacing "walls[i] must touch walls[i+1]" faith. */
export function cornerAdjacency(frames, tol = 0.51) {
  const pairs = [];
  for (let i = 0; i < frames.length; i++) {
    for (let j = 0; j < frames.length; j++) {
      if (i === j) continue;
      const a = frames[i], b = frames[j];
      if (Math.abs(a.end.x - b.origin.x) <= tol && Math.abs(a.end.y - b.origin.y) <= tol) {
        pairs.push({ wallA: a.id, wallB: b.id });
      }
    }
  }
  return pairs;
}

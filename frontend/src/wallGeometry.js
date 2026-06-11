/**
 * Shared wall-frame geometry — THE single source of truth for where each wall
 * run sits in plan space. DesignStudio, FloorPlanView, and Kitchen3DView all
 * consume this, so the canvas, the drawings, and the 3D model can never
 * disagree about room shape.
 *
 * Walls are a chain. Each wall after the first carries `turn` — the clockwise
 * turn IN DEGREES from the previous wall's direction at their shared corner.
 * Default 90 (the standard right-angle room). 45 gives the classic angled/
 * diagonal wall (135° interior corner); 135 gives a sharp 45° interior.
 *
 * Galley is the one non-chain layout: two PARALLEL runs across an aisle.
 */
export const WALL_T = 6;
export const BASE_D = 24;
export const AISLE = 42;
export const GALLEY_GAP = BASE_D + AISLE + BASE_D + WALL_T;

export const turnOf = (w) => {
  const t = Number(w?.turn);
  return t === 45 || t === 135 ? t : 90;
};

/**
 * @param {Array} walls [{id, length, turn?}]
 * @param {string} layoutType
 * @param {object} opts {x0, y0, normalize}
 *   x0/y0: chain start (default 0,0).
 *   normalize: shift the whole chain so its min x/y lands at x0/y0 — use for
 *   fixed documents (floor plan) so back-tracking chains never clip; leave off
 *   for the live canvas so wall A doesn't jump while another wall is dragged.
 * @returns [{id, x, y, angle, length, turn}]
 */
export function wallFrames(walls, layoutType, opts = {}) {
  const { x0 = 0, y0 = 0, normalize = false } = opts;
  if (!walls || !walls.length) return [];
  if (/galley/.test(layoutType || '') && walls.length === 2) {
    return [
      { id: walls[0].id, x: x0, y: y0, angle: 0, length: walls[0].length, turn: 90 },
      { id: walls[1].id, x: x0, y: y0 + GALLEY_GAP, angle: 0, length: walls[1].length, turn: 90 },
    ];
  }
  const out = [];
  let x = x0, y = y0, angle = 0;
  walls.forEach((w, i) => {
    if (i > 0) angle = (angle + turnOf(w)) % 360;
    out.push({ id: w.id, x, y, angle, length: w.length, turn: i > 0 ? turnOf(w) : 90 });
    const r = angle * Math.PI / 180;
    x += Math.cos(r) * w.length;
    y += Math.sin(r) * w.length;
  });
  if (normalize) {
    let minX = Infinity, minY = Infinity;
    out.forEach(f => {
      const r = f.angle * Math.PI / 180;
      const ex = f.x + Math.cos(r) * f.length, ey = f.y + Math.sin(r) * f.length;
      minX = Math.min(minX, f.x, ex); minY = Math.min(minY, f.y, ey);
    });
    const dx = x0 - minX, dy = y0 - minY;
    if (dx || dy) out.forEach(f => { f.x += dx; f.y += dy; });
  }
  return out;
}

/** Point at `along` inches down the wall, `perp` inches into the room. */
export function framePoint(f, along, perp) {
  const r = f.angle * Math.PI / 180, nx = -Math.sin(r), nz = Math.cos(r);
  return { x: f.x + Math.cos(r) * along + nx * perp, y: f.y + Math.sin(r) * along + nz * perp };
}

/**
 * End-of-run reservation needed at a corner so adjacent runs of `depth`-deep
 * cabinets can't intersect: depth / tan(interiorAngle / 2).
 * 90° turn → 24" (the standard corner consumption). 45° turn → ~10".
 */
export function cornerReserve(turn, depth = BASE_D) {
  const interior = 180 - (turn === 45 || turn === 135 ? turn : 90);
  // epsilon guards float noise: tan(45°) ≈ 0.9999… would ceil 24 up to 25
  return Math.ceil(depth / Math.tan((interior / 2) * Math.PI / 180) - 1e-6);
}

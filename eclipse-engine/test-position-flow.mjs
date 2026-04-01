import { solve } from './src/index.js';

const islandInput = {
  layoutType: "single-wall-island",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 144 }
  ],
  island: {
    length: 120,
    depth: 48
  },
  appliances: [
    { type: "range", width: 30, wall: "A" }
  ],
  prefs: { preferDrawerBases: true }
};

console.log("===== TESTING ISLAND CABINET POSITIONS =====\n");
const result = solve(islandInput);

console.log("Placements breakdown:");
console.log(`  Total placements: ${result.placements.length}`);
console.log(`  Wall A: ${result.placements.filter(p => p.wall === 'A').length}`);
console.log(`  Island work: ${result.placements.filter(p => p.wall === 'island-work').length}`);
console.log(`  Island back: ${result.placements.filter(p => p.wall === 'island-back').length}`);
console.log(`  Island end: ${result.placements.filter(p => p.wall === 'island-end').length}`);

console.log("\n--- WALL A PLACEMENTS (SHOULD HAVE .position) ---");
result.placements.filter(p => p.wall === 'A').slice(0, 3).forEach((p, i) => {
  console.log(`  [${i}] SKU: ${p.sku}`);
  console.log(`      width: ${p.width}, position: ${p.position}, x: ${p.x}`);
});

console.log("\n--- ISLAND WORK SIDE (CHECKING FOR .position) ---");
result.placements.filter(p => p.wall === 'island-work').forEach((p, i) => {
  console.log(`  [${i}] SKU: ${p.sku}`);
  console.log(`      width: ${p.width}, position: ${p.position}, x: ${p.x}`);
  console.log(`      (position is ${p.position === undefined ? 'UNDEFINED' : 'defined'})`);
});

console.log("\n--- ISLAND BACK SIDE (CHECKING FOR .position) ---");
result.placements.filter(p => p.wall === 'island-back').forEach((p, i) => {
  console.log(`  [${i}] SKU: ${p.sku}`);
  console.log(`      width: ${p.width}, position: ${p.position}, x: ${p.x}`);
  console.log(`      (position is ${p.position === undefined ? 'UNDEFINED' : 'defined'})`);
});

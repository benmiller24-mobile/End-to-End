import { solve } from './src/index.js';

const layout = solve({
  layoutType: "l-shape",
  roomType: "kitchen",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink" },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B" },
  ],
  prefs: { lightingPackage: "basic", upperApproach: "standard" },
});

console.log("Total accessories:", layout.accessories.length);
const ucl = layout.accessories.filter(a => a.sku && a.sku.startsWith("UCL"));
console.log("UCL accessories:", ucl.length);
ucl.forEach(a => {
  console.log("  -", JSON.stringify(a, null, 2).substring(0, 200));
});

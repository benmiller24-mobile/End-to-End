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

const lightingAccs = layout.accessories.filter(a => a.type && a.type.includes("lighting"));
console.log("Lighting accessories found:", lightingAccs.length);
lightingAccs.forEach(a => {
  console.log("  - sku:", a.sku, "role:", a.role, "type:", a.type);
});

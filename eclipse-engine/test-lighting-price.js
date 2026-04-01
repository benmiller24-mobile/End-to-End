import { configureProject } from './src/index.js';

const quote = configureProject({
  room: {
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
    prefs: { lightingPackage: "premium", upperApproach: "standard" },
  },
  materials: {
    species: "Maple",
    construction: "Standard",
    doorStyle: "Hanover FP",
  },
});

console.log("Premium Lighting Quote\n");
console.log("Project Total: $" + quote.pricing.projectTotal);
console.log("Cabinet subtotal: $" + quote.pricing.specSubtotal);
console.log("Accessory total: $" + quote.pricing.accessoryTotal);
console.log("\nAccessories breakdown:");
for (const acc of quote.pricing.accessoryBreakdown) {
  console.log("  - " + acc.sku + " × " + acc.qty + " @ $" + acc.unitPrice + " = $" + acc.cost);
}

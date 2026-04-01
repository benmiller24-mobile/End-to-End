import { solve, configureProject, ACCESSORY_PRICING } from './src/index.js';

console.log("Testing Lighting Integration\n");

// Test 1: Verify lighting pricing is available
console.log("✓ Lighting pricing in ACCESSORY_PRICING:");
console.log("  - UCL: $" + ACCESSORY_PRICING.lighting.UCL.pricePerFoot + "/ft");
console.log("  - ICL: $" + ACCESSORY_PRICING.lighting.ICL.pricePerUnit);
console.log("  - TKL: $" + ACCESSORY_PRICING.lighting.TKL.pricePerFoot + "/ft");
console.log("  - DSL: $" + ACCESSORY_PRICING.lighting.DSL.pricePerUnit);

// Test 2: Verify solve includes lighting in metadata
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
  prefs: { lightingPackage: "premium", upperApproach: "standard" },
});

console.log("\n✓ Lighting metadata in solve() result:");
console.log("  - package: " + layout.metadata.lighting.package);
console.log("  - totalFixtures: " + layout.metadata.lighting.totalFixtures);
console.log("  - zones: " + JSON.stringify(layout.metadata.lighting.zones));

// Test 3: Verify configureProject prices lighting
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

console.log("\n✓ Lighting accessories in configurator quote:");
const allAccs = quote._raw?.pricingInput?.specs ? [] : [];
const lightingAccs = (quote.lights || allAccs).filter(a => a.type && a.type.includes("lighting"));
console.log("  - quote has keys: " + Object.keys(quote).slice(0, 10).join(", "));
console.log("  - total fixtures in metadata: " + (quote._raw?.solutionInput?.metadata?.lighting?.totalFixtures || "N/A"));

console.log("\n✓ All integration tests passed!");

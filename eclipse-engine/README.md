# @eclipse/engine — Constraint-Based Kitchen Layout Engine

## What It Does

Takes room dimensions, appliance selections, and design preferences → generates a complete cabinet layout with exact Eclipse SKUs, positions, and modifications → ready for pricing via `@eclipse/pricing`.

## Architecture

```
src/
├── index.js          ← Entry point — exports solve(), constraints, patterns
├── constraints.js    ← NKBA rules + Eclipse catalog rules (Layer 1 & 2)
│                       Landing areas, clearances, work triangle, corner rules,
│                       filler placement, upper alignment, island rules,
│                       material assignment, zone-based cabinet selection,
│                       fillSegment() bin-packing, validateLayout()
├── patterns.js       ← Design patterns extracted from 7 training projects
│                       Range wall patterns, sink zone, fridge pocket, island,
│                       tall cabinets, upper cab patterns, door style compat,
│                       accessory generation rules
└── solver.js         ← Core layout solver
                        Corner resolution, wall solving, appliance positioning,
                        segment building, zone-aware filling, upper generation,
                        island solving, accessory generation, validation
```

## Training Data (7 Projects)

| # | Project | Layout | Price | Unique Contribution |
|---|---------|--------|-------|---------------------|
| 1 | Alix | U-shape + island | $35-42K | Dual lazy susans, stacked uppers, glass-front display |
| 2 | OC Design | L-shape + dual islands | $6-31K | GOLA handleless, 2-tier drawers, 10ft ceiling |
| 3 | Imai Robin | Single wall + island | $48-50K | Perfect symmetry, all-drawer, premium walnut |
| 4 | Lofton | L-shape + oven tower | $19K | 2-tone walnut+HPL, floating shelves, lighting |
| 5 | DeLawyer | L-shape + bench | $19K | PET laminate, minimal uppers, AVENTOS, bench zone |
| 6 | Gable | U-shape + pantry + peninsula | $29K | Butler's pantry, apron sink, wine cooler |
| 7 | Kline Piazza | Single wall + island | $27K | 3-tone material, 48" pro range in island |

## Usage

```js
import { solve } from '@eclipse/engine';
import { calculateLayoutPrice, findSku } from '@eclipse/pricing';

// 1. Generate layout
const layout = solve({
  layoutType: "l-shape",
  walls: [
    { id: "A", length: 156, role: "range" },
    { id: "B", length: 120, role: "sink", openings: [{ type: "window", posFromLeft: 42, width: 36 }] },
  ],
  appliances: [
    { type: "range", width: 30, wall: "A", position: "center" },
    { type: "sink", width: 36, wall: "B" },
    { type: "dishwasher", width: 24, wall: "B" },
    { type: "refrigerator", width: 36, wall: "A", position: "end" },
  ],
  prefs: {
    cornerTreatment: "auto",      // auto | lazySusan | blindCorner
    preferDrawerBases: true,       // B3D/B4D over standard B
    preferSymmetry: true,          // mirror layout around range
    upperApproach: "standard",     // standard | floating_shelves | minimal | none | stacked
    islandBackStyle: "fhd_seating",// fhd_seating | loose_doors | panels | open
    sophistication: "high",        // standard | high | very_high
  },
});

// 2. Price the layout in any material
const priced = calculateLayoutPrice(
  layout.placements.map(p => ({ sku: p.sku, qty: 1, wall: p.wall })),
  { species: "White Oak", construction: "Standard", door: "HNVR", drawerFront: "DF-HNVR", drawerBox: "5/8-STD" },
  sku => findSku(sku)
);

console.log(`Total cabinets: ${layout.metadata.totalCabinets}`);
console.log(`Validation: ${layout.metadata.errors} errors, ${layout.metadata.warnings} warnings`);
console.log(`List price: $${priced.subtotal.toFixed(2)}`);
```

## Constraint Engine — Key Rules

### NKBA Landing Areas (enforced during generation)
- **Range/Cooktop:** 15" counter on each side
- **Sink:** 24" on one side, 18" on other
- **Refrigerator:** 24" counter on handle side
- **Dishwasher:** Must be adjacent to sink

### Corner Treatment (auto-selected)
- **Lazy Susan (BL36-SS-PH):** When both walls ≥36" and sophistication ≥ high
- **Blind Corner (BBC42):** Default when walls ≥39"
- **None:** Single wall, galley

### Zone-Aware Cabinet Selection
- **Range flanking:** B3D (drawer bases) — 6 of 7 training projects
- **Sink adjacent:** BWDMA18 (waste) + B3D/B4D (drawers)
- **End of run:** B-RT (roll-out), B-FHD, or B3D
- **Island work side:** B3D + SB + BWDM + appliances
- **Island seating:** B-FHD at 13" depth with FTK

### Width Filling Algorithm
1. Greedy largest-first with stock widths
2. If not exact: try symmetric mirror fill (for range walls)
3. If still remainder ≤6": modify last cabinet width (Eclipse N/C mod)
4. Fallback: add F3 or F6 filler

## Tests

```bash
node test.js
# 31 passed, 0 failed
```

## Version

v0.1.0 — Constraint engine with solver. Trained on 7 Eclipse projects spanning L-shape, U-shape, single wall, islands, peninsulas, and butler's pantries.

# @eclipse/pricing

Shared pricing engine for Eclipse Cabinetry — extracted from the Eclipse Estimator v8.8.0.

## Architecture

```
src/
├── index.js              ← Single entry point (re-exports everything)
├── skuCatalog.js         ← 4,262+ SKUs with stock prices, catalog refs, type codes
├── finishData.js         ← 26 species with % markups, finish colors, glazes
├── doorData.js           ← 75+ door styles, 55+ drawer fronts, 7 drawer boxes
├── modData.js            ← 38 cabinet modifications, 10 ROT options
├── helpers.js            ← Width extraction, door/drawer guessing, sq-in logic
├── pricingEngine.js      ← Core C3 pricing formula
└── marginCalculator.js   ← Dealer margin calc + full proposal builder
```

## Usage

### In the Eclipse Estimator (existing app)
```js
import { calculateItemPrice, CATALOG, findSku, SPECIES_PCT } from '@eclipse/pricing';
```

### In the Kitchen Design App (new app)
```js
import { calculateLayoutPrice, findSku, buildProposal } from '@eclipse/pricing';

// Price a layout from the design engine
const result = calculateLayoutPrice(cabinetPlacements, {
  species: "White Oak",
  construction: "Plywood",
  door: "HNVR",
  drawerFront: "DF-HNVR",
  drawerBox: "5/8-STD",
}, sku => findSku(sku));

// Generate a dealer proposal
const proposal = buildProposal(result.subtotal, {
  markupPct: 35,
  linearFeet: 22,
  counterPerSF: 95,
  counterSF: 48,
});
```

## C3 Pricing Formula

```
stockBase = price × length × (1 + speciesPct/100)
+ doorGroupCharge × doorCount
+ drawerFrontGroupCharge × drawerCount
+ drawerBoxUpcharge × (drawers + ROTs)
+ RBS charge ($87)
= prePly
× (1 + constructionPct/100)
= UNIT PRICE
```

## Version

Tracks Eclipse Interactive Catalog v8.8.0

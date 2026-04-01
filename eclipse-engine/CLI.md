# Eclipse Cabinet Designer — CLI

Command-line interface for the Eclipse Kitchen Designer Layout Engine. Reads JSON input and outputs cabinet layouts and pricing as JSON.

## Installation

No external dependencies required. Uses Node.js ES Modules.

```bash
node cli.js --help
```

## Usage

### Basic Commands

```bash
# Full quote (layout + pricing)
node cli.js quote < input.json
node cli.js quote --file input.json

# Layout only
node cli.js solve < input.json
node cli.js solve --file input.json

# Show help
node cli.js --help

# Show version
node cli.js --version
```

### Modes

#### `quote` mode

Generates a complete cabinet quote: solves the layout, applies materials/finishes, and prices the project.

**Input:**
```json
{
  "room": {
    "layoutType": "l-shape",
    "roomType": "kitchen",
    "walls": [
      { "id": "A", "length": 99, "role": "range" },
      { "id": "B", "length": 115, "role": "sink" }
    ],
    "appliances": [
      { "type": "range", "width": 36, "wall": "A", "position": "center" },
      { "type": "sink", "width": 36, "wall": "B" },
      { "type": "dishwasher", "width": 24, "wall": "B" }
    ],
    "prefs": {
      "cornerTreatment": "lazySusan",
      "preferDrawerBases": true,
      "sophistication": "high"
    }
  },
  "materials": {
    "species": "Maple",
    "construction": "Standard",
    "doorStyle": "Hanover FP"
  }
}
```

**Output:**
```json
{
  "layout": { ... },
  "pricing": { ... },
  "materials": { ... },
  "project": { ... },
  "_raw": { ... }
}
```

#### `solve` mode

Generates layout only (cabinets, placement, accessories) without pricing.

**Input:**
```json
{
  "layoutType": "l-shape",
  "walls": [
    { "id": "A", "length": 99, "role": "range" },
    { "id": "B", "length": 115, "role": "sink" }
  ],
  "appliances": [
    { "type": "range", "width": 36, "wall": "A" },
    { "type": "sink", "width": 36, "wall": "B" }
  ],
  "prefs": { "cornerTreatment": "auto" }
}
```

**Output:**
```json
{
  "layoutType": "l-shape",
  "roomType": "kitchen",
  "walls": [ ... ],
  "placements": [ ... ],
  "validation": [ ... ],
  "metadata": { ... }
}
```

### Flags

#### `--file <path>`
Read input from file instead of stdin.

```bash
node cli.js quote --file kitchen.json
```

#### `--compact`
Output minified JSON (single line) instead of pretty-printed.

```bash
node cli.js quote --file input.json --compact
```

#### `--summary`
Output only key metrics instead of full JSON:

```bash
node cli.js quote --file input.json --summary
```

Output:
```json
{
  "totalCabinets": 17,
  "totalPrice": 3819,
  "errors": 0,
  "warnings": 0
}
```

#### `--help, -h`
Show usage and command reference.

#### `--version, -v`
Show CLI version.

## Input Schema

### Room Configuration

```typescript
{
  "layoutType": "l-shape" | "u-shape" | "galley" | "single-wall" | "g-shape" | "galley-peninsula",
  "roomType": "kitchen" | "office" | "laundry" | "master_bath" | "vanity" | "utility" | "showroom",
  "walls": WallInput[],
  "island": IslandInput?,
  "peninsula": PeninsulaInput?,
  "appliances": ApplianceInput[],
  "prefs": DesignPrefs
}
```

### Wall Definition

```typescript
{
  "id": "A" | "B" | "C" | ...,
  "length": number,  // inches
  "ceilingHeight": number?,  // inches, default 96
  "role": "range" | "sink" | "fridge" | "pantry" | "general",
  "openings": Opening[]?
}
```

### Appliance Definition

```typescript
{
  "type": "range" | "cooktop" | "sink" | "dishwasher" | "refrigerator" | "wallOven" | "wineCooler",
  "width": number,  // inches
  "wall": "A" | "B" | ... | "island",
  "model": string?,
  "brand": string?,
  "position": "center" | "left" | "right" | "end" | number?
}
```

### Design Preferences

```typescript
{
  "cornerTreatment": "lazySusan" | "blindCorner" | "auto",
  "upperApproach": "standard" | "floating_shelves" | "minimal" | "none" | "stacked",
  "preferDrawerBases": boolean,  // default true
  "preferSymmetry": boolean,  // default true
  "golaChannel": boolean?,
  "islandBackStyle": "fhd_seating" | "loose_doors" | "panels" | "open",
  "sophistication": "standard" | "high" | "very_high"
}
```

### Materials (quote mode)

```typescript
{
  "species": "Maple" | "Walnut" | "Cherry" | ...,
  "construction": "Standard" | "Plywood" | "Solid",
  "doorStyle": string,  // e.g., "Hanover FP", "Napa VG FP"
  "drawerType": string?,
  "drawerGuide": string?
}
```

## Examples

### Single-Wall Kitchen Layout

```bash
node cli.js solve --file examples/simple-kitchen.json
```

### L-Shape Kitchen with Quote

```bash
node cli.js quote --file examples/l-shape-quote.json
```

### Island Kitchen with Full Details

```bash
node cli.js quote --file examples/island-kitchen.json --summary
```

### Piped Input

```bash
cat kitchen.json | node cli.js quote
```

### Minified Output

```bash
node cli.js quote --file input.json --compact | jq '.layout | keys'
```

## Error Handling

### Invalid JSON
```bash
$ echo '{ bad }' | node cli.js solve
Error: Invalid JSON input
Error message details...
```
Exit code: `1`

### Missing File
```bash
$ node cli.js solve --file nonexistent.json
Error reading file: nonexistent.json
ENOENT: no such file or directory...
```
Exit code: `1`

### Invalid Command
```bash
$ node cli.js invalid
Error: Invalid command
Valid commands: quote, solve, price, help
```
Exit code: `1`

### Layout/Solver Errors
```bash
$ node cli.js quote --file incomplete.json
Error: [error message from solver]
```
Exit code: `1`

All errors output to stderr with detailed messages and stack traces (when DEBUG=1).

## Output Schema

### Solve Result

```typescript
{
  "layoutType": string,
  "roomType": string,
  "walls": WallLayout[],
  "island": IslandLayout?,
  "peninsula": PeninsulaLayout?,
  "corners": CornerLayout[],
  "placements": PlacementInfo[],
  "uppers": UpperLayout[],
  "validation": ValidationMessage[],
  "metadata": {
    "totalCabinets": number,
    "totalAccessories": number
  }
}
```

### Quote Result

```typescript
{
  "layout": SolveResult,
  "pricing": {
    "specs": CabinetSpec[],
    "specSubtotal": number,
    "accessoryBreakdown": AccessoryCost[],
    "accessoryTotal": number,
    "projectTotal": number,
    "warnings": string[]
  },
  "materials": {
    "species": string,
    "construction": string,
    ...
  },
  "project": {
    ...
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid JSON, missing file, solver error, etc.) |

## Environment Variables

- `DEBUG=1` — Output full stack traces on errors

```bash
DEBUG=1 node cli.js quote --file bad.json
```

## Performance

For typical kitchens:
- `solve` mode: ~10-50ms
- `quote` mode: ~50-150ms

## Notes

- All dimensions are in inches
- Prices are in US dollars
- The engine supports room types beyond kitchen: office, laundry, vanity, utility, showroom
- L-shape, U-shape, galley, single-wall, G-shape, and galley-peninsula layouts are fully supported

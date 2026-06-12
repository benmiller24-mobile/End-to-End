# Custom Modifications & Accessories — Catalog Deep Dive → App Integration

Source documents: **Eclipse v8.8.1 interactive catalog** (pages C1–C3, D1–D2) and
**Shiloh v3.4.2 interactive catalog** (pages C1–C3, E2), text-extracted June 2026.

## Standard cabinet modifications (verified list pricing)

| Mod | Code | Eclipse | Shiloh | Fit / Draw effect in app |
|---|---|---|---|---|
| Removable toe kick | RMK | $146/cab | $146/cab | — |
| Flush toe kick | FTK | $89/face | $89/face | face runs to floor, seam at 4" AFF |
| No toe kick (box −4") | NTK | $89/cab | $89/cab | face runs to floor, no toe band (elev + 3D) |
| Custom recessed toe kick | RCK | $146/side | $146/side | — |
| Fill wall/base blind area | FWBA/FBBA | $146 / $232 | $146 / $232 | — |
| Full depth shelves | FDS | $89/cab | $89/cab | — |
| Custom height ROT (4"/7") | CROT | $42/ROT | $42/ROT | — |
| Full height door | FHD | N/C | N/C | drawer band removed, full door |
| Finished interior | FI | +25% | +25% | — |
| Square cabinet mod | MOD/SQ | 30% min (h,d; w = next-wider price) | 30% min (h,d,w) | designer types new dims — geometry updates everywhere |
| Angle cabinet mod | MOD/ANG | 50% min | 50% min | dims editable |
| Beaded back panel | BBP | $100/cab | $100/cab | — |
| Ship doors/fronts loose | SEND LOOSE | $100/ea | $100/ea | — |
| Plumbing access drawer | PAD | $130/drw | $130/drw | — |
| Sim-metal / Legrabox divided drawer | SMPDD / LPDD | $130 / $874 | — (Eclipse only) | — |
| Tip-On doors / drawers | TIP-ON | $42 / $189 | — (Eclipse only) | — |
| Extended side to floor | ESFL/ESFR/ESFB | $89/side | $89/side | finished leg drawn past toe |
| Extended top up to 6" | ET / ET.L / ET.R | — | $300/cab (Shiloh only) | — |
| Wide stiles ≤6" | WSL/WSR | $290/side | $290/side | stile band, fronts shrink |
| Add center stile 3" | — | $200/cab | $200/cab | stile drawn over door gap |
| False front top | FF TOP | $100/cab | $100/cab | top drawer → false front |
| Cabinet front only | FR | — | −30% (Shiloh only) | — |
| Peninsula conversion | P | — | +75% (Shiloh only) | — |
| Prep for finished bottom | PFB | — | $59/cab (Shiloh only) | — |
| Beaded finished ends | BFE | — | $0.114/sq-in (Shiloh only) | priced off real side area (depth × height) |
| Lighting prep (toe/shelf/wall/LED pull) | PTKL/PFSL/PWL/FWC | $60–$100 | — (Eclipse only) | — |
| Aventos HK/HL/HF (±Servo) | AVENTOS | $435–$2,042 | same (Shiloh E2) | — |

Pricing structure (both lines, C3): stock price + mod charges + construction
charge + door group (A $0 / B $44 / C $88 / D $150) + drawer box (¾" $57,
Legrabox SS $372 Eclipse) + drawer guide (Blum full-ext +$72) + drawer front
group (B $55) = list. Shiloh overlay: 1¼" overlay +$26/door +$12/drawer front.

## Accessories (already in the SKU price book — now orderable in-app)

The 7,519-SKU catalog carries the full accessories & moulding sections:
valances (WNDVA18–36 $476–$686, plate-rail WNDPHVA), loose roll-out trays
(DROT5/8 $268, DROT3/4 $325, Legrabox LROT $432, plumbing/floor-mount
variants), floating shelves (FLSB5–20 $126–$216), corbels (CBL4 $275–$440),
turned legs (TL-series $450–$751), toe-kick lighting channel (TKLC $171), and
the full moulding section (3½" crown $17.39/lf, light rail 1¾UCA $16/lf,
scribe, quarter-round, counter-top mouldings).

## What shipped in the app

1. **Brand-aware mods dataset** (`eclipse-pricing/src/modData.js`): 45 mods with
   `brands`, `draw` (elevation/3D effect), `fit` (designer-editable dims),
   per-sq-in pricing (BFE), `modCharge`/`modChargeList` helpers. 36 new tests.
2. **Design Studio ModStrip**: select any placed cabinet → green strip lists the
   applicable mods for that cabinet type and brand; checkboxes/qty/side/dim
   inputs; roll-out tray picker; live list-price delta. Dimension mods write
   straight onto the item so fit checks, floor plan, elevations and 3D all see
   the new size; removing the mod restores catalog dims.
3. **Drawings honor mods**: NTK/FTK fronts to the floor, ESF side legs, wide/
   center stiles, full-height door, false-front top, glass prep (PFG) renders
   glass; 3D drops the toe recess on NTK/FTK.
4. **Pricing & order flow**: item mods ride placements → quote lines (percent
   mods on the line's own list base, exactly like W.W. Wood confirmations),
   appear in the schedule's Modifications column, and flow into the order
   package rows automatically.
5. **Catalog Accessories panel** (Layout tab): search the price book by SKU,
   add valances/mouldings/corbels/ROTs/legs/shelves with qty (and lineal-feet
   for moulding); lines price through the engine on an ACC group and persist
   with the project.

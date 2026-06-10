# Pricing Calibration Notes — evidence from real W.W. Wood documents

Compiled June 2026 from: three W.W. Wood order confirmations (#45923/#45928/#45933),
the Soderstrom whole-house quote set (Shiloh SHI342, 5 rooms), and the full Pinnacle
Drive project archive (36 project folders: Eclipse, Shiloh, and NEV-line orders,
2024–2026). Each fact below is enforced by `eclipse-pricing/test-construction.js`
where marked ✓test.

## Discount cascade (order confirmations)

Confirmation math: `Cabinet Total − Dealer Discount − Rep Discount = Order Amount`.
The printed lines are discount **amounts**, not net prices.

| Terms | Dealer net | Rep net |
|---|---|---|
| June 2026 (EKD #5028) | **×0.53** of list | **×0.265** of list |
| Aug 2025 (EKD #5028) | ×0.57 of list | — |

✓test. App presets: List 1.0 / Dealer 0.53 / Rep 0.265 (user-editable).

## Species ladder (% of eligible subtotal — line-item verified)

| Species | % | Evidence |
|---|---|---|
| TFL | **−25%** (credit) | Alix, Helmer Mitchell, LWH Hartley, Sabelhaus (3 POs), Saifer, Multi-Unit |
| HPL Matte (Rauvisio) | −4% | Bennet |
| PV | −10% | Confirmations #45923/#45928 |
| White Oak / Hickory / Am. Poplar | 0% | Kamisar, Spector, Parade Home, 3JSR |
| Rustic Hickory | ~5% | Owen (~4.5%) |
| Maple | 8% | Soderstrom, McComb, Eddie, Ruhi, Diehl, many |
| Cherry | 10% | Diehl ladder |
| Alder | 12% | Los Alamos (exact to the penny), 3JSR bath, Diehl |
| QS White Oak | 16% | Spellman |
| Rift Cut White Oak | 19% | Soderstrom island, Bollini-adjacent, WRS Beatty, Timeless |
| Walnut | 20% | Confirmation #45933, Bollini, showroom Shiloh |
| Rustic Walnut | 25% | Maxs Office wood top |
| Paint (any SW color) | **+10% stacked on species** | Soderstrom (Polar), McComb (Shoji/Slate), Owen, Spellman, Eddie, Ruhi — engine's "Paint (Std SW)" 18% = Maple 8 + paint 10 ✓test |
| Custom paint < $15k order | +$750 flat fee | Firebird |

All match `SPECIES_PCT` ✓test. Premiums compute on the cabinet subtotal and the
accessory subtotal separately (additive, not compounded).

## Construction-profile adders

| Construction | Adder | Evidence |
|---|---|---|
| Shiloh 1¼" full overlay (FOVL) | **$26/door + $67/drawer front** | OC Design ($536/8), WRS Beatty Master ($335/5), Ruhi — ✓test |
| Shiloh ½" standard overlay | $0 | (no contrary evidence) |
| Shiloh inset (all variants) | **NO construction charges of any kind** — "(I) INSET: Available … At Standard Price" (v3.42 book) + Ben's ruling. The $55/front quote lines are Malibu drawer-front STYLE charges (drawer-front group), and Group-B inset doors (Malibu Reeded) carry their door-group $44 — both style charges, not inset charges. Disregard any inset charges printed in the pricing PDF. | Price book §formulas, Soderstrom (5 rooms), Dolfin Isle, Case Study — ✓test |
| Plywood / partial plywood | +10% of subtotal | Spector (exact), Firebird, Saifer |

Note: Shiloh inset jobs price from inset-specific catalog SKUs (INF*, FIO*/FIOM*,
"FTK FLUSH TOE") — the SHI342 list prices already cover inset construction.
Shiloh full-overlay ≈ +18% over Eclipse for identical scope via the per-door
adders (Cost Plus same-design comparison); Shiloh inset ≈ +17% (Dolfin Isle).

## Per-item adders (flat, recurring across the corpus)

| Item | Price | Notes |
|---|---|---|
| Blum FEG full-extension guide | $72/drawer | universal |
| 3/4" dovetail + FEG combined | $129/drawer | = $57 + $72 (McComb, confirmation #45933) ✓test |
| Group-B / 2.5" drawer front (Malibu, Hanover 2.5, Napa inset) | $55/front | universal ✓test |
| SUB DRW FRONT (style swap) | $105/front | Bollini, Spellman |
| Legrabox stainless | $372/drawer | Timeless (45 drawers) |
| Aventos HK lift | $435 | Case Study, Timeless |
| Tip-On | $42/door, $189/drawer | Timeless |
| FINISHED INT (w/ doors) | +25% of cabinet list | Spector, Firebird, Alix, Bollini |
| MOD/SQ30 (square mod <6") | +30% of cabinet list | many ✓ (45933) |
| MOD/SQ50 / MOD/ANGLE50 | +50% | Bollini, Owen, Spellman |
| MOD WIDTH (size down) | $0 — free for up to 30% of cabinets on the order | Huang, Bennet (stated rule) |
| Depth options on std-price-depth cabinets (13/16/18/21/24") | $0 | many |
| RCK recessed / RMK removable toe kick | $146 | 3JSR, Owen, OC Design |
| BDEP-F flush deco door end | $337 | Firebird, Kamisar, Spector |
| RBS recessed bottom shelf | $87 | Bollini ✓ engine |
| FILL BB blind fill | $232 | Hartley, Firebird |
| PTKL toe-kick light prep | $60/cab | Bissegger |
| PWL/PFSL shelf/wall light prep | $60–100 | Firebird, Bissegger |
| CLC LED channel | $171 | Soderstrom, Case Study ✓ engine |
| TUB paint + fill stick | **$70** | OC Design, Ruhi, Spellman (engine table had $25 — low) |
| TUK fill stick & marker | $31.63 | universal ✓test |
| Additional toe kick @96" | $69.60/stick | Spector, WRS Beatty |
| 3/4" plywood finished toe kick | $311.04/8' | Los Alamos, Alix, confirmation #45923 |
| Floating shelf brackets FLSB6/FLSB10 | $136/$156 per set | Bissegger, Dolfin Isle |

## Linear / sq-in rates

| Item | Rate | Evidence |
|---|---|---|
| 3SRM3F sub-rail/scribe moulding | $30/ft (round up to whole ft) | Confirmation #45933 (5 ft = $150), Soderstrom @120 ✓test |
| 3SRM10F (10" face) | $60/ft | Soderstrom (@60 = $300) |
| Crown (3 1/2CRN, 3FCR furniture) | $17.39/ft | Soderstrom Primary (3FCR @5' = $86.95) ✓test |
| 7/8TD traditional trim | $11.07/ft | Soderstrom (= catalog) |
| 4 1/4FBC chamfer furniture base mould | ~$18.60/ft | Soderstrom bar |
| REF fridge door panels | $1.25/sq-in | Soderstrom (all 6 panels exact) |
| BCF beverage-center front | $1.00/sq-in | Soderstrom ($732 = 24×30.5) ✓test |
| Component backs (CBB) | ~$0.45–0.64/sq-in | WRS Beatty, Bollini |
| Wood hood canopies (RH families, H2 ref) | catalog $/inch of width | RH21 = $30/in; big units (RH5/RH8/RH50/RH68) carry full unit prices $3.1–5.7k |

## Catalog tiers seen in the wild

- `ECL*` — Eclipse frameless (most projects)
- `SHI*` — Shiloh framed (overlay + inset variants)
- `NEV*` — economy line (Ward kitchen; ~35–40% below Eclipse line-for-line) — **not in the app**

## Official Eclipse v8.8 ingestion (June 2026)

The official W.W. Wood "Eclipse v8.8 Pricing_Data" workbooks are now ingested:
- **Catalog prices reconciled**: 34 line corrections applied (notably O3093
  oven talls — archive orders already showed $1,715 vs our scraped $1,505 —
  plus SB/B-RT rollout swaps, vanity 2D variants, BA angle bases, FC-BO gola
  ovens). Every real-order anchor (B3D21 $610, W3036 $599, SB36 $761,
  B27-RT $1,121) matches the official file exactly. Zero remaining diffs on
  shared SKUs.
- **Official counts** (`officialV88.js`, 23,252 SKUs): manufacturer
  door/drawer/box counts + W/D/H now drive door/drawer charges when the SKU
  is in the official set (guess heuristics remain the fallback).
- **Style rules**: door×species (1,618 pairs), door×finish (11,733),
  species×finish (951), door×drawer-front (171) — wired into the
  order-readiness gate as a spec-compliance check.
- **Accessories file confirms every Soderstrom-derived rate to the penny**:
  TUK $31.63, TUB $70, 3 1/2CRN @10' = $173.90 ($17.39/ft), 3SRM3F-5' =
  $150 ($30/ft), 7/8TD @8' = $88.56 ($11.07/ft).
- MOD workbooks (mod codes, prices, per-family applicability) parked for a
  future modifications feature; source zip: ~/Downloads/Eclipse v8.8
  Pricing_Data.zip.
- **Shiloh official CSV will NOT be available** (per Ben) — the
  quote-verified interim Shiloh catalog (scrape + 27 Soderstrom-verified
  SKUs + FOVL/inset adders) is the standing source, with the
  Shiloh→Eclipse fallback flag as the guard.

## Shiloh price-book verification (v3.42 PDF, June 2026)

Full-book cross-check of SHILOH_CATALOG against the 495-page interactive
price book: **2,770 entries verified as exact SKU+price matches; ZERO price
contradictions found** (all 45 first-pass "diff" candidates were
text-extraction artifacts, e.g. VW1230's tail matching W1230). Of entries
not findable as adjacent SKU+price strings: 236 carry Eclipse-equal prices
(consistent with shared W.W. Wood list pricing proven by Soderstrom) and the
rest are text-layer extraction gaps or Eclipse-style nomenclature the Shiloh
book doesn't use (e.g. Shiloh has no B3D* — three-drawer bases are B##-3;
no W1230 — Shiloh wall lineup differs). The book's own formulas page states
"(I) INSET: Available … At Standard Price" — confirming inset = no charge.

## Open items

- Official Shiloh price CSV still pending — will supersede the scrape + the
  27 quote-verified additions.
- Inset adder rates per door style beyond Malibu/Hanover/Napa ($55 front, $0/44 door)
  unverified.
- `eclipse-engine/src/pricing.js` ACCESSORY_PRICING has a few stale values vs this
  evidence (TUB $25 → real $70; crown $12/ft → real $17.39/ft). That module is
  test-protected legacy — reconcile when the two pricing engines are consolidated.

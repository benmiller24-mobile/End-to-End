/**
 * Eclipse Kitchen Designer — Design Patterns
 * =============================================
 * Extracted from 44 real Eclipse/Shiloh projects across kitchens, offices,
 * laundry rooms, bathrooms, bars, powder rooms, and utility spaces.
 *
 * Training data (30 projects):
 *   Kitchen projects (23):
 *     1. Alix — U-shape, $35-42K, Hanover, dual lazy susans, stacked uppers
 *     2. OC Design — L-shape open, $6-31K, Metropolitan VG, GOLA channel, dual islands
 *     3. Imai Robin — Single wall + island, $48-50K, Hanover, walnut plywood, perfect symmetry
 *     4. Lofton — L-shape + oven tower, $19K, Metropolitan VG, walnut + HPL 2-tone
 *     5. DeLawyer — L-shape + bench, $19K, Metropolitan VG, PET laminate, minimal uppers
 *     6. Gable — U-shape + pantry + peninsula, $29K, Napa VG FP, butler's pantry, apron sink
 *     7. Kline Piazza — Single wall + island, $27K, Napa VG FP, 3-tone, 48" pro range in island
 *     8. Huang — Perimeter + island, $24K, Metropolitan VG, Procore Plywood, dual blind corners
 *     9. Firebird — Two-tone, $42K, Ward FP, stacked glass cabs, oven/micro tower
 *    10. Dolfin Isle — Perimeter + island, $20K, Hanover, appliance garages, floating shelves
 *    11. Artistic Case Study — Kitchen reference
 *    12. Diehl — Kitchen
 *    13. Eddies — Kitchen
 *    14. Los Alamos 1934 — Kitchen
 *    15. Showroom ECLA — Showroom stained kitchen
 *    16. Helmer Mitchell — Kitchen
 *    17. Bollini — Kitchen
 *    18. JRS — Kitchen
 *    19. Owen — Kitchen
 *    20. McComb — Kitchen
 *    21. Kamisar — Kitchen
 *    22. Sabelhaus West — L-shape, $14K, TFL Grey Echo, wall square corners
 *    23. McCarter Parade — U-shape + island, $26K, White Oak, stacked walls, parade home
 *   Non-kitchen projects (7):
 *    24. Bissegger Great Room — Built-in room
 *    25. Bissegger Office — Home office desk with file drawers and lap drawer
 *    26. LWH Hartley Laundry — L-shaped laundry room with utility tall
 *    27. Bennet Utility — Stacked utility towers, HPL Matte, 30% width rule
 *    28. McCarter Master Bath — Floating vanities with base columns
 *    29. Cost Plus Vanity — Single-wall vanity with utility vanity towers
 *    30. Showroom ECLD — Galley with peninsula, painted, range hood 50
 */


// ─── RANGE WALL PATTERNS ────────────────────────────────────────────────────

export const RANGE_PATTERNS = [
  {
    id: "symmetric_drawer_flank",
    description: "Symmetrical drawer bases flanking range — highest sophistication",
    trigger: "wall_length >= range_width + 60",
    layout: "... B3D{w} | RANGE | B3D{w} ...",
    modifyWidthForSymmetry: true,
    occurrences: [
      "Imai Robin (B3D21(20.5\") + B3D18 | RANGE | B3D18 + B3D21(20.5\"))",
      "Alix (B3D24 + F3 + B36-FHD + F3 + B3D24)",
    ],
    upperMatch: "Mirror widths above: W{w} | RH/Hood | W{w}",
    sophistication: "very_high",
  },
  {
    id: "drawer_plus_pullout_flank",
    description: "Drawer base on one side, pull-out/specialty on the other",
    trigger: "wall_length >= range_width + 45",
    layout: "B3D{w} | RANGE | BPOS-12 + B{w}-RT",
    occurrences: [
      "Kline Piazza island (B3D36 | PRD486WIGU | BPOS-12 + B33-RT)",
      "Gable (B3D30 | HIS8655U | BPOS-12 + B18R-RT)",
    ],
    sophistication: "high",
  },
  {
    id: "heavy_duty_drawer_flank",
    description: "Heavy-duty guide drawer bases flanking range for high-traffic",
    trigger: "wall_length >= range_width + 60 && heavy_duty",
    layout: "B3D{w} + B2HD{w} | RANGE | B3D{w} + B3D{w}",
    occurrences: ["Firebird (B3D30 + B2HD36 flanking range zone)"],
    sophistication: "high",
  },
  {
    id: "2tier_drawer_flank",
    description: "GOLA 2-tier drawers flanking range — handleless modern",
    trigger: "gola_channel && wall_length >= range_width + 48",
    layout: "FC-B2TD{w} + FC-B2TD{w} | RANGE | FC-B2TD{w} + FC-B2TD{w}",
    occurrences: ["OC Design (FC-B2TD21 + FC-B2TD24 | RANGE | FC-B2TD24 + FC-B2TD36)"],
    sophistication: "high",
  },
  {
    id: "knife_insert_flank",
    description: "Knife insert base flanking range for specialized utensil storage",
    trigger: "premium_kitchen && range_width + 18",
    layout: "B3D{w} + BKI-9 | RANGE | B2HD{w} + BPOS-9 + B3D{w}",
    occurrences: ["Bollini (B22.25-RT ×2 + B3D38 + BKI-9 + RANGE + B2HD36 + BPOS-9 + B3D38 — most elaborate range wall in training)"],
    sophistication: "very_high",
    note: "BKI-9 knife insert is 9\" — first specialized utensil storage next to range. Heavy-duty B2HD on other side for pots.",
  },
  {
    id: "range_top_base",
    description: "Dedicated range top base cabinet with drawer bases flanking",
    trigger: "range_top_cooktop",
    layout: "B4D{w} + RTB36 + B4D{w}",
    occurrences: ["Kamisar (B4D18 + RTB36 + B4D18 — range top with 4-drawer bases flanking)"],
    sophistication: "high",
    note: "RTB36 is specialized range top base at 28.5\" height. Paired with B4D18 4-drawer bases.",
  },
  {
    id: "simple_base_flank",
    description: "Standard base or drawer flanking range — budget-conscious",
    trigger: "wall_length >= range_width + 30",
    layout: "B{w} or B3D{w} | RANGE | B{w} or B3D{w}",
    occurrences: ["Lofton (B3D19 | PP9036SJSS slot | B3D17)"],
    sophistication: "standard",
  },
  {
    id: "roll_out_tray_flank",
    description: "Roll-out tray bases flanking range for easy access",
    trigger: "wall_length >= range_width + 60",
    layout: "B{w}-RT + B3D{w} | RANGE | B3D{w} + B{w}-RT",
    occurrences: [
      "McCarter Parade (B33-RT ×2 + B3D18 flanking range zone)",
      "Sabelhaus (B30-RT flanking perimeter)",
    ],
    sophistication: "high",
  },
];


// ─── SINK ZONE PATTERNS ─────────────────────────────────────────────────────

export const SINK_PATTERNS = [
  {
    id: "sink_dw_waste_drawers",
    description: "Classic sink zone: waste → sink → DW, drawers bookending",
    layout: "B3D{w} + BWDMA18 + SB36 + DW(24) + B4D{w}",
    trigger: "always",
    occurrences: [
      "Kline Piazza",
      "Gable (B12L + SBA36 + DW + BWDMA18 + B4D33)",
      "Dolfin Isle island (SB33 + BWDMA18)",
    ],
    note: "Waste can be on either side of sink. DW always adjacent to sink.",
  },
  {
    id: "sink_fhd_flanking",
    description: "Sink base with full-height doors flanking — modern minimal",
    layout: "SB{w}-FHD | (flanking B3D or standard cabs)",
    trigger: "minimal_aesthetic",
    occurrences: ["Huang (SB33-FHD with left finished end)"],
    note: "Full-height door conceals plumbing more cleanly than standard 2-door sink base.",
  },
  {
    id: "sink_island_work_side",
    description: "Island sink with DW, waste, and drawer flanking",
    layout: "B3D{w} + DW + SB36 + BWDMW18 + B3D{w}",
    trigger: "island_with_sink",
    occurrences: ["Imai Robin (B3D24 + DW + SB36 + BWDMW18 + B3D30)"],
    note: "Standard island sink arrangement — DW and waste on opposite sides",
  },
  {
    id: "sink_under_window_minimal_uppers",
    description: "Sink under window, wall cabs flanking window",
    layout: "W{w}L | WINDOW | W{w} + W{w}",
    trigger: "window_above_sink",
    occurrences: [
      "Kline Piazza (W2439L | window | W2739 + W2739)",
      "Alix (W2715 | window | WND2718)",
    ],
  },
  {
    id: "sink_diagonal_corner",
    description: "Diagonal sink base in corner position — first in training",
    layout: "BEP3L-RTK + DSB42-2D + BEP3R-RTK",
    trigger: "l_shape_corner_sink",
    occurrences: ["Kamisar (DSB42-2D diagonal sink base with BEP3-RTK recessed toe kick end panels flanking)"],
    note: "Diagonal sink base sits at 45° in L-shape corner. Recessed toe kick end panels provide clean termination.",
  },
  {
    id: "sink_apron_farmhouse",
    description: "Apron/farmhouse sink base — premium reveal for undermount farmhouse sinks",
    layout: "B3D{w} + SBA36 + DW + B{w}",
    trigger: "farmhouse_aesthetic",
    occurrences: ["Gable (SBA36)", "Bissegger Great Room (SBA36 with PTKL toe kick lighting)"],
    note: "SBA36 has apron-front reveal. Always 36\" width. Used in premium/farmhouse kitchens.",
  },
  {
    id: "sink_double_waste",
    description: "Sink with double waste cabinet for larger households",
    layout: "BTD-12 + SB{w}-FHD + BWDMW21",
    trigger: "double_waste",
    occurrences: ["Huang (BTD-12 + SB33-FHD + BWDMW21 double waste)"],
    note: "21\" waste cabinet provides double capacity; tray divider adjacent for organization.",
  },
];


// ─── FRIDGE POCKET PATTERNS ─────────────────────────────────────────────────

export const FRIDGE_PATTERNS = [
  {
    id: "standard_fridge_pocket",
    description: "REP panels flanking fridge, RW cab above",
    layout: "REP{d}-L + FRIDGE + REP{d}-R + RW{w}{h}",
    trigger: "always_for_built_in",
    occurrences: [
      "Kline Piazza (REP3 93FTK-24R + B36CT80SNS + REP3 93FTK-24L + RW3621(mod))",
      "Gable (REP1.5 93FTK-30R + B36CT80SNS + REP1.5 93FTK-30R + RW3618-27)",
      "Huang (REP3/4 96FTK-27L + fridge + REP3/4 96FTK-27R)",
    ],
    panelThickness: { "0.75": "REP3/4", "1.5": "REP1.5", "3": "REP3" },
    panelDepth: { counterDepth: 24, standard: 27, fullDepth: 30 },
  },
  {
    id: "tall_fridge_pocket",
    description: "Tall fridge pocket with 102-114\" panels for premium presentation",
    layout: "REP{d}H-L + FRIDGE + REP{d}H-R + RW{w}{h}",
    trigger: "premium_fridge_presentation",
    occurrences: [
      "Firebird (REP3/4 102FTK-27R ×2 — tallest in training)",
      "McCarter Parade (REP1.5 114FTK-27L ×2 — tallest overall)",
    ],
    note: "Heights from 93\" to 114\" depending on ceiling and design intent.",
  },
  {
    id: "double_fridge_columns",
    description: "Dual fridge/freezer columns with panels between",
    layout: "FBEP + FRIDGE1 + FREP + OVEN + FREP + FRIDGE2 + FREP",
    trigger: "premium_dual_fridge",
    occurrences: ["Alix (B42 + FBEP + FRIDGE(38\") + FREP + O30105 + FREP + FRIDGE(42\") + FREP)"],
    note: "Highest-end fridge configuration. Requires ~160\" of wall space.",
  },
  {
    id: "fridge_plus_utility_tower",
    description: "Fridge pocket with adjacent utility/pantry tower",
    layout: "U{w}{h}-27 + REP + FRIDGE + REP",
    trigger: "tall_storage_needed",
    occurrences: [
      "DeLawyer (REP3/4 93FTK-30L + BBBF3019 + UT2190-RT-27-L)",
      "Gable (U3D2490L-27 + REP1.5 + B36CT80SNS + REP1.5)",
      "Huang (UT3693 ×2 with ROT-FM + ROT flanking fridge pocket)",
    ],
  },
  {
    id: "fridge_with_stacked_walls",
    description: "Fridge pocket wall with stacked cabinets flanking",
    layout: "SW{w}{h} ×N + RW{w}{h} + REP + FRIDGE + REP",
    trigger: "tall_ceiling_fridge_wall",
    occurrences: ["McCarter Parade (3× SW3060(15) + RW4830-27 on fridge wall)"],
    note: "Stacked wall cabs at 15\" depth fill above-fridge area on tall ceiling fridge walls.",
  },
];


// ─── ISLAND PATTERNS ────────────────────────────────────────────────────────

export const ISLAND_PATTERNS = [
  {
    id: "sink_island_with_seating_back",
    description: "Work side has sink/DW/waste, back side has FHD at 13\" depth for seating",
    workSide: "drawers + DW + SB + waste + drawers",
    seatingSide: "B{w}-FHD at 13\" depth with FTK, repeated to fill island length",
    endTreatment: "EDGTL panels, BBHNVR bar backs, or BDEP deco panels",
    occurrences: [
      "Imai Robin (132\" island: 5 work cabs, 4× B33-FHD back, 2× BBHNVR ends)",
      "OC Design sink island (93\": FC-SB42-FHD + FC-B24L-FHD work, FC-B21L/R-FHD + 48\" open back)",
    ],
  },
  {
    id: "range_island",
    description: "Island with integrated range, drawer/specialty flanking, FHD back",
    rangeSide: "B3D{w} | RANGE | BPOS-12 + B{w}-RT",
    backSide: "B{w}L-FHD + B{w}R-FHD + B42-FHD + B42-FHD (with ROT-FM + ROT)",
    endTreatment: "EDGTL large panels (waterfall ends)",
    occurrences: ["Kline Piazza (129\" island: PRD486WIGU 48\" range, EDGTL 62.5\"/54.5\" ends)"],
    note: "Requires island-mount range hood. Back side B42-FHD loaded with roll-out trays.",
  },
  {
    id: "drawer_island_with_seating",
    description: "All-drawer island with shallow FHD back and counter overhang",
    drawerSide: "FC-B3D30 × N (fill island length with equal drawer bases)",
    seatingSide: "FC-B30-FHD at 13\" depth × N (matching count)",
    occurrences: ["OC Design seating island (93\": 3× FC-B3D30 drawer, 3× FC-B30-FHD(13\") back)"],
  },
  {
    id: "small_prep_island",
    description: "Compact island for prep, drawers on work side, loose doors or panels on back",
    trigger: "island_length <= 60",
    workSide: "B3D{w} + B3D{w}",
    backSide: "LD-STD loose doors or BDEP panels",
    occurrences: ["Alix (54.5\" island: B3D24 + B3D27 work, 3× LD-STD|17.5|30.5 back)"],
  },
  {
    id: "island_with_floating_shelves",
    description: "Island with floating shelves for open display + bar back panel",
    workSide: "SB33 + BWDMA18",
    backSide: "BB1/2-CMP component bar back (modified width)",
    accessorySide: "FLS floating shelves ×4 for open display",
    occurrences: ["Dolfin Isle (SB33 + BWDMA18 work, BB1/2-CMP 77.25\" bar back, 4× FLS|21|3|13)"],
    note: "Floating shelves provide visual lightness while maintaining storage.",
  },
  {
    id: "island_with_base_columns",
    description: "Island with base columns at ends for structural/seating overhang support",
    workSide: "B30 ×3 + B24L with FULL SHELF",
    endTreatment: "BC3341/2-{d} base columns + EDGTS panels",
    finishedTop: "PLWT-SQUARE finished top moldings for overhang",
    occurrences: ["McCarter Parade (3× B30 + B24L, 2× BC3341/2-27, 2× EDGTS|57|34.5, 2× PLWT-SQUARE|60|13)"],
    note: "Base columns provide structural support and design detail at island ends.",
  },
  {
    id: "island_sink_waste_with_bar_backs",
    description: "Island with working sink side and Hartford bar back seating panels",
    workSide: "BTD-9 + SB36-FHD + BWDMB18 + B4D18",
    seatingSide: "BBHTFD ×4 (bar back panels in door style — 52.5\" + 30.125\" sizing)",
    occurrences: ["Bollini (112.625\" island: BTD-9 → SB36-FHD → BWDMB18 → B4D18 work side, 4× BBHTFD bar back seating)"],
    note: "Hartford bar backs are unique to Hartford door style. Work side has clean prep→sink→waste→drawer flow.",
  },
  {
    id: "island_with_deco_end_panels",
    description: "Island with decorative flush end panels and rack details",
    workSide: "B3D30 ×2 (with BDEP-F + RCK flanking) + B18 (BDEP-F + RCK)",
    endTreatment: "BDEP-F flush deco panels with RCK rack details",
    occurrences: ["Firebird (B3D30 ×2 with BDEP-F LT/RT + RCK LT/RT, B18R/L with same)"],
    note: "Premium furniture-style island with decorative end panels and rack details on each base.",
  },
];


// ─── TALL CABINET PATTERNS ──────────────────────────────────────────────────

export const TALL_PATTERNS = [
  {
    id: "oven_tower",
    description: "Dedicated oven cabinet with intermediate rails",
    skuPattern: "O{w}{h}",
    occurrences: [
      "Lofton (O2784 with Jenn Air cutout)",
      "Alix (O30105, 105\" height)",
      "OC Design (FC-O3084)",
      "Huang (O3093 with custom cutouts)",
    ],
    note: "Always requires oven cutout form (ECL-CO-O-AI). Heights 84-105\".",
  },
  {
    id: "oven_micro_tower",
    description: "Combined oven/microwave tower with dual cutouts",
    skuPattern: "OM{w}{h}",
    occurrences: ["Firebird (OM3096|27|25|14|27|14 — MW 27×14 + OVEN 27×25)"],
    note: "Dual cutout form required. 96\" height is standard for combo tower.",
  },
  {
    id: "utility_pantry_tower",
    description: "Tall utility with roll-out trays or 3 drawers",
    variants: {
      rollOutTrays: { sku: "UT{w}{h}-RT-{d}", occurrences: ["DeLawyer (UT2190-RT-27-L)", "Imai Robin (UT22½90-RT-27 ×2)"] },
      threeDrawer: { sku: "U3D{w}{h}-{d}", occurrences: ["Gable (U3D2490L-27)"] },
      standard: { sku: "U{w}{h}", occurrences: ["OC Design (FC-U3384, FC-U2484-2D)"] },
      fullHeight96: { sku: "UT{w}96", occurrences: ["LWH Hartley (UT2196L at 96\" — floor to ceiling)"] },
      rollOutFM: { sku: "UT{w}{h} + ROT-FM + ROT", occurrences: ["Huang (UT3693 with ROT-FM + 3× ROT)", "McCarter Parade (UT1884 with NTK)"] },
    },
    note: "Commonly placed at end of run as bookend. Depths: 18\", 21\", 24\", 27\".",
  },
  {
    id: "utility_stacked_tower",
    description: "Utility tall cabinet topped with wall cabinet for full-height coverage",
    layout: "UT{w}{h} + W{w}{stackH} = total height (e.g., 87+18=105)",
    occurrences: ["Bennet (UT3387 + W3318 = 105\", flanked by F3108 tall fillers at 108\")"],
    note: "Wall cab sits on top of utility tower. Total height must not exceed ceiling.",
  },
  {
    id: "pantry_closet",
    description: "Single shallow-depth FHD base used as pantry in a nook",
    layout: "OVF + B{w}-FHD(18\"depth) + OVF",
    occurrences: ["Kline Piazza (OVF + B39-FHD(37\"×18\") + OVF in small pantry wall)"],
    note: "Overlay fillers on both sides. Modified to 18\" depth and custom width.",
  },
  {
    id: "ntk_utility_tower",
    description: "Utility tall with No Toe Kick for stacked or wall-mounted configs",
    layout: "UT{w}{h} + NTK mod → reduced OA height by 4.5\"",
    occurrences: ["McCarter Parade (UT1884L/R with NTK + MOD/SQ50, 78\" OA height at 18\" depth)"],
    note: "NTK removes toe kick, SW/stacked walls sit above. Commonly combined with depth reduction.",
  },
  {
    id: "flush_inset_oven_tower",
    description: "Flush inset oven cabinet with frame and sub-frame for built-in appliances",
    skuPattern: "FIO{w}{h}-{d}",
    occurrences: [
      "JRS (FIBO27 flush inset base oven with BDEP-F flush deco)",
      "Owen (FIO2790 90H with Miele coffee maker sub-frame, 21D)",
      "Kamisar (FIO3393-27 93H with 1 5/8\" frame + sub frame)",
    ],
    note: "Premium oven integration. Requires Flush Inset Oven Frame + Sub Frame mods. Heights 90-93\".",
  },
  {
    id: "ultra_tall_utility_27d",
    description: "117\" utility towers at 27\" depth with roll-out trays — tallest in training",
    layout: "REP3/4 118FTK ×2 + U21117-27L + U21102-27R + REP3/4 118FTK ×2",
    occurrences: ["Bollini (U21117-27L + U21102-27R at 117H 27D, flanked by 118\" REP panels, 4×/3× ROT + ROT-FM)"],
    note: "Tallest utility in training set. 27\" depth (deeper than standard 24\"). REP panels at 118\" (also tallest).",
  },
  {
    id: "oven_with_wire_tray_dividers",
    description: "Oven cabinet with WTD dividers for organized baking sheet storage",
    layout: "O{w}{h}-{d} + WTD × N",
    occurrences: ["Bollini (O3096-27 with 2× WTD + SUB DRW FRONT + FDS)"],
    note: "WTD dividers convert oven tower drawers into organized tray/sheet storage.",
  },
];


// ─── UPPER WALL CABINET PATTERNS ────────────────────────────────────────────

export const UPPER_PATTERNS = [
  {
    id: "standard_uppers_above_bases",
    description: "Wall cabs aligned with bases below, consistent height",
    trigger: "default",
    heightSelection: "Match ceiling: 96\"→36\"H, 108\"→42\"H, 120\"→stacked(42\"+21\")",
    occurrences: [
      "Gable (5× W3036 Polar Paint)",
      "Kline Piazza (W2439L + W2739 ×2 Shoji White)",
      "Sabelhaus (W3636 ×2 + W3336 ×2 + W3018)",
    ],
  },
  {
    id: "floating_shelves_instead",
    description: "Replace wall cabs with floating shelves for modern look",
    trigger: "modern_minimal_aesthetic",
    skuPattern: "SFLS{w} or FLS|{w}|{d}|{h}",
    occurrences: [
      "Lofton (4× SFLS36 with lighting channels)",
      "DeLawyer (1× FLS|54|3|13)",
      "Dolfin Isle (4× FLS|21|3|13 on island, with PWL lighting)",
      "Firebird (3× FLS|17|3|13 + 3× FLS|24|3|13 with PWL)",
    ],
    note: "PWL (Prep for Lighting) commonly added at $60/shelf for under-shelf lighting.",
  },
  {
    id: "no_uppers",
    description: "Skip wall cabs entirely — open backsplash to ceiling",
    trigger: "ultra_minimal || range_wall_with_hood || sink_wall_with_large_windows",
    occurrences: [
      "DeLawyer (only 2 wall cabs in entire kitchen)",
      "Kline Piazza range wall (no uppers)",
      "Sabelhaus window wall (bases only — no uppers due to window)",
    ],
  },
  {
    id: "stacked_uppers",
    description: "Two tiers of wall cabs for tall ceilings",
    layout: "W{w}42 main + W{w}15/21 stacked above",
    trigger: "ceiling_height >= 108",
    occurrences: [
      "Alix (W4236 + W4215 stacked, SWBC corner pieces)",
      "OC Design (W{w}42 + W{w}21)",
    ],
  },
  {
    id: "stacked_wall_deep",
    description: "Stacked wall cabinets at 15\" depth for fridge/tower walls",
    layout: "SW{w}{h}(15) — single unit stacked cab at 15\" depth",
    trigger: "fridge_wall || tall_ceiling_presentation",
    occurrences: [
      "McCarter Parade (3× SW3060(15) at 60\" height, 15\" depth on fridge wall)",
      "Firebird (SW1551(15)R, SW3351(15) with GFD + FINISHED INT + PWL)",
    ],
    note: "SW units come as single piece with internal divider. 15\" depth for clearance above fridge.",
  },
  {
    id: "stacked_wall_angle",
    description: "Stacked wall angle cabinet for corner/transition zones",
    layout: "SA{w}{h}(15) — angle cabinet for transitions",
    trigger: "corner_transition_tall_ceiling",
    occurrences: ["Firebird (SA2451(15)R with GFD + FINISHED INT + PWL)"],
    note: "Specialized stacked angle cabinet for transitions between straight runs.",
  },
  {
    id: "glass_front_display",
    description: "Glass-front doors (GFD) + finished interior on select uppers",
    mods: ["GFD", "FINISHED INT", "PWL"],
    trigger: "premium_aesthetic",
    occurrences: [
      "Alix (W4236+GFD×2+FINT, W3015+GFD×2+FINT flanking range)",
      "Firebird (SW1551+GFD, SA2451+GFD, SW3351+GFD — all with FINISHED INT + PWL)",
      "Showroom ECLD (W3636+GFD+2-TONE Walnut Rye interior)",
    ],
    note: "GFD is $0 but FINISHED INT is a percentage upcharge. PWL adds $60 for lighting.",
  },
  {
    id: "appliance_garage",
    description: "Tall wall cabinet with appliance garage doors flanking range/sink zone",
    layout: "WGD{w}{h}|{d}|L + ... + WGD{w}{h}|{d}|R",
    trigger: "countertop_storage_concealment",
    occurrences: ["Dolfin Isle (WGD2454|18|L + WGD2454|18|R — 54\" tall, 18\" deep appliance garages)"],
    note: "Garage doors flip up to reveal countertop appliances. 54\" height for tall items.",
  },
  {
    id: "wall_square_corner",
    description: "Wall square corner cabinet pair for upper L-shape turns",
    layout: "WSC2436-PHL + ... + WSC2436-PHR",
    trigger: "upper_l_shape_corner",
    occurrences: ["Sabelhaus (WSC2436-PHL + WSC2436-PHR with BL36-SS-PH-L base lazy susan below)"],
    note: "Pie-hinged wall square corners pair with base lazy susan below.",
  },
  {
    id: "stacked_glass_display_wall",
    description: "Full wall of stacked glass-front cabinets at 63\" height — dramatic display",
    layout: "FWEP + SW{w}63(21) ×N (all with GFD + FINISHED INT + RBS) + SWSC{w}63(21) corner + FWEP",
    trigger: "premium_walnut_display || ultra_premium_budget",
    occurrences: ["Bollini (4× SW3363(21) + SW16.563(21) + SWSC2463(21)R bi-fold corner — 6 total glass cabs, all 63\" with Walnut FINISHED INT)"],
    note: "Most extensive glass display in training set. FWEP flush end panels flank. FINISHED INT crucial for walnut backing visibility through glass.",
  },
  {
    id: "wall_garage_pocket_doors",
    description: "Wall garage cabinets with pocket doors for concealed storage/display",
    layout: "WGPD{w}{h}|{d} ×N (with RCTD/LCTD contour doors + MD mullion)",
    trigger: "great_room_display || library_display",
    occurrences: ["Bissegger Great Room (2× WGPD4272|16 with contour arch doors — designer asked about glass insert option)"],
    note: "Premium display cabinetry. Pocket doors retract. Contour arch doors add character. Potential glass upgrade.",
  },
  {
    id: "range_hood_above",
    description: "Range hood cabinet above cooktop/range — flanked by wall cabs or shelves",
    variants: {
      standard: { sku: "RH21", heights: [24], note: "Standard hood for 30-42\" ranges" },
      large: { sku: "RH50", heights: [42], depth: 24, note: "Large hood for premium ranges — Showroom ECLD" },
    },
    flanking: "WND (no-door) cabs at 12\" height for display shelf above hood",
    occurrences: [
      "Showroom ECLD (RH50 424224 + 2× WND2112 flanking)",
      "Multiple kitchen projects (RH21 standard hood)",
    ],
  },
];


// ─── HUTCH PATTERNS ────────────────────────────────────────────────────────
// Hutch-style: upper cabinets sit directly on countertop for furniture-like feel.
// Very popular with pocket door hardware. Eclipse has WPD and countertop-sitting
// cabinet options that combine into hutch assemblies.

export const HUTCH_PATTERNS = [
  {
    id: "pocket_door_hutch",
    description: "Pocket door hutch cabinets on countertop — doors retract fully for open access",
    layout: "WPD-H{w}{h}|{d} (with PKD hardware) — sits on counter, no backsplash",
    trigger: "hutch || pocket_door_hutch || coffee_station_hutch",
    occurrences: ["Kamisar (WPD3657|18 pocket door wall cab — basis for hutch variant)"],
    note: "Most popular hutch style. Pocket doors retract into cabinet sides, leaving countertop fully accessible. Great for coffee bars, baking zones, and appliance garages. Creates a permanent, furniture-like built-in feel.",
    doorStyle: "pocket",
    hardware: "PKD",
  },
  {
    id: "standard_door_hutch",
    description: "Traditional hutch with standard or glass-front doors on countertop",
    layout: "W-H{w}{h}|{d} (optional GFD glass front + FINISHED INT + PWL lighting)",
    trigger: "display_hutch || china_hutch || glass_hutch",
    note: "Classic furniture-style hutch. Glass front doors showcase dishes, glassware, or collectibles. Interior lighting (PWL) adds warmth. Crown mould at top completes the furniture look.",
    doorStyle: "standard",
    hardware: null,
  },
  {
    id: "appliance_garage_hutch",
    description: "Shorter hutch concealing countertop appliances — toaster, coffee maker, mixer",
    layout: "WGD-H{w}{h}|{d} (with optional PKD pocket doors)",
    trigger: "appliance_garage_hutch || appliance_hideaway",
    note: "24-30\" tall hutch sits on counter, hiding everyday appliances. Pocket doors preferred so appliances are instantly accessible. Can be paired with taller hutch cabs on same wall for a tiered look.",
    doorStyle: "pocket",
    hardware: "PKD",
    heights: [24, 30],
  },
  {
    id: "mixed_hutch_and_upper",
    description: "Hutch cabinets in one zone with standard wall cabs elsewhere on same wall",
    layout: "WPD-H{w}{h}|{d} (hutch zone) + W{w}{h} (standard zone)",
    trigger: "mixed_hutch || partial_hutch",
    note: "Most common real-world approach: hutch in the coffee/baking zone, standard uppers over sink and range. Creates visual interest through height and depth variation on the same wall.",
    doorStyle: "mixed",
    hardware: "PKD",
  },
];


// ─── PENINSULA PATTERNS ─────────────────────────────────────────────────────
// New section from Showroom ECLD, Owen training projects

export const PENINSULA_PATTERNS = [
  {
    id: "column_peninsula_with_shelf",
    description: "Peninsula base columns with edge-banded shelf for seating overhang",
    layout: "PBC3341/2-{d} ×2 + Edge Banded Shelf + REP6R returns",
    occurrences: ["Showroom ECLD (PBC3341/2-36|36 ×2 at 36\" depth, shelf 14\"W × 81\"D with PWL)"],
    note: "Columns provide structural support; shelf extends for seating; REP returns finish exposed sides.",
  },
  {
    id: "peninsula_with_turned_legs",
    description: "Peninsula with PBC columns, turned legs, and furniture base moulding",
    layout: "PBC3341/2-{h} ×2 + TL28-3-341/2 ×4 + 4 1/4FBP ×3",
    occurrences: ["Owen (PBC3341/2-42|35.5 ×2 + TL28 ×4 + FBP ×3 — Rustic Hickory island with peninsula)"],
    note: "Peninsula columns with turned legs for furniture-style seating support. First PBC in two-tone project.",
  },
  {
    id: "simple_peninsula_extension",
    description: "Peninsula extending from wall run — base cabinets with decorative treatment",
    layout: "B{w} + peninsula columns or end panels",
    trigger: "peninsula_with_seating",
    note: "Gable 48\" peninsula return. Simpler than column/leg approach.",
  },
];


// ─── NON-KITCHEN ROOM PATTERNS ──────────────────────────────────────────────
// New section — office, laundry, bathroom, utility patterns

export const OFFICE_PATTERNS = [
  {
    id: "desk_with_file_pedestal",
    description: "Home office desk: file drawer pedestal + vanity pedestal + lap drawer",
    layout: "FD2HD{w} + LD{w} + VB3D{w} (uppers above: W{w}42 ×N)",
    pedestals: {
      fileCabinet: { sku: "FD2HD21", height: 30.5, depth: 24.875, note: "2-file drawer with heavy-duty guides" },
      vanityDrawer: { sku: "VB3D18", height: 30.5, depth: 24.875, note: "Vanity 3-drawer used as desk pedestal" },
      lapDrawer: { sku: "LD36", height: 6, depth: 24.875, note: "Keyboard/pencil tray spanning desk opening" },
    },
    mods: ["24\" DEPTH OPTION", "MOD/SQ30 for custom pedestal sizing"],
    occurrences: ["Bissegger Office (FD2HD21 + VB3D18 + LD36 with W2142L + W1842L ×2 + W1842R above)"],
    note: "Vanity-height bases (30.5\") create standard desk height. Uppers above for book/display storage.",
  },
];

export const LAUNDRY_PATTERNS = [
  {
    id: "l_shape_laundry",
    description: "L-shaped laundry with blind corner, drawer base, and utility tower",
    layout: "UT{w}{h}L + BBC{w}R + B3D{w} (uppers: W{w}42 ×2)",
    occurrences: ["LWH Hartley (UT2196L + BBC48R with FILL BB + FULL SHELF + B3D18)"],
    note: "Utility tower for full-height storage, blind corner maximizes L-shape, drawer for small items.",
  },
];

export const VANITY_PATTERNS = [
  {
    id: "floating_vanity_dual",
    description: "Dual floating vanity sink bases with base columns between",
    layout: "BEP + BC3341 + FLVSB{w}{h} + BC3341 + BEP",
    components: {
      vanity: { sku: "FLVSB4221", height: 21, depth: 21, note: "Wall-mounted, no toe kick, drawer config like VTSD" },
      column: { sku: "BC3341/2-27|23", note: "Base column at custom 1.5\"W × 34.5\"H × 23\"D" },
      finishedTop: { sku: "PLWT-SQUARE|48|20", note: "Finished top square molding for countertop" },
    },
    mods: ["MOD/SQ50 for custom quote workflow"],
    occurrences: ["McCarter Master Bath (2× FLVSB4221 + 2× BC3341/2 + 2× PLWT-SQUARE)"],
    note: "Floating vanities require wall-mount brackets. Changed from standard vanity for structural reasons.",
  },
  {
    id: "symmetrical_vanity_wall",
    description: "Symmetrical single-wall vanity with utility towers flanking sink bases",
    layout: "UV{w}{h}L + VTSB3D{w} + VTSB{w} + VTSB{w} + VTSB3D{w} + UV{w}{h}R",
    components: {
      utilityTower: { sku: "UV1896L/R", height: 96, depth: 21.75, note: "Floor-to-ceiling vanity utility storage" },
      sinkBase: { sku: "VTSB36", height: 36, depth: 21.75, note: "Vanity tall sink base with doors" },
      sinkBase3D: { sku: "VTSB3D36", height: 36, depth: 21.75, note: "Vanity tall 3-drawer sink base" },
    },
    occurrences: ["Cost Plus (UV1896L + VTSB3D36 + VTSB36 + VTSB36 + VTSB3D36 + UV1896R across 198.875\")"],
    note: "Perfect symmetry across vanity wall. Utility towers at ends provide full-height storage.",
  },
  {
    id: "symmetric_drawer_flank_vanity",
    description: "Symmetric drawer bases flanking vanity sink — primary bath pattern",
    layout: "FBEP-L + VTB3D{w} + VTSB{w} + VTB3D{w} + FBEP-R",
    components: {
      sinkBase: { sku: "VTSB30", height: 36, depth: 21.75, note: "Vanity tall sink base" },
      drawerBase: { sku: "VTB3D15", height: 36, depth: 21.75, note: "Vanity tall 3-drawer base" },
      endPanel: { sku: "FBEP 3/4-FTK-L/R", note: "Flush end panel with flush toe kick" },
    },
    lapDrawer: { sku: "LD33", height: 6, note: "Lap drawer spanning above center vanity section" },
    occurrences: ["Diehl Primary Bath (FBEP + VTB3D15 + VTSB30 + VTB3D15 + FBEP + LD33)"],
    sophistication: "high",
  },
  {
    id: "simple_vanity",
    description: "Simple vanity — sink base plus one small drawer cabinet",
    layout: "VTSB{w} + VTB3D{w} + OVF",
    components: {
      sinkBase: { sku: "VTSB27", height: 36, depth: 21.75, note: "Vanity tall sink base" },
      drawerBase: { sku: "VTB3D12", height: 36, depth: 21.75, note: "Vanity tall 3-drawer base" },
      filler: { sku: "OVF", note: "Overlay filler at wall transition" },
    },
    occurrences: ["Diehl Main Bath (VTSB27 + VTB3D12 + OVF — simplest vanity in training)"],
    sophistication: "standard",
  },
];


// ─── BAR PATTERNS ──────────────────────────────────────────────────────────
// Extracted from Bissegger Great Room bar zone

export const BAR_PATTERNS = [
  {
    id: "bar_zone_display",
    description: "Bar zone with floating shelves, beverage center fronts, and blind corner",
    layout: "BBC{w}-S + B{w} + BCF + BCF + FLS...",
    components: {
      blindCorner: { sku: "BBC42R-S", note: "Quarter-turn shelves for corner access" },
      beverageCenter: { sku: "BCF|24W|30H", note: "Beverage center front × 2" },
      floatingShelves: { sku: "FLS|84|3|8", note: "84\" floating shelves at 8\" depth" },
    },
    occurrences: ["Bissegger Great Room bar zone (BBC42R-S + BCF ×2 + FLS — Malibu Reeded Panel {B})"],
    sophistication: "high",
  },
];


// ─── CONTEMPORARY VALANCE PATTERNS ─────────────────────────────────────────
// (Removed — all training occurrences were Shiloh/JRS projects)
export const VALANCE_PATTERNS = [];


// ─── REFRIGERATOR TALL PATTERNS ────────────────────────────────────────────
// (Removed — all training occurrences were Shiloh/Showroom SHIA projects)
export const FRIDGE_TALL_PATTERNS = [];

export const UTILITY_PATTERNS = [
  {
    id: "stacked_utility_towers",
    description: "Utility tall cabinets topped with wall cabinets for floor-to-ceiling storage",
    layout: "F3{h} + UT{w}{h}(mod) + W{w}{stackH}(mod) + F3{h}",
    components: {
      utilityTall: { sku: "UT3387", note: "87\" tall main storage — modified to 31.5\"W × 21\"D" },
      wallCap: { sku: "W3318", note: "18\" wall cap on top — creates 105\" total" },
      tallFiller: { sku: "F3108", note: "108\" tall fillers flanking for terminal closure" },
      subRail: { sku: "3SRM3F-8'", note: "Sub rail connecting wall caps horizontally" },
    },
    mods: ["WIDTH REDUCTION (30% N/C rule)", "MOD N/C WIDTH REDUCTION"],
    occurrences: ["Bennet (2× UT3387(31.5×87×21) + 2× W3318(31.5×18×21) + 2× F3108 + 3SRM3F)"],
    note: "All 4 cabs modified — 67% exceeds 30% N/C limit. 2 cabs get upcharge, 2 get N/C.",
  },
];


// ─── DOOR STYLE → LAYOUT COMPATIBILITY ──────────────────────────────────────

export const DOOR_LAYOUT_COMPAT = {
  "Hanover (HNVR)": {
    group: "A",
    compatibility: ["all layouts"],
    trainingOccurrences: ["Alix (U-shape)", "Imai Robin (single wall + island)", "Dolfin Isle (perimeter + island)", "Cost Plus Vanity"],
    pairsWith: ["glass_front_display", "symmetric_flanking", "bar_back_panels"],
  },
  "Metropolitan VG (MET-V)": {
    group: "A",
    compatibility: ["all layouts", "GOLA channel"],
    trainingOccurrences: ["OC Design (GOLA)", "Lofton (L-shape)", "DeLawyer (L-shape)", "LWH Hartley (laundry)", "Bennet (utility)", "Sabelhaus (L-shape)"],
    pairsWith: ["floating_shelves", "minimal_uppers", "GOLA_handleless"],
  },
  "Napa VG FP (NAPA-V)": {
    group: "A",
    compatibility: ["all layouts"],
    trainingOccurrences: ["Gable (U-shape + pantry)", "Kline Piazza (island + range)"],
    pairsWith: ["butler_pantry", "apron_sink", "two_tone_material", "three_tone_material"],
  },
  "Malibu FP (MLBU)": {
    group: "A",
    compatibility: ["all layouts"],
    trainingOccurrences: ["Bissegger Office", "McCarter Master Bath", "McCarter Parade", "Showroom ECLD"],
    pairsWith: ["reeded_drawer_fronts", "two_tone_interior", "peninsula_columns"],
    note: "Malibu door with optional Reeded Panel drawer front for texture contrast.",
  },
  "Malibu Reeded Panel (RMLB)": {
    group: "B",
    compatibility: ["all layouts"],
    trainingOccurrences: ["McCarter Parade (Malibu Reeded Panel {B})", "Showroom ECLD (door: Malibu FP, drawer: Reeded Panel)"],
    note: "Reeded texture variant — Group B door ($44/door upcharge).",
  },
  "Ward FP (WARD)": {
    group: "A",
    compatibility: ["all layouts"],
    trainingOccurrences: ["Firebird (Ward Flat Panel stain + paint two-tone)"],
    pairsWith: ["stacked_glass_display", "furniture_crown", "under_cabinet_molding"],
    note: "Used across both stain and paint orders in two-tone projects.",
  },
  "Hartford FP (HTFD)": {
    group: "A",
    compatibility: ["all layouts"],
    trainingOccurrences: ["Bollini ($64K — largest kitchen, Walnut Natural, all Hartford)"],
    pairsWith: ["slab_drawer_fronts", "glass_display_wall", "hartford_bar_backs", "magic_corner"],
    note: "First Hartford FP in training set. Clean modern flat panel with Slab Drawer Fronts. 39 line items all Hartford.",
  },
  "Scottsdale FP (SCDL)": {
    group: "A",
    compatibility: ["all layouts"],
    trainingOccurrences: ["JRS (American Poplar, edge 750)", "Owen (two-tone Maple paint + Rustic Hickory stain)", "McComb (two-tone Shoji White + Slate Tile)", "Kamisar (White Oak Almond single-tone)"],
    pairsWith: ["slab_drawer_fronts", "two_tone_paint_stain", "deco_doors"],
    note: "Most versatile door style — seen in 4 projects across single-tone, two-tone, stain, and paint finishes.",
  },
  "Hanover FP 2.5 (HNVR-2.5)": {
    group: "A",
    compatibility: ["all layouts"],
    trainingOccurrences: ["Kamisar (Hanover Flat Panel {A} with 2 1/2 drawer front profile)"],
    pairsWith: ["pocket_door_wall", "diagonal_sink_base", "range_hood_cabinet"],
    note: "Hanover with wider 2.5\" drawer front rail profile — distinct from standard Hanover.",
  },
  "Metropolitan MDF (MET-MDF)": {
    group: "A",
    compatibility: ["all layouts", "GOLA channel"],
    trainingOccurrences: ["Willis (Metropolitan MDF {A} with Painted M1 TruGrey)"],
    pairsWith: ["two_tone_paint_stain", "tiered_drawers", "comparison_pricing"],
    note: "Metropolitan MDF — painted variant for two-tone projects (paint order).",
  },
  "Hanover Flat Panel (HNVR-B)": {
    group: "A",
    drawerFront: { v: "DF-HNVR", g: "B", charge: 55, note: "DF-HNVR is Group B at $55/front" },
    compatibility: ["all layouts"],
    trainingOccurrences: ["Willis Oak order (Hanover {A} door + DF-HNVR {B} drawer front)"],
    pairsWith: ["oak_stain", "comparison_pricing"],
    note: "Hanover door is Group A but DF-HNVR drawer front is Group B with $55 charge — costs more than door.",
  },
  "Metropolitan VG (MET-V) — GOLA": {
    group: "A",
    compatibility: ["GOLA channel"],
    trainingOccurrences: ["Carolyn's Kitchen (ECGO24-A_1, RCWO Braun stain, $33K)"],
    pairsWith: ["gola_handleless", "no_wall_cabinets", "tiered_drawer_dominance", "dishwasher_panel"],
    note: "First pure Gola kitchen in training data. Metropolitan VG on ECGO24 catalog with FC- prefix cabinets throughout.",
  },

};


// ─── ACCESSORY GENERATION RULES ─────────────────────────────────────────────

export const ACCESSORY_RULES = {
  toeKick: {
    standard: "TK-N/C",          // included with order
    charged: "TK-CHARGE",        // charged toe kick (Firebird: $139.20 for 2)
    plywood: "3/4TK",            // plywood finished toe kick
    flush: "FTK FLUSH TOE",      // flush toe kick for exposed ends
    note: "3/4TK when visible terminal ends. FTK for island exposed faces. TK-CHARGE for premium builds.",
  },
  trim: {
    traditional: "7/8TD -8'",    // used to scribe to wall (Cost Plus, Sabelhaus)
    subRail3: "3SRM3F-10'",      // 3" face sub rail
    subRail1_5: "3SRM1 1/2F-10'", // 1.5" face sub rail (Showroom ECLD)
    furnitureBase: "4 1/4FBP-10'", // furniture base moulding (premium)
    furnitureCrown: "4 1/4FCR -10'",  // furniture crown (Firebird)
    furnitureCrown3: "3FCR -10'",     // 3" furniture crown (Cost Plus)
    battenMould: "7/8BM -8'",         // batten mould (McCarter Parade)
    underCabinet: "1 3/4 UCA",        // under cabinet molding (Firebird)
    note: "Traditional trim on all painted orders. Sub rail for all painted wall cabs.",
  },
  touchUp: {
    stain: "TUK-STAIN",          // fill stick & marker
    paintBottle: "TUB",          // bottle of paint + fill stick
    paintQuart: "QST",           // quart of paint (larger jobs)
    note: "TUK-STAIN for stained orders, TUB for painted, QST for large painted orders.",
  },
  endPanels: {
    base: "FBEP 3/4-FTK",
    wall: "FWEP3/4",
    fridge: "FREP3/4 or REP1.5 or REP3",
    base1_5: "BEP1.5-FTK",        // 1.5" base end panel (McCarter, Firebird)
    base3: "BEP3-FTK",            // 3" base end panel (Sabelhaus, Firebird, LWH Hartley)
    note: "Required at every exposed cabinet side and appliance opening. BEP1.5 for lighter-duty, BEP3 standard.",
  },
  finishedTop: {
    sku: "PLWT-SQUARE",
    note: "Finished top square molding for countertop trim. Available in any species/color.",
  },
  rollOutTrays: {
    floorMounted: "ROT-FM",       // floor-mounted roll-out (Huang, Kline Piazza)
    standard: "ROT",              // standard roll-out tray
    note: "ROT-FM for tall utility cabs. 1-4 ROTs per cabinet depending on height.",
  },
  restrictorClips: {
    sku: "RESTRICTOR CLIPS",
    note: "Hinge restrictor clips for safety — Firebird used 16 clips across project.",
  },
};


// ─── GOLA/HANDLELESS CHANNEL PATTERNS ───────────────────────────────────────
// Extracted from Carolyn's Kitchen (ECGO24-A_1) and OC Design

export const GOLA_PATTERNS = {
  channelType: "ECGO24-A_1",
  description: "Frameless Channel (FC-) handleless system — integrated grip channel replaces handles/knobs",

  designRules: {
    noWallCabinets: {
      rule: "Gola kitchens strongly prefer NO wall cabinets — open backsplash or floating shelves only",
      occurrences: ["Carolyn's (zero wall cabs — fully open)", "OC Design (zero wall cabs)"],
      exceptions: "Rare exceptions for very tall pantry/utility walls",
    },
    noMouldings: {
      rule: "No traditional mouldings (crown, batten, sub-rail) — clean modern lines",
      occurrences: ["Carolyn's (no mouldings)", "OC Design (no mouldings)"],
    },
    tieredDrawerDominance: {
      rule: "FC-B2TD (2-tiered drawer) is the dominant base cabinet — replaces standard B, B3D, B4D",
      ratio: "60-80% of base cabinets are B2TD in Gola kitchens",
      occurrences: ["Carolyn's (11 of 15 base cabs are FC-B2TD)", "OC Design (multiple FC-B2TD)"],
    },
    dishwasherPanel: {
      rule: "Gola kitchens require DP (dishwasher door panel) to maintain seamless facade",
      occurrences: ["Carolyn's (DP matching RCWO/Braun finish)"],
    },
    endPanels: {
      rule: "FC-SBEP and FC-DBEP Gola-specific end panels (not standard BEP/FBEP)",
      occurrences: ["Carolyn's (FC-SBEP3/4 34.5FTK-24L/R + FC-DBEP3/4 34.5FTK-24)"],
    },
    tallCabinets: {
      rule: "FC-U2D and FC-O30 for tall cabinets — Gola channel continues vertically",
      occurrences: ["Carolyn's (FC-U2D2496-27 utility + FC-O3096 oven tower)"],
    },
  },

  islandConfig: {
    seatingSide13D: {
      rule: "Island seating side uses FC-B-FHD at 13\" depth (shallow) for knee clearance under counter overhang",
      occurrences: ["OC Design (FC-B30-FHD ×3 at 13\" depth on seating island)", "OC Design (FC-B21L/R-FHD on sink island back)"],
    },
    workSideFullDepth: {
      rule: "Island work side at standard 24\" depth for sink/drawer function",
      occurrences: ["OC Design sink island (FC-SB42-FHD + FC-B24L-FHD at 24\" depth)"],
    },
  },

  pricingNote: "Gola cabinets typically 5-10% premium over equivalent frameless. FC-TUEP tall panels are significant cost items ($1,100+ each).",
};


// ─── COMPARISON PRICING PATTERNS ────────────────────────────────────────────
// Extracted from Willis Kitchen — first 4-order comparison pricing project

export const COMPARISON_PRICING_PATTERNS = {
  description: "Same layout priced across multiple finish/species options for client comparison",

  strategy: {
    sameLayout: "All orders share identical cabinet SKUs, quantities, and dimensions",
    varyFinish: "Only species, finish color, and door style change between orders",
    twoToneSplit: "Two-tone projects split into separate Paint + Stain orders on different catalogs",
  },

  priceDrivers: {
    speciesPremium: {
      description: "Species % applied to stock price — biggest swing factor",
      examples: {
        tfl: { premium: -25, note: "TFL is NEGATIVE — cheapest option (Willis: -$5,143.75)" },
        maple: { premium: 8, note: "Maple standard paint grade" },
        oak: { premium: 12, note: "Red/White Oak mid-range stain" },
        walnut: { premium: 20, note: "Walnut premium — $4-8K over Maple" },
        rcwo: { premium: 19, note: "Rift Cut White Oak — near Walnut pricing" },
      },
    },
    doorGroupCharge: {
      description: "Per-door charge by door group: A=$0, B=$44, C=$88, D=$150",
      example: "Willis Oak order: Hanover {A} doors $0 vs if Hartford {B} would add $44×doors",
    },
    constructionPremium: {
      description: "Frameless construction % upcharge (typically 0% for Eclipse standard)",
    },
  },

  trainingOccurrences: [
    "Willis Kitchen: Paint+Stain two-tone $23,438 vs All-TFL $15,567 vs All-Oak $21,252",
    "Alix: 3 finish variants $26K-$42K range",
    "Imai Robin: 2 finish options $48K-$50K",
  ],
};

/**
 * Tests for Phase 2: Zone-Based Pattern Library
 * ================================================
 * Validates zone-patterns.js — data-mined cabinet selection rules
 * extracted from 39 Eclipse training projects.
 */

import {
  CORNER_TREATMENTS, selectCornerTreatment,
  SINK_ZONE_RULES, RANGE_ZONE_RULES, FRIDGE_POD_RULES,
  ISLAND_RULES_EXTENDED, UPPER_SIZING_RULES,
  FILLER_MOD_RULES, MATERIAL_SPEC_RULES,
  PENINSULA_ZONE_RULES, ZONE_PATTERN_METADATA,
} from './src/zone-patterns.js';

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Metadata ═══");

test("ZONE_PATTERN_METADATA exists", !!ZONE_PATTERN_METADATA);
test("Version is 2.0.0", ZONE_PATTERN_METADATA.version === "2.0.0");
test("Extracted from 39 projects", ZONE_PATTERN_METADATA.extractedFrom.includes("39"));
test("9 pattern categories listed", ZONE_PATTERN_METADATA.patterns.length === 9);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Corner Treatments ═══");

test("3 corner treatment types", Object.keys(CORNER_TREATMENTS).length === 3);
test("blindSuperSusan exists", !!CORNER_TREATMENTS.blindSuperSusan);
test("blindSuperSusan frequency is 5", CORNER_TREATMENTS.blindSuperSusan.frequency === 5);
test("blindSuperSusan SKU is BL36-SS-PH", CORNER_TREATMENTS.blindSuperSusan.sku === "BL36-SS-PH");
test("blindSuperSusan has 5 training occurrences", CORNER_TREATMENTS.blindSuperSusan.trainingOccurrences.length === 5);

test("blindCornerMagic exists", !!CORNER_TREATMENTS.blindCornerMagic);
test("blindCornerMagic widths include 42 and 48", CORNER_TREATMENTS.blindCornerMagic.widths.includes(42) && CORNER_TREATMENTS.blindCornerMagic.widths.includes(48));

test("blindPullHardware exists (budget option)", !!CORNER_TREATMENTS.blindPullHardware);
test("blindPullHardware frequency is 1", CORNER_TREATMENTS.blindPullHardware.frequency === 1);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ selectCornerTreatment() ═══");

const defaultCorner = selectCornerTreatment();
test("Default selection is BL36-SS-PH", defaultCorner.selectedSku === "BL36-SS-PH");

const premiumCorner = selectCornerTreatment({ budget: "premium" });
test("Premium budget selects BBC42R-S", premiumCorner.selectedSku === "BBC42R-S");

const wideCorner = selectCornerTreatment({ availableWidth: 48 });
test("48\" available selects BBC48R-MC", wideCorner.selectedSku === "BBC48R-MC");

const budgetCorner = selectCornerTreatment({ budget: "budget" });
test("Budget selects BL36-PHL", budgetCorner.selectedSku === "BL36-PHL");

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Sink Zone Rules ═══");

test("SINK_ZONE_RULES exported", !!SINK_ZONE_RULES);
test("5 sink base types", Object.keys(SINK_ZONE_RULES.sinkBases).length === 5);
test("Standard sink is SB36", SINK_ZONE_RULES.sinkBases.standard.sku === "SB36");
test("Apron front is SBA36", SINK_ZONE_RULES.sinkBases.apronFront.sku === "SBA36");
test("Wide sink is SB42-1DR", SINK_ZONE_RULES.sinkBases.wide.sku === "SB42-1DR");

test("2 flanking preference patterns", SINK_ZONE_RULES.flankingPreferences.length === 2);
test("Drawer bases flanking frequency is 5", SINK_ZONE_RULES.flankingPreferences[0].frequency === 5);

test("Dishwasher placement rule exists", !!SINK_ZONE_RULES.dishwasherRule);
test("Dishwasher is adjacent to sink", SINK_ZONE_RULES.dishwasherRule.placement === "adjacent_to_sink");

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Range Zone Rules ═══");

test("RANGE_ZONE_RULES exported", !!RANGE_ZONE_RULES);
test("Standard range widths defined", RANGE_ZONE_RULES.standardRangeWidths.includes(30) && RANGE_ZONE_RULES.standardRangeWidths.includes(36));
test("2 flanking preference patterns", RANGE_ZONE_RULES.flankingPreferences.length === 2);
test("Pull-out/roll-out flanking has frequency 4", RANGE_ZONE_RULES.flankingPreferences[0].frequency === 4);
test("Upper above range rules exist", !!RANGE_ZONE_RULES.upperAboveRange);
test("Symmetrical pair pattern defined", !!RANGE_ZONE_RULES.upperAboveRange.symmetricalPair);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Fridge Pod Rules ═══");

test("FRIDGE_POD_RULES exported", !!FRIDGE_POD_RULES);
test("3 end panel types", Object.keys(FRIDGE_POD_RULES.endPanels).length === 3);
test("Standard end panel is REP3/4", FRIDGE_POD_RULES.endPanels.standard.sku === "REP3/4");
test("Wall cab above fridge defined", !!FRIDGE_POD_RULES.wallCabAboveFridge);
test("Short wall cab is RW3621 (most common)", FRIDGE_POD_RULES.wallCabAboveFridge.short.sku === "RW3621");
test("Adjacent tall pairing defined", !!FRIDGE_POD_RULES.adjacentTall);
test("Adjacent tall frequency is 5", FRIDGE_POD_RULES.adjacentTall.frequency === 5);
test("Typical sequence defined", FRIDGE_POD_RULES.typicalSequence.includes("REP"));

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Island Rules Extended ═══");

test("ISLAND_RULES_EXTENDED exported", !!ISLAND_RULES_EXTENDED);
test("Work side defined", !!ISLAND_RULES_EXTENDED.workSide);
test("Display side defined", !!ISLAND_RULES_EXTENDED.displaySide);
test("Display side depth is 13.875\"", ISLAND_RULES_EXTENDED.displaySide.depth === 13.875);
test("Display side typicalCabs include B-FHD", ISLAND_RULES_EXTENDED.displaySide.typicalCabs.includes("B-FHD"));
test("End panels defined", !!ISLAND_RULES_EXTENDED.endPanels);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Upper Sizing Rules ═══");

test("UPPER_SIZING_RULES exported", !!UPPER_SIZING_RULES);
test("4 height contexts", Object.keys(UPPER_SIZING_RULES.heightsByContext).length === 4);
test("Standard height is 36\"", UPPER_SIZING_RULES.heightsByContext.standard.height === 36);
test("Tall height is 39\"", UPPER_SIZING_RULES.heightsByContext.tall.height === 39);
test("Stacked height is 48\"", UPPER_SIZING_RULES.heightsByContext.stacked.height === 48);
test("Floor-to-ceiling is 63\"", UPPER_SIZING_RULES.heightsByContext.floorToCeiling.height === 63);

test("Width ratio with gap ~0.63", UPPER_SIZING_RULES.widthRatioToBase.withGap.avgRatio === 0.63);
test("Width ratio without gap ~0.60", UPPER_SIZING_RULES.widthRatioToBase.withoutGap.avgRatio === 0.60);
test("Width alignment rule exists", !!UPPER_SIZING_RULES.widthAlignment);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Filler vs. Modification Rules ═══");

test("FILLER_MOD_RULES exported", !!FILLER_MOD_RULES);
test("Preference is modification over filler", FILLER_MOD_RULES.preference === "modification_over_filler");

test("3 width mod tiers", Object.keys(FILLER_MOD_RULES.widthModTiers).length === 3);
test("Free tier code is MOD WIDTH N/C", FILLER_MOD_RULES.widthModTiers.free.code === "MOD WIDTH N/C");
test("Free tier frequency is 22", FILLER_MOD_RULES.widthModTiers.free.frequency === 22);
test("SQ30 tier code is MOD/SQ30", FILLER_MOD_RULES.widthModTiers.sq30.code === "MOD/SQ30");
test("SQ50 tier code is MOD/SQ50", FILLER_MOD_RULES.widthModTiers.sq50.code === "MOD/SQ50");

test("Filler use cases defined", !!FILLER_MOD_RULES.fillerUseCases);
test("Zone transition filler is OVF3", FILLER_MOD_RULES.fillerUseCases.zoneTransition.sku === "OVF3");
test("Zone transition filler width is 3\"", FILLER_MOD_RULES.fillerUseCases.zoneTransition.width === 3);

test("Decision function has 5 steps", FILLER_MOD_RULES.decisionFunction.steps.length === 5);
test("Top modifications has PTKL first", FILLER_MOD_RULES.topModifications[0].code === "PTKL");
test("PTKL frequency is 16", FILLER_MOD_RULES.topModifications[0].frequency === 16);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Material Specification Rules ═══");

test("MATERIAL_SPEC_RULES exported", !!MATERIAL_SPEC_RULES);

test("Single-tone frequency is 23 (59%)", MATERIAL_SPEC_RULES.singleTone.frequency === 23);
test("Two-tone frequency is 9 (23%)", MATERIAL_SPEC_RULES.twoTone.frequency === 9);
test("Three-tone frequency is 1", MATERIAL_SPEC_RULES.threeTone.frequency === 1);

test("3 two-tone patterns", MATERIAL_SPEC_RULES.twoTone.patterns.length === 3);
test("Stain bases + paint uppers is first pattern", MATERIAL_SPEC_RULES.twoTone.patterns[0].id === "stain_bases_paint_uppers");

test("Species selection for paint includes Maple", MATERIAL_SPEC_RULES.speciesSelection.forPaint.includes("Maple"));
test("Species selection for stain includes Walnut", MATERIAL_SPEC_RULES.speciesSelection.forStain.includes("Walnut"));
test("Species selection for budget includes TFL", MATERIAL_SPEC_RULES.speciesSelection.forBudget.some(s => s.includes("TFL") || s.includes("Laminate")));

test("Door style frequency has 8 entries", MATERIAL_SPEC_RULES.doorStyleFrequency.length === 8);
test("Hanover FP is most common (9×)", MATERIAL_SPEC_RULES.doorStyleFrequency[0].count === 9);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Peninsula Zone Rules ═══");

test("PENINSULA_ZONE_RULES exported", !!PENINSULA_ZONE_RULES);
test("Peninsula frequency is 3", PENINSULA_ZONE_RULES.frequency === 3);

// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ Cross-Validation: No Shiloh References ═══");

// Verify no Shiloh content leaked into zone patterns
const allText = JSON.stringify({
  CORNER_TREATMENTS, SINK_ZONE_RULES, RANGE_ZONE_RULES, FRIDGE_POD_RULES,
  ISLAND_RULES_EXTENDED, UPPER_SIZING_RULES, FILLER_MOD_RULES,
  MATERIAL_SPEC_RULES, PENINSULA_ZONE_RULES,
});

test("No SHI34A_1 references", !allText.includes("SHI34A_1"));
test("No SHI34_2A_1 references", !allText.includes("SHI34_2A_1"));
test("No SHI24_1 references", !allText.includes("SHI24_1"));
test("No SHI23H_1 references", !allText.includes("SHI23H_1"));
test("No 'Flush Inset' references", !allText.includes("Flush Inset"));
test("No 'Modern Flush Inset' references", !allText.includes("Modern Flush Inset"));
test("No 'Full Overlay' references", !allText.includes("Full Overlay"));

// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${"═".repeat(50)}`);
console.log(`Zone Pattern Tests: ${passed} passed, ${failed} failed (${passed + failed} total)`);
console.log(`${"═".repeat(50)}\n`);

if (failed > 0) process.exit(1);

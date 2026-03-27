/**
 * Eclipse Cabinetry — Margin & Proposal Calculator
 * Dealer margin calculation with project add-ons for full proposal pricing
 */

/**
 * Calculate dealer sell price from cost
 * @param {number} cost - Dealer cost (from pricing engine)
 * @param {number} percentage - Markup or margin percentage
 * @param {string} method - "markup" (cost × 1.35) or "margin" (cost / 0.65)
 * @returns {Object} { sellPrice, grossProfit, grossMarginPct }
 */
export function calculateDealerPrice(cost, percentage = 35, method = "markup") {
  const sell = method === "markup"
    ? cost * (1 + percentage / 100)
    : cost / (1 - percentage / 100);
  const grossProfit = sell - cost;
  const grossMarginPct = sell > 0 ? (grossProfit / sell) * 100 : 0;
  return { sellPrice: sell, grossProfit, grossMarginPct };
}

/**
 * Build a full project proposal with add-ons
 * @param {number} cabinetCost - Total dealer cost for cabinetry
 * @param {Object} options - Proposal configuration
 * @param {number} options.markupPct - Markup/margin percentage (default 35)
 * @param {string} options.markupMethod - "markup" or "margin" (default "markup")
 * @param {number} options.installPerLF - Installation cost per linear foot (default 65)
 * @param {number} options.linearFeet - Total linear feet of cabinetry (default 20)
 * @param {number} options.counterPerSF - Countertop cost per square foot (default 85)
 * @param {number} options.counterSF - Total countertop square footage (default 45)
 * @param {number} options.designFee - Design fee (default 750)
 * @param {number} options.freight - Freight/shipping (default 450)
 * @returns {Object} Full proposal breakdown
 */
export function buildProposal(cabinetCost, options = {}) {
  const {
    markupPct = 35,
    markupMethod = "markup",
    installPerLF = 65,
    linearFeet = 20,
    counterPerSF = 85,
    counterSF = 45,
    designFee = 750,
    freight = 450,
  } = options;

  const dealer = calculateDealerPrice(cabinetCost, markupPct, markupMethod);
  const installCost = installPerLF * linearFeet;
  const counterCost = counterPerSF * counterSF;

  const projectTotal = dealer.sellPrice + installCost + counterCost + designFee + freight;
  const totalProfit = dealer.grossProfit + designFee;
  const blendedMarginPct = projectTotal > 0 ? (totalProfit / projectTotal) * 100 : 0;

  return {
    // Cabinetry
    cabinetCost,
    cabinetSell: dealer.sellPrice,
    cabinetGrossProfit: dealer.grossProfit,
    cabinetMarginPct: dealer.grossMarginPct,

    // Add-ons
    installCost,
    installPerLF,
    linearFeet,
    counterCost,
    counterPerSF,
    counterSF,
    designFee,
    freight,

    // Totals
    projectTotal,
    totalProfit,
    blendedMarginPct,

    // Line items for display
    lineItems: [
      { label: "Cabinetry", value: dealer.sellPrice },
      { label: `Install (${linearFeet} LF)`, value: installCost },
      { label: `Countertops (${counterSF} SF)`, value: counterCost },
      { label: "Design", value: designFee },
      { label: "Freight", value: freight },
    ],
  };
}

/**
 * Calculate a quick estimate range for a kitchen based on linear footage
 * Useful for consumer-facing budget estimators
 * @param {number} linearFeet - Kitchen linear footage
 * @param {string} tier - "entry" | "mid" | "premium" | "luxury"
 * @returns {Object} { lowEstimate, highEstimate, perLFRange }
 */
export function quickEstimate(linearFeet, tier = "mid") {
  const tiers = {
    entry:   { low: 150, high: 250 },   // TFL, PV, basic species
    mid:     { low: 250, high: 450 },   // White Oak, Maple, standard doors
    premium: { low: 450, high: 700 },   // Walnut, QS White Oak, mitered doors, plywood
    luxury:  { low: 700, high: 1200 },  // Custom paint, specialty mullions, Legrabox
  };
  const range = tiers[tier] || tiers.mid;
  return {
    lowEstimate: linearFeet * range.low,
    highEstimate: linearFeet * range.high,
    perLFRange: range,
  };
}

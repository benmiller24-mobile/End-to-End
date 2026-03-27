/**
 * Eclipse Kitchen Designer â Project Cost Summary & Export
 * ===========================================================
 * Aggregates pricing data into formatted summaries with category breakdowns,
 * modification analysis, species/construction surcharge details, and top items.
 */

/**
 * Generate a structured cost summary from project quote result.
 *
 * @param {Object} quoteResult - Result from configureProject() with { layout, quote, ... }
 * @returns {Object} Structured summary with categories, totals, breakdowns
 */
export function generateProjectSummary(quoteResult) {
  const { layout, quote } = quoteResult;

  if (!quote || !quote.specs) {
    throw new Error("generateProjectSummary requires quote with pricing.specs");
  }

  // Flatten all pricedItems from all specs
  const allPricedItems = quote.specs.flatMap(spec => spec.pricedItems || []);

  // Extract layout info
  const layoutType = layout?.layoutType || quoteResult.layoutType || quoteResult.project?.layoutType || "unknown";
  const roomType = layout?.roomType || quoteResult.roomType || quoteResult.project?.roomType || "unknown";
  const totalCabinets = quoteResult.totalCabinets ||
    (layout?.metadata?.totalCabinets ?? allPricedItems.length);
  const totalPlacements = layout?.metadata?.totalPlacements ?? 0;
  const validationErrors = layout?.metadata?.errors ?? 0;
  const validationWarnings = layout?.metadata?.warnings ?? 0;

  // ââ CATEGORY AGGREGATION ââ
  const categories = {
    baseCabinets: { count: 0, subtotal: 0 },
    wallCabinets: { count: 0, subtotal: 0 },
    tallCabinets: { count: 0, subtotal: 0 },
    cornerCabinets: { count: 0, subtotal: 0 },
    sinkBaseCabinets: { count: 0, subtotal: 0 },
    islandCabinets: { count: 0, subtotal: 0 },
    accessories: { count: 0, subtotal: 0 },
    panels: { count: 0, subtotal: 0 },
    modifications: { count: 0, subtotal: 0 },
    trim: { count: 0, subtotal: 0 },
  };

  // Map items to categories
  for (const item of allPricedItems) {
    const sku = item.sku || "";
    const modCharge = item.modCharge || 0;

    // Categorize by SKU prefix and family
    if (sku.startsWith("FC-")) {
      // GOLA special â still count as its base type
      categorizeByCabinet(sku.slice(3), categories, item);
    } else {
      categorizeByCabinet(sku, categories, item);
    }

    // Add modifications to modifications category
    if (modCharge > 0) {
      categories.modifications.subtotal += modCharge;
    }
  }

  // Count accessories from quote
  if (quote.accessoryBreakdown && Array.isArray(quote.accessoryBreakdown)) {
    let accTotalQty = 0;
    let accTotalCost = 0;
    for (const acc of quote.accessoryBreakdown) {
      accTotalQty += acc.qty || 1;
      accTotalCost += acc.cost || 0;
    }
    if (quote.accessoryTotal > 0) {
      categories.accessories.count = accTotalQty;
      categories.accessories.subtotal = quote.accessoryTotal;
    }
  }

  // ââ MODIFICATION BREAKDOWN ââ
  // Aggregate modifications by type across all items
  const modMap = new Map();
  for (const item of allPricedItems) {
    if (item.modBreakdown && Array.isArray(item.modBreakdown)) {
      for (const mod of item.modBreakdown) {
        const modKey = mod.mod || mod.type;
        if (!modMap.has(modKey)) {
          modMap.set(modKey, { totalQty: 0, totalCharge: 0 });
        }
        const entry = modMap.get(modKey);
        entry.totalQty += mod.qty || 1;
        entry.totalCharge += mod.cost || 0;
      }
    }
  }
  const modificationBreakdown = Array.from(modMap.entries()).map(([mod, data]) => ({
    mod,
    totalQty: data.totalQty,
    totalCharge: data.totalCharge,
  }));

  // ââ SPECIES SURCHARGE ââ
  let speciesSurcharge = { species: "", pct: 0, totalAdded: 0 };
  if (quote.specs.length > 0) {
    const species = quote.specs[0].species || "Maple";
    // Estimate species surcharge from first item's pricing
    if (allPricedItems.length > 0) {
      const item = allPricedItems[0];
      const speciesPct = item.speciesUpcharge || 0;
      // Calculate added cost from species
      const added = allPricedItems.reduce((sum, it) => {
        const basePrice = it.listPrice || 0;
        const specPct = it.speciesUpcharge || 0;
        const added = basePrice * (specPct / 100);
        return sum + added;
      }, 0);
      speciesSurcharge = {
        species,
        pct: speciesPct,
        totalAdded: Math.round(added * 100) / 100,
      };
    }
  }

  // ââ CONSTRUCTION SURCHARGE ââ
  let constructionSurcharge = { construction: "", pct: 0, totalAdded: 0 };
  if (quote.specs.length > 0) {
    const construction = quote.specs[0].construction || "Standard";
    if (allPricedItems.length > 0) {
      const item = allPricedItems[0];
      const constructPct = item.constructionUpcharge || 0;
      // Calculate added cost from construction
      const added = allPricedItems.reduce((sum, it) => {
        const basePrice = it.listPrice || 0;
        const cPct = it.constructionUpcharge || 0;
        const added = basePrice * (cPct / 100);
        return sum + added;
      }, 0);
      constructionSurcharge = {
        construction,
        pct: constructPct,
        totalAdded: Math.round(added * 100) / 100,
      };
    }
  }

  // ââ TOP ITEMS (by price, descending) ââ
  const topItems = allPricedItems
    .map(item => ({
      sku: item.sku,
      price: item.totalPrice,
      wall: item.wall || "N/A",
    }))
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);

  // ââ PROJECT TOTAL ââ
  const projectTotal = quote.projectTotal || 0;

  return {
    projectTotal,
    categories,
    modificationBreakdown,
    speciesSurcharge,
    constructionSurcharge,
    topItems,
    roomSummary: {
      layoutType,
      roomType,
      totalCabinets,
      totalPlacements,
      validationErrors,
      validationWarnings,
    },
  };
}

/**
 * Categorize a cabinet item by its SKU prefix.
 * @private
 */
function categorizeByCabinet(sku, categories, item) {
  const totalPrice = item.totalPrice || 0;

  // Corner cabinets
  if (/^BL\d|^BBC/.test(sku)) {
    categories.cornerCabinets.count++;
    categories.cornerCabinets.subtotal += totalPrice;
  }
  // Sink bases
  else if (/^SBA|^SB|^DSB/.test(sku)) {
    categories.sinkBaseCabinets.count++;
    categories.sinkBaseCabinets.subtotal += totalPrice;
  }
  // Tall cabinets
  else if (/^NTK|^TP|^FIO|^TC|^BO/.test(sku)) {
    categories.tallCabinets.count++;
    categories.tallCabinets.subtotal += totalPrice;
  }
  // Wall cabinets (including stacked)
  else if (/^SWSC|^WSC|^RW|^W\d|^WGP?D|^WND|^WPD|^WS\d|^RH/.test(sku)) {
    categories.wallCabinets.count++;
    categories.wallCabinets.subtotal += totalPrice;
  }
  // Island (prefix indicator)
  else if (sku.includes("ISLAND") || sku.includes("PEND")) {
    categories.islandCabinets.count++;
    categories.islandCabinets.subtotal += totalPrice;
  }
  // Trim / hardware
  else if (/^3SRM|^CRN|^STP|^BM|^PLWT|^PBC|^BC\d|^TL\d|^FBP|^FSLB/.test(sku)) {
    categories.trim.count++;
    categories.trim.subtotal += totalPrice;
  }
  // Panels
  else if (/^FBEP|^FWEP|^BEP|^FREP|^REP|^REF$|^EDGTL|^DWP|^FDP|^FZP/.test(sku)) {
    categories.panels.count++;
    categories.panels.subtotal += totalPrice;
  }
  // Fillers, accessories, valances, light bridges
  else if (/^F\d|^VLN|^LB-|^TK|^TUK|^TUB|^QST|^UCL|^ICL|^TKL|^DSL/.test(sku)) {
    categories.accessories.count++;
    categories.accessories.subtotal += totalPrice;
  }
  // Default: base cabinet
  else {
    categories.baseCabinets.count++;
    categories.baseCabinets.subtotal += totalPrice;
  }
}

/**
 * Generate a formatted text breakdown of the project cost summary.
 *
 * @param {Object} summary - Result from generateProjectSummary()
 * @returns {string} Formatted text suitable for print/export
 */
export function generateCostBreakdownText(summary) {
  const {
    projectTotal,
    categories,
    modificationBreakdown,
    speciesSurcharge,
    constructionSurcharge,
    topItems,
    roomSummary,
  } = summary;

  // Format currency
  const fmt = (n) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n);
  };

  // Format layout type
  const layoutLabel = (roomSummary.layoutType || "unknown")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const roomLabel = (roomSummary.roomType || "unknown")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const lines = [];
  lines.push("â".repeat(55));
  lines.push("ECLIPSE KITCHEN DESIGNER â PROJECT COST SUMMARY");
  lines.push("â".repeat(55));
  lines.push("");
  lines.push(`Layout: ${layoutLabel} ${roomLabel}`);
  lines.push(`Total Cabinets: ${roomSummary.totalCabinets}`);
  lines.push("");
  lines.push("â Category Breakdown " + "â".repeat(33));

  // Category entries (non-zero only)
  const categoryLabels = {
    baseCabinets: "Base Cabinets",
    wallCabinets: "Wall Cabinets",
    tallCabinets: "Tall Cabinets",
    cornerCabinets: "Corner Cabinets",
    sinkBaseCabinets: "Sink Bases",
    islandCabinets: "Island Cabinets",
    accessories: "Accessories",
    panels: "Panels",
    modifications: "Modifications",
    trim: "Trim",
  };

  let categoryTotal = 0;
  for (const [key, label] of Object.entries(categoryLabels)) {
    const cat = categories[key];
    if (cat && cat.count > 0) {
      categoryTotal += cat.subtotal;
      const line = `${label} (${cat.count})`.padEnd(30);
      lines.push(`${line} ${fmt(cat.subtotal).padStart(14)}`);
    }
  }

  lines.push(" ".repeat(30) + "â".repeat(15));
  lines.push(`${"PROJECT TOTAL".padEnd(30)} ${fmt(projectTotal).padStart(14)}`);
  lines.push("");

  // Top 5 items
  if (topItems.length > 0) {
    lines.push("â Top 5 Items " + "â".repeat(40));
    topItems.forEach((item, i) => {
      const numLabel = `${i + 1}.`;
      const skuLabel = item.sku;
      const wallLabel = `[${item.wall}]`;
      const line = `${numLabel.padEnd(4)} ${skuLabel.padEnd(20)} ${wallLabel.padEnd(8)}`;
      lines.push(`${line} ${fmt(item.price).padStart(10)}`);
    });
    lines.push("");
  }

  // Species / Construction surcharges
  lines.push("â Species/Construction " + "â".repeat(32));
  if (speciesSurcharge.pct !== 0) {
    lines.push(`Species: ${speciesSurcharge.species} (+${speciesSurcharge.pct}%)`.padEnd(30) +
      `${fmt(speciesSurcharge.totalAdded).padStart(14)} added`);
  } else {
    lines.push(`Species: ${speciesSurcharge.species} (+0%)`.padEnd(30) +
      `${fmt(0).padStart(14)} added`);
  }

  if (constructionSurcharge.pct !== 0) {
    lines.push(`Construction: ${constructionSurcharge.construction} (+${constructionSurcharge.pct}%)`.padEnd(30) +
      `${fmt(constructionSurcharge.totalAdded).padStart(14)} added`);
  } else {
    lines.push(`Construction: ${constructionSurcharge.construction} (+0%)`.padEnd(30) +
      `${fmt(0).padStart(14)} added`);
  }

  lines.push("");

  // Modification breakdown (if any)
  if (modificationBreakdown.length > 0) {
    lines.push("â Modifications " + "â".repeat(38));
    for (const mod of modificationBreakdown) {
      const modLabel = mod.mod.padEnd(20);
      const qtyLabel = `Qty: ${mod.totalQty}`.padEnd(12);
      lines.push(`  ${modLabel} ${qtyLabel} ${fmt(mod.totalCharge).padStart(12)}`);
    }
    lines.push("");
  }

  lines.push("â".repeat(55));

  return lines.join("\n");
}

/**
 * Eclipse Cabinet Designer â Revision & Change Order Tracking
 * ============================================================
 * Diff two layouts and compute price deltas for change orders.
 *
 * Functions:
 *   - diffLayouts(layoutA, layoutB) â Compare two solve() results
 *   - diffQuotes(quoteA, quoteB) â Compare two configureProject() results with pricing
 *   - createRevision(originalQuote, changes) â Apply changes and auto-generate diff
 */

/**
 * Compare two layouts (solve() results) and identify changes.
 *
 * Matches placements by wall + position (or index if position unavailable).
 * A placement is "modified" if same wall+position but different SKU or mods.
 *
 * @param {Object} layoutA - First layout result from solve()
 * @param {Object} layoutB - Second layout result from solve()
 * @returns {Object} Diff result with added, removed, modified, unchanged, summary
 */
export function diffLayouts(layoutA, layoutB) {
  const placementsA = layoutA.placements || [];
  const placementsB = layoutB.placements || [];

  // Build maps by wall + position/index for matching
  const mapLayout = (placements) => {
    const map = new Map();
    placements.forEach((p, idx) => {
      // Key: "wall:position" or "wall:idx" if no position
      const wall = p.wall || "unknown";
      const key = p.position !== undefined
        ? `${wall}:${p.position}`
        : `${wall}:idx-${idx}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return map;
  };

  const mapA = mapLayout(placementsA);
  const mapB = mapLayout(placementsB);

  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  // Check all keys in B
  const processedKeysA = new Set();

  for (const [key, itemsB] of mapB) {
    if (mapA.has(key)) {
      const itemsA = mapA.get(key);
      processedKeysA.add(key);

      // Match items by SKU, count differences
      const itemsAByIdx = new Map(itemsA.map((item, idx) => [idx, item]));
      const itemsBByIdx = new Map(itemsB.map((item, idx) => [idx, item]));

      for (const [idxB, itemB] of itemsBByIdx) {
        const itemA = itemsAByIdx.get(idxB);

        if (!itemA) {
          // B has more items at this key than A
          added.push(itemB);
        } else if (itemA.sku !== itemB.sku || JSON.stringify(itemA.mods || []) !== JSON.stringify(itemB.mods || [])) {
          // SKU or mods changed
          modified.push({
            before: itemA,
            after: itemB,
          });
        } else {
          // Identical
          unchanged.push(itemA);
        }
      }

      // If A had more items at this key, they're removed
      if (itemsA.length > itemsB.length) {
        for (let i = itemsB.length; i < itemsA.length; i++) {
          removed.push(itemsA[i]);
        }
      }
    } else {
      // Key not in A, all items in B are added
      added.push(...itemsB);
    }
  }

  // Check all keys in A that weren't in B â those are removed
  for (const [key, itemsA] of mapA) {
    if (!processedKeysA.has(key)) {
      removed.push(...itemsA);
    }
  }

  // Calculate summary
  const summary = {
    totalAdded: added.length,
    totalRemoved: removed.length,
    totalModified: modified.length,
    totalUnchanged: unchanged.length,
    netCabinetChange: added.length - removed.length,
  };

  return {
    added,
    removed,
    modified,
    unchanged,
    summary,
  };
}

/**
 * Compare two quotes (configureProject() results) and compute price deltas.
 *
 * Returns layout diff PLUS pricing diff including changeOrder description.
 *
 * @param {Object} quoteA - First quote from configureProject()
 * @param {Object} quoteB - Second quote from configureProject()
 * @returns {Object} Diff with layoutDiff, priceDiff, changeOrder
 */
export function diffQuotes(quoteA, quoteB) {
  const layoutA = quoteA._raw?.solverOutput;
  const layoutB = quoteB._raw?.solverOutput;

  if (!layoutA || !layoutB) {
    throw new Error("diffQuotes requires quotes with _raw.solverOutput data");
  }

  // Get layout diff
  const layoutDiff = diffLayouts(layoutA, layoutB);

  // Get pricing totals
  const originalTotal = quoteA.pricing?.projectTotal || 0;
  const revisedTotal = quoteB.pricing?.projectTotal || 0;
  const delta = revisedTotal - originalTotal;
  const deltaPercent = originalTotal > 0 ? (delta / originalTotal) * 100 : 0;

  // Calculate cost changes for added/removed/modified items
  // We need to extract pricing from the specs
  const getItemPrice = (quote, sku) => {
    const specs = quote.pricing?.specs || [];
    const spec = specs.find(s => s.sku === sku);
    return spec?.totalPrice || 0;
  };

  let addedCost = 0;
  for (const item of layoutDiff.added) {
    addedCost += getItemPrice(quoteB, item.sku);
  }

  let removedCredit = 0;
  for (const item of layoutDiff.removed) {
    removedCredit += getItemPrice(quoteA, item.sku);
  }

  let modifiedDelta = 0;
  for (const { before, after } of layoutDiff.modified) {
    const beforePrice = getItemPrice(quoteA, before.sku);
    const afterPrice = getItemPrice(quoteB, after.sku);
    modifiedDelta += afterPrice - beforePrice;
  }

  // Auto-generate change order description
  const changeDescription = generateChangeDescription(layoutDiff);

  // Build changeOrder items list
  const changeOrderItems = [];

  for (const item of layoutDiff.added) {
    const price = getItemPrice(quoteB, item.sku);
    changeOrderItems.push({
      action: "add",
      sku: item.sku,
      wall: item.wall,
      width: item.width,
      mods: item.mods || [],
      priceDelta: price,
    });
  }

  for (const item of layoutDiff.removed) {
    const price = getItemPrice(quoteA, item.sku);
    changeOrderItems.push({
      action: "remove",
      sku: item.sku,
      wall: item.wall,
      width: item.width,
      mods: item.mods || [],
      priceDelta: -price,
    });
  }

  for (const { before, after } of layoutDiff.modified) {
    const beforePrice = getItemPrice(quoteA, before.sku);
    const afterPrice = getItemPrice(quoteB, after.sku);
    changeOrderItems.push({
      action: "modify",
      skuBefore: before.sku,
      skuAfter: after.sku,
      wall: before.wall,
      priceDelta: afterPrice - beforePrice,
    });
  }

  return {
    layoutDiff,
    priceDiff: {
      originalTotal,
      revisedTotal,
      delta,
      deltaPercent: Math.round(deltaPercent * 100) / 100,
      addedCost,
      removedCredit,
      modifiedDelta,
    },
    changeOrder: {
      description: changeDescription,
      items: changeOrderItems,
    },
  };
}

/**
 * Generate a human-readable description of changes.
 *
 * @param {Object} layoutDiff - Result from diffLayouts()
 * @returns {string} Auto-generated summary like "Added 3 cabs, removed 1, modified 2"
 */
function generateChangeDescription(layoutDiff) {
  const { added, removed, modified } = layoutDiff.summary;

  const parts = [];
  if (added > 0) parts.push(`Added ${added} cab${added === 1 ? "" : "s"}`);
  if (removed > 0) parts.push(`removed ${removed}`);
  if (modified > 0) parts.push(`modified ${modified}`);

  if (parts.length === 0) {
    return "No changes";
  }

  // Join with commas, last one gets "and"
  if (parts.length === 1) {
    return parts[0];
  }

  const last = parts.pop();
  return parts.join(", ") + ", and " + last;
}

/**
 * Create a new quote by applying changes to an existing quote.
 *
 * Re-runs configureProject with merged input, then auto-generates diff.
 *
 * @param {Object} originalQuote - Original quote from configureProject()
 * @param {Object} changes - Changes object: { prefs: {...}, walls: [...], appliances: [...] }
 * @param {Function} configureProjectFn - The configureProject function (passed in for testability)
 * @returns {Object} { original, revised, diff, revision }
 */
export function createRevision(originalQuote, changes, configureProjectFn) {
  if (!configureProjectFn) {
    throw new Error("createRevision requires configureProjectFn argument");
  }

  if (!originalQuote._raw?.solverOutput?.walls) {
    throw new Error("createRevision requires quote with _raw.solverOutput.walls");
  }

  // Merge the original room input with changes
  const originalRoom = originalQuote.project;
  const originalLayout = originalQuote._raw.solverOutput;

  // Build new room input by merging
  const newRoom = {
    layoutType: originalLayout.layoutType,
    roomType: originalLayout.roomType,
    walls: changes.walls !== undefined ? changes.walls : originalLayout.walls.map(w => ({
      id: w.wallId,
      length: w.wallLength,
    })),
    appliances: changes.appliances !== undefined ? changes.appliances : [],
    prefs: { ...originalLayout.prefs, ...changes.prefs },
  };

  // Re-run configureProject with merged input
  const newQuote = configureProjectFn({
    room: newRoom,
    materials: originalQuote.materials,
    options: { projectName: originalQuote.project.name },
  });

  // Compute diff
  const diff = diffQuotes(originalQuote, newQuote);

  return {
    original: originalQuote,
    revised: newQuote,
    diff,
    revision: 1, // Could be incremented if tracking multiple revisions
  };
}

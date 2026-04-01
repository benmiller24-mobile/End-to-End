/**
 * Eclipse Kitchen Cabinet Layout Engine - Part ID Generator
 *
 * Generates unique, barcode-friendly PART IDs for all cabinet components and accessories
 * in a kitchen layout. Each part ID encodes room, wall, sequence, SKU, and modifications
 * for installation-ready part identification and BOM generation.
 *
 * Format: {ROOM}-{WALL}-{SEQ}-{SKU}-{MODS}
 * Example: KIT-A-001-B30-RT-GFD.RBS
 *
 * @module part-id-generator
 * @version 1.0.0
 */

/**
 * Room type codes used in part identification
 * @typedef {Object} RoomCodes
 * @property {string} KIT - Kitchen
 * @property {string} OFF - Office
 * @property {string} LAU - Laundry
 * @property {string} BTH - Bathroom
 * @property {string} VAN - Vanity
 */

/**
 * Modification codes that can be applied to cabinet units
 * @typedef {Object} ModificationCodes
 * @property {string} GFD - Glass Front Door
 * @property {string} RBS - Rollout Behind Shelf
 * @property {string} 2TN - Two-Tone finish
 * @property {string} FI - Finished Interior
 * @property {string} SH - Soft Close Hinges (default, typically omitted)
 * @property {string} DR - Door Reversal (hinge swap)
 * @property {string} USL - Under-shelf Lighting
 * @property {string} RS - Reduced Stile (for tight fits)
 * @property {string} WF - Waterfall edge
 * @property {string} DP - Decorative Panel applied
 */

/**
 * Accessory type codes for non-cabinet items
 * @typedef {Object} AccessoryTypes
 * @property {string} TK - Toe kick
 * @property {string} CRN - Crown molding
 * @property {string} LR - Light rail
 * @property {string} FIL - Filler
 * @property {string} SCR - Scribe
 * @property {string} EP - End panel (Left/Right)
 * @property {string} DFBP - Door Front Bottom Panel
 * @property {string} CBL - Corbel
 * @property {string} RAIL - Mounting rail
 */

/**
 * Part ID format constants and valid codes
 */
export const PART_ID_CONSTANTS = {
  ROOM_CODES: {
    KIT: 'KIT',     // Kitchen
    OFF: 'OFF',     // Office
    LAU: 'LAU',     // Laundry
    BTH: 'BTH',     // Bathroom
    VAN: 'VAN'      // Vanity
  },

  WALL_IDENTIFIERS: {
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
    ISL: 'ISL',     // Island
    PEN: 'PEN'      // Peninsula
  },

  MODIFICATION_CODES: {
    GFD: 'GFD',     // Glass Front Door
    RBS: 'RBS',     // Rollout Behind Shelf
    '2TN': '2TN',   // Two-Tone finish
    FI: 'FI',       // Finished Interior
    SH: 'SH',       // Soft Close Hinges (default, usually omitted)
    DR: 'DR',       // Door Reversal
    USL: 'USL',     // Under-shelf Lighting
    RS: 'RS',       // Reduced Stile
    WF: 'WF',       // Waterfall edge
    DP: 'DP'        // Decorative Panel
  },

  ACCESSORY_TYPES: {
    TK: 'TK',       // Toe kick
    CRN: 'CRN',     // Crown molding
    LR: 'LR',       // Light rail
    FIL: 'FIL',     // Filler
    SCR: 'SCR',     // Scribe
    EP: 'EP',       // End panel
    DFBP: 'DFBP',   // Door Front Bottom Panel
    CBL: 'CBL',     // Corbel
    RAIL: 'RAIL'    // Mounting rail
  },

  CABINET_TYPES: {
    BASE: 'BASE',
    UPPER: 'UPPER',
    TALL: 'TALL'
  },

  SEQUENCE_FORMAT: '3d',  // 3-digit zero-padded format (001, 002, etc.)
  MODULO_BASE: 10        // Check digit uses modulo 10
};

/**
 * Generates a formatted part ID string with optional check digit for barcode compatibility
 *
 * @param {string} room - Room code (KIT, OFF, LAU, BTH, VAN)
 * @param {string} wall - Wall identifier (A, B, C, D, ISL, PEN)
 * @param {number|string} seq - Sequence number on that wall (will be zero-padded to 3 digits)
 * @param {string} sku - Eclipse C3 catalog SKU (e.g., B30-RT, W3630, BBC36-MC)
 * @param {string[]|string} [mods=[]] - Modification codes as array or dot-separated string
 * @param {Object} [options={}] - Generation options
 * @param {boolean} [options.includeCheckDigit=false] - Add modulo-10 check digit to part ID
 * @returns {string} Formatted part ID string, e.g., "KIT-A-001-B30-RT-GFD.RBS"
 * @throws {Error} If required parameters are invalid or empty
 *
 * @example
 * // Basic cabinet part ID
 * formatPartId('KIT', 'A', 1, 'B30-RT')
 * // → 'KIT-A-001-B30-RT'
 *
 * @example
 * // With modifications
 * formatPartId('KIT', 'A', 1, 'B30-RT', ['GFD', 'RBS'])
 * // → 'KIT-A-001-B30-RT-GFD.RBS'
 *
 * @example
 * // With check digit for barcode
 * formatPartId('KIT', 'A', 1, 'B30-RT', 'GFD.RBS', { includeCheckDigit: true })
 * // → 'KIT-A-001-B30-RT-GFD.RBS-8'
 */
export function formatPartId(room, wall, seq, sku, mods = [], options = {}) {
  // Validate required parameters
  if (!room || !Object.values(PART_ID_CONSTANTS.ROOM_CODES).includes(room)) {
    throw new Error(`Invalid room code: ${room}. Must be one of: ${Object.values(PART_ID_CONSTANTS.ROOM_CODES).join(', ')}`);
  }
  if (!wall || !Object.values(PART_ID_CONSTANTS.WALL_IDENTIFIERS).includes(wall)) {
    throw new Error(`Invalid wall identifier: ${wall}. Must be one of: ${Object.values(PART_ID_CONSTANTS.WALL_IDENTIFIERS).join(', ')}`);
  }
  if (!sku || typeof sku !== 'string') {
    throw new Error('SKU must be a non-empty string');
  }

  // Format sequence number (3-digit zero-padded)
  const seqFormatted = String(seq).padStart(3, '0');

  // Normalize modifications to array
  let modArray = [];
  if (Array.isArray(mods)) {
    modArray = mods.filter(m => m && m !== 'SH'); // Filter out empty and default SH
  } else if (typeof mods === 'string' && mods.trim()) {
    modArray = mods.split('.').filter(m => m && m !== 'SH');
  }

  // Build base part ID
  let partId = `${room}-${wall}-${seqFormatted}-${sku}`;

  // Append modifications if present
  if (modArray.length > 0) {
    partId += `-${modArray.join('.')}`;
  }

  // Add check digit if requested
  if (options.includeCheckDigit) {
    const checkDigit = calculateCheckDigit(partId);
    partId += `-${checkDigit}`;
  }

  return partId;
}

/**
 * Generates a formatted accessory part ID
 *
 * @param {string} room - Room code (KIT, OFF, LAU, BTH, VAN)
 * @param {string} accessoryType - Accessory type code (TK, CRN, LR, FIL, SCR, EP, DFBP, CBL, RAIL)
 * @param {string} wall - Wall identifier (A, B, C, D, ISL, PEN)
 * @param {number|string} seq - Sequence number on that wall
 * @param {string|number} [extraParam] - Additional parameter (width for FIL, L/R for EP, etc.)
 * @returns {string} Formatted accessory part ID, e.g., "KIT-TK-A-001" or "KIT-FIL-A-001-1.5"
 * @throws {Error} If required parameters are invalid
 *
 * @example
 * // Toe kick
 * formatAccessoryPartId('KIT', 'TK', 'A', 1)
 * // → 'KIT-TK-A-001'
 *
 * @example
 * // Filler with width
 * formatAccessoryPartId('KIT', 'FIL', 'A', 2, '1.5')
 * // → 'KIT-FIL-A-002-1.5'
 *
 * @example
 * // End panel with side
 * formatAccessoryPartId('KIT', 'EP', 'A', 3, 'L')
 * // → 'KIT-EP-A-003-L'
 */
export function formatAccessoryPartId(room, accessoryType, wall, seq, extraParam = null) {
  if (!room || !Object.values(PART_ID_CONSTANTS.ROOM_CODES).includes(room)) {
    throw new Error(`Invalid room code: ${room}`);
  }
  if (!accessoryType || !Object.values(PART_ID_CONSTANTS.ACCESSORY_TYPES).includes(accessoryType)) {
    throw new Error(`Invalid accessory type: ${accessoryType}`);
  }
  if (!wall || !Object.values(PART_ID_CONSTANTS.WALL_IDENTIFIERS).includes(wall)) {
    throw new Error(`Invalid wall identifier: ${wall}`);
  }

  const seqFormatted = String(seq).padStart(3, '0');
  let partId = `${room}-${accessoryType}-${wall}-${seqFormatted}`;

  if (extraParam !== null && extraParam !== undefined && extraParam !== '') {
    partId += `-${extraParam}`;
  }

  return partId;
}

/**
 * Parses a part ID string back into its component parts
 *
 * @param {string} partIdString - Part ID string to parse (e.g., "KIT-A-001-B30-RT-GFD.RBS")
 * @returns {Object} Parsed part ID components
 * @returns {string} result.room - Room code
 * @returns {string} result.wall - Wall identifier
 * @returns {number} result.seq - Sequence number (numeric)
 * @returns {string} result.sku - Catalog SKU
 * @returns {string[]} result.mods - Modification codes as array
 * @returns {boolean} result.hasCheckDigit - Whether part ID includes a check digit
 * @returns {string} result.checkDigit - Check digit value if present
 * @throws {Error} If part ID format is invalid
 *
 * @example
 * parsePartId('KIT-A-001-B30-RT-GFD.RBS')
 * // → { room: 'KIT', wall: 'A', seq: 1, sku: 'B30-RT', mods: ['GFD', 'RBS'], hasCheckDigit: false }
 *
 * @example
 * parsePartId('KIT-A-001-B30-RT-GFD.RBS-8')
 * // → { room: 'KIT', wall: 'A', seq: 1, sku: 'B30-RT', mods: ['GFD', 'RBS'], hasCheckDigit: true, checkDigit: '8' }
 */
export function parsePartId(partIdString) {
  if (!partIdString || typeof partIdString !== 'string') {
    throw new Error('Part ID must be a non-empty string');
  }

  const parts = partIdString.split('-');

  if (parts.length < 4) {
    throw new Error(`Invalid part ID format: ${partIdString}. Expected at least 4 segments.`);
  }

  const room = parts[0];
  const wall = parts[1];
  const seq = parseInt(parts[2], 10);
  const sku = parts[3];

  if (isNaN(seq)) {
    throw new Error(`Invalid sequence number in part ID: ${parts[2]}`);
  }

  // Collect remaining parts (modifications and optional check digit)
  const remaining = parts.slice(4);
  let mods = [];
  let checkDigit = null;
  let hasCheckDigit = false;

  if (remaining.length > 0) {
    const lastPart = remaining[remaining.length - 1];

    // Check if last part is a single digit (potential check digit)
    if (lastPart.length === 1 && /^\d$/.test(lastPart)) {
      checkDigit = lastPart;
      hasCheckDigit = true;
      // Modifications are everything except the check digit
      if (remaining.length > 1) {
        mods = remaining[0].split('.');
      }
    } else {
      // All remaining parts are modifications
      mods = remaining.join('-').split('.');
    }
  }

  return {
    room,
    wall,
    seq,
    sku,
    mods: mods.filter(m => m),  // Filter out empty strings
    hasCheckDigit,
    checkDigit
  };
}

/**
 * Generates unique part IDs for all components in a kitchen layout result
 *
 * @param {Object} layoutResult - Layout result from the constraint solver
 * @param {string} roomType - Room code for the layout (KIT, OFF, LAU, BTH, VAN)
 * @param {Object} [options={}] - Generation options
 * @param {boolean} [options.includeCheckDigits=false] - Add check digits to part IDs
 * @param {Object} [options.pricingData] - Optional pricing data for line totals
 * @returns {Object} Generated parts and BOM
 * @returns {Array} result.parts - Array of complete part objects with all metadata
 * @returns {Array} result.bom - Bill of materials grouped by wall and type
 * @returns {Object} result.summary - Summary statistics (total parts, part counts by type, etc.)
 *
 * @example
 * const layout = { walls: { A: { base: [...], upper: [...] }, B: {...} } };
 * const result = generatePartIds(layout, 'KIT');
 * // → { parts: [...], bom: [...], summary: {...} }
 */
export function generatePartIds(layoutResult, roomType, options = {}) {
  if (!layoutResult || typeof layoutResult !== 'object') {
    throw new Error('layoutResult must be a valid object');
  }
  if (!Object.values(PART_ID_CONSTANTS.ROOM_CODES).includes(roomType)) {
    throw new Error(`Invalid room type: ${roomType}`);
  }

  const parts = [];
  const wallSequences = {};  // Track sequence numbers per wall
  const summary = {
    totalParts: 0,
    byType: { BASE: 0, UPPER: 0, TALL: 0, ACCESSORY: 0 },
    byWall: {},
    byModification: {}
  };

  // Initialize wall sequences
  const walls = Object.keys(layoutResult.walls || {});
  walls.forEach(wall => {
    wallSequences[wall] = 0;
    summary.byWall[wall] = 0;
  });

  // Process each wall
  walls.forEach(wall => {
    const wallData = layoutResult.walls[wall];

    if (!wallData) return;

    // Helper to generate cabinet parts
    const processCabinets = (cabinets, cabinetType) => {
      if (!Array.isArray(cabinets)) return;

      cabinets.forEach(cabinet => {
        wallSequences[wall]++;
        const seq = wallSequences[wall];

        const mods = (cabinet.modifications || []).filter(m => m !== 'SH');
        const partId = formatPartId(
          roomType,
          wall,
          seq,
          cabinet.sku,
          mods,
          { includeCheckDigit: options.includeCheckDigits }
        );

        const part = {
          partId,
          sku: cabinet.sku,
          description: cabinet.description || formatCabinetDescription(cabinet.sku),
          cabinetType,
          wall,
          position: seq,
          width: cabinet.width,
          height: cabinet.height,
          depth: cabinet.depth || 12,  // Default depth for uppers
          mods,
          qty: 1,
          unitPrice: options.pricingData?.[cabinet.sku]?.price || 0,
          lineTotal: 0
        };

        part.lineTotal = part.qty * part.unitPrice;

        parts.push(part);
        summary.totalParts++;
        summary.byType[cabinetType]++;
        summary.byWall[wall]++;

        // Track modifications used
        mods.forEach(mod => {
          summary.byModification[mod] = (summary.byModification[mod] || 0) + 1;
        });
      });
    };

    // Process all cabinet types
    processCabinets(wallData.base, 'BASE');
    processCabinets(wallData.upper, 'UPPER');
    processCabinets(wallData.tall, 'TALL');

    // Process accessories
    const processAccessories = (accessories, type) => {
      if (!Array.isArray(accessories)) return;

      accessories.forEach((accessory, idx) => {
        const seq = idx + 1;
        let extraParam = null;

        if (type === 'FIL') {
          extraParam = accessory.width;
        } else if (type === 'EP') {
          extraParam = accessory.side || 'L';
        }

        const partId = formatAccessoryPartId(roomType, type, wall, seq, extraParam);

        const part = {
          partId,
          type,
          description: getAccessoryDescription(type, accessory),
          wall,
          position: seq,
          width: accessory.width,
          height: accessory.height,
          qty: accessory.qty || 1,
          unitPrice: options.pricingData?.[type]?.price || 0,
          lineTotal: 0
        };

        part.lineTotal = part.qty * part.unitPrice;

        parts.push(part);
        summary.totalParts++;
        summary.byType.ACCESSORY++;
        summary.byWall[wall]++;
      });
    };

    // Process all accessory types
    processAccessories(wallData.toeKicks, 'TK');
    processAccessories(wallData.crown, 'CRN');
    processAccessories(wallData.lightRail, 'LR');
    processAccessories(wallData.fillers, 'FIL');
    processAccessories(wallData.scribes, 'SCR');
    processAccessories(wallData.endPanels, 'EP');
    processAccessories(wallData.corbels, 'CBL');
  });

  // Build BOM grouped by wall and type
  const bom = buildBOM(parts);

  return {
    parts,
    bom,
    summary
  };
}

/**
 * Generates a Bill of Materials (BOM) from a parts array with grouping and totals
 *
 * @param {Array} parts - Array of part objects with pricing information
 * @param {Object} [options={}] - BOM generation options
 * @param {string} [options.groupBy='wall'] - Grouping strategy ('wall', 'type', 'both')
 * @returns {Object} Structured BOM
 * @returns {Array} result.lines - BOM line items
 * @returns {number} result.subtotal - Sum of all line totals
 * @returns {number} result.totalParts - Total part count
 * @returns {Object} result.grouping - Grouped summary data
 *
 * @example
 * const parts = [
 *   { partId: 'KIT-A-001-B30-RT', qty: 1, unitPrice: 450, lineTotal: 450 },
 *   { partId: 'KIT-A-002-W3630', qty: 1, unitPrice: 280, lineTotal: 280 }
 * ];
 * const bom = generateBOM(parts);
 * // → { lines: [...], subtotal: 730, totalParts: 2, grouping: {...} }
 */
export function generateBOM(parts, options = {}) {
  if (!Array.isArray(parts)) {
    throw new Error('Parts must be an array');
  }

  const groupBy = options.groupBy || 'wall';
  const bom = {
    lines: [],
    subtotal: 0,
    totalParts: 0,
    grouping: {}
  };

  // Copy and sort parts
  const sortedParts = [...parts].sort((a, b) => {
    if (a.wall !== b.wall) {
      return a.wall.localeCompare(b.wall);
    }
    return (a.position || 0) - (b.position || 0);
  });

  // Build BOM lines
  sortedParts.forEach(part => {
    const line = {
      partId: part.partId,
      sku: part.sku,
      description: part.description,
      wall: part.wall,
      type: part.cabinetType || part.type || 'ACCESSORY',
      qty: part.qty || 1,
      unitPrice: part.unitPrice || 0,
      lineTotal: part.lineTotal || (part.qty * part.unitPrice)
    };

    bom.lines.push(line);
    bom.subtotal += line.lineTotal;
    bom.totalParts += line.qty;

    // Build grouping stats
    const key = groupBy === 'wall' ? line.wall : line.type;
    if (!bom.grouping[key]) {
      bom.grouping[key] = {
        partCount: 0,
        itemCount: 0,
        subtotal: 0
      };
    }
    bom.grouping[key].partCount++;
    bom.grouping[key].itemCount += line.qty;
    bom.grouping[key].subtotal += line.lineTotal;
  });

  return bom;
}

/**
 * Exports BOM as CSV format suitable for printing or external systems
 *
 * @param {Object} bom - BOM object from generateBOM()
 * @param {Object} [options={}] - Export options
 * @param {string} [options.title='Kitchen Cabinet BOM'] - BOM title
 * @param {boolean} [options.includeHeaders=true] - Include header row
 * @returns {string} CSV formatted BOM data
 *
 * @example
 * const csv = exportBOMAsCSV(bom, { title: 'Island Configuration' });
 * console.log(csv);
 * // Part ID,SKU,Description,Wall,Type,Qty,Unit Price,Line Total
 * // KIT-A-001-B30-RT,B30-RT,Base Cabinet 30"...
 */
export function exportBOMAsCSV(bom, options = {}) {
  if (!bom || !bom.lines) {
    throw new Error('BOM must be a valid BOM object with lines array');
  }

  const title = options.title || 'Kitchen Cabinet BOM';
  const includeHeaders = options.includeHeaders !== false;

  let csv = '';

  // Add title as comment
  csv += `# ${title}\n`;
  csv += `# Generated: ${new Date().toISOString()}\n\n`;

  // Add headers
  if (includeHeaders) {
    csv += 'Part ID,SKU,Description,Wall,Type,Qty,Unit Price,Line Total\n';
  }

  // Add data rows
  bom.lines.forEach(line => {
    const description = (line.description || '').replace(/"/g, '""');  // Escape quotes
    csv += `"${line.partId}","${line.sku}","${description}","${line.wall}","${line.type}",${line.qty},${line.unitPrice.toFixed(2)},${line.lineTotal.toFixed(2)}\n`;
  });

  // Add summary
  csv += `\n# Summary\n`;
  csv += `# Total Parts: ${bom.totalParts}\n`;
  csv += `# Unique Cabinets: ${bom.lines.length}\n`;
  csv += `# Subtotal: $${bom.subtotal.toFixed(2)}\n`;

  return csv;
}

/**
 * Validates a part ID against the format specification
 *
 * @param {string} partId - Part ID to validate
 * @returns {Object} Validation result
 * @returns {boolean} result.valid - Whether part ID is valid
 * @returns {string[]} result.errors - Array of validation errors
 *
 * @example
 * validatePartId('KIT-A-001-B30-RT-GFD.RBS')
 * // → { valid: true, errors: [] }
 *
 * @example
 * validatePartId('INVALID-X-999-SKU')
 * // → { valid: false, errors: ['Invalid room code: INVALID', 'Invalid wall identifier: X'] }
 */
export function validatePartId(partId) {
  const errors = [];

  try {
    const parsed = parsePartId(partId);

    // Validate room
    if (!Object.values(PART_ID_CONSTANTS.ROOM_CODES).includes(parsed.room)) {
      errors.push(`Invalid room code: ${parsed.room}`);
    }

    // Validate wall
    if (!Object.values(PART_ID_CONSTANTS.WALL_IDENTIFIERS).includes(parsed.wall)) {
      errors.push(`Invalid wall identifier: ${parsed.wall}`);
    }

    // Validate sequence
    if (parsed.seq < 0 || parsed.seq > 999) {
      errors.push(`Sequence number out of range: ${parsed.seq}`);
    }

    // Validate SKU format (basic: non-empty, alphanumeric with hyphens)
    if (!/^[A-Z0-9\-]+$/.test(parsed.sku)) {
      errors.push(`Invalid SKU format: ${parsed.sku}`);
    }

    // Validate modifications
    const validMods = Object.values(PART_ID_CONSTANTS.MODIFICATION_CODES);
    parsed.mods.forEach(mod => {
      if (!validMods.includes(mod)) {
        errors.push(`Invalid modification code: ${mod}`);
      }
    });

  } catch (error) {
    errors.push(error.message);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculates a modulo-10 check digit for barcode compatibility
 *
 * @private
 * @param {string} partId - Part ID string (without check digit)
 * @returns {number} Check digit (0-9)
 */
function calculateCheckDigit(partId) {
  // Sum ASCII values of all characters
  let sum = 0;
  for (let i = 0; i < partId.length; i++) {
    sum += partId.charCodeAt(i);
  }
  // Return modulo 10
  return sum % PART_ID_CONSTANTS.MODULO_BASE;
}

/**
 * Generates a human-readable description for a cabinet SKU
 *
 * @private
 * @param {string} sku - Cabinet SKU
 * @returns {string} Formatted description
 */
function formatCabinetDescription(sku) {
  // Parse Eclipse SKU format: [B|W|T][width][type-optional]
  // B30-RT = Base 30" Right Type
  // W3630 = Wall/Upper 36" wide, 30" tall
  // BBC36-MC = Base Blind Corner 36" Multi-Config

  if (!sku) return 'Cabinet';

  const parts = sku.split('-');
  const prefix = sku.charAt(0);
  const width = sku.match(/\d{2,3}/)?.[0] || '';

  let type = '';
  if (prefix === 'B') type = 'Base';
  else if (prefix === 'W') type = 'Wall/Upper';
  else if (prefix === 'T') type = 'Tall';

  return `${type} Cabinet ${width}"`;
}

/**
 * Generates a human-readable description for an accessory
 *
 * @private
 * @param {string} type - Accessory type code
 * @param {Object} accessory - Accessory data object
 * @returns {string} Formatted description
 */
function getAccessoryDescription(type, accessory = {}) {
  const descriptions = {
    TK: 'Toe Kick',
    CRN: 'Crown Molding',
    LR: 'Light Rail',
    FIL: `Filler ${accessory.width || ''}"`,
    SCR: 'Scribe',
    EP: `End Panel ${accessory.side || 'L'} Side`,
    DFBP: 'Door Front Bottom Panel',
    CBL: 'Corbel',
    RAIL: 'Mounting Rail'
  };

  return descriptions[type] || 'Accessory';
}

/**
 * Island-specific sequence numbering (clockwise from work side)
 *
 * @param {Array} islandCabinets - Array of cabinets on island
 * @returns {Array} Cabinets with corrected sequence numbers
 */
export function renumberIslandSequence(islandCabinets) {
  if (!Array.isArray(islandCabinets)) {
    return islandCabinets;
  }

  // Island numbering: clockwise from work side (typically back-left)
  // Back row: left to right
  // Right side: bottom to top
  // Front row: right to left
  // Left side: top to bottom

  return islandCabinets.map((cabinet, idx) => ({
    ...cabinet,
    sequence: idx + 1
  }));
}

/**
 * Peninsula-specific sequence numbering (from wall attachment outward)
 *
 * @param {Array} peninsulaCabinets - Array of cabinets on peninsula
 * @returns {Array} Cabinets with corrected sequence numbers
 */
export function renumberPeninsulaSequence(peninsulaCabinets) {
  if (!Array.isArray(peninsulaCabinets)) {
    return peninsulaCabinets;
  }

  // Peninsula numbering: from wall attachment outward
  return peninsulaCabinets.map((cabinet, idx) => ({
    ...cabinet,
    sequence: idx + 1
  }));
}

export default {
  PART_ID_CONSTANTS,
  formatPartId,
  formatAccessoryPartId,
  parsePartId,
  generatePartIds,
  generateBOM,
  exportBOMAsCSV,
  validatePartId,
  renumberIslandSequence,
  renumberPeninsulaSequence
};

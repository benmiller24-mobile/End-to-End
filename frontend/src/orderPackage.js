/**
 * W.W. Wood Order Package Generator
 * =================================
 * Produces the complete submission package in the manufacturer's own format
 * (mirrors the Pinnacle Dealer Hub standard order forms, ECL-SO-CS/SHI-SO-CS
 * + item list ECL-SO-IL/SHI-SO-IL, rev 11/25):
 *
 *   1. COVER SHEET   — the global style rules (species, color, glaze/highlight,
 *                      door styles, edge, drawer box/front/guide, tip-on,
 *                      construction, interior, character techniques, contacts).
 *   2. ITEM LIST     — Cab No | Qty | Description | Hinge | Finished End | Price,
 *                      cab numbers matching the drawing tags (KD##).
 *   3. CUTOUT SHEETS — one per built-in appliance cabinet (oven / oven+micro /
 *                      base oven / wall microwave / warming drawer, flush-inset
 *                      variants per construction), pre-filled with cab no, SKU,
 *                      appliance maker + model. Manufacturer install specs must
 *                      be attached by the dealer (the form says so).
 *   4. CUSTOM QUOTE WORKSHEET — items with no standard price (route to
 *                      quotes@wwinc.com per the Dealer Hub SOP).
 *
 * Honesty rule: when the design is not order-grade, every page carries a
 * BUDGET — NOT FOR ORDER watermark. No invented data: unknown fields print
 * blank for the dealer to complete, never a guess.
 */
import { jsPDF } from 'jspdf';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';

// ── Item-row construction (ported from the Cabinet List schedule logic) ──

const parseHeightFromSku = (sku, dflt) => {
  const s = (sku || '').toUpperCase().replace(/^FC-/, '');
  let m = s.match(/^[A-Z]+\d{2}(\d{2})(?:$|[^0-9])/);
  if (m) { const h = parseInt(m[1]); if (h >= 12 && h <= 96) return h; }
  m = s.match(/(\d{2,3})H/);
  if (m) return parseInt(m[1]);
  return dflt;
};

const determineHinge = (cab, width, wallCabs) => {
  if (width > 24) return '—';
  const s = (cab.sku || '').toUpperCase().replace(/^FC-/, '');
  if (/^B[34]D/.test(s) || /^RTB/.test(s) || /^BPOS/.test(s) || /^F\d|^OVF|^REP|^WEP|^BEP|^TK|^CRN|^LR|^SCRIBE|^LB-/.test(s)) return '—';
  const apps = (wallCabs || []).filter(c => c.type === 'appliance');
  const cabCenter = (cab.position || 0) + width / 2;
  if (!apps.length) {
    const wallEnd = (wallCabs || []).reduce((mx, c) => Math.max(mx, (c.position || 0) + (c.width || 0)), 0);
    return cabCenter < wallEnd / 2 ? 'R' : 'L';
  }
  let nearest = apps[0], best = Infinity;
  for (const a of apps) {
    const ac = (a.position || 0) + (a.width || 0) / 2;
    const d = Math.abs(cabCenter - ac);
    if (d < best) { best = d; nearest = a; }
  }
  return cabCenter < (nearest.position || 0) + (nearest.width || 0) / 2 ? 'R' : 'L';
};

// Built-in cutout classification → which spec sheet the order must include.
export function cutoutFormFor(sku, inset) {
  const s = (sku || '').toUpperCase().replace(/^FC-/, '');
  if (/^FIOM/.test(s)) return { kind: 'Flush Inset Oven/Microwave Cutout', code: 'CO-FIOM', appTypes: ['wallOven', 'microwave'] };
  if (/^FIO/.test(s)) return { kind: 'Flush Inset Oven Cutout', code: 'CO-FIO', appTypes: ['wallOven'] };
  if (/^FIBO/.test(s)) return { kind: 'Flush Inset Base Oven Cutout', code: 'CO-FIBO', appTypes: ['wallOven'] };
  if (/^OM\d/.test(s)) return inset
    ? { kind: 'Flush Inset Oven/Microwave Cutout', code: 'CO-FIOM', appTypes: ['wallOven', 'microwave'] }
    : { kind: 'Oven/Microwave Cutout', code: 'CO-OM', appTypes: ['wallOven', 'microwave'] };
  if (/^O\d/.test(s)) return inset
    ? { kind: 'Flush Inset Oven Cutout', code: 'CO-FIO', appTypes: ['wallOven'] }
    : { kind: 'Oven Cutout', code: 'CO-O', appTypes: ['wallOven'] };
  if (/^BO\d/.test(s)) return inset
    ? { kind: 'Flush Inset Base Oven Cutout', code: 'CO-FIBO', appTypes: ['wallOven'] }
    : { kind: 'Base Oven Cutout', code: 'CO-BO', appTypes: ['wallOven'] };
  if (/^MWC|^MW\d/.test(s)) return { kind: 'Wall Microwave Cutout', code: 'CO-MW', appTypes: ['microwave'] };
  if (/^BWD\d|WARM/.test(s)) return inset
    ? { kind: 'Flush Inset Base Warming Drawer Cutout', code: 'CO-FIBWD', appTypes: ['warmingDrawer'] }
    : { kind: 'Base Warming Drawer Cutout', code: 'CO-BWD', appTypes: ['warmingDrawer'] };
  return null;
}

/**
 * Build the order item rows from solver placements + the priced quote.
 * Cab numbers (KD##) follow the same wall-grouped sequence as the drawings.
 */
export function buildOrderItems(placements, quote, { inset = false } = {}) {
  const wallGroups = {};
  (placements || []).forEach(p => {
    const w = p.wall || p.zone || 'other';
    (wallGroups[w] = wallGroups[w] || []).push(p);
  });
  const rows = [];
  const cutouts = [];
  let tag = 1;
  const occ = {};
  for (const wall of Object.keys(wallGroups)) {
    for (const p of wallGroups[wall]) {
      const isApp = p.type === 'appliance';
      if (isApp && !p.sku) continue;                       // freestanding appliances aren't order lines
      const cabNo = `KD${String(tag++).padStart(2, '0')}`;
      // Match the priced quote line by the same wall::sku::occurrence key the
      // pricing path uses, so per-line modifications land on the right row.
      const base = `${p.wall || p.zone || 'other'}::${p.sku}`;
      occ[base] = (occ[base] || 0) + 1;
      const lineKey = `${base}::${occ[base]}`;
      const priced = quote?.items?.find(qi => qi.lineKey === lineKey) || quote?.items?.find(qi => qi.sku === p.sku);
      const fabPriced = quote?.fabrication?.items?.find(fi => fi.sku === p.sku);
      const w = p.width || 0;
      rows.push({
        cabNo, wall,
        qty: p.qty || 1,
        sku: (p.sku || '').replace(/^FC-/, ''),
        rawSku: p.sku,
        hinge: determineHinge(p, w, wallGroups[wall]),
        finEnd: /EP|PANEL/i.test(p.sku || '') ? '—' : '',   // blank = dealer marks; panels n/a
        price: priced?.unitPrice ?? fabPriced?.unitPrice ?? null,
        needsQuote: !!fabPriced?.needsQuote,
        resolution: priced?._resolution || null,
        fallback: !!priced?._fallback,
        mods: (priced?.mods || []).map(m => ({ code: m.code, desc: m.desc, charge: m.pct ? null : (m.flat || 0), pct: m.pct || 0 })),
        modChg: priced?.modChg || 0,
      });
      const cf = cutoutFormFor(p.sku, inset);
      if (cf) cutouts.push({ cabNo, sku: (p.sku || '').replace(/^FC-/, ''), ...cf });
    }
  }
  return { rows, cutouts };
}

// ── PDF rendering ──

const GOLD = [184, 148, 78], INK = [26, 26, 26], MUT = [110, 110, 110], LINE = [200, 195, 186];

function watermark(doc, pageW, pageH, text) {
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity: 0.13 }));
  doc.setFontSize(54);
  doc.setTextColor(192, 57, 43);
  doc.setFont(undefined, 'bold');
  doc.text(text, pageW / 2, pageH / 2, { align: 'center', angle: 24 });
  doc.restoreGraphicsState();
  doc.setFont(undefined, 'normal');
}

function pageHeader(doc, pageW, margin, brandName, formCode, title, sub) {
  doc.setFontSize(7.5); doc.setTextColor(...GOLD);
  doc.text('PINNACLE SALES — DEALER ORDER PACKAGE', margin, margin - 6);
  doc.setFontSize(16); doc.setTextColor(...INK); doc.setFont(undefined, 'bold');
  doc.text(`${brandName} — ${title}`, margin, margin + 12);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8); doc.setTextColor(...MUT);
  doc.text(sub, margin, margin + 24);
  doc.text(formCode, pageW - margin, margin + 12, { align: 'right' });
  doc.setDrawColor(...GOLD); doc.setLineWidth(1);
  doc.line(margin, margin + 30, pageW - margin, margin + 30);
  return margin + 42;
}

function fieldGrid(doc, fields, x0, y0, colW, rowH, cols) {
  fields.forEach((f, i) => {
    const cx = x0 + (i % cols) * colW;
    const cy = y0 + Math.floor(i / cols) * rowH;
    doc.setFontSize(6.5); doc.setTextColor(...MUT);
    doc.text(f[0].toUpperCase(), cx, cy);
    doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text(String(f[1] ?? '') || '—', cx, cy + 11, { maxWidth: colW - 10 });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
    doc.line(cx, cy + 15, cx + colW - 12, cy + 15);
  });
  return y0 + Math.ceil(fields.length / cols) * rowH;
}

/**
 * Generate the full order package PDF.
 * @param {Object} opts
 *   brand: 'eclipse'|'shiloh'; cover: {field map}; items, cutouts (from
 *   buildOrderItems); customQuoteItems; appliancesByType: {wallOven: {...}};
 *   orderReady: boolean; readinessIssues: string[]
 */
export function generateOrderPackage({ brand, cover, items, cutouts, customQuoteItems = [], appliancesByType = {}, orderReady = false, readinessIssues = [], fmtMoney = v => `$${(v ?? 0).toLocaleString()}` }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const tenant = getTenant(brand);
  const brandName = tenant.branding.manufacturerName;
  const codePrefix = tenant.branding.formCodePrefix;
  // Currency-aware money (pronorm prices in EUR); falls back to the caller's $.
  const money = (cover.currency && cover.currency !== 'USD')
    ? (v) => `${cover.currency === 'EUR' ? '€' : cover.currency + ' '}${(v ?? 0).toLocaleString()}`
    : fmtMoney;
  const wm = () => { if (!orderReady) watermark(doc, pageW, pageH, 'BUDGET — NOT FOR ORDER'); };

  // ════ 1. COVER SHEET ════
  let y = pageHeader(doc, pageW, margin, brandName, `${codePrefix}-SO-CS`, 'Standard Order — Cover Sheet',
    'Global style rules for this order. Submit with the item list to Orders@wwinc.com.');
  const colW = (pageW - margin * 2) / 3;
  // Tenant-driven cover (pronorm and other coverSheet-labelled lines): the
  // line's own spec rows (front range/colour/handle/etc.) replace the W.W.
  // door/glaze grid; universal identity + price-group fields bracket them.
  const grid = cover.specRows
    ? [
        ['1. Business Name', cover.businessName], ['2. Customer #', cover.customerNumber], ['3. PO #', cover.po],
        ['4. Job Name', cover.jobName],
        ...(cover.priceGroup ? [['Price Group', cover.priceGroup]] : []),
        ...cover.specRows.map(([l, v], i) => [`${i + 5}. ${l}`, v]),
        ['Order Date', cover.orderDate], ['Salesperson / Contact', cover.salesperson],
        ['Contact Phone', cover.contactPhone], ['Contact Email', cover.contactEmail],
        ['Pages In Order (excl. cover)', cover.pageCount],
      ]
    : [
        ['1. Business Name', cover.businessName], ['2. Customer #', cover.customerNumber], ['3. PO #', cover.po],
        ['4. Job Name', cover.jobName], ['5. Wood Species', cover.species], ['6. Color', cover.color],
        ['7. Glaze / Highlight', [cover.glaze, cover.highlight].filter(v => v && !/^no /i.test(v)).join(' / ') || 'None'],
        ['8a. Upper Door Style', cover.upperDoor], ['8b. Lower Door Style', cover.lowerDoor],
        ['9. Edge Profile / Banding', cover.edgeProfile],
        [tenant.coverFields.field10Label, cover[tenant.coverFields.field10Key]],
        ['11. Drawer Front Style', cover.drawerFrontStyle],
        ['12. Drawer Guide', cover.drawerGuide], ['13. Tip-On', cover.tipOn ? 'YES — all doors & drawers' : 'No'],
        ['14. Material Type', cover.materialType],
        ['15. Interior Finish', cover.interiorFinish], ['16. Construction Type', cover.constructionNote],
        ['17. Character Technique(s)', cover.charTechniques || 'None'],
        ['18. Order Date', cover.orderDate], ['19. Salesperson / Contact', cover.salesperson], ['20. Contact Phone', cover.contactPhone],
        ['21. Contact Email', cover.contactEmail],
        ['22. Pages In Order (excl. cover)', cover.pageCount], ['23. Drawer Box Type', cover.drawerBox],
      ];
  y = fieldGrid(doc, grid, margin, y + 8, colW, 34, 3);

  doc.setFontSize(7); doc.setTextColor(...MUT);
  doc.text('SPECIAL INSTRUCTIONS', margin, y + 10);
  doc.setDrawColor(...LINE);
  doc.rect(margin, y + 14, pageW - margin * 2, 54);
  doc.setFontSize(9); doc.setTextColor(...INK);
  doc.text(String(cover.specialInstructions || ''), margin + 6, y + 26, { maxWidth: pageW - margin * 2 - 12 });
  y += 80;

  doc.setFontSize(7.5); doc.setTextColor(150, 80, 80);
  doc.text('NOTICE: This order for production is final. After receipt of confirmation, changes or cancellations are allowed', margin, y + 8);
  doc.text('for 24 HOURS ONLY. Review the acknowledgment line-by-line the day it arrives.', margin, y + 18);
  if (!orderReady && readinessIssues.length) {
    doc.setFontSize(7.5); doc.setTextColor(192, 57, 43);
    doc.text(`NOT ORDER-READY — open items: ${readinessIssues.slice(0, 4).join(' · ')}${readinessIssues.length > 4 ? ` (+${readinessIssues.length - 4} more)` : ''}`, margin, y + 32, { maxWidth: pageW - 2 * margin });
  }
  wm();

  // ════ 2. ITEM LIST ════
  const cols = [
    { k: 'cabNo', label: 'CAB NO', x: 0, w: 50 },
    { k: 'qty', label: 'QTY', x: 54, w: 28, r: true },
    { k: 'sku', label: 'DESCRIPTION (SKU)', x: 92, w: 210 },
    { k: 'hinge', label: 'HINGE', x: 312, w: 40 },
    { k: 'finEnd', label: 'FIN. END', x: 356, w: 50 },
    { k: 'wall', label: 'LOC', x: 412, w: 40 },
    { k: 'price', label: 'LIST PRICE', x: 460, w: 64, r: true },
  ];
  const rowH = 16;
  let pageNo = 0;
  const newItemPage = () => {
    doc.addPage('letter', 'portrait');
    pageNo++;
    let yy = pageHeader(doc, pageW, margin, brandName, `${codePrefix}-SO-IL`, `Standard Order — Item List (p${pageNo})`,
      'Must be accompanied by the cover sheet. Cab numbers match the drawing tags.');
    doc.setFillColor(236, 233, 228);
    doc.rect(margin, yy, pageW - 2 * margin, rowH, 'F');
    doc.setFontSize(7); doc.setTextColor(60, 60, 60);
    cols.forEach(c => doc.text(c.label, margin + c.x + (c.r ? c.w : 0), yy + 11, { align: c.r ? 'right' : 'left' }));
    return yy + rowH;
  };
  y = newItemPage();
  for (const row of items) {
    if (y + rowH > pageH - 60) { wm(); y = newItemPage(); }
    doc.setFontSize(8.5); doc.setTextColor(...INK);
    cols.forEach(c => {
      let v = row[c.k];
      if (c.k === 'price') v = row.needsQuote ? 'CUSTOM QUOTE' : (v != null ? money(Math.round(v * 100) / 100) : '');
      if (c.k === 'sku' && row.fallback) v = `${v}  *`;
      doc.text(String(v ?? ''), margin + c.x + (c.r ? c.w : 0), y + 11, { align: c.r ? 'right' : 'left', maxWidth: c.w });
    });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.4);
    doc.line(margin, y + rowH, pageW - margin, y + rowH);
    y += rowH;
    // Modification sub-lines (the confirmation format prints these under the cabinet)
    for (const mod of (row.mods || [])) {
      if (y + rowH > pageH - 60) { wm(); y = newItemPage(); }
      doc.setFontSize(7.5); doc.setTextColor(...MUT);
      doc.text(`↳ MOD ${mod.code} — ${mod.desc}`, margin + 92, y + 10, { maxWidth: 300 });
      doc.text(mod.pct ? `+${Math.round(mod.pct * 100)}% of list` : (mod.charge ? money(mod.charge) : 'N/C'),
        margin + 460 + 64, y + 10, { align: 'right' });
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
      doc.line(margin + 88, y + rowH, pageW - margin, y + rowH);
      y += rowH;
    }
  }
  const subtotal = items.reduce((s, r) => s + (r.needsQuote ? 0 : (r.price || 0) * (r.qty || 1)), 0);
  doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(...INK);
  doc.text(`LIST SUBTOTAL (${items.length} lines): ${money(Math.round(subtotal * 100) / 100)}`, pageW - margin, y + 16, { align: 'right' });
  doc.setFont(undefined, 'normal');
  if (items.some(r => r.fallback)) {
    doc.setFontSize(7); doc.setTextColor(192, 57, 43);
    doc.text('* priced from the Eclipse list (no Shiloh catalog match) — verify before submitting', margin, y + 16);
  }
  wm();

  // ════ 3. APPLIANCE CUTOUT SHEETS ════
  for (const co of cutouts) {
    doc.addPage('letter', 'portrait');
    let yy = pageHeader(doc, pageW, margin, brandName, `${codePrefix}-${co.code}`, co.kind,
      'Identifies appliance specifications for this cutout cabinet. One sheet per cabinet.');
    const app = co.appTypes.map(t => appliancesByType[t]).find(Boolean);
    yy = fieldGrid(doc, [
      ['1. Business Name', cover.businessName], ['2. Customer #', cover.customerNumber], ['3. Order PO #', cover.po],
      ['4. Job Name', cover.jobName],
      ['5. Cabinet Number (per item list)', co.cabNo], ['6. Cabinet SKU', co.sku],
      ['7. Appliance Maker', app?.brandName || app?.brand || ''], ['8. Appliance Model (complete)', app?.model || ''],
      ['Appliance Width', app?.width ? `${app.width}"` : ''],
    ], margin, yy + 8, colW, 36, 3);
    doc.setFontSize(8); doc.setTextColor(...MUT);
    const ack = [
      'CUSTOMER ACKNOWLEDGMENT AND RESPONSIBILITY: W. W. Wood Products, Inc. is not responsible for inaccuracies in',
      'appliance cutout specifications. The purchaser must verify all cutout, clearance, and venting requirements, and must',
      'attach the manufacturer’s installation specifications (flush installation specs for flush-inset cutouts) at time of purchase.',
    ];
    ack.forEach((l, i) => doc.text(l, margin, yy + 14 + i * 11));
    doc.setDrawColor(...INK);
    doc.line(margin, yy + 84, margin + 200, yy + 84);
    doc.setFontSize(7); doc.text('SIGNATURE', margin, yy + 94);
    doc.line(margin + 260, yy + 84, margin + 380, yy + 84);
    doc.text('DATE', margin + 260, yy + 94);
    if (!app?.model) {
      doc.setFontSize(9); doc.setTextColor(192, 57, 43);
      doc.text('⚠ NO APPLIANCE MODEL SELECTED — this sheet cannot be submitted until the model is specified.', margin, yy + 116, { maxWidth: pageW - 2 * margin });
    }
    wm();
  }

  // ════ 4. CUSTOM QUOTE WORKSHEET ════
  if (customQuoteItems.length) {
    doc.addPage('letter', 'portrait');
    let yy = pageHeader(doc, pageW, margin, brandName, 'CUSTOM QUOTE', 'Custom Quote Worksheet',
      'Non-standard items — email this sheet to Billy Rhea at quotes@wwinc.com per the Dealer Hub SOP.');
    yy = fieldGrid(doc, [
      ['Business Name', cover.businessName], ['Customer #', cover.customerNumber], ['PO #', cover.po],
      ['Job Name', cover.jobName], ['Contact', cover.salesperson], ['Email', cover.contactEmail],
    ], margin, yy + 8, colW, 34, 3);
    doc.setFontSize(8); doc.setTextColor(60, 60, 60);
    doc.text('ITEM', margin, yy + 12);
    doc.text('DESCRIPTION / REQUIREMENTS', margin + 140, yy + 12);
    yy += 18;
    for (const it of customQuoteItems) {
      doc.setFontSize(9); doc.setTextColor(...INK);
      doc.text(it.sku || '—', margin, yy + 11);
      doc.text(`${it.label || ''}${it.qty > 1 ? `  × ${it.qty}` : ''}`, margin + 140, yy + 11, { maxWidth: pageW - margin * 2 - 150 });
      doc.setDrawColor(...LINE);
      doc.line(margin, yy + 16, pageW - margin, yy + 16);
      yy += 20;
    }
    wm();
  }

  // footers
  const pc = doc.getNumberOfPages();
  for (let p = 1; p <= pc; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(138, 138, 138);
    doc.text(`${brandName} order package · generated by Eclipse Kitchen Designer · ${cover.orderDate}`, margin, pageH - 20);
    doc.text(`Page ${p} of ${pc}`, pageW - margin, pageH - 20, { align: 'right' });
  }

  const fname = `${codePrefix}_Order_${(cover.po || cover.jobName || 'draft').replace(/[^\w-]+/g, '_')}.pdf`;
  doc.save(fname);
  return fname;
}

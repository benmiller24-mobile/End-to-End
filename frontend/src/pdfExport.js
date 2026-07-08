/**
 * PDF Export Utility — Eclipse Kitchen Designer
 * Captures SVG floor plans and elevations into a multi-page PDF.
 * Uses jsPDF + svg2pdf.js for high-quality vector PDF output.
 */
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

/**
 * Competitive Re-Quote sheet — the deliverable of the 2020-PDF import flow:
 * the customer's existing design, priced line-by-line in every line we carry.
 * Budget-grade by definition (imported dims are customer-supplied), so every
 * page carries the watermark; per-line resolution honesty comes straight from
 * counterQuote.js (missing / substituted rows are printed, never dropped).
 *
 * @param {Object} opts
 * @param {string} opts.title        project / customer name
 * @param {string} opts.sourceNote   e.g. 'Imported from Mautz-Kitchen.pdf (2020 design PDF), 21 cabinets'
 * @param {Array}  opts.columns      buildCounterQuote(...).columns
 * @param {Array}  opts.deltas       counterQuoteDeltas(columns)
 * @param {Function} [opts.formatCurrency]
 */
export async function exportCounterQuotePDF({ title = 'Competitive Re-Quote', sourceNote = '', columns = [], deltas = [], formatCurrency = (v) => `$${Math.round(v).toLocaleString()}` }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  const watermark = () => {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.08 }));
    doc.setFontSize(90);
    doc.setTextColor(160, 60, 40);
    doc.text('BUDGET — NOT FIELD-VERIFIED', pageW / 2, pageH / 2, { align: 'center', angle: 22 });
    doc.restoreGraphicsState();
  };
  const footer = () => {
    doc.setFontSize(7);
    doc.setTextColor(138, 138, 138);
    doc.text('Competitive re-quote — imported dimensions are customer-supplied; pricing is manufacturer list until field-verified.', margin, pageH - 15);
  };

  watermark();
  doc.setFontSize(8);
  doc.setTextColor(184, 148, 78);
  doc.text('PINNACLE SALES', margin, margin + 2);
  doc.setFontSize(20);
  doc.setTextColor(26, 26, 26);
  doc.text(`Competitive Re-Quote — ${title}`, margin, margin + 20);
  doc.setDrawColor(200, 169, 110);
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 26, margin + 170, margin + 26);
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  doc.text(`${sourceNote}${sourceNote ? '  ·  ' : ''}Generated ${new Date().toLocaleDateString()}`, margin, margin + 40);

  // ── Totals band: one card per line, delta vs the first column ──
  let y = margin + 56;
  const cardW = Math.min(180, (pageW - 2 * margin - 10 * (columns.length - 1)) / columns.length);
  columns.forEach((c, i) => {
    const x = margin + i * (cardW + 10);
    doc.setFillColor(250, 248, 245);
    doc.roundedRect(x, y, cardW, 56, 4, 4, 'F');
    doc.setFontSize(9);
    doc.setTextColor(93, 77, 46);
    doc.text(c.label, x + 8, y + 13);
    doc.setFontSize(14);
    doc.setTextColor(184, 148, 78);
    doc.text(`${c.currency}${c.subtotal.toLocaleString()}`, x + 8, y + 30);
    doc.setFontSize(7.5);
    const d = deltas[i];
    if (d != null) {
      doc.setTextColor(d < 0 ? 58 : 150, d < 0 ? 125 : 80, d < 0 ? 68 : 80);
      doc.text(`${d < 0 ? '−' : '+'}${c.currency}${Math.abs(Math.round(d)).toLocaleString()} vs ${columns[0].label}`, x + 8, y + 41);
    } else if (i > 0) {
      doc.setTextColor(138, 138, 138);
      doc.text('different currency — no direct delta', x + 8, y + 41);
    }
    const unresolved = c.counts.missing + c.counts.substituted;
    if (unresolved > 0) {
      doc.setTextColor(160, 60, 40);
      doc.text(`${unresolved} item${unresolved > 1 ? 's' : ''} without a true equivalent`, x + 8, y + 51);
    }
  });
  y += 72;

  // ── Line-by-line table: source SKU + per-line resolved SKU & price ──
  const srcW = 120;
  const colW = (pageW - 2 * margin - srcW) / columns.length;
  const rowH = 12;
  const header = () => {
    doc.setFillColor(236, 233, 228);
    doc.rect(margin, y, pageW - 2 * margin, rowH + 2, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text('DESIGN SKU', margin + 3, y + 9);
    columns.forEach((c, i) => doc.text(c.label.toUpperCase(), margin + srcW + i * colW + 3, y + 9));
    y += rowH + 2;
  };
  header();
  doc.setFontSize(7.5);
  const rowCount = columns[0]?.rows?.length || 0;
  for (let r = 0; r < rowCount; r++) {
    if (y + rowH > pageH - 30) {
      footer();
      doc.addPage('letter', 'landscape');
      watermark();
      y = margin;
      header();
      doc.setFontSize(7.5);
    }
    doc.setTextColor(26, 26, 26);
    doc.setFont('courier', 'normal');
    doc.text(String(columns[0].rows[r].srcSku || '').slice(0, 22), margin + 3, y + 9);
    doc.setFont('helvetica', 'normal');
    columns.forEach((c, i) => {
      const row = c.rows[r];
      const x = margin + srcW + i * colW + 3;
      if (!row) return;
      if (row.resolution === 'missing') {
        doc.setTextColor(160, 60, 40);
        doc.text('no equivalent', x, y + 9);
      } else if (row.resolution === 'substituted') {
        doc.setTextColor(160, 60, 40);
        doc.text(`no true match — filler ${c.currency}${Math.round(row.total).toLocaleString()}`, x, y + 9);
      } else {
        doc.setTextColor(26, 26, 26);
        const marker = row.resolution === 'normalized' ? ' ≈' : '';
        doc.text(`${String(row.sku).slice(0, 16)}${marker}  ${c.currency}${Math.round(row.total).toLocaleString()}`, x, y + 9);
      }
    });
    doc.setDrawColor(228, 221, 210);
    doc.setLineWidth(0.4);
    doc.line(margin, y + rowH, pageW - margin, y + rowH);
    y += rowH;
  }

  // Subtotals row + per-line notes (interim-pricing disclaimers travel with the line).
  doc.setFontSize(8.5);
  doc.setTextColor(26, 26, 26);
  doc.setFont('helvetica', 'bold');
  if (y + 40 > pageH - 30) { footer(); doc.addPage('letter', 'landscape'); watermark(); y = margin; }
  doc.text('Cabinet list total', margin + 3, y + 12);
  columns.forEach((c, i) => doc.text(`${c.currency}${c.subtotal.toLocaleString()}`, margin + srcW + i * colW + 3, y + 12));
  doc.setFont('helvetica', 'normal');
  y += 24;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('≈ resolved by family/size rule (review before ordering). Cabinet list prices only — trim, fabrication, delivery and install are quoted on the full proposal.', margin, y);
  y += 10;
  for (const c of columns) {
    if (c.note) { doc.text(`${c.label}: ${c.note}`, margin, y); y += 9; }
  }
  footer();

  const filename = `Counter-Quote_${title.replace(/[^A-Za-z0-9-]+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Export all SVG elements matching a selector into a PDF
 * @param {Object} options
 * @param {string} options.title - Project title for the header
 * @param {string} options.layoutType - Layout type description
 * @param {string} options.roomType - Room type
 * @param {Object} options.materials - Materials summary { species, door, construction }
 * @param {number} options.cabinetTotal - Cabinet subtotal
 * @param {number} options.applianceTotal - Appliance MSRP total
 * @param {Object} options.countertopEstimate - { totalLow, totalHigh }
 * @param {string} options.formatCurrency - Currency formatter function
 */
export async function exportPDF(options = {}) {
  const {
    title = 'Eclipse Kitchen Designer',
    layoutType = '',
    roomType = '',
    materials = {},
    cabinetTotal = 0,
    applianceTotal = 0,
    countertopEstimate = null,
    formatCurrency = (v) => `$${v.toLocaleString()}`,
    bom = [],          // [{sku, qty, w, h, d, walls}] — project-wide bill of materials
    specs = [],        // construction-notes lines (brand, overlay, species, hardware, …)
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // ── Page 1: Cover + Floor Plan ──
  // Header
  doc.setFontSize(8);
  doc.setTextColor(184, 148, 78); // Pinnacle gold eyebrow
  doc.text('PINNACLE SALES', margin, margin + 2);
  doc.setFontSize(22);
  doc.setTextColor(26, 26, 26);
  doc.text(title, margin, margin + 18);
  doc.setDrawColor(200, 169, 110); // gold rule under the title
  doc.setLineWidth(1.5);
  doc.line(margin, margin + 24, margin + 150, margin + 24);

  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text(`Layout: ${layoutType.toUpperCase()} | Room: ${roomType} | Generated: ${new Date().toLocaleDateString()}`, margin, margin + 38);

  // Materials summary
  doc.setFontSize(9);
  doc.text(`Species: ${materials.species || 'N/A'} | Door: ${materials.door || 'N/A'} | Construction: ${materials.construction || 'N/A'}`, margin, margin + 52);

  // Pricing summary bar
  const barY = margin + 64;
  doc.setFillColor(250, 248, 245);
  doc.roundedRect(margin, barY, pageW - 2 * margin, 24, 4, 4, 'F');
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 26);
  doc.text(`Cabinetry: ${formatCurrency(cabinetTotal)}`, margin + 10, barY + 15);
  doc.text(`Appliances: ${applianceTotal > 0 ? formatCurrency(applianceTotal) : 'N/A'}`, margin + 180, barY + 15);
  const ctText = countertopEstimate
    ? `${formatCurrency(countertopEstimate.totalLow)} – ${formatCurrency(countertopEstimate.totalHigh)}`
    : 'N/A';
  doc.text(`Countertops: ${ctText}`, margin + 340, barY + 15);
  const grandTotal = cabinetTotal + applianceTotal + (countertopEstimate ? (countertopEstimate.totalLow + countertopEstimate.totalHigh) / 2 : 0);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(184, 148, 78); // Pinnacle gold
  doc.text(`Est. Total: ${formatCurrency(Math.round(grandTotal))}`, margin + 520, barY + 15);
  doc.setTextColor(26, 26, 26);
  doc.setFont(undefined, 'normal');

  // Floor plan SVG
  const floorPlanSvg = document.querySelector('[data-pdf="floorplan"]');
  if (floorPlanSvg) {
    try {
      const svgClone = floorPlanSvg.cloneNode(true);
      // Set explicit dimensions for svg2pdf
      const vb = svgClone.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 500, 300];
      const availW = pageW - 2 * margin;
      const availH = pageH - barY - 50;
      const svgAR = vb[2] / vb[3];
      const fitW = Math.min(availW, availH * svgAR);
      const fitH = fitW / svgAR;

      await doc.svg(svgClone, {
        x: margin + (availW - fitW) / 2,
        y: barY + 34,
        width: fitW,
        height: fitH,
      });
    } catch (e) {
      console.warn('Floor plan SVG export failed:', e);
      doc.setFontSize(12);
      doc.text('Floor plan rendering — see interactive view', margin, barY + 60);
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(138, 138, 138);
  doc.text('Eclipse Kitchen Designer — Pinnacle Sales — Eclipse Cabinetry', margin, pageH - 15);
  doc.text('Page 1', pageW - margin - 30, pageH - 15);

  // ── Page 2+: Elevations + section, composed at a CONSISTENT TRUE SCALE ──
  // The elevation SVGs carry S = 2.2 px/inch internally. Target architectural scale
  // 1/2" = 1'-0"  →  72 * (0.5 / 12) = 3 pt per real inch  →  3 / 2.2 pt per SVG unit.
  // Every wall is drawn at this same factor so they're directly comparable across
  // sheets (capped down only if a wall is too wide for the page — flagged NTS).
  const S_INTERNAL = 2.2;
  const TRUE_PT_PER_UNIT = 3 / S_INTERNAL;
  const availW = pageW - 2 * margin;

  const sheets = [
    ...Array.from(document.querySelectorAll('[data-pdf="elevation"]')).map(el => ({ el, kind: 'Wall Elevation' })),
    ...Array.from(document.querySelectorAll('[data-pdf="section"]')).map(el => ({ el, kind: 'Typical Section' })),
  ];

  if (sheets.length > 0) {
    let yOffset = pageH; // force a new page on first item
    let pageScale = 1;

    for (let i = 0; i < sheets.length; i++) {
      try {
        const svgClone = sheets[i].el.cloneNode(true);
        const vb = svgClone.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 400, 200];
        // True scale, capped so an oversized wall still fits the page width.
        const fitToWidth = availW / vb[2];
        const scale = Math.min(TRUE_PT_PER_UNIT, fitToWidth);
        const isNTS = scale < TRUE_PT_PER_UNIT - 1e-6;
        const drawW = vb[2] * scale;
        const drawH = vb[3] * scale;

        // Page break when the next drawing won't fit in the remaining height.
        if (yOffset + drawH > pageH - 30) {
          doc.addPage('letter', 'landscape');
          yOffset = margin + 26;
          doc.setFontSize(14);
          doc.setTextColor(26, 26, 26);
          doc.text('Elevations & Sections', margin, margin + 8);
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text(`Scale: 1/2" = 1'-0"`, pageW - margin - 90, margin + 8);
        }

        await doc.svg(svgClone, {
          x: margin + (availW - drawW) / 2,
          y: yOffset,
          width: drawW,
          height: drawH,
        });
        if (isNTS) {
          doc.setFontSize(7);
          doc.setTextColor(150, 80, 80);
          doc.text('SCALE REDUCED TO FIT (NTS)', margin + (availW - drawW) / 2, yOffset + drawH + 8);
          doc.setTextColor(138, 138, 138);
        }
        yOffset += drawH + 22;
      } catch (e) {
        console.warn(`Sheet ${i} (${sheets[i].kind}) SVG export failed:`, e);
        yOffset += 30;
      }
    }
  }

  // ── BOM + construction notes sheet(s) — the order-entry page ──
  if (bom.length > 0 || specs.length > 0) {
    doc.addPage('letter', 'landscape');
    let y = margin + 8;
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 26);
    doc.text('BILL OF MATERIALS', margin, y);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${bom.reduce((s, r) => s + r.qty, 0)} units · ${bom.length} SKUs`, pageW - margin - 110, y);
    y += 14;

    const cols = [
      { k: 'sku', label: 'SKU', x: margin, w: 190 },
      { k: 'qty', label: 'QTY', x: margin + 195, w: 34, r: true },
      { k: 'w', label: 'W"', x: margin + 234, w: 40, r: true },
      { k: 'h', label: 'H"', x: margin + 279, w: 40, r: true },
      { k: 'd', label: 'D"', x: margin + 324, w: 40, r: true },
      { k: 'walls', label: 'LOCATION', x: margin + 372, w: 130 },
    ];
    const rowH = 13;
    const drawHeader = () => {
      doc.setFillColor(236, 233, 228);
      doc.rect(margin, y, pageW - 2 * margin, rowH, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      cols.forEach(c => doc.text(c.label, c.r ? c.x + c.w : c.x, y + 9, { align: c.r ? 'right' : 'left' }));
      y += rowH;
    };
    drawHeader();
    doc.setFontSize(8);
    for (const row of bom) {
      if (y + rowH > pageH - 30) {
        doc.addPage('letter', 'landscape');
        y = margin + 8;
        doc.setFontSize(11); doc.setTextColor(26, 26, 26);
        doc.text('BILL OF MATERIALS (cont.)', margin, y);
        y += 12;
        drawHeader();
        doc.setFontSize(8);
      }
      doc.setTextColor(26, 26, 26);
      cols.forEach(c => {
        const v = row[c.k];
        doc.text(v == null || v === '' ? '—' : String(v), c.r ? c.x + c.w : c.x, y + 9, { align: c.r ? 'right' : 'left' });
      });
      doc.setDrawColor(228, 221, 210);
      doc.setLineWidth(0.4);
      doc.line(margin, y + rowH, pageW - margin, y + rowH);
      y += rowH;
    }

    if (specs.length > 0) {
      if (y + 30 + specs.length * 12 > pageH - 30) {
        doc.addPage('letter', 'landscape');
        y = margin + 8;
      }
      y += 18;
      doc.setFontSize(12);
      doc.setTextColor(26, 26, 26);
      doc.text('CONSTRUCTION NOTES', margin, y);
      y += 12;
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);
      for (const line of specs) {
        doc.text(`•  ${line}`, margin, y);
        y += 12;
      }
    }
  }

  // Page footers (numbered, across the whole set)
  {
    const pageCount = doc.getNumberOfPages();
    for (let pp = 1; pp <= pageCount; pp++) {
      doc.setPage(pp);
      doc.setFontSize(7);
      doc.setTextColor(138, 138, 138);
      doc.text('Eclipse Kitchen Designer — Pinnacle Sales — Eclipse Cabinetry', margin, pageH - 15);
      doc.text(`Page ${pp} of ${pageCount}`, pageW - margin - 50, pageH - 15);
    }
  }

  // Save
  const filename = `Eclipse_${layoutType}_${roomType}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  return filename;
}

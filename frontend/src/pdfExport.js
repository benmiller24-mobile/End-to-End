/**
 * PDF Export Utility — Eclipse Kitchen Designer
 * Captures SVG floor plans and elevations into a multi-page PDF.
 * Uses jsPDF + svg2pdf.js for high-quality vector PDF output.
 */
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';

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

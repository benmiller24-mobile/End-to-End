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
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin, margin + 10);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Layout: ${layoutType.toUpperCase()} | Room: ${roomType} | Generated: ${new Date().toLocaleDateString()}`, margin, margin + 26);

  // Materials summary
  doc.setFontSize(9);
  doc.text(`Species: ${materials.species || 'N/A'} | Door: ${materials.door || 'N/A'} | Construction: ${materials.construction || 'N/A'}`, margin, margin + 40);

  // Pricing summary bar
  const barY = margin + 52;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, barY, pageW - 2 * margin, 24, 4, 4, 'F');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Cabinetry: ${formatCurrency(cabinetTotal)}`, margin + 10, barY + 15);
  doc.text(`Appliances: ${applianceTotal > 0 ? formatCurrency(applianceTotal) : 'N/A'}`, margin + 180, barY + 15);
  const ctText = countertopEstimate
    ? `${formatCurrency(countertopEstimate.totalLow)} – ${formatCurrency(countertopEstimate.totalHigh)}`
    : 'N/A';
  doc.text(`Countertops: ${ctText}`, margin + 340, barY + 15);
  const grandTotal = cabinetTotal + applianceTotal + (countertopEstimate ? (countertopEstimate.totalLow + countertopEstimate.totalHigh) / 2 : 0);
  doc.setFont(undefined, 'bold');
  doc.text(`Est. Total: ${formatCurrency(Math.round(grandTotal))}`, margin + 520, barY + 15);
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
  doc.setTextColor(148, 163, 184);
  doc.text('Eclipse Kitchen Designer — Pinnacle Sales — Eclipse Cabinetry', margin, pageH - 15);
  doc.text('Page 1', pageW - margin - 30, pageH - 15);

  // ── Page 2+: Elevations ──
  const elevationSvgs = document.querySelectorAll('[data-pdf="elevation"]');
  if (elevationSvgs.length > 0) {
    doc.addPage('letter', 'landscape');

    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Wall Elevations', margin, margin + 10);

    let yOffset = margin + 30;
    const maxElevH = (pageH - margin * 2 - 40) / Math.min(elevationSvgs.length, 3);

    for (let i = 0; i < elevationSvgs.length; i++) {
      if (yOffset + maxElevH > pageH - 30) {
        // New page
        doc.addPage('letter', 'landscape');
        yOffset = margin + 10;
      }

      try {
        const svgClone = elevationSvgs[i].cloneNode(true);
        const vb = svgClone.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 400, 200];
        const availW = pageW - 2 * margin;
        const svgAR = vb[2] / vb[3];
        const fitW = Math.min(availW, maxElevH * svgAR);
        const fitH = fitW / svgAR;

        await doc.svg(svgClone, {
          x: margin + (availW - fitW) / 2,
          y: yOffset,
          width: fitW,
          height: fitH,
        });
        yOffset += fitH + 15;
      } catch (e) {
        console.warn(`Elevation ${i} SVG export failed:`, e);
        yOffset += 30;
      }
    }

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.text(`Page ${p} of ${pageCount}`, pageW - margin - 50, pageH - 15);
    }
  }

  // Save
  const filename = `Eclipse_${layoutType}_${roomType}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  return filename;
}

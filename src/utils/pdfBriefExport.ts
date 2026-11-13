import { jsPDF } from 'jspdf';
import { CONTRACTORS_DIRECTORY } from '../data/contractors';
import { SAMPLE_FLOOR_PLAN_IMAGE } from '../data/styles';
import { StudioBriefSnapshots } from '../three/RoomSceneEngine';
import {
  ColorScheme,
  CostEstimate,
  MoodBoardPhoto,
  RoomConfig,
  StyleDefinition,
  UnitSystem,
} from '../types/design';
import { formatArea, formatCostPerArea, formatLength } from './units';

export interface DesignBriefPdfInput {
  room: RoomConfig;
  unitSystem: UnitSystem;
  style: StyleDefinition;
  scheme: ColorScheme;
  pinnedPhotos: MoodBoardPhoto[];
  estimate: CostEstimate;
  shortlistedContractorIds: string[];
  snapshots: StudioBriefSnapshots | null;
  propertyType?: string;
  postalDistrict?: string;
}

interface LoadedRaster {
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '8');
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return [120, 120, 120];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function formatSGD(amount: number): string {
  return `S$${Math.round(amount).toLocaleString('en-SG')}`;
}

/**
 * Loads an image URL (data URL, bundled Vite asset, or CORS-enabled remote image)
 * and normalizes it into a JPEG/PNG data URL suitable for jsPDF.
 */
async function loadRasterForPdf(
  src: string,
  coverRatio?: number,
): Promise<LoadedRaster | null> {
  if (!src) return null;

  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = window.setTimeout(() => resolve(null), 6500);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const srcW = Math.max(1, img.naturalWidth || img.width);
        const srcH = Math.max(1, img.naturalHeight || img.height);
        const maxDim = 1280;

        let sx = 0;
        let sy = 0;
        let sw = srcW;
        let sh = srcH;

        if (coverRatio && coverRatio > 0) {
          const currentRatio = srcW / srcH;
          if (currentRatio > coverRatio) {
            sw = srcH * coverRatio;
            sx = (srcW - sw) / 2;
          } else {
            sh = srcW / coverRatio;
            sy = (srcH - sh) / 2;
          }
        }

        const scale = Math.min(1, maxDim / Math.max(sw, sh));
        const outW = Math.max(2, Math.round(sw * scale));
        const outH = Math.max(2, Math.round(sh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve({
          dataUrl,
          width: outW,
          height: outH,
          format: 'JPEG',
        });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };

    img.src = src;
  });
}

function drawFittedImage(
  doc: jsPDF,
  raster: LoadedRaster,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
) {
  const ratio = raster.width / Math.max(1, raster.height);
  const boxRatio = boxW / Math.max(0.01, boxH);
  let drawW = boxW;
  let drawH = boxH;
  if (ratio > boxRatio) {
    drawH = boxW / ratio;
  } else {
    drawW = boxH * ratio;
  }
  const dx = boxX + (boxW - drawW) / 2;
  const dy = boxY + (boxH - drawH) / 2;
  doc.addImage(raster.dataUrl, raster.format, dx, dy, drawW, drawH, undefined, 'FAST');
}

function addPageHeader(doc: jsPDF, sectionTitle: string, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 25, 23);
  doc.rect(0, 0, pageW, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('ATELIER SPATIAL', 14, 11.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 195, 184);
  doc.text(sectionTitle, 58, 11.2);

  doc.text(`Page ${pageNum} of ${totalPages}`, pageW - 14, 11.2, { align: 'right' });
}

export async function exportDesignBriefPdf(input: DesignBriefPdfInput): Promise<void> {
  const {
    room,
    unitSystem,
    style,
    scheme,
    pinnedPhotos,
    estimate,
    shortlistedContractorIds,
    snapshots,
    propertyType = room.layoutPreset === 'hdb-5-room' ? 'HDB BTO / Resale' : 'Singapore Residence',
    postalDistrict,
  } = input;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const totalPages = 3;

  // Resolve Mood Board photos: prioritize user-pinned looks, fill with style's curated photos up to 6
  const seenIds = new Set<string>();
  const briefMoodPhotos: MoodBoardPhoto[] = [];
  for (const p of [...pinnedPhotos, ...style.moodBoardPhotos]) {
    if (seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    briefMoodPhotos.push(p);
    if (briefMoodPhotos.length >= 6) break;
  }

  const targetContractors = (() => {
    const manual = CONTRACTORS_DIRECTORY.filter((c) => shortlistedContractorIds.includes(c.id));
    if (manual.length > 0) return manual;
    return CONTRACTORS_DIRECTORY.filter((c) => c.recommendedFor.includes(style.id)).slice(0, 3);
  })();

  // Pre-load all images concurrently
  const floorPlanSource = room.floorPlanUrl ?? SAMPLE_FLOOR_PLAN_IMAGE;
  const [
    floorPlanRaster,
    active3dRaster,
    iso3dRaster,
    top3dRaster,
    moodRasters,
    spacePhotoRasters,
  ] = await Promise.all([
    loadRasterForPdf(floorPlanSource),
    snapshots ? loadRasterForPdf(snapshots.activeViewDataUrl) : Promise.resolve(null),
    snapshots ? loadRasterForPdf(snapshots.isometricDataUrl) : Promise.resolve(null),
    snapshots ? loadRasterForPdf(snapshots.topPlanDataUrl) : Promise.resolve(null),
    Promise.all(briefMoodPhotos.map((p) => loadRasterForPdf(p.imageUrl, 1.5))),
    Promise.all(room.photos.slice(0, 3).map((p) => loadRasterForPdf(p.dataUrl, 1.5))),
  ]);

  // ============================================================================
  // PAGE 1: DESIGN BRIEF OVERVIEW, 2D FLOOR PLAN & 3D MODEL SCREENSHOTS
  // ============================================================================
  addPageHeader(doc, 'Renovation Design Brief & 3D Spatial Visualisation', 1, totalPages);

  // Title & Date block
  let y = 27;
  doc.setTextColor(26, 25, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(room.roomName || 'Singapore Renovation Project Brief', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 97, 91);
  const dateStr = new Date().toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const subParts = [
    propertyType,
    postalDistrict ? `District / Estate: ${postalDistrict}` : null,
    `Prepared ${dateStr}`,
  ].filter(Boolean);
  doc.text(subParts.join('  ·  '), margin, y + 5.5);

  // Key Summary Cards (3 columns)
  y = 39;
  const cardGap = 4;
  const cardW = (contentW - cardGap * 2) / 3;
  const cardH = 22;

  // Card 1: Space Dimensions
  doc.setFillColor(248, 247, 244);
  doc.setDrawColor(230, 227, 220);
  doc.roundedRect(margin, y, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 97, 91);
  doc.text('SPACE DIMENSIONS', margin + 3.5, y + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(26, 25, 23);
  doc.text(
    `${formatLength(room.widthFt, unitSystem)} × ${formatLength(room.lengthFt, unitSystem)}`,
    margin + 3.5,
    y + 11.5,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 72, 66);
  doc.text(
    `${formatArea(estimate.areaSqFt, unitSystem)} · ${formatLength(room.heightFt, unitSystem)} ceiling`,
    margin + 3.5,
    y + 17.5,
  );

  // Card 2: Selected Style & Palette
  const c2x = margin + cardW + cardGap;
  doc.setFillColor(248, 247, 244);
  doc.roundedRect(c2x, y, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 97, 91);
  doc.text('STYLE & PALETTE', c2x + 3.5, y + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(26, 25, 23);
  doc.text(`${style.name} · ${scheme.name}`, c2x + 3.5, y + 11.5);
  scheme.swatches.forEach((hex, idx) => {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.setDrawColor(200, 196, 188);
    doc.rect(c2x + 3.5 + idx * 7.5, y + 14.2, 6, 4.2, 'FD');
  });

  // Card 3: Estimated Budget
  const c3x = c2x + cardW + cardGap;
  doc.setFillColor(248, 247, 244);
  doc.roundedRect(c3x, y, cardW, cardH, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 97, 91);
  doc.text('ESTIMATED SGD BUDGET', c3x + 3.5, y + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(27, 77, 62);
  doc.text(
    `${formatSGD(estimate.estimatedLow)} – ${formatSGD(estimate.estimatedHigh)}`,
    c3x + 3.5,
    y + 11.5,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 72, 66);
  doc.text(
    `${estimate.rows.length} work packages · ~${formatCostPerArea(estimate.costPerSqFt, unitSystem)}`,
    c3x + 3.5,
    y + 17.5,
  );

  // Section 1: 2D Architectural Floor Plan
  y = 67;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(26, 25, 23);
  doc.text('01. Architectural 2D Floor Plan & Calibrated Scan', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 97, 91);
  const scanNote = room.floorPlanAnalysis
    ? `${room.floorPlanName ?? 'Floor Plan'}  ·  ${room.floorPlanAnalysis.detectedWalls.length} scanned walls  ·  ${room.floorPlanAnalysis.scaleLabel}  ·  ${room.floorPlanAnalysis.openingsDetected} openings`
    : `${room.floorPlanName ?? 'Calibrated Spatial Plan'}  ·  ${room.layoutPreset}`;
  doc.text(scanNote, margin, y + 4.5);

  const planBoxY = y + 7;
  const planBoxH = 88;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 216, 207);
  doc.roundedRect(margin, planBoxY, contentW, planBoxH, 2, 2, 'FD');

  if (floorPlanRaster) {
    drawFittedImage(doc, floorPlanRaster, margin + 2, planBoxY + 2, contentW - 4, planBoxH - 4);
  } else {
    doc.setFontSize(9);
    doc.setTextColor(120, 116, 108);
    doc.text('Floor plan preview unavailable', pageW / 2, planBoxY + planBoxH / 2, {
      align: 'center',
    });
  }

  // Section 2: Interactive 3D Spatial Model Screenshots
  y = planBoxY + planBoxH + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(26, 25, 23);
  doc.text('02. 3D Spatial Model Screenshots', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 97, 91);
  doc.text(
    `Rendered with ${style.name} PBR timber, wall finish & ${scheme.name} furnishings`,
    margin,
    y + 4.5,
  );

  const shotsY = y + 7;
  const shotGap = 4;
  const shotW = (contentW - shotGap) / 2;
  const shotH = 68;

  const leftShot = active3dRaster ?? iso3dRaster;
  const rightShot =
    top3dRaster ??
    (iso3dRaster && active3dRaster !== iso3dRaster ? iso3dRaster : null);

  // Left 3D Screenshot Card
  doc.setFillColor(25, 24, 22);
  doc.setDrawColor(220, 216, 207);
  doc.roundedRect(margin, shotsY, shotW, shotH, 2, 2, 'FD');
  if (leftShot) {
    drawFittedImage(doc, leftShot, margin + 1.5, shotsY + 1.5, shotW - 3, shotH - 10);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('3D Perspective View', margin + 3.5, shotsY + shotH - 3.2);

  // Right 3D Screenshot Card
  const rShotX = margin + shotW + shotGap;
  doc.setFillColor(25, 24, 22);
  doc.roundedRect(rShotX, shotsY, shotW, shotH, 2, 2, 'FD');
  if (rightShot) {
    drawFittedImage(doc, rightShot, rShotX + 1.5, shotsY + 1.5, shotW - 3, shotH - 10);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('3D Top-Down Spatial Plan', rShotX + 3.5, shotsY + shotH - 3.2);

  // Footer note on Page 1
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 116, 108);
  doc.text(
    'Atelier Spatial · Singapore DIY Renovation & Contractor Planning Studio',
    margin,
    pageH - 10,
  );

  // ============================================================================
  // PAGE 2: SELECTED INSPIRATION MOOD BOARD, PALETTE & MATERIAL SPECIFICATIONS
  // ============================================================================
  doc.addPage();
  addPageHeader(doc, 'Selected Inspiration Mood Board & Material Palette', 2, totalPages);

  y = 27;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 25, 23);
  doc.text(`03. Inspiration Mood Board — ${style.name} (${scheme.name})`, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 72, 66);
  const descLines = doc.splitTextToSize(style.description, contentW);
  doc.text(descLines, margin, y + 5.5);

  // Color Swatches & Material Spec Panel
  y = y + 6 + descLines.length * 4 + 3;
  doc.setFillColor(248, 247, 244);
  doc.setDrawColor(230, 227, 220);
  doc.roundedRect(margin, y, contentW, 33, 2, 2, 'FD');

  const swatchLabels = ['Wall', 'Accent', 'Floor', 'Timber', 'Textile'];
  scheme.swatches.forEach((hex, i) => {
    const sx = margin + 4 + i * 35;
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
    doc.setDrawColor(195, 190, 182);
    doc.roundedRect(sx, y + 3.5, 10, 7, 1, 1, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(26, 25, 23);
    doc.text(swatchLabels[i] ?? `Tone ${i + 1}`, sx + 12, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 97, 91);
    doc.text(hex.toUpperCase(), sx + 12, y + 10);
  });

  // Material spec grid inside same panel
  doc.setFontSize(7.5);
  const matCols = [
    { label: 'Flooring', value: style.materialSpecs.flooring },
    { label: 'Walls', value: style.materialSpecs.walls },
    { label: 'Textiles', value: style.materialSpecs.textiles },
    { label: 'Hardware', value: style.materialSpecs.hardware },
  ];
  matCols.forEach((m, idx) => {
    const colX = margin + 4 + (idx % 2) * (contentW / 2 - 2);
    const colY = y + 17 + Math.floor(idx / 2) * 7.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 25, 23);
    doc.text(`${m.label}:`, colX, colY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 72, 66);
    const clipped = doc.splitTextToSize(m.value, contentW / 2 - 22)[0] ?? m.value;
    doc.text(clipped, colX + 16, colY);
  });

  // Mood Board Photo Grid (2 cols x up to 3 rows)
  y = y + 38;
  const pinnedIds = new Set(pinnedPhotos.map((p) => p.id));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(26, 25, 23);
  doc.text(
    `Curated Inspiration Selection (${pinnedPhotos.length > 0 ? `${pinnedPhotos.length} pinned + ` : ''}${briefMoodPhotos.length} total looks)`,
    margin,
    y,
  );

  const gridY = y + 4;
  const mGapX = 4;
  const mGapY = 4;
  const mW = (contentW - mGapX) / 2;
  const hasExistingPhotos = spacePhotoRasters.some(Boolean);
  const mImgH = hasExistingPhotos ? 34 : 44;
  const mCardH = mImgH + 14;

  briefMoodPhotos.forEach((photo, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = margin + col * (mW + mGapX);
    const cy = gridY + row * (mCardH + mGapY);
    const raster = moodRasters[idx];

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(pinnedIds.has(photo.id) ? 27 : 225, pinnedIds.has(photo.id) ? 77 : 222, pinnedIds.has(photo.id) ? 62 : 215);
    doc.roundedRect(cx, cy, mW, mCardH, 2, 2, 'FD');

    if (raster) {
      drawFittedImage(doc, raster, cx + 1.5, cy + 1.5, mW - 3, mImgH - 2);
    } else {
      const [r, g, b] = hexToRgb(photo.dominantHex);
      doc.setFillColor(r, g, b);
      doc.rect(cx + 1.5, cy + 1.5, mW - 3, mImgH - 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(photo.category.toUpperCase(), cx + 4, cy + mImgH / 2);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(26, 25, 23);
    const titleClip = doc.splitTextToSize(
      `${pinnedIds.has(photo.id) ? '★ ' : ''}${photo.title}`,
      mW - 6,
    )[0];
    doc.text(titleClip ?? photo.title, cx + 3, cy + mImgH + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 97, 91);
    const noteClip = doc.splitTextToSize(`${photo.category} · ${photo.finishNote}`, mW - 6)[0];
    doc.text(noteClip ?? photo.finishNote, cx + 3, cy + mImgH + 9.2);
  });

  // Optional Uploaded Existing Room Reference Photos
  if (hasExistingPhotos) {
    const rowsUsed = Math.ceil(briefMoodPhotos.length / 2);
    const refY = gridY + rowsUsed * (mCardH + mGapY) + 4;
    if (refY + 34 < pageH - 14) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(26, 25, 23);
      doc.text(`Existing Space Reference Photos (${room.photos.length})`, margin, refY);

      const pGap = 4;
      const pW = (contentW - pGap * 2) / 3;
      room.photos.slice(0, 3).forEach((photo, idx) => {
        const px = margin + idx * (pW + pGap);
        const py = refY + 3.5;
        doc.setFillColor(248, 247, 244);
        doc.setDrawColor(225, 222, 215);
        doc.roundedRect(px, py, pW, 30, 1.5, 1.5, 'FD');
        const raster = spacePhotoRasters[idx];
        if (raster) {
          drawFittedImage(doc, raster, px + 1, py + 1, pW - 2, 22);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(75, 72, 66);
        doc.text(photo.name.slice(0, 26), px + 2, py + 27);
      });
    }
  }

  // ============================================================================
  // PAGE 3: ITEMIZED SGD BUDGET & MATCHED SINGAPORE RENOVATION CONTRACTORS
  // ============================================================================
  doc.addPage();
  addPageHeader(doc, 'SGD Renovation Cost Breakdown & Singapore Contractors', 3, totalPages);

  y = 27;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 25, 23);
  doc.text('04. Itemized Singapore Renovation Estimate (SGD)', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 97, 91);
  doc.text(
    `Based on ${formatArea(estimate.areaSqFt, unitSystem)} · ${style.name} material tier (${style.costMultiplier.toFixed(2)}×)`,
    margin,
    y + 5,
  );

  // Table Header
  let ty = y + 10;
  doc.setFillColor(241, 239, 233);
  doc.rect(margin, ty, contentW, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(75, 72, 66);
  doc.text('Work Package', margin + 3, ty + 5.4);
  doc.text('Qty', margin + 88, ty + 5.4, { align: 'right' });
  doc.text('Materials', margin + 120, ty + 5.4, { align: 'right' });
  doc.text('Labor', margin + 150, ty + 5.4, { align: 'right' });
  doc.text('Total', pageW - margin - 3, ty + 5.4, { align: 'right' });

  ty += 8;
  estimate.rows.forEach((row, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 249, 246);
      doc.rect(margin, ty, contentW, 9, 'F');
    }
    doc.setDrawColor(235, 232, 226);
    doc.line(margin, ty + 9, pageW - margin, ty + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(26, 25, 23);
    doc.text(row.label, margin + 3, ty + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 97, 91);
    doc.text(row.category, margin + 3, ty + 7.7);

    doc.setFontSize(8);
    doc.text(row.quantityLabel, margin + 88, ty + 5.5, { align: 'right' });
    doc.setTextColor(26, 25, 23);
    doc.text(formatSGD(row.materialCost), margin + 120, ty + 5.5, { align: 'right' });
    doc.text(formatSGD(row.laborCost), margin + 150, ty + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatSGD(row.totalCost), pageW - margin - 3, ty + 5.5, { align: 'right' });

    ty += 9;
  });

  // Totals Footer
  doc.setFillColor(248, 247, 244);
  doc.rect(margin, ty, contentW, 24, 'F');
  doc.setDrawColor(210, 206, 198);
  doc.rect(margin, ty, contentW, 24, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 72, 66);
  doc.text('Subtotal (Materials + Labor)', margin + 3, ty + 6);
  doc.setTextColor(26, 25, 23);
  doc.text(formatSGD(estimate.materialsTotal), margin + 120, ty + 6, { align: 'right' });
  doc.text(formatSGD(estimate.laborTotal), margin + 150, ty + 6, { align: 'right' });
  doc.text(formatSGD(estimate.subtotal), pageW - margin - 3, ty + 6, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(100, 97, 91);
  doc.text('Recommended 10% Renovation Contingency', margin + 3, ty + 12.5);
  doc.text(formatSGD(estimate.contingency), pageW - margin - 3, ty + 12.5, { align: 'right' });

  doc.setDrawColor(210, 206, 198);
  doc.line(margin + 3, ty + 15.5, pageW - margin - 3, ty + 15.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(27, 77, 62);
  doc.text('Estimated Total Budget Range (SGD)', margin + 3, ty + 21);
  doc.text(
    `${formatSGD(estimate.estimatedLow)} – ${formatSGD(estimate.estimatedHigh)}`,
    pageW - margin - 3,
    ty + 21,
    { align: 'right' },
  );

  // Matched Singapore Contractors Section
  y = ty + 34;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 25, 23);
  doc.text(
    `05. Matched Singapore Renovation Contractors (${targetContractors.length})`,
    margin,
    y,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 97, 91);
  doc.text(
    'Recommended HDB-registered, BCA-licensed & CaseTrust Singapore firms for this design brief',
    margin,
    y + 4.5,
  );

  let cy = y + 8.5;
  targetContractors.forEach((c) => {
    if (cy + 27 > pageH - 14) return;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(225, 222, 215);
    doc.roundedRect(margin, cy, contentW, 25, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(26, 25, 23);
    doc.text(c.name, margin + 4, cy + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(27, 77, 62);
    doc.text(`${c.rateTier} · ${c.rating.toFixed(1)}★ · ${c.leadTime}`, pageW - margin - 4, cy + 6.5, {
      align: 'right',
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 97, 91);
    doc.text(`${c.specialty}  ·  ${c.location}  ·  ${c.directoryLabel}`, margin + 4, cy + 11.5);

    doc.setTextColor(63, 61, 57);
    const sumLines = doc.splitTextToSize(c.summary, contentW - 8).slice(0, 2);
    doc.text(sumLines, margin + 4, cy + 16.5);

    cy += 28;
  });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 116, 108);
  doc.text(
    'Generated by Atelier Spatial · Ready to attach for Singapore HDB / Condo renovation quotations',
    margin,
    pageH - 10,
  );

  const safeSlug = `${style.id}-${scheme.id}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  doc.save(`atelier-spatial-design-brief-${safeSlug}.pdf`);
}

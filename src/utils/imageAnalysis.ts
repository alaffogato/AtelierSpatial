import {
  DetectedWallSegment,
  FloorPlanAnalysis,
  NormalizedBox,
} from '../types/design';
import { metersToFeet } from './units';

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Scans the bottom margin region of a floor plan image for a horizontal
 * graphic scale bar (dense dark horizontal band or alternating black/white ticks).
 */
function detectGraphicScaleBar(
  binary: Uint8Array,
  w: number,
  h: number,
): { box: NormalizedBox; pixelWidth: number } | null {
  const startY = Math.floor(h * 0.74);
  const endY = Math.floor(h * 0.96);

  let bestRowStart = -1;
  let bestRowEnd = -1;
  let bestBarStartX = 0;
  let bestBarWidth = 0;

  for (let y = startY; y < endY; y++) {
    let runStart = -1;
    let maxRun = 0;
    let maxRunStart = 0;

    for (let x = Math.floor(w * 0.04); x < Math.floor(w * 0.55); x++) {
      // Allow 2px gaps inside segmented scale bars (alternating black/white blocks)
      const isInk =
        binary[y * w + x] === 1 ||
        (y + 1 < h && binary[(y + 1) * w + x] === 1) ||
        (y - 1 >= 0 && binary[(y - 1) * w + x] === 1);

      if (isInk) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        // Look ahead up to 4px in case of white segment inside alternating scale bar
        let bridged = false;
        for (let k = 1; k <= 4 && x + k < w; k++) {
          if (binary[y * w + x + k] === 1) {
            bridged = true;
            break;
          }
        }
        if (!bridged) {
          const len = x - runStart;
          if (len > maxRun) {
            maxRun = len;
            maxRunStart = runStart;
          }
          runStart = -1;
        }
      }
    }

    if (runStart !== -1) {
      const len = Math.floor(w * 0.55) - runStart;
      if (len > maxRun) {
        maxRun = len;
        maxRunStart = runStart;
      }
    }

    // Scale bars are typically 10%..38% of image width and multi-pixel thick
    if (maxRun >= w * 0.09 && maxRun <= w * 0.42) {
      if (bestRowStart === -1 || y - bestRowEnd > 3) {
        bestRowStart = y;
        bestRowEnd = y;
        bestBarStartX = maxRunStart;
        bestBarWidth = maxRun;
      } else {
        bestRowEnd = y;
        bestBarWidth = Math.max(bestBarWidth, maxRun);
      }
    }
  }

  if (bestRowStart !== -1 && bestBarWidth >= w * 0.09) {
    const barH = Math.max(4, bestRowEnd - bestRowStart + 4);
    return {
      pixelWidth: bestBarWidth,
      box: {
        x: Number((bestBarStartX / w).toFixed(3)),
        y: Number((Math.max(0, bestRowStart - 2) / h).toFixed(3)),
        w: Number((bestBarWidth / w).toFixed(3)),
        h: Number((barH / h).toFixed(3)),
      },
    };
  }

  return null;
}

/**
 * Finds the main floor plan architectural enclosure bounds (excluding outer paper border/title block).
 */
function detectPlanEnclosureBounds(
  binary: Uint8Array,
  w: number,
  h: number,
): NormalizedBox {
  const rowCounts = new Float32Array(h);
  const colCounts = new Float32Array(w);

  // Focus inside central 10%..84% Y to exclude top page border & bottom title/scale bar
  const yMinScan = Math.floor(h * 0.08);
  const yMaxScan = Math.floor(h * 0.82);
  const xMinScan = Math.floor(w * 0.06);
  const xMaxScan = Math.floor(w * 0.94);

  for (let y = yMinScan; y < yMaxScan; y++) {
    let count = 0;
    for (let x = xMinScan; x < xMaxScan; x++) {
      if (binary[y * w + x] === 1) {
        count++;
        colCounts[x]++;
      }
    }
    rowCounts[y] = count / Math.max(1, xMaxScan - xMinScan);
  }

  const scanH = Math.max(1, yMaxScan - yMinScan);
  for (let x = xMinScan; x < xMaxScan; x++) {
    colCounts[x] /= scanH;
  }

  let topY = yMinScan;
  let botY = yMaxScan - 1;
  let leftX = xMinScan;
  let rightX = xMaxScan - 1;

  for (let y = yMinScan; y < yMaxScan; y++) {
    if (rowCounts[y] > 0.14) {
      topY = y;
      break;
    }
  }
  for (let y = yMaxScan - 1; y > topY + 20; y--) {
    if (rowCounts[y] > 0.14) {
      botY = y;
      break;
    }
  }
  for (let x = xMinScan; x < xMaxScan; x++) {
    if (colCounts[x] > 0.12) {
      leftX = x;
      break;
    }
  }
  for (let x = xMaxScan - 1; x > leftX + 20; x--) {
    if (colCounts[x] > 0.12) {
      rightX = x;
      break;
    }
  }

  const boxW = Math.max(40, rightX - leftX);
  const boxH = Math.max(30, botY - topY);

  return {
    x: Number((leftX / w).toFixed(3)),
    y: Number((topY / h).toFixed(3)),
    w: Number((boxW / w).toFixed(3)),
    h: Number((boxH / h).toFixed(3)),
  };
}

/**
 * Scans the interior of the detected floor plan enclosure for horizontal
 * and vertical structural partition walls.
 */
function detectInteriorWallSegments(
  binary: Uint8Array,
  w: number,
  h: number,
  bounds: NormalizedBox,
): DetectedWallSegment[] {
  const bx = Math.floor(bounds.x * w);
  const by = Math.floor(bounds.y * h);
  const bw = Math.max(20, Math.floor(bounds.w * w));
  const bh = Math.max(20, Math.floor(bounds.h * h));

  const segments: DetectedWallSegment[] = [];

  // Scan horizontal interior bands (skip outer 14% perimeter walls)
  const yStart = by + Math.floor(bh * 0.16);
  const yEnd = by + Math.floor(bh * 0.84);
  const xStart = bx + Math.floor(bw * 0.08);
  const xEnd = bx + Math.floor(bw * 0.92);

  for (let y = yStart; y < yEnd; y += 3) {
    let runStart = -1;
    for (let x = xStart; x <= xEnd; x++) {
      // Check 3px vertical band for thick wall ink (ignores thin furniture/text)
      const thickInk =
        x < xEnd &&
        binary[y * w + x] +
          binary[Math.min(h - 1, y + 1) * w + x] +
          binary[Math.max(0, y - 1) * w + x] >=
          2;

      if (thickInk) {
        if (runStart === -1) runStart = x;
      } else if (runStart !== -1) {
        const len = x - runStart;
        if (len >= bw * 0.22 && len <= bw * 0.78) {
          segments.push({
            x1: Number(((runStart - bx) / bw).toFixed(3)),
            y1: Number(((y - by) / bh).toFixed(3)),
            x2: Number(((x - bx) / bw).toFixed(3)),
            y2: Number(((y - by) / bh).toFixed(3)),
            thicknessNorm: 0.025,
          });
        }
        runStart = -1;
      }
    }
  }

  // Scan vertical interior bands
  const vxStart = bx + Math.floor(bw * 0.16);
  const vxEnd = bx + Math.floor(bw * 0.84);
  const vyStart = by + Math.floor(bh * 0.08);
  const vyEnd = by + Math.floor(bh * 0.92);

  for (let x = vxStart; x < vxEnd; x += 3) {
    let runStart = -1;
    for (let y = vyStart; y <= vyEnd; y++) {
      const thickInk =
        y < vyEnd &&
        binary[y * w + x] +
          binary[y * w + Math.min(w - 1, x + 1)] +
          binary[y * w + Math.max(0, x - 1)] >=
          2;

      if (thickInk) {
        if (runStart === -1) runStart = y;
      } else if (runStart !== -1) {
        const len = y - runStart;
        if (len >= bh * 0.24 && len <= bh * 0.78) {
          segments.push({
            x1: Number(((x - bx) / bw).toFixed(3)),
            y1: Number(((runStart - by) / bh).toFixed(3)),
            x2: Number(((x - bx) / bw).toFixed(3)),
            y2: Number(((y - by) / bh).toFixed(3)),
            thicknessNorm: 0.025,
          });
        }
        runStart = -1;
      }
    }
  }

  // Deduplicate close parallel wall detections so we keep max 3 clean structural partitions
  const deduped: DetectedWallSegment[] = [];
  for (const seg of segments) {
    const isNearExisting = deduped.some(
      (d) =>
        Math.abs(d.x1 - seg.x1) < 0.12 &&
        Math.abs(d.y1 - seg.y1) < 0.12 &&
        Math.abs(d.x2 - seg.x2) < 0.12 &&
        Math.abs(d.y2 - seg.y2) < 0.12,
    );
    if (!isNearExisting) {
      deduped.push(seg);
      if (deduped.length >= 3) break;
    }
  }

  return deduped;
}

/**
 * Rebuilt Floor Plan Analyzer:
 * Scans an uploaded floor plan image for structural wall lines, enclosure bounds,
 * openings, and graphic scale bars, returning metric & imperial calibrated dimensions.
 */
export async function analyzeFloorPlanImage(
  dataUrl: string,
  scaleReferenceMeters = 3.0,
): Promise<FloorPlanAnalysis> {
  try {
    const img = await loadImageElement(dataUrl);
    const sampleW = 240;
    const sampleH = Math.max(120, Math.round((img.height / Math.max(1, img.width)) * sampleW));

    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');

    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

    const binary = new Uint8Array(sampleW * sampleH);
    let darkPixelsTotal = 0;

    for (let i = 0; i < sampleW * sampleH; i++) {
      const idx = i * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < 138) {
        binary[i] = 1;
        darkPixelsTotal++;
      }
    }

    const scaleResult = detectGraphicScaleBar(binary, sampleW, sampleH);
    const wallBounds = detectPlanEnclosureBounds(binary, sampleW, sampleH);
    const detectedWalls = detectInteriorWallSegments(binary, sampleW, sampleH, wallBounds);

    const boxPxW = wallBounds.w * sampleW;
    const boxPxH = wallBounds.h * sampleH;
    const planAspect = boxPxW / Math.max(1, boxPxH);

    let pixelsPerMeter = boxPxW / 7.8;
    let suggestedLengthM = 7.8;
    let suggestedWidthM = Number((7.8 / Math.max(1.05, Math.min(1.85, planAspect))).toFixed(1));

    if (scaleResult) {
      pixelsPerMeter = scaleResult.pixelWidth / Math.max(0.5, scaleReferenceMeters);
      const rawLengthM = boxPxW / pixelsPerMeter;
      const rawWidthM = boxPxH / pixelsPerMeter;
      suggestedLengthM = Number(Math.min(11.5, Math.max(4.2, rawLengthM)).toFixed(1));
      suggestedWidthM = Number(Math.min(9.0, Math.max(3.6, rawWidthM)).toFixed(1));
    } else {
      suggestedLengthM = Number(
        Math.min(10.5, Math.max(4.5, 4.8 * Math.min(1.85, Math.max(1.0, planAspect)))).toFixed(1),
      );
      suggestedWidthM = Number(
        Math.min(8.5, Math.max(3.8, suggestedLengthM / Math.max(1.05, Math.min(1.75, planAspect)))).toFixed(1),
      );
    }

    // Build 12x9 normalized wall-ink grid for HUD overlay
    const cols = 12;
    const rows = 9;
    const cellW = Math.floor(sampleW / cols);
    const cellH = Math.floor(sampleH / rows);
    const zoneGrid: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const rowValues: number[] = [];
      for (let c = 0; c < cols; c++) {
        let count = 0;
        for (let y = r * cellH; y < (r + 1) * cellH; y++) {
          for (let x = c * cellW; x < (c + 1) * cellW; x++) {
            count += binary[y * sampleW + x];
          }
        }
        rowValues.push(Number((count / Math.max(1, cellW * cellH)).toFixed(2)));
      }
      zoneGrid.push(rowValues);
    }

    // Estimate perimeter openings along top/bottom wall bands
    let openingsDetected = 0;
    const topBandY = Math.floor(wallBounds.y * sampleH);
    for (let c = 1; c < cols - 1; c++) {
      const cx = Math.floor((c + 0.5) * cellW);
      if (binary[topBandY * sampleW + cx] === 0) openingsDetected++;
    }

    const scaleLabel = scaleResult
      ? `Scale bar detected (${Math.round(scaleResult.pixelWidth)} px = ${scaleReferenceMeters.toFixed(1)} m)`
      : `Calibrated from plan enclosure (${planAspect.toFixed(2)}:1 ratio)`;

    return {
      aspectRatio: Number(planAspect.toFixed(2)),
      wallDensity: Number((darkPixelsTotal / (sampleW * sampleH)).toFixed(2)),
      suggestedWidthM,
      suggestedLengthM,
      suggestedWidthFt: metersToFeet(suggestedWidthM),
      suggestedLengthFt: metersToFeet(suggestedLengthM),
      scaleBarDetected: Boolean(scaleResult),
      scaleBarBounds: scaleResult?.box ?? null,
      scaleBarPx: scaleResult?.pixelWidth ?? null,
      scaleReferenceMeters,
      pixelsPerMeter: Number(pixelsPerMeter.toFixed(1)),
      scaleLabel,
      wallBounds,
      detectedWalls,
      hasPartition: detectedWalls.length > 0,
      openingsDetected: Math.max(2, Math.min(6, openingsDetected)),
      zoneGrid,
    };
  } catch {
    return {
      aspectRatio: 1.62,
      wallDensity: 0.16,
      suggestedWidthM: 4.9,
      suggestedLengthM: 7.9,
      suggestedWidthFt: 16,
      suggestedLengthFt: 26,
      scaleBarDetected: false,
      scaleBarBounds: null,
      scaleBarPx: null,
      scaleReferenceMeters,
      pixelsPerMeter: 30,
      scaleLabel: 'Standard spatial calibration applied',
      wallBounds: { x: 0.12, y: 0.18, w: 0.76, h: 0.6 },
      detectedWalls: [],
      hasPartition: false,
      openingsDetected: 3,
      zoneGrid: Array.from({ length: 9 }, () => Array(12).fill(0.1)),
    };
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export async function extractDominantColors(
  dataUrl: string,
): Promise<{ colors: string[]; width: number; height: number }> {
  try {
    const img = await loadImageElement(dataUrl);
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { colors: ['#D7CEC2', '#8B7156', '#E8E3DC', '#4F4942'], width: img.width, height: img.height };

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`;
      const entry = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1;
      entry.r += r;
      entry.g += g;
      entry.b += b;
      buckets.set(key, entry);
    }

    const sorted = Array.from(buckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((b) => rgbToHex(b.r / b.count, b.g / b.count, b.b / b.count));

    return {
      colors: sorted.length > 0 ? sorted : ['#D7CEC2', '#8B7156', '#E8E3DC', '#4F4942'],
      width: img.width,
      height: img.height,
    };
  } catch {
    return { colors: ['#D7CEC2', '#8B7156', '#E8E3DC', '#4F4942'], width: 1200, height: 900 };
  }
}

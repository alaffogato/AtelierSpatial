import { FloorPlanAnalysis } from '../types/design';

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
 * Analyzes an uploaded floor plan image using an offscreen HTML5 canvas
 * to estimate room aspect ratio, wall density, structural partitions, and
 * produce an 8x6 occupancy grid for 3D geometry generation.
 */
export async function analyzeFloorPlanImage(dataUrl: string): Promise<FloorPlanAnalysis> {
  try {
    const img = await loadImageElement(dataUrl);
    const cols = 8;
    const rows = 6;
    const sampleW = 96;
    const sampleH = 72;

    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D context unavailable');
    }

    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

    const cellW = Math.floor(sampleW / cols);
    const cellH = Math.floor(sampleH / rows);
    const zoneGrid: number[][] = [];
    let darkPixelsTotal = 0;
    const totalPixels = sampleW * sampleH;

    for (let r = 0; r < rows; r++) {
      const rowValues: number[] = [];
      for (let c = 0; c < cols; c++) {
        let darkCount = 0;
        const cellPixels = cellW * cellH;
        for (let y = r * cellH; y < (r + 1) * cellH; y++) {
          for (let x = c * cellW; x < (c + 1) * cellW; x++) {
            const idx = (y * sampleW + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            if (lum < 145) {
              darkCount++;
              darkPixelsTotal++;
            }
          }
        }
        rowValues.push(Number((darkCount / cellPixels).toFixed(2)));
      }
      zoneGrid.push(rowValues);
    }

    const aspectRatio = img.width / Math.max(1, img.height);
    const wallDensity = Number((darkPixelsTotal / totalPixels).toFixed(2));

    // Check interior middle cells (rows 1..4, cols 2..5) for partition lines
    let interiorInk = 0;
    for (let r = 1; r <= 4; r++) {
      for (let c = 2; c <= 5; c++) {
        interiorInk += zoneGrid[r][c];
      }
    }
    const hasPartition = interiorInk / 16 > 0.24;

    // Map aspect ratio sensibly into real architectural room dimensions (14–30 ft)
    const suggestedLengthFt = Math.round(Math.min(28, Math.max(14, 15 * Math.min(1.85, Math.max(0.95, aspectRatio)))));
    const suggestedWidthFt = Math.round(Math.min(22, Math.max(12, suggestedLengthFt / Math.max(1.05, Math.min(1.65, aspectRatio)))));

    // Estimate perimeter openings from lighter border cells
    let openingsDetected = 0;
    for (let c = 1; c < cols - 1; c++) {
      if (zoneGrid[0][c] < 0.18) openingsDetected++;
    }

    return {
      aspectRatio: Number(aspectRatio.toFixed(2)),
      wallDensity,
      suggestedWidthFt: Math.max(14, suggestedWidthFt),
      suggestedLengthFt: Math.max(16, suggestedLengthFt),
      hasPartition,
      openingsDetected: Math.max(2, openingsDetected),
      zoneGrid,
    };
  } catch {
    return {
      aspectRatio: 1.33,
      wallDensity: 0.16,
      suggestedWidthFt: 16,
      suggestedLengthFt: 24,
      hasPartition: false,
      openingsDetected: 3,
      zoneGrid: Array.from({ length: 6 }, () => Array(8).fill(0.1)),
    };
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Extracts 4 representative dominant colors from an uploaded room photo
 * by quantizing RGB buckets on an offscreen canvas.
 */
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
      // Quantize to 32-step buckets so close shades cluster naturally
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

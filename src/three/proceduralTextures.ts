import * as THREE from 'three';
import { ColorScheme, FloorMaterialType, RugPatternType, WallFinishType } from '../types/design';

function adjustHex(hex: string, delta: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, delta);
  return `#${c.getHexString()}`;
}

export function createFloorTexture(
  floorType: FloorMaterialType,
  baseHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  if (floorType === 'honed-concrete') {
    // Subtle troweled concrete variation & expansion joints
    for (let i = 0; i < 1600; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      const r = 6 + (i % 18);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 254, 254);
    ctx.strokeRect(256, 256, 254, 254);
    ctx.strokeRect(256, 1, 254, 254);
    ctx.strokeRect(1, 256, 254, 254);
  } else {
    // Timber plank flooring (oak, walnut, birch, bleached-ash)
    const plankRows = 8;
    const plankH = 512 / plankRows;
    for (let row = 0; row < plankRows; row++) {
      const y = row * plankH;
      const offset = (row % 3) * 170;
      const joints = [offset % 512, (offset + 256) % 512];

      const shade = ((row % 4) - 1.5) * 0.022;
      ctx.fillStyle = adjustHex(baseHex, shade);
      ctx.fillRect(0, y, 512, plankH - 1);

      // Subtle wood grain lines
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) {
        const gy = y + 6 + g * ((plankH - 12) / 6);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(170, gy + ((row + g) % 3 - 1) * 3, 340, gy - ((row + g) % 2) * 2, 512, gy);
        ctx.stroke();
      }

      // Plank seams
      ctx.fillStyle = 'rgba(25,18,12,0.22)';
      ctx.fillRect(0, y + plankH - 1.5, 512, 1.5);
      for (const jx of joints) {
        ctx.fillRect(jx, y, 1.5, plankH);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.5, 3.5);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createWallTexture(
  finish: WallFinishType,
  baseHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  if (finish === 'brick-accent') {
    const rows = 16;
    const cols = 6;
    const bh = 512 / rows;
    const bw = 512 / cols;
    ctx.fillStyle = adjustHex(baseHex, 0.08);
    ctx.fillRect(0, 0, 512, 512);
    for (let r = 0; r < rows; r++) {
      const stagger = r % 2 === 0 ? 0 : bw * 0.5;
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + stagger;
        const y = r * bh;
        const delta = (((r * 7 + c * 13) % 5) - 2) * 0.025;
        ctx.fillStyle = adjustHex(baseHex, delta);
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
  } else {
    // Limewash / plaster subtle cloudy mineral texture
    const count = finish === 'limewash' || finish === 'plaster' ? 420 : 120;
    for (let i = 0; i < count; i++) {
      const x = (i * 97) % 512;
      const y = (i * 151) % 512;
      const rad = 14 + (i % 24);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.022)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1.2);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createRugTexture(
  pattern: RugPatternType,
  scheme: ColorScheme,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = scheme.rugHex;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle woven textile threads
  ctx.strokeStyle = 'rgba(0,0,0,0.045)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 512; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  if (pattern === 'geometric-wool') {
    ctx.strokeStyle = scheme.accentHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(36, 36, 440, 440);
    ctx.strokeStyle = scheme.woodHex;
    ctx.lineWidth = 4;
    for (let d = 96; d <= 416; d += 160) {
      ctx.beginPath();
      ctx.moveTo(d, 110);
      ctx.lineTo(d + 54, 256);
      ctx.lineTo(d, 402);
      ctx.lineTo(d - 54, 256);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (pattern === 'distressed-kilim') {
    ctx.strokeStyle = scheme.metalHex;
    ctx.lineWidth = 12;
    ctx.strokeRect(24, 24, 464, 464);
    ctx.fillStyle = adjustHex(scheme.accentHex, 0.05);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(72, 72, 368, 368);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = scheme.wallHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(96, 96, 320, 320);
  } else if (pattern === 'woven-sisal') {
    ctx.strokeStyle = adjustHex(scheme.rugHex, -0.14);
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 492, 492);
  } else {
    // Boucle subtle border
    ctx.strokeStyle = adjustHex(scheme.rugHex, -0.08);
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, 476, 476);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createArtworkTexture(
  scheme: ColorScheme,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  // Mat board
  ctx.fillStyle = '#F7F5F0';
  ctx.fillRect(0, 0, 512, 640);

  // Inner print area
  ctx.fillStyle = adjustHex(scheme.wallHex, -0.03);
  ctx.fillRect(46, 56, 420, 528);

  // Architectural abstract shapes derived from the active color scheme
  ctx.fillStyle = scheme.accentHex;
  ctx.beginPath();
  ctx.arc(220, 270, 118, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = scheme.woodHex;
  ctx.fillRect(195, 295, 195, 210);

  ctx.strokeStyle = scheme.metalHex;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(95, 175);
  ctx.lineTo(395, 175);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

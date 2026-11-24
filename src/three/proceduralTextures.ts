import * as THREE from 'three';

export interface ProceduralTextureSet {
  terrainLightMap: THREE.CanvasTexture;
  terrainDarkMap: THREE.CanvasTexture;
  terrainRoughnessMap: THREE.CanvasTexture;
  buildingLightMap: THREE.CanvasTexture;
  buildingDarkMap: THREE.CanvasTexture;
  buildingEmissiveMap: THREE.CanvasTexture;
  waterBumpMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function configureRepeatTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function drawTerrainCanvas(isDark: boolean): HTMLCanvasElement {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base Cotonou urban ground tone (warm mineral limestone in day, deep coastal slate at night)
  ctx.fillStyle = isDark ? '#101A17' : '#E7E9E3';
  ctx.fillRect(0, 0, size, size);

  // Subtle organic mineral speckle so the ground reads as real urban earth/concrete
  for (let i = 0; i < 2400; i++) {
    const x = (i * 97) % size;
    const y = (i * 193 + Math.floor(i / 5) * 13) % size;
    const alpha = (i % 7) * 0.008 + 0.012;
    ctx.fillStyle = isDark
      ? `rgba(180, 210, 196, ${alpha})`
      : `rgba(85, 98, 90, ${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Secondary neighborhood street grid
  ctx.strokeStyle = isDark
    ? 'rgba(56, 86, 75, 0.36)'
    : 'rgba(186, 193, 185, 0.72)';
  ctx.lineWidth = 4;
  for (let pos = 0; pos <= size; pos += 128) {
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  // Fine parcel subdivisions
  ctx.strokeStyle = isDark
    ? 'rgba(38, 60, 52, 0.25)'
    : 'rgba(202, 208, 200, 0.5)';
  ctx.lineWidth = 1.5;
  for (let pos = 64; pos < size; pos += 128) {
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  return canvas;
}

function drawTerrainRoughnessCanvas(): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#DCDCDC'; // ~0.86 matte urban ground
  ctx.fillRect(0, 0, size, size);

  // Slightly smoother roads on grid lines
  ctx.strokeStyle = '#A8A8A8';
  ctx.lineWidth = 4;
  for (let pos = 0; pos <= size; pos += 64) {
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
    ctx.stroke();
  }

  return canvas;
}

function drawBuildingFacadeCanvas(isDark: boolean): HTMLCanvasElement {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Sun-baked concrete / plaster facade in daylight, architectural slate at night
  ctx.fillStyle = isDark ? '#1D2926' : '#ECEBE6';
  ctx.fillRect(0, 0, width, height);

  // Subtle floor slab ledges
  const cols = 4;
  const rows = 8;
  const padX = 16;
  const padY = 14;
  const cellW = (width - padX * 2) / cols;
  const cellH = (height - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    const y = padY + r * cellH;
    // Horizontal architectural spandrel band
    ctx.fillStyle = isDark ? '#141D1A' : '#D9D8D1';
    ctx.fillRect(0, y - 4, width, 4);

    for (let c = 0; c < cols; c++) {
      const x = padX + c * cellW;
      // Recessed window frame
      ctx.fillStyle = isDark ? '#0D1412' : '#B7C2BE';
      ctx.fillRect(x + 5, y + 6, cellW - 10, cellH - 16);

      // Glazing reflection strip
      ctx.fillStyle = isDark ? '#1A2D28' : '#7E9891';
      ctx.fillRect(x + 7, y + 8, cellW - 14, cellH - 20);
    }
  }

  return canvas;
}

function drawBuildingEmissiveCanvas(): HTMLCanvasElement {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const cols = 4;
  const rows = 8;
  const padX = 16;
  const padY = 14;
  const cellW = (width - padX * 2) / cols;
  const cellH = (height - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    const y = padY + r * cellH;
    for (let c = 0; c < cols; c++) {
      const hash = ((r + 1) * 31 + (c + 1) * 17) % 11;
      if (hash < 5) continue; // Only light ~55% of windows for natural Cotonou skyline
      const x = padX + c * cellW;
      ctx.fillStyle = hash > 8 ? '#FFE4A8' : hash === 7 ? '#99F6E4' : '#F4C46A';
      ctx.fillRect(x + 7, y + 8, cellW - 14, cellH - 20);
    }
  }

  return canvas;
}

function drawWaterBumpCanvas(): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 8) {
    const grad = ctx.createLinearGradient(0, y, 0, y + 8);
    grad.addColorStop(0, '#6A6A6A');
    grad.addColorStop(0.5, '#9A9A9A');
    grad.addColorStop(1, '#6A6A6A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, size, 8);
  }

  return canvas;
}

function drawContactShadowCanvas(): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(6, 15, 11, 0.56)');
  grad.addColorStop(0.55, 'rgba(6, 15, 11, 0.22)');
  grad.addColorStop(1, 'rgba(6, 15, 11, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return canvas;
}

export function createProceduralTextureSet(
  maxAnisotropy: number
): ProceduralTextureSet {
  const terrainLightMap = configureRepeatTexture(
    drawTerrainCanvas(false),
    22,
    22,
    true,
    maxAnisotropy
  );
  const terrainDarkMap = configureRepeatTexture(
    drawTerrainCanvas(true),
    22,
    22,
    true,
    maxAnisotropy
  );
  const terrainRoughnessMap = configureRepeatTexture(
    drawTerrainRoughnessCanvas(),
    22,
    22,
    false,
    maxAnisotropy
  );

  const buildingLightMap = configureRepeatTexture(
    drawBuildingFacadeCanvas(false),
    1,
    1,
    true,
    maxAnisotropy
  );
  const buildingDarkMap = configureRepeatTexture(
    drawBuildingFacadeCanvas(true),
    1,
    1,
    true,
    maxAnisotropy
  );
  const buildingEmissiveMap = configureRepeatTexture(
    drawBuildingEmissiveCanvas(),
    1,
    1,
    true,
    maxAnisotropy
  );

  const waterBumpMap = configureRepeatTexture(
    drawWaterBumpCanvas(),
    14,
    6,
    false,
    maxAnisotropy
  );

  const contactShadowMap = new THREE.CanvasTexture(drawContactShadowCanvas());
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  contactShadowMap.needsUpdate = true;

  return {
    terrainLightMap,
    terrainDarkMap,
    terrainRoughnessMap,
    buildingLightMap,
    buildingDarkMap,
    buildingEmissiveMap,
    waterBumpMap,
    contactShadowMap,
    dispose: () => {
      terrainLightMap.dispose();
      terrainDarkMap.dispose();
      terrainRoughnessMap.dispose();
      buildingLightMap.dispose();
      buildingDarkMap.dispose();
      buildingEmissiveMap.dispose();
      waterBumpMap.dispose();
      contactShadowMap.dispose();
    },
  };
}

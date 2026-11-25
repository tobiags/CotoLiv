import * as THREE from 'three';

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

export function createProceduralTextureSet() {
  const contactShadowMap = new THREE.CanvasTexture(drawContactShadowCanvas());
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  return {contactShadowMap, dispose: () => contactShadowMap.dispose()};
}

import * as THREE from 'three';

export function createStudioGridTexture(
  cellsX: number,
  cellsZ: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base slate ceramic finish
  ctx.fillStyle = '#151c2b';
  ctx.fillRect(0, 0, size, size);

  // Subtle radial vignette on baseplate
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.65);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.07)');
  grad.addColorStop(1, 'rgba(13, 17, 26, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Grid cells
  const stepX = size / cellsX;
  const stepZ = size / cellsZ;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 2;

  for (let i = 0; i <= cellsX; i++) {
    const x = i * stepX;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let j = 0; j <= cellsZ; j++) {
    const y = j * stepZ;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // Subtle corner crosshairs at intersections
  ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
  for (let i = 1; i < cellsX; i++) {
    for (let j = 1; j < cellsZ; j++) {
      ctx.fillRect(i * stepX - 2, j * stepZ - 2, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createSoftShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.05,
    size / 2,
    size / 2,
    size * 0.5
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createBrushedRoughnessTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    const shade = 120 + Math.floor(Math.random() * 48);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, size, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Data texture: keep linear (NoColorSpace)
  tex.needsUpdate = true;
  return tex;
}

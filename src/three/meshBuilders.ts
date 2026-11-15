import * as THREE from 'three';
import { DIRECTION_VECTORS, Direction, PuzzleTile, TileKind } from '../types/game';
import { createBrushedRoughnessTexture, createSoftShadowTexture, createStudioGridTexture } from './proceduralTextures';

export const CELL_SPACING = 1.24;

// Shared geometries & helpers created lazily
let sharedRoughnessMap: THREE.CanvasTexture | null = null;
function getBrushedRoughnessMap(): THREE.CanvasTexture {
  if (!sharedRoughnessMap) {
    sharedRoughnessMap = createBrushedRoughnessTexture();
  }
  return sharedRoughnessMap;
}

function createRoundedSquareShape(size: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const h = size / 2;
  s.moveTo(-h + radius, -h);
  s.lineTo(h - radius, -h);
  s.quadraticCurveTo(h, -h, h, -h + radius);
  s.lineTo(h, h - radius);
  s.quadraticCurveTo(h, h, h - radius, h);
  s.lineTo(-h + radius, h);
  s.quadraticCurveTo(-h, h, -h, h - radius);
  s.lineTo(-h, -h + radius);
  s.quadraticCurveTo(-h, -h, -h + radius, -h);
  return s;
}

function createArrowHeadShape(scale = 1): THREE.Shape {
  const s = new THREE.Shape();
  // Pointing +Y in 2D shape coordinates
  s.moveTo(0, 0.36 * scale);
  s.lineTo(0.28 * scale, 0.04 * scale);
  s.lineTo(0.11 * scale, 0.04 * scale);
  s.lineTo(0.11 * scale, -0.32 * scale);
  s.lineTo(-0.11 * scale, -0.32 * scale);
  s.lineTo(-0.11 * scale, 0.04 * scale);
  s.lineTo(-0.28 * scale, 0.04 * scale);
  s.closePath();
  return s;
}

const DIRECTION_PALETTE: Record<Direction, { body: number; accent: number; emissive: number }> = {
  [Direction.PX]: { body: 0x0ea5e9, accent: 0xe0f2fe, emissive: 0x0284c7 },
  [Direction.NX]: { body: 0x3b82f6, accent: 0xdbeafe, emissive: 0x1d4ed8 },
  [Direction.PY]: { body: 0x10b981, accent: 0xd1fae5, emissive: 0x047857 },
  [Direction.NY]: { body: 0x14b8a6, accent: 0xccfbf1, emissive: 0x0f766e },
  [Direction.PZ]: { body: 0xf97316, accent: 0xffedd5, emissive: 0xc2410c },
  [Direction.NZ]: { body: 0x8b5cf6, accent: 0xede9fe, emissive: 0x6d28d9 },
};

function orientGroupToDirection(group: THREE.Object3D, dir: Direction) {
  const vec = DIRECTION_VECTORS[dir];
  const target = new THREE.Vector3(vec.x, vec.y, vec.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, target);
  group.quaternion.copy(quat);
}

/**
 * Composite 6-part Arrow Block:
 * 1. Beveled rounded outer shell (ExtrudeGeometry)
 * 2. Metallic trim collar ring around base
 * 3. Sculpted raised 3D directional arrow cap on top (+Y local)
 * 4. Four lateral directional arrow inlays on the sides (so readable from any angle)
 * 5. Key emblem halo ring (if isKey === true)
 * 6. Invisible raycast proxy box on layer 1
 */
export function createArrowBlockMesh(tile: PuzzleTile): {
  group: THREE.Group;
  raycastProxy: THREE.Mesh;
  materialsToTint: THREE.MeshStandardMaterial[];
} {
  const group = new THREE.Group();
  const dir = tile.dir ?? Direction.PY;
  const palette = tile.isKey
    ? { body: 0xf59e0b, accent: 0xfef3c7, emissive: 0xb45309 }
    : DIRECTION_PALETTE[dir];

  const roughMap = getBrushedRoughnessMap();

  // Oriented sub-group so local +Y always points along the arrow direction
  const oriented = new THREE.Group();
  orientGroupToDirection(oriented, dir);
  group.add(oriented);

  // 1. Primary beveled block chassis
  const blockShape = createRoundedSquareShape(0.84, 0.14);
  const blockGeo = new THREE.ExtrudeGeometry(blockShape, {
    depth: 0.72,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 3,
  });
  blockGeo.center();
  blockGeo.rotateX(Math.PI / 2);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.body,
    roughness: 0.34,
    metalness: 0.18,
    emissive: palette.emissive,
    emissiveIntensity: 0.12,
  });
  const bodyMesh = new THREE.Mesh(blockGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  oriented.add(bodyMesh);

  // 2. Brushed dark titanium collar around the mid-waist
  const collarGeo = new THREE.BoxGeometry(0.95, 0.12, 0.95);
  const collarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.28,
    metalness: 0.82,
    roughnessMap: roughMap,
  });
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.position.y = -0.14;
  collarMesh.castShadow = true;
  oriented.add(collarMesh);

  // 3. Sculpted 3D chevron cap on the leading face (+Y) & trailing notch
  const arrowShape = createArrowHeadShape(0.92);
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  arrowGeo.center();

  const accentMat = new THREE.MeshStandardMaterial({
    color: palette.accent,
    roughness: 0.18,
    metalness: 0.1,
    emissive: palette.body,
    emissiveIntensity: 0.4,
  });

  // Place directional chevrons on all 4 side faces pointing toward local +Y
  const sideOffsets: Array<{ pos: [number, number, number]; rotY: number }> = [
    { pos: [0, 0.04, 0.45], rotY: 0 },
    { pos: [0, 0.04, -0.45], rotY: Math.PI },
    { pos: [0.45, 0.04, 0], rotY: Math.PI / 2 },
    { pos: [-0.45, 0.04, 0], rotY: -Math.PI / 2 },
  ];

  for (const s of sideOffsets) {
    const chevron = new THREE.Mesh(arrowGeo, accentMat);
    chevron.position.set(...s.pos);
    chevron.rotation.y = s.rotY;
    oriented.add(chevron);
  }

  // 4. Leading nose cone / directional tip crown at +Y
  const tipGeo = new THREE.ConeGeometry(0.24, 0.16, 4);
  tipGeo.rotateY(Math.PI / 4);
  const tipMesh = new THREE.Mesh(tipGeo, accentMat);
  tipMesh.position.set(0, 0.48, 0);
  oriented.add(tipMesh);

  // 5. Golden Key Ring emblem if isKey
  if (tile.isKey) {
    const ringGeo = new THREE.TorusGeometry(0.32, 0.055, 12, 24);
    ringGeo.rotateX(Math.PI / 2);
    const keyMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      roughness: 0.18,
      metalness: 0.92,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
    });
    const ringMesh = new THREE.Mesh(ringGeo, keyMat);
    ringMesh.position.y = 0.43;
    oriented.add(ringMesh);
  }

  // 6. Raycast proxy box (Layer 1)
  const proxyGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const raycastProxy = new THREE.Mesh(proxyGeo, proxyMat);
  raycastProxy.layers.set(1);
  raycastProxy.userData.tileId = tile.id;
  group.add(raycastProxy);

  return { group, raycastProxy, materialsToTint: [bodyMat, accentMat] };
}

/**
 * Composite Steel Blocker Pillar (5 parts):
 * Anodized dark core, steel bevel frame, diagonal cross-ribs, 4 brass corner bolts.
 */
export function createBlockerMesh(): THREE.Group {
  const group = new THREE.Group();
  const roughMap = getBrushedRoughnessMap();

  const coreGeo = new THREE.BoxGeometry(0.88, 0.88, 0.88);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.65,
    metalness: 0.35,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.25,
    metalness: 0.88,
    roughnessMap: roughMap,
  });

  // Outer cage bars along X/Y/Z edges
  const barH = new THREE.BoxGeometry(0.96, 0.14, 0.96);
  const topBar = new THREE.Mesh(barH, frameMat);
  topBar.position.y = 0.4;
  const botBar = new THREE.Mesh(barH, frameMat);
  botBar.position.y = -0.4;
  group.add(topBar, botBar);

  // Diagonal X-brace plates on front/back
  const braceGeo = new THREE.BoxGeometry(0.82, 0.12, 0.94);
  const brace1 = new THREE.Mesh(braceGeo, frameMat);
  brace1.rotation.z = Math.PI / 4;
  const brace2 = new THREE.Mesh(braceGeo, frameMat);
  brace2.rotation.z = -Math.PI / 4;
  group.add(brace1, brace2);

  // Brass corner rivets
  const rivetMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.24,
    metalness: 0.9,
  });
  const rivetGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.98, 10);
  const offsets: [number, number][] = [
    [-0.36, -0.36],
    [0.36, -0.36],
    [-0.36, 0.36],
    [0.36, 0.36],
  ];
  for (const [ox, oz] of offsets) {
    const rivet = new THREE.Mesh(rivetGeo, rivetMat);
    rivet.position.set(ox, 0, oz);
    group.add(rivet);
  }

  return group;
}

/**
 * Composite Fragile Crystal Barrier (4 parts):
 * Faceted octahedron-prism crystal core + wireframe fracture lines + top/bottom titanium mounts.
 */
export function createFragileMesh(isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();

  const crystalGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.78, 6);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x67e8f9,
    roughness: 0.08,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.52 : 0.92,
    ior: 1.55,
    thickness: 1.1,
    clearcoat: 1.0,
    emissive: 0x0891b2,
    emissiveIntensity: 0.25,
  });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.castShadow = true;
  group.add(crystal);

  // Crisp glowing fracture edges
  const edges = new THREE.EdgesGeometry(crystalGeo, 12);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.85,
  });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  group.add(wireframe);

  // Inner faceted diamond core
  const innerGeo = new THREE.OctahedronGeometry(0.24, 0);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xa5f3fc,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.3,
  });
  const innerCore = new THREE.Mesh(innerGeo, innerMat);
  group.add(innerCore);

  // Top & bottom mounting caps
  const capGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 6);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.3,
    metalness: 0.85,
  });
  const topCap = new THREE.Mesh(capGeo, capMat);
  topCap.position.y = 0.42;
  const botCap = new THREE.Mesh(capGeo, capMat);
  botCap.position.y = -0.42;
  group.add(topCap, botCap);

  return group;
}

/**
 * Composite Locked Energy Gate (4 parts):
 * Anodized outer portal pillars, 3 glowing amber laser bars, central lock emblem.
 */
export function createGateMesh(): THREE.Group {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.82,
  });

  // Left & Right pillars
  const pillarGeo = new THREE.BoxGeometry(0.16, 0.94, 0.94);
  const leftPillar = new THREE.Mesh(pillarGeo, frameMat);
  leftPillar.position.x = -0.4;
  leftPillar.castShadow = true;
  const rightPillar = new THREE.Mesh(pillarGeo, frameMat);
  rightPillar.position.x = 0.4;
  rightPillar.castShadow = true;
  group.add(leftPillar, rightPillar);

  // Top & Bottom headers
  const headerGeo = new THREE.BoxGeometry(0.96, 0.14, 0.94);
  const topHeader = new THREE.Mesh(headerGeo, frameMat);
  topHeader.position.y = 0.41;
  const botHeader = new THREE.Mesh(headerGeo, frameMat);
  botHeader.position.y = -0.41;
  group.add(topHeader, botHeader);

  // Glowing horizontal energy bars
  const barMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
    roughness: 0.2,
    metalness: 0.2,
  });
  const barGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.72, 12);
  barGeo.rotateZ(Math.PI / 2);

  for (const yOff of [-0.18, 0, 0.18]) {
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.position.y = yOff;
    group.add(bar);
  }

  // Central golden lock diamond
  const lockGeo = new THREE.OctahedronGeometry(0.16, 0);
  const lockMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xd97706,
    emissiveIntensity: 0.65,
    roughness: 0.18,
    metalness: 0.85,
  });
  const lock = new THREE.Mesh(lockGeo, lockMat);
  lock.name = 'gateLockEmblem';
  group.add(lock);

  return group;
}

/**
 * Composite Hazard Mine (4 parts):
 * Dark metallic icosahedron shell + 6 crimson-tipped spikes + pulsing crimson core + caution ring.
 */
export function createMineMesh(): THREE.Group {
  const group = new THREE.Group();

  const shellGeo = new THREE.IcosahedronGeometry(0.34, 0);
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.48,
    metalness: 0.62,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.castShadow = true;
  group.add(shell);

  // Glowing crimson core sphere
  const coreGeo = new THREE.SphereGeometry(0.24, 16, 16);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'mineCore';
  group.add(core);

  // 6 directional warning spikes
  const spikeGeo = new THREE.ConeGeometry(0.095, 0.28, 8);
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0xf87171,
    emissive: 0x991b1b,
    emissiveIntensity: 0.4,
    roughness: 0.25,
    metalness: 0.75,
  });

  const spikeDirs: Array<{ pos: [number, number, number]; rot: [number, number, number] }> = [
    { pos: [0, 0.39, 0], rot: [0, 0, 0] },
    { pos: [0, -0.39, 0], rot: [Math.PI, 0, 0] },
    { pos: [0.39, 0, 0], rot: [0, 0, -Math.PI / 2] },
    { pos: [-0.39, 0, 0], rot: [0, 0, Math.PI / 2] },
    { pos: [0, 0, 0.39], rot: [Math.PI / 2, 0, 0] },
    { pos: [0, 0, -0.39], rot: [-Math.PI / 2, 0, 0] },
  ];

  for (const s of spikeDirs) {
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set(...s.pos);
    spike.rotation.set(...s.rot);
    group.add(spike);
  }

  // Caution equator ring
  const ringGeo = new THREE.TorusGeometry(0.36, 0.03, 10, 24);
  ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xe11d48,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.5,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  group.add(ring);

  return group;
}

/**
 * Architectural Studio Plinth beneath the 3D puzzle lattice
 */
export function createPlinthGroup(
  dims: { x: number; y: number; z: number },
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();

  const width = dims.x * CELL_SPACING + 0.8;
  const depth = dims.z * CELL_SPACING + 0.8;
  const baseY = -((dims.y - 1) * CELL_SPACING) / 2 - 0.85;

  // Main brushed dark pedestal slab
  const slabGeo = new THREE.BoxGeometry(width, 0.24, depth);
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x161f30,
    roughness: 0.45,
    metalness: 0.4,
  });
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.y = baseY - 0.14;
  slab.receiveShadow = true;
  group.add(slab);

  // Subtle metallic lower skirt
  const skirtGeo = new THREE.BoxGeometry(width + 0.24, 0.12, depth + 0.24);
  const skirtMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.72,
  });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.y = baseY - 0.32;
  skirt.receiveShadow = true;
  group.add(skirt);

  // Grid surface decal with polygonOffset to avoid Z-fighting
  const gridTex = createStudioGridTexture(dims.x, dims.z, maxAnisotropy);
  const gridGeo = new THREE.PlaneGeometry(dims.x * CELL_SPACING, dims.z * CELL_SPACING);
  gridGeo.rotateX(-Math.PI / 2);
  const gridMat = new THREE.MeshStandardMaterial({
    map: gridTex,
    roughness: 0.55,
    metalness: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const gridPlane = new THREE.Mesh(gridGeo, gridMat);
  gridPlane.position.y = baseY;
  gridPlane.receiveShadow = true;
  group.add(gridPlane);

  // Soft radial contact shadow beneath plinth
  const shadowTex = createSoftShadowTexture();
  const shadowGeo = new THREE.PlaneGeometry(width * 1.45, depth * 1.45);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = baseY - 0.4;
  group.add(shadowPlane);

  return group;
}

export function gridToWorld(
  pos: { x: number; y: number; z: number },
  dims: { x: number; y: number; z: number }
): THREE.Vector3 {
  const ox = ((dims.x - 1) * CELL_SPACING) / 2;
  const oy = ((dims.y - 1) * CELL_SPACING) / 2;
  const oz = ((dims.z - 1) * CELL_SPACING) / 2;
  return new THREE.Vector3(
    pos.x * CELL_SPACING - ox,
    pos.y * CELL_SPACING - oy,
    pos.z * CELL_SPACING - oz
  );
}

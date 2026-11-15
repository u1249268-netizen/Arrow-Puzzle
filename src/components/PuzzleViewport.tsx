import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraPreset,
  DIRECTION_VECTORS,
  Direction,
  LevelDef,
  PuzzleTile,
  RayOutcome,
  TileKind,
} from '../types/game';
import {
  CELL_SPACING,
  createArrowBlockMesh,
  createBlockerMesh,
  createFragileMesh,
  createGateMesh,
  createMineMesh,
  createPlinthGroup,
  gridToWorld,
} from '../three/meshBuilders';

interface PuzzleViewportProps {
  level: LevelDef;
  tiles: PuzzleTile[];
  hintTileId: string | null;
  cameraPreset: CameraPreset;
  cameraTrigger: number;
  disabled: boolean;
  onAttemptArrow: (tileId: string) => {
    outcome: RayOutcome;
    unlockedGateIds: string[];
  } | null;
}

interface TileRuntime {
  tile: PuzzleTile;
  group: THREE.Group;
  basePos: THREE.Vector3;
  raycastProxy?: THREE.Mesh;
  materialsToTint?: THREE.MeshStandardMaterial[];
  baseEmissives?: number[];
  animState: 'idle' | 'escaping' | 'bouncing' | 'dissolving';
  animTime: number;
  animDuration: number;
  bounceTarget?: THREE.Vector3;
  escapeDir?: THREE.Vector3;
  tintColor?: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
}

// Pre-allocated math helpers (Zero GC in render loop)
const _camTargetPos = new THREE.Vector3();
const _pointer = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const PuzzleViewport: React.FC<PuzzleViewportProps> = ({
  level,
  tiles,
  hintTileId,
  cameraPreset,
  cameraTrigger,
  disabled,
  onAttemptArrow,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Refs to keep Three.js loop decoupled from React re-renders
  const onAttemptArrowRef = useRef(onAttemptArrow);
  onAttemptArrowRef.current = onAttemptArrow;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const hintTileIdRef = useRef(hintTileId);
  hintTileIdRef.current = hintTileId;

  const sceneControllerRef = useRef<{
    syncBoard: (lvl: LevelDef, currentTiles: PuzzleTile[], resetCamera: boolean) => void;
    triggerEscape: (tileId: string, dir: Direction) => void;
    triggerBounce: (tileId: string, dir: Direction, steps: number, tint: number) => void;
    triggerShatter: (fragileId: string) => void;
    triggerGateUnlock: (gateIds: string[]) => void;
    applyCameraPreset: (preset: CameraPreset, dims: { x: number; y: number; z: number }) => void;
  } | null>(null);

  const prevLevelIdRef = useRef<number>(level.id);
  const prevTilesRef = useRef<PuzzleTile[]>(tiles);

  // Mount Three.js once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d111a);
    scene.fog = new THREE.FogExp2(0x0d111a, 0.026);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
    camera.position.set(6.5, 5.8, 7.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Studio IBL reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.0);
    keyLight.position.set(7, 12, 8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 35;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-7, 4, -8);
    scene.add(rimLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 4.2;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.78;
    controls.minPolarAngle = Math.PI * 0.08;

    // Camera transition state (cancelled immediately when user orbits)
    let camTransitionActive = false;
    controls.addEventListener('start', () => {
      camTransitionActive = false;
    });

    // Groups for board & particles
    const boardGroup = new THREE.Group();
    const particleGroup = new THREE.Group();
    scene.add(boardGroup);
    scene.add(particleGroup);

    const tileMap = new Map<string, TileRuntime>();
    const activeParticles: BurstParticle[] = [];
    const shardGeo = new THREE.OctahedronGeometry(0.11, 0);
    let plinthGroup: THREE.Group | null = null;
    let hoveredTileId: string | null = null;
    let shakeIntensity = 0;

    // Raycaster on layer 1
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let raycastProxies: THREE.Mesh[] = [];

    function spawnBurst(origin: THREE.Vector3, colorHex: number, count: number, speed = 4.2) {
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshStandardMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: 0.65,
          roughness: 0.2,
          metalness: 0.3,
          transparent: true,
          opacity: 1,
        });
        const m = new THREE.Mesh(shardGeo, mat);
        m.position.copy(origin);
        m.scale.setScalar(0.6 + Math.random() * 0.8);
        particleGroup.add(m);

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const s = speed * (0.5 + Math.random() * 0.8);
        activeParticles.push({
          mesh: m,
          vel: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * s,
            Math.cos(phi) * s + 1.2,
            Math.sin(phi) * Math.sin(theta) * s
          ),
          rotVel: new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
          ),
          life: 0,
          maxLife: 0.48 + Math.random() * 0.28,
        });
      }
    }

    function disposeObject(obj: THREE.Object3D) {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.LineSegments).isLineSegments) {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    }

    function applyCameraPreset(preset: CameraPreset, dims: { x: number; y: number; z: number }) {
      const span = Math.max(dims.x, dims.y, dims.z);
      const dist = span * 2.15 + 2.6;
      if (preset === 'iso') {
        _camTargetPos.set(dist * 0.68, dist * 0.58, dist * 0.74);
      } else if (preset === 'front') {
        _camTargetPos.set(0, dist * 0.22, dist * 1.05);
      } else if (preset === 'top') {
        _camTargetPos.set(0.01, dist * 1.15, dist * 0.2);
      } else if (preset === 'side') {
        _camTargetPos.set(dist * 1.05, dist * 0.25, 0);
      }
      camTransitionActive = true;
    }

    function rebuildBoard(lvl: LevelDef, currentTiles: PuzzleTile[], resetCam: boolean) {
      // Clear existing board meshes
      for (const rt of tileMap.values()) {
        boardGroup.remove(rt.group);
        disposeObject(rt.group);
      }
      tileMap.clear();
      if (plinthGroup) {
        boardGroup.remove(plinthGroup);
        disposeObject(plinthGroup);
        plinthGroup = null;
      }

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      plinthGroup = createPlinthGroup(lvl.dims, maxAniso);
      boardGroup.add(plinthGroup);

      const newProxies: THREE.Mesh[] = [];

      for (const tile of currentTiles) {
        const worldPos = gridToWorld(tile.pos, lvl.dims);
        let group: THREE.Group;
        let raycastProxy: THREE.Mesh | undefined;
        let materialsToTint: THREE.MeshStandardMaterial[] | undefined;
        let baseEmissives: number[] | undefined;

        if (tile.kind === TileKind.ARROW) {
          const built = createArrowBlockMesh(tile);
          group = built.group;
          raycastProxy = built.raycastProxy;
          materialsToTint = built.materialsToTint;
          baseEmissives = built.materialsToTint.map((m) => m.emissive.getHex());
          newProxies.push(raycastProxy);
        } else if (tile.kind === TileKind.BLOCKER) {
          group = createBlockerMesh();
        } else if (tile.kind === TileKind.FRAGILE) {
          group = createFragileMesh(isSoftwareGl);
        } else if (tile.kind === TileKind.GATE) {
          group = createGateMesh();
        } else {
          group = createMineMesh();
        }

        group.position.copy(worldPos);
        boardGroup.add(group);

        tileMap.set(tile.id, {
          tile,
          group,
          basePos: worldPos.clone(),
          raycastProxy,
          materialsToTint,
          baseEmissives,
          animState: 'idle',
          animTime: 0,
          animDuration: 0.35,
        });
      }

      raycastProxies = newProxies;
      hoveredTileId = null;

      if (resetCam) {
        controls.target.set(0, 0, 0);
        applyCameraPreset('iso', lvl.dims);
      }
    }

    function syncBoard(lvl: LevelDef, currentTiles: PuzzleTile[], resetCam: boolean) {
      if (resetCam) {
        rebuildBoard(lvl, currentTiles, true);
        return;
      }

      // Check if an undo/reset added back tiles that are missing from tileMap
      const currentIds = new Set(currentTiles.map((t) => t.id));
      let needsFullRebuild = false;
      for (const t of currentTiles) {
        if (!tileMap.has(t.id)) {
          needsFullRebuild = true;
          break;
        }
      }
      // Also check if any idle tile in tileMap was removed without an animation
      if (!needsFullRebuild) {
        for (const [id, rt] of tileMap.entries()) {
          if (!currentIds.has(id) && rt.animState === 'idle') {
            needsFullRebuild = true;
            break;
          }
        }
      }

      if (needsFullRebuild) {
        rebuildBoard(lvl, currentTiles, false);
      }
    }

    function triggerEscape(tileId: string, dir: Direction) {
      const rt = tileMap.get(tileId);
      if (!rt) return;
      const v = DIRECTION_VECTORS[dir];
      rt.animState = 'escaping';
      rt.animTime = 0;
      rt.animDuration = 0.42;
      rt.escapeDir = new THREE.Vector3(v.x, v.y, v.z);
      if (rt.raycastProxy) {
        raycastProxies = raycastProxies.filter((p) => p !== rt.raycastProxy);
      }
      spawnBurst(rt.basePos, rt.tile.isKey ? 0xfbbf24 : 0x38bdf8, 12, 3.6);
    }

    function triggerBounce(tileId: string, dir: Direction, steps: number, tint: number) {
      const rt = tileMap.get(tileId);
      if (!rt) return;
      const v = DIRECTION_VECTORS[dir];
      const travel = (steps + 0.28) * CELL_SPACING;
      rt.animState = 'bouncing';
      rt.animTime = 0;
      rt.animDuration = 0.28;
      rt.bounceTarget = rt.basePos.clone().addScaledVector(new THREE.Vector3(v.x, v.y, v.z), travel);
      rt.tintColor = tint;
      shakeIntensity = tint === 0xef4444 ? 0.14 : 0.055;
      if (tint === 0xef4444) {
        spawnBurst(rt.bounceTarget, 0xef4444, 16, 4.8);
      }
    }

    function triggerShatter(fragileId: string) {
      const rt = tileMap.get(fragileId);
      if (!rt) return;
      spawnBurst(rt.basePos, 0x67e8f9, 20, 5.2);
      boardGroup.remove(rt.group);
      disposeObject(rt.group);
      tileMap.delete(fragileId);
    }

    function triggerGateUnlock(gateIds: string[]) {
      for (const gid of gateIds) {
        const rt = tileMap.get(gid);
        if (!rt) continue;
        rt.animState = 'dissolving';
        rt.animTime = 0;
        rt.animDuration = 0.36;
        spawnBurst(rt.basePos, 0xfbbf24, 14, 4.2);
      }
    }

    sceneControllerRef.current = {
      syncBoard,
      triggerEscape,
      triggerBounce,
      triggerShatter,
      triggerGateUnlock,
      applyCameraPreset,
    };

    // Initial board build
    rebuildBoard(level, tiles, true);
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer Interaction (Click vs Orbit Drag + Hover)
    let downX = 0;
    let downY = 0;
    let lastHoverTime = 0;

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 40) return;
      lastHoverTime = now;

      if (disabledRef.current) {
        if (hoveredTileId) {
          hoveredTileId = null;
          renderer.domElement.style.cursor = 'default';
        }
        return;
      }

      updatePointer(e);
      raycaster.setFromCamera(_pointer, camera);
      const hits = raycaster.intersectObjects(raycastProxies, false);

      if (hits.length > 0) {
        const id = hits[0].object.userData.tileId as string;
        hoveredTileId = id;
        renderer.domElement.style.cursor = 'pointer';
      } else {
        hoveredTileId = null;
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (disabledRef.current) return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 7) return; // Was an orbit drag, not a tap!

      updatePointer(e);
      raycaster.setFromCamera(_pointer, camera);
      const hits = raycaster.intersectObjects(raycastProxies, false);
      if (hits.length > 0) {
        const tileId = hits[0].object.userData.tileId as string;
        const rt = tileMap.get(tileId);
        if (!rt || rt.animState !== 'idle') return;

        const actionRes = onAttemptArrowRef.current(tileId);
        if (!actionRes) return;

        const { outcome, unlockedGateIds } = actionRes;
        const dir = rt.tile.dir ?? Direction.PY;

        if (outcome.status === 'CLEAR') {
          triggerEscape(tileId, dir);
          if (unlockedGateIds.length > 0) {
            triggerGateUnlock(unlockedGateIds);
          }
        } else if (outcome.status === 'SHATTER_FRAGILE') {
          triggerBounce(tileId, dir, outcome.stepsBeforeHit, 0x67e8f9);
          window.setTimeout(() => triggerShatter(outcome.hitTile.id), 95);
        } else if (outcome.status === 'HIT_MINE') {
          triggerBounce(tileId, dir, outcome.stepsBeforeHit, 0xef4444);
        } else {
          triggerBounce(tileId, dir, outcome.stepsBeforeHit, 0xf87171);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Render loop (Software WebGL uses afterDraw pacing)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.elapsedTime;

      // Camera smooth preset transition
      if (camTransitionActive) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 7, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 7, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 7, delta);
        if (camera.position.distanceTo(_camTargetPos) < 0.03) {
          camTransitionActive = false;
        }
      }

      controls.update();

      // Subtle camera micro-shake decay
      if (shakeIntensity > 0.001) {
        boardGroup.position.set(
          (Math.random() - 0.5) * shakeIntensity,
          (Math.random() - 0.5) * shakeIntensity * 0.7,
          (Math.random() - 0.5) * shakeIntensity
        );
        shakeIntensity = THREE.MathUtils.damp(shakeIntensity, 0, 14, delta);
      } else {
        boardGroup.position.set(0, 0, 0);
      }

      // Animate tiles
      for (const [id, rt] of tileMap.entries()) {
        // Mine core & gate lock idle motion
        if (rt.tile.kind === TileKind.MINE) {
          const core = rt.group.getObjectByName('mineCore');
          if (core) {
            const pulse = 1 + Math.sin(elapsed * 4.5) * 0.1;
            core.scale.setScalar(pulse);
          }
        } else if (rt.tile.kind === TileKind.GATE && rt.animState === 'idle') {
          const emblem = rt.group.getObjectByName('gateLockEmblem');
          if (emblem) {
            emblem.rotation.y += delta * 1.4;
          }
        }

        if (rt.animState === 'idle') {
          const isHovered = hoveredTileId === id;
          const isHinted = hintTileIdRef.current === id;
          const targetScale = isHinted
            ? 1.07 + Math.sin(elapsed * 6) * 0.04
            : isHovered
            ? 1.05
            : 1.0;

          const curScale = rt.group.scale.x;
          const nextScale = THREE.MathUtils.damp(curScale, targetScale, 14, delta);
          rt.group.scale.setScalar(nextScale);

          if (rt.materialsToTint && rt.baseEmissives) {
            const boost = isHinted ? 0.85 : isHovered ? 0.42 : 0.14;
            rt.materialsToTint.forEach((mat, idx) => {
              if (isHinted) {
                mat.emissive.setHex(0xfef08a);
                mat.emissiveIntensity = 0.65 + Math.sin(elapsed * 6) * 0.25;
              } else {
                mat.emissive.setHex(rt.baseEmissives![idx]);
                mat.emissiveIntensity = THREE.MathUtils.damp(
                  mat.emissiveIntensity,
                  idx === 0 ? boost : boost + 0.25,
                  12,
                  delta
                );
              }
            });
          }
        } else if (rt.animState === 'escaping') {
          rt.animTime += delta;
          const p = Math.min(rt.animTime / rt.animDuration, 1);
          const ease = p * p * (2.2 - 1.2 * p);
          if (rt.escapeDir) {
            rt.group.position.copy(rt.basePos).addScaledVector(rt.escapeDir, ease * 11);
          }
          const scale = p > 0.45 ? Math.max(0.01, 1 - (p - 0.45) / 0.55) : 1;
          rt.group.scale.setScalar(scale);
          if (p >= 1) {
            boardGroup.remove(rt.group);
            disposeObject(rt.group);
            tileMap.delete(id);
          }
        } else if (rt.animState === 'bouncing') {
          rt.animTime += delta;
          const p = Math.min(rt.animTime / rt.animDuration, 1);
          const tri = p < 0.38 ? p / 0.38 : 1 - (p - 0.38) / 0.62;
          if (rt.bounceTarget) {
            rt.group.position.lerpVectors(rt.basePos, rt.bounceTarget, tri);
          }
          if (rt.materialsToTint && rt.baseEmissives) {
            const flash = p < 0.6 ? 1 - p / 0.6 : 0;
            rt.materialsToTint.forEach((mat, idx) => {
              if (flash > 0.05 && rt.tintColor) {
                mat.emissive.setHex(rt.tintColor);
                mat.emissiveIntensity = 0.85 * flash;
              } else {
                mat.emissive.setHex(rt.baseEmissives![idx]);
                mat.emissiveIntensity = idx === 0 ? 0.14 : 0.4;
              }
            });
          }
          if (p >= 1) {
            rt.group.position.copy(rt.basePos);
            rt.animState = 'idle';
          }
        } else if (rt.animState === 'dissolving') {
          rt.animTime += delta;
          const p = Math.min(rt.animTime / rt.animDuration, 1);
          rt.group.rotation.y += delta * 9;
          rt.group.scale.setScalar(Math.max(0.01, 1 - p));
          if (p >= 1) {
            boardGroup.remove(rt.group);
            disposeObject(rt.group);
            tileMap.delete(id);
          }
        }
      }

      // Animate burst particles
      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const pt = activeParticles[i];
        pt.life += delta;
        if (pt.life >= pt.maxLife) {
          particleGroup.remove(pt.mesh);
          (pt.mesh.material as THREE.Material).dispose();
          activeParticles.splice(i, 1);
          continue;
        }
        pt.vel.y -= 9.8 * delta;
        pt.mesh.position.addScaledVector(pt.vel, delta);
        pt.mesh.rotation.x += pt.rotVel.x * delta;
        pt.mesh.rotation.y += pt.rotVel.y * delta;
        const alpha = 1 - pt.life / pt.maxLife;
        (pt.mesh.material as THREE.MeshStandardMaterial).opacity = alpha;
        pt.mesh.scale.setScalar(alpha * 0.9);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      frameId = window.setTimeout(tick, 16);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      for (const rt of tileMap.values()) {
        disposeObject(rt.group);
      }
      if (plinthGroup) disposeObject(plinthGroup);
      shardGeo.dispose();
      envTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync level or tile state changes (e.g., reset, undo, level change)
  useEffect(() => {
    const ctrl = sceneControllerRef.current;
    if (!ctrl) return;
    const isNewLevel = prevLevelIdRef.current !== level.id;
    const prevCount = prevTilesRef.current.length;
    const isFullReset = tiles.length > prevCount || isNewLevel;

    ctrl.syncBoard(level, tiles, isNewLevel);
    if (isFullReset && !isNewLevel) {
      ctrl.syncBoard(level, tiles, false);
    }

    prevLevelIdRef.current = level.id;
    prevTilesRef.current = tiles;
  }, [level, tiles]);

  // Camera preset trigger
  useEffect(() => {
    if (cameraTrigger === 0) return;
    sceneControllerRef.current?.applyCameraPreset(cameraPreset, level.dims);
  }, [cameraPreset, cameraTrigger, level.dims]);

  return (
    <div className="relative w-full h-full bg-[#0d111a]">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d111a]/95 z-30">
          <div className="max-w-sm rounded-xl border border-slate-700/60 bg-slate-900 p-6 text-center">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              3D Graphics Paused
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              WebGL context was interrupted. Reload the page or switch tabs back to resume.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

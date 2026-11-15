import {
  DIRECTION_VECTORS,
  GridCoord,
  LevelDef,
  PuzzleTile,
  RayOutcome,
  TileKind,
} from '../types/game';

export function coordKey(pos: GridCoord): string {
  return `${pos.x},${pos.y},${pos.z}`;
}

export function evaluateArrowRay(
  arrow: PuzzleTile,
  tiles: PuzzleTile[],
  dims: { x: number; y: number; z: number }
): RayOutcome {
  if (arrow.kind !== TileKind.ARROW || !arrow.dir) {
    return { status: 'CLEAR' };
  }

  const vec = DIRECTION_VECTORS[arrow.dir];
  const tileMap = new Map<string, PuzzleTile>();
  for (const t of tiles) {
    if (t.id !== arrow.id) {
      tileMap.set(coordKey(t.pos), t);
    }
  }

  const maxSteps = Math.max(dims.x, dims.y, dims.z) + 2;
  let cx = arrow.pos.x;
  let cy = arrow.pos.y;
  let cz = arrow.pos.z;

  for (let step = 1; step <= maxSteps; step++) {
    cx += vec.x;
    cy += vec.y;
    cz += vec.z;

    if (
      cx < 0 ||
      cx >= dims.x ||
      cy < 0 ||
      cy >= dims.y ||
      cz < 0 ||
      cz >= dims.z
    ) {
      return { status: 'CLEAR' };
    }

    const hit = tileMap.get(`${cx},${cy},${cz}`);
    if (hit) {
      const stepsBeforeHit = step - 1;
      switch (hit.kind) {
        case TileKind.ARROW:
          return { status: 'BLOCKED_ARROW', hitTile: hit, stepsBeforeHit };
        case TileKind.BLOCKER:
          return { status: 'BLOCKED_WALL', hitTile: hit, stepsBeforeHit };
        case TileKind.GATE:
          return { status: 'BLOCKED_GATE', hitTile: hit, stepsBeforeHit };
        case TileKind.FRAGILE:
          return { status: 'SHATTER_FRAGILE', hitTile: hit, stepsBeforeHit };
        case TileKind.MINE:
          return { status: 'HIT_MINE', hitTile: hit, stepsBeforeHit };
      }
    }
  }

  return { status: 'CLEAR' };
}

export function applyTileAction(
  tiles: PuzzleTile[],
  targetId: string,
  dims: { x: number; y: number; z: number }
): {
  nextTiles: PuzzleTile[];
  outcome: RayOutcome;
  unlockedGateIds: string[];
} {
  const arrow = tiles.find((t) => t.id === targetId);
  if (!arrow || arrow.kind !== TileKind.ARROW) {
    return { nextTiles: tiles, outcome: { status: 'CLEAR' }, unlockedGateIds: [] };
  }

  const outcome = evaluateArrowRay(arrow, tiles, dims);
  if (outcome.status === 'CLEAR') {
    let nextTiles = tiles.filter((t) => t.id !== arrow.id);
    const unlockedGateIds: string[] = [];

    if (arrow.isKey) {
      const channel = arrow.gateChannel ?? 1;
      const hasRemainingKeySameChannel = nextTiles.some(
        (t) => t.kind === TileKind.ARROW && t.isKey && (t.gateChannel ?? 1) === channel
      );
      if (!hasRemainingKeySameChannel) {
        for (const t of nextTiles) {
          if (t.kind === TileKind.GATE && (t.gateChannel ?? 1) === channel) {
            unlockedGateIds.push(t.id);
          }
        }
        nextTiles = nextTiles.filter(
          (t) => !(t.kind === TileKind.GATE && (t.gateChannel ?? 1) === channel)
        );
      }
    }

    return { nextTiles, outcome, unlockedGateIds };
  }

  if (outcome.status === 'SHATTER_FRAGILE') {
    const nextTiles = tiles.filter((t) => t.id !== outcome.hitTile.id);
    return { nextTiles, outcome, unlockedGateIds: [] };
  }

  return { nextTiles: tiles, outcome, unlockedGateIds: [] };
}

export function countRemainingArrows(tiles: PuzzleTile[]): number {
  return tiles.filter((t) => t.kind === TileKind.ARROW).length;
}

/**
 * BFS/DFS solver that finds a winning sequence of arrow IDs from the current board state.
 * Note: Valid moves are either CLEAR (arrow escapes) or SHATTER_FRAGILE (arrow breaks a crystal barrier).
 * Never taps an arrow pointing into a MINE, BLOCKER, or GATE.
 */
export function findWinningMoveSequence(
  initialTiles: PuzzleTile[],
  dims: { x: number; y: number; z: number },
  maxStates = 12000
): string[] | null {
  const encodeState = (tiles: PuzzleTile[]) =>
    tiles
      .map((t) => t.id)
      .sort()
      .join('|');

  interface QueueNode {
    tiles: PuzzleTile[];
    path: string[];
  }

  const visited = new Set<string>();
  const queue: QueueNode[] = [{ tiles: initialTiles, path: [] }];
  visited.add(encodeState(initialTiles));

  let explored = 0;

  while (queue.length > 0 && explored < maxStates) {
    const current = queue.shift()!;
    explored++;

    const arrows = current.tiles.filter((t) => t.kind === TileKind.ARROW);
    if (arrows.length === 0) {
      return current.path;
    }

    // Prioritize CLEAR moves first (greedy heuristic inside BFS)
    const clearMoves: { id: string; nextTiles: PuzzleTile[] }[] = [];
    const shatterMoves: { id: string; nextTiles: PuzzleTile[] }[] = [];

    for (const arrow of arrows) {
      const res = applyTileAction(current.tiles, arrow.id, dims);
      if (res.outcome.status === 'CLEAR') {
        clearMoves.push({ id: arrow.id, nextTiles: res.nextTiles });
      } else if (res.outcome.status === 'SHATTER_FRAGILE') {
        shatterMoves.push({ id: arrow.id, nextTiles: res.nextTiles });
      }
    }

    const candidates = [...clearMoves, ...shatterMoves];
    for (const cand of candidates) {
      const key = encodeState(cand.nextTiles);
      if (!visited.has(key)) {
        visited.add(key);
        const nextPath = [...current.path, cand.id];
        if (countRemainingArrows(cand.nextTiles) === 0) {
          return nextPath;
        }
        queue.push({ tiles: cand.nextTiles, path: nextPath });
      }
    }
  }

  return null;
}

export function getHintArrowId(
  tiles: PuzzleTile[],
  dims: { x: number; y: number; z: number }
): string | null {
  // First try full solver so the hint never leads to a dead end
  const solution = findWinningMoveSequence(tiles, dims, 6000);
  if (solution && solution.length > 0) {
    return solution[0];
  }
  // Fallback: any clear or shatter move
  for (const t of tiles) {
    if (t.kind === TileKind.ARROW) {
      const outcome = evaluateArrowRay(t, tiles, dims);
      if (outcome.status === 'CLEAR' || outcome.status === 'SHATTER_FRAGILE') {
        return t.id;
      }
    }
  }
  return null;
}

export function verifyLevelSolvable(level: LevelDef): {
  solvable: boolean;
  optimalMoves: number | null;
} {
  const solution = findWinningMoveSequence(level.tiles, level.dims, 25000);
  return {
    solvable: solution !== null,
    optimalMoves: solution ? solution.length : null,
  };
}

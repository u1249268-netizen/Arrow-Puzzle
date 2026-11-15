export enum Direction {
  PX = 'PX', // +X (Right)
  NX = 'NX', // -X (Left)
  PY = 'PY', // +Y (Up)
  NY = 'NY', // -Y (Down)
  PZ = 'PZ', // +Z (Front)
  NZ = 'NZ', // -Z (Back)
}

export enum TileKind {
  ARROW = 'ARROW',
  BLOCKER = 'BLOCKER',   // Permanent steel obstacle
  FRAGILE = 'FRAGILE',   // Crystal barrier: shatters on 1st arrow impact
  GATE = 'GATE',         // Locked energy gate: opens when key arrow escapes
  MINE = 'MINE',         // Hazard mine: hitting it costs 1 heart
}

export interface GridCoord {
  x: number;
  y: number;
  z: number;
}

export interface PuzzleTile {
  id: string;
  kind: TileKind;
  pos: GridCoord;
  dir?: Direction;       // Required for ARROW
  isKey?: boolean;       // Unlocks GATE tiles when this arrow escapes
  gateChannel?: number;  // Optional channel (default 1)
}

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  parMoves: number;
  dims: { x: number; y: number; z: number };
  tiles: PuzzleTile[];
}

export type CameraPreset = 'iso' | 'front' | 'top' | 'side';

export interface LevelSaveData {
  unlocked: boolean;
  completed: boolean;
  stars: number; // 0-3
  bestMoves: number | null;
}

export interface MoveSnapshot {
  tiles: PuzzleTile[];
  moves: number;
  mistakes: number;
  hearts: number;
}

export type RayOutcome =
  | { status: 'CLEAR' }
  | { status: 'BLOCKED_ARROW'; hitTile: PuzzleTile; stepsBeforeHit: number }
  | { status: 'BLOCKED_WALL'; hitTile: PuzzleTile; stepsBeforeHit: number }
  | { status: 'BLOCKED_GATE'; hitTile: PuzzleTile; stepsBeforeHit: number }
  | { status: 'SHATTER_FRAGILE'; hitTile: PuzzleTile; stepsBeforeHit: number }
  | { status: 'HIT_MINE'; hitTile: PuzzleTile; stepsBeforeHit: number };

export const DIRECTION_VECTORS: Record<Direction, GridCoord> = {
  [Direction.PX]: { x: 1, y: 0, z: 0 },
  [Direction.NX]: { x: -1, y: 0, z: 0 },
  [Direction.PY]: { x: 0, y: 1, z: 0 },
  [Direction.NY]: { x: 0, y: -1, z: 0 },
  [Direction.PZ]: { x: 0, y: 0, z: 1 },
  [Direction.NZ]: { x: 0, y: 0, z: -1 },
};

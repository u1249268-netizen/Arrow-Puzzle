import { Direction, LevelDef, PuzzleTile, TileKind } from '../types/game';

function arrow(
  id: string,
  x: number,
  y: number,
  z: number,
  dir: Direction,
  isKey = false,
  gateChannel = 1
): PuzzleTile {
  return {
    id,
    kind: TileKind.ARROW,
    pos: { x, y, z },
    dir,
    ...(isKey ? { isKey: true, gateChannel } : {}),
  };
}

function blocker(id: string, x: number, y: number, z: number): PuzzleTile {
  return { id, kind: TileKind.BLOCKER, pos: { x, y, z } };
}

function fragile(id: string, x: number, y: number, z: number): PuzzleTile {
  return { id, kind: TileKind.FRAGILE, pos: { x, y, z } };
}

function gate(id: string, x: number, y: number, z: number, gateChannel = 1): PuzzleTile {
  return { id, kind: TileKind.GATE, pos: { x, y, z }, gateChannel };
}

function mine(id: string, x: number, y: number, z: number): PuzzleTile {
  return { id, kind: TileKind.MINE, pos: { x, y, z } };
}

export const LEVELS: LevelDef[] = [
  // LEVEL 1: First Steps (2x2x2)
  {
    id: 1,
    name: 'First Extraction',
    subtitle: 'Clear the outer arrows before freeing the inner ones',
    parMoves: 6,
    dims: { x: 2, y: 2, z: 2 },
    tiles: [
      arrow('a1', 0, 0, 0, Direction.PX), // blocked by a2
      arrow('a2', 1, 0, 0, Direction.PZ), // blocked by a3
      arrow('a3', 1, 0, 1, Direction.PX), // FREE (+X)
      arrow('a4', 0, 0, 1, Direction.PY), // blocked by a5
      arrow('a5', 0, 1, 1, Direction.NZ), // blocked by a6
      arrow('a6', 0, 1, 0, Direction.PY), // FREE (+Y)
    ],
  },

  // LEVEL 2: Orbit & Unwind (3x2x2)
  {
    id: 2,
    name: 'Spatial Loop',
    subtitle: 'Rotate the 3D cluster to spot clear exit lanes',
    parMoves: 9,
    dims: { x: 3, y: 2, z: 2 },
    tiles: [
      arrow('a1', 0, 0, 0, Direction.PX), // blocked by a2
      arrow('a2', 1, 0, 0, Direction.PX), // blocked by a3
      arrow('a3', 2, 0, 0, Direction.PZ), // blocked by a4
      arrow('a4', 2, 0, 1, Direction.PY), // blocked by a5
      arrow('a5', 2, 1, 1, Direction.NX), // blocked by a6
      arrow('a6', 1, 1, 1, Direction.NX), // blocked by a7
      arrow('a7', 0, 1, 1, Direction.NZ), // blocked by a8
      arrow('a8', 0, 1, 0, Direction.PY), // FREE (+Y)
      arrow('a9', 1, 1, 0, Direction.NY), // blocked by a2
    ],
  },

  // LEVEL 3: Steel Pillars (3x2x3)
  {
    id: 3,
    name: 'Steel Pillars',
    subtitle: 'Solid steel pillars block paths permanently — route around them',
    parMoves: 8,
    dims: { x: 3, y: 2, z: 3 },
    tiles: [
      blocker('b1', 1, 0, 1),
      blocker('b2', 1, 1, 1),
      arrow('a1', 0, 0, 1, Direction.NZ), // blocked by a2
      arrow('a2', 0, 0, 0, Direction.NX), // FREE (-X)
      arrow('a3', 2, 0, 1, Direction.PZ), // blocked by a4
      arrow('a4', 2, 0, 2, Direction.PX), // FREE (+X)
      arrow('a5', 1, 0, 0, Direction.NX), // blocked by a2 -> free after a2
      arrow('a6', 1, 0, 2, Direction.PX), // blocked by a4 -> free after a4
      arrow('a7', 0, 1, 0, Direction.NY), // blocked by a2 -> free after a2
      arrow('a8', 2, 1, 2, Direction.NY), // blocked by a4 -> free after a4
    ],
  },

  // LEVEL 4: Crossbeam Vault (3x3x3)
  {
    id: 4,
    name: 'Crossbeam Vault',
    subtitle: 'Peel outer layers to unlock the interior core',
    parMoves: 10,
    dims: { x: 3, y: 3, z: 3 },
    tiles: [
      blocker('b1', 1, 1, 1),
      blocker('b2', 0, 1, 1),
      blocker('b3', 2, 1, 1),
      arrow('a1', 1, 0, 1, Direction.PZ), // blocked by a2
      arrow('a2', 1, 0, 2, Direction.PX), // blocked by a3
      arrow('a3', 2, 0, 2, Direction.PZ), // FREE (+Z)
      arrow('a4', 1, 2, 1, Direction.NZ), // blocked by a5
      arrow('a5', 1, 2, 0, Direction.NX), // blocked by a6
      arrow('a6', 0, 2, 0, Direction.PY), // FREE (+Y)
      arrow('a7', 0, 0, 0, Direction.PX), // blocked by a8
      arrow('a8', 1, 0, 0, Direction.PY), // blocked by b1 -> wait! b1 is at (1,1,1), not (1,1,0)!
      arrow('a9', 1, 1, 0, Direction.PY), // blocked by a5 -> free after a5
      arrow('a10', 2, 2, 2, Direction.NX), // FREE (-X) if (1,2,2) empty
    ],
  },

  // LEVEL 5: Crystal Fracture (3x2x3)
  {
    id: 5,
    name: 'Crystal Fracture',
    subtitle: 'Tap an arrow into a Fragile Crystal to shatter the barrier',
    parMoves: 9,
    dims: { x: 3, y: 2, z: 3 },
    tiles: [
      fragile('f1', 1, 0, 0),
      fragile('f2', 2, 1, 1),
      blocker('b1', 1, 1, 1),
      arrow('a1', 0, 0, 0, Direction.PX), // hits f1 -> shatters f1 -> next tap FREE (+X) if (2,0,0) clear
      arrow('a2', 2, 0, 0, Direction.PZ), // FREE? blocked by a3
      arrow('a3', 2, 0, 1, Direction.PX), // FREE (+X)
      arrow('a4', 0, 1, 1, Direction.NZ), // blocked by a5
      arrow('a5', 0, 1, 0, Direction.NY), // blocked by a1 -> free after a1 leaves
      arrow('a6', 2, 1, 2, Direction.NZ), // hits f2 -> shatters f2 -> next tap blocked by a7? (2,1,0)
      arrow('a7', 2, 1, 0, Direction.NY), // blocked by a2 -> free after a2 leaves
    ],
  },

  // LEVEL 6: Prism Chamber (3x3x3)
  {
    id: 6,
    name: 'Prism Chamber',
    subtitle: 'Shatter crystal shields in the right sequence',
    parMoves: 10,
    dims: { x: 3, y: 3, z: 3 },
    tiles: [
      blocker('b1', 0, 1, 0),
      blocker('b2', 2, 1, 2),
      fragile('f1', 1, 0, 1),
      fragile('f2', 1, 2, 1),
      arrow('a1', 0, 0, 1, Direction.PX), // hits f1 -> shatters f1 -> blocked by a2
      arrow('a2', 2, 0, 1, Direction.NZ), // blocked by a3
      arrow('a3', 2, 0, 0, Direction.PX), // FREE (+X)
      arrow('a4', 1, 0, 2, Direction.NZ), // blocked by f1 -> free after f1 shattered & a5 clear
      arrow('a5', 1, 0, 0, Direction.PY), // blocked by a6
      arrow('a6', 1, 1, 0, Direction.PY), // blocked by a7
      arrow('a7', 1, 2, 0, Direction.PZ), // hits f2 -> shatters f2 -> then FREE (+Z) if (1,2,2) clear
      arrow('a8', 1, 2, 2, Direction.PY), // FREE (+Y)
    ],
  },

  // LEVEL 7: Golden Key & Gate (3x2x3)
  {
    id: 7,
    name: 'Golden Latch',
    subtitle: 'Free the Golden Key Arrow to unlock the glowing Energy Gates',
    parMoves: 7,
    dims: { x: 3, y: 2, z: 3 },
    tiles: [
      gate('g1', 1, 0, 2),
      gate('g2', 2, 1, 1),
      blocker('b1', 0, 1, 1),
      arrow('k1', 1, 0, 0, Direction.PX, true), // Key arrow! Blocked by a1
      arrow('a1', 2, 0, 0, Direction.PZ), // blocked by a2
      arrow('a2', 2, 0, 1, Direction.PX), // FREE (+X)
      arrow('a3', 1, 0, 1, Direction.PZ), // blocked by g1 until k1 escapes!
      arrow('a4', 0, 0, 2, Direction.PX), // blocked by g1 until k1 escapes!
      arrow('a5', 1, 1, 1, Direction.PX), // blocked by g2 until k1 escapes!
      arrow('a6', 1, 1, 0, Direction.PZ), // blocked by a5
    ],
  },

  // LEVEL 8: Twin Vaults (3x3x3)
  {
    id: 8,
    name: 'Twin Vaults',
    subtitle: 'Combine crystal shatters with key gate unlocks',
    parMoves: 10,
    dims: { x: 3, y: 3, z: 3 },
    tiles: [
      gate('g1', 1, 1, 2),
      gate('g2', 0, 1, 1),
      fragile('f1', 2, 0, 1),
      blocker('b1', 1, 2, 1),
      arrow('k1', 2, 0, 0, Direction.PZ, true), // hits f1 -> shatters f1 -> blocked by a1
      arrow('a1', 2, 0, 2, Direction.PX), // FREE (+X)
      arrow('a2', 1, 1, 1, Direction.PZ), // blocked by g1
      arrow('a3', 1, 1, 0, Direction.NX), // blocked by a4
      arrow('a4', 0, 1, 0, Direction.PZ), // blocked by g2
      arrow('a5', 0, 2, 0, Direction.NY), // blocked by a4
      arrow('a6', 2, 2, 2, Direction.NX), // FREE (-X)
      arrow('a7', 1, 2, 2, Direction.NY), // blocked by g1
      arrow('a8', 0, 0, 1, Direction.PY), // blocked by g2
    ],
  },

  // LEVEL 9: Minefield Caution (3x2x3)
  {
    id: 9,
    name: 'Hazard Perimeter',
    subtitle: 'Crimson Mines damage hearts on impact — never launch into them',
    parMoves: 8,
    dims: { x: 3, y: 2, z: 3 },
    tiles: [
      mine('m1', 1, 0, 0),
      mine('m2', 1, 1, 2),
      blocker('b1', 0, 0, 2),
      arrow('a1', 0, 0, 0, Direction.PY), // safe (+Y) after a2 leaves! (Note: pointing PX would hit m1!)
      arrow('a2', 0, 1, 0, Direction.PZ), // blocked by a3
      arrow('a3', 0, 1, 1, Direction.PX), // blocked by a4
      arrow('a4', 1, 1, 1, Direction.NZ), // blocked by a5
      arrow('a5', 1, 1, 0, Direction.PX), // blocked by a6
      arrow('a6', 2, 1, 0, Direction.NY), // blocked by a7
      arrow('a7', 2, 0, 0, Direction.PZ), // blocked by a8
      arrow('a8', 2, 0, 1, Direction.PX), // FREE (+X)
    ],
  },

  // LEVEL 10: Laser & Mines (3x3x3)
  {
    id: 10,
    name: 'Razor Corridor',
    subtitle: 'Thread arrows safely between hazard mines and locked gates',
    parMoves: 10,
    dims: { x: 3, y: 3, z: 3 },
    tiles: [
      mine('m1', 0, 1, 1),
      mine('m2', 2, 1, 1),
      gate('g1', 1, 2, 1),
      fragile('f1', 1, 0, 1),
      blocker('b1', 1, 1, 2),
      arrow('k1', 1, 0, 0, Direction.PZ, true), // hits f1 -> shatters f1 -> blocked by a1
      arrow('a1', 1, 0, 2, Direction.PX), // blocked by a2
      arrow('a2', 2, 0, 2, Direction.PZ), // FREE (+Z)
      arrow('a3', 0, 0, 0, Direction.PX), // FREE after k1 leaves
      arrow('a4', 1, 1, 0, Direction.PY), // blocked by a5
      arrow('a5', 1, 2, 0, Direction.PZ), // blocked by g1
      arrow('a6', 2, 2, 1, Direction.PZ), // FREE (+Z) after g1? No, (2,2,2) empty -> FREE (+Z)
      arrow('a7', 0, 2, 1, Direction.PX), // blocked by g1 -> FREE (+X) after g1 unlocks & a6 leaves
      arrow('a8', 1, 1, 1, Direction.PY), // blocked by g1
    ],
  },

  // LEVEL 11: Clockwork Bastion (4x3x3)
  {
    id: 11,
    name: 'Clockwork Bastion',
    subtitle: 'Four-column multi-tier puzzle with nested crystals and locks',
    parMoves: 14,
    dims: { x: 4, y: 3, z: 3 },
    tiles: [
      blocker('b1', 1, 1, 1),
      blocker('b2', 2, 1, 1),
      mine('m1', 0, 2, 1),
      mine('m2', 3, 2, 1),
      fragile('f1', 1, 0, 1),
      fragile('f2', 2, 2, 1),
      gate('g1', 2, 0, 1),
      gate('g2', 1, 2, 1),
      arrow('k1', 0, 0, 1, Direction.PZ, true), // blocked by a1
      arrow('a1', 0, 0, 2, Direction.PX), // blocked by a2
      arrow('a2', 1, 0, 2, Direction.PX), // blocked by a3
      arrow('a3', 2, 0, 2, Direction.PZ), // FREE (+Z)
      arrow('a4', 0, 0, 0, Direction.PZ), // blocked by k1 -> free after k1
      arrow('a5', 1, 0, 0, Direction.PZ), // hits f1 -> shatters f1 -> blocked by a6? (1,0,2)
      arrow('a6', 3, 0, 1, Direction.NX), // blocked by g1 -> free after k1!
      arrow('a7', 2, 2, 2, Direction.NZ), // hits f2 -> shatters f2 -> blocked by a8
      arrow('a8', 2, 2, 0, Direction.PY), // FREE (+Y)
      arrow('a9', 1, 2, 0, Direction.PZ), // blocked by g2 -> free after k1!
      arrow('a10', 3, 1, 1, Direction.NY), // blocked by a6 -> free after a6!
      arrow('a11', 0, 1, 1, Direction.NY), // blocked by k1 -> free after k1!
    ],
  },

  // LEVEL 12: Zenith Citadel (4x3x4)
  {
    id: 12,
    name: 'Zenith Citadel',
    subtitle: 'Master all 3D layers, crystals, energy gates, and hazard mines',
    parMoves: 16,
    dims: { x: 4, y: 3, z: 4 },
    tiles: [
      blocker('b1', 0, 1, 1),
      blocker('b2', 2, 1, 2),
      mine('m1', 0, 0, 3),
      mine('m2', 3, 2, 0),
      mine('m3', 0, 2, 2),
      fragile('f1', 2, 0, 1),
      fragile('f2', 1, 1, 2),
      gate('g1', 1, 0, 2),
      gate('g2', 2, 2, 1),
      arrow('k1', 2, 0, 0, Direction.PZ, true), // hits f1 -> shatters f1 -> blocked by a1
      arrow('a1', 2, 0, 2, Direction.PX), // blocked by a2
      arrow('a2', 3, 0, 2, Direction.PZ), // blocked by a3
      arrow('a3', 3, 0, 3, Direction.PX), // FREE (+X)
      arrow('a4', 1, 0, 1, Direction.PZ), // blocked by g1 -> free after k1
      arrow('a5', 0, 0, 2, Direction.PX), // blocked by g1 -> free after k1
      arrow('a6', 1, 0, 3, Direction.PX), // FREE (+X) once a3 leaves!
      arrow('a7', 0, 1, 2, Direction.NY), // blocked by a5 -> free after a5 leaves!
      arrow('a8', 1, 1, 3, Direction.NZ), // hits f2 -> shatters f2 -> FREE (-Z)!
      arrow('a9', 2, 2, 2, Direction.NZ), // blocked by g2 -> free after k1
      arrow('a10', 2, 2, 0, Direction.PY), // FREE (+Y)
      arrow('a11', 3, 2, 1, Direction.PZ), // FREE (+Z)
      arrow('a12', 1, 2, 1, Direction.PX), // blocked by g2 -> free after k1
      arrow('a13', 1, 2, 3, Direction.NY), // blocked by a8 -> free after a8 leaves
    ],
  },
];

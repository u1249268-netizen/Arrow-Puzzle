import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { GameHUD } from './components/GameHUD';
import { PuzzleViewport } from './components/PuzzleViewport';
import { LEVELS } from './game/levels';
import {
  applyTileAction,
  countRemainingArrows,
  getHintArrowId,
} from './game/puzzleLogic';
import {
  CameraPreset,
  LevelSaveData,
  MoveSnapshot,
  PuzzleTile,
  RayOutcome,
} from './types/game';

const STORAGE_KEY = 'arrow-out-3d-progress-v1';
const MAX_HEARTS = 3;

function loadSavedProgress(): Record<number, LevelSaveData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as Record<number, LevelSaveData>;
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    1: { unlocked: true, completed: false, stars: 0, bestMoves: null },
  };
}

export default function App() {
  const [progress, setProgress] = useState<Record<number, LevelSaveData>>(loadSavedProgress);
  const [currentLevelIdx, setCurrentLevelIdx] = useState<number>(0);

  const currentLevel = LEVELS[currentLevelIdx];

  const [tiles, setTiles] = useState<PuzzleTile[]>(() =>
    currentLevel.tiles.map((t) => ({ ...t, pos: { ...t.pos } }))
  );
  const [history, setHistory] = useState<MoveSnapshot[]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [hearts, setHearts] = useState<number>(MAX_HEARTS);
  const [combo, setCombo] = useState<number>(0);

  const [hintTileId, setHintTileId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('iso');
  const [cameraTrigger, setCameraTrigger] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [showLevelSelect, setShowLevelSelect] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const [levelStatus, setLevelStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [earnedStars, setEarnedStars] = useState<number>(0);

  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'info' | 'success' | 'warning' | 'danger'>('info');
  const feedbackTimerRef = useRef<number>(0);

  const showToast = useCallback(
    (text: string, tone: 'info' | 'success' | 'warning' | 'danger' = 'info') => {
      window.clearTimeout(feedbackTimerRef.current);
      setFeedbackText(text);
      setFeedbackTone(tone);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedbackText(null);
      }, 2200);
    },
    []
  );

  // Persist progress
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage write errors
    }
  }, [progress]);

  const loadLevel = useCallback((idx: number) => {
    const lvl = LEVELS[idx];
    setCurrentLevelIdx(idx);
    setTiles(lvl.tiles.map((t) => ({ ...t, pos: { ...t.pos } })));
    setHistory([]);
    setMoves(0);
    setMistakes(0);
    setHearts(MAX_HEARTS);
    setCombo(0);
    setHintTileId(null);
    setLevelStatus('playing');
    setEarnedStars(0);
    setCameraPreset('iso');
    setFeedbackText(null);
  }, []);

  const handleReset = useCallback(() => {
    soundEngine.playClick();
    loadLevel(currentLevelIdx);
  }, [currentLevelIdx, loadLevel]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || levelStatus !== 'playing') return;
    soundEngine.playClick();
    const prev = history[history.length - 1];
    setTiles(prev.tiles);
    setMoves(prev.moves);
    setMistakes(prev.mistakes);
    setHearts(prev.hearts);
    setHistory((h) => h.slice(0, -1));
    setHintTileId(null);
    setCombo(0);
  }, [history, levelStatus]);

  const handleHint = useCallback(() => {
    if (levelStatus !== 'playing') return;
    soundEngine.playClick();
    const id = getHintArrowId(tiles, currentLevel.dims);
    if (id) {
      setHintTileId(id);
      showToast('Highlighted arrow has a valid move', 'info');
    } else {
      showToast('No valid moves left — try Undo or Reset', 'warning');
    }
  }, [tiles, currentLevel.dims, levelStatus, showToast]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      if (!next) soundEngine.playClick();
      return next;
    });
  }, []);

  const handleSelectCamera = useCallback((preset: CameraPreset) => {
    soundEngine.playClick();
    setCameraPreset(preset);
    setCameraTrigger((c) => c + 1);
  }, []);

  const handleSelectLevel = useCallback(
    (levelId: number) => {
      const idx = LEVELS.findIndex((l) => l.id === levelId);
      if (idx >= 0) {
        soundEngine.playClick();
        loadLevel(idx);
      }
    },
    [loadLevel]
  );

  const handleNextLevel = useCallback(() => {
    if (currentLevelIdx + 1 < LEVELS.length) {
      soundEngine.playClick();
      loadLevel(currentLevelIdx + 1);
    }
  }, [currentLevelIdx, loadLevel]);

  const handleAttemptArrow = useCallback(
    (tileId: string): { outcome: RayOutcome; unlockedGateIds: string[] } | null => {
      if (levelStatus !== 'playing') return null;

      const snapshot: MoveSnapshot = {
        tiles: tiles.map((t) => ({ ...t, pos: { ...t.pos } })),
        moves,
        mistakes,
        hearts,
      };

      const { nextTiles, outcome, unlockedGateIds } = applyTileAction(
        tiles,
        tileId,
        currentLevel.dims
      );

      setHintTileId(null);

      if (outcome.status === 'CLEAR') {
        const nextMoves = moves + 1;
        setHistory((h) => [...h, snapshot]);
        setTiles(nextTiles);
        setMoves(nextMoves);
        setCombo((c) => c + 1);

        if (unlockedGateIds.length > 0) {
          soundEngine.playGateUnlock();
          showToast('Golden Key Extracted · Energy Gate Unlocked', 'success');
        } else {
          soundEngine.playEscape(combo);
        }

        const remaining = countRemainingArrows(nextTiles);
        if (remaining === 0) {
          // Compute stars
          const stars =
            nextMoves <= currentLevel.parMoves && mistakes === 0
              ? 3
              : nextMoves <= currentLevel.parMoves + 3 && mistakes <= 2
              ? 2
              : 1;

          setEarnedStars(stars);

          // Update saved progress
          setProgress((prev) => {
            const curSave = prev[currentLevel.id] ?? {
              unlocked: true,
              completed: false,
              stars: 0,
              bestMoves: null,
            };
            const nextMap: Record<number, LevelSaveData> = {
              ...prev,
              [currentLevel.id]: {
                unlocked: true,
                completed: true,
                stars: Math.max(curSave.stars, stars),
                bestMoves:
                  curSave.bestMoves === null
                    ? nextMoves
                    : Math.min(curSave.bestMoves, nextMoves),
              },
            };
            if (currentLevelIdx + 1 < LEVELS.length) {
              const nextId = LEVELS[currentLevelIdx + 1].id;
              if (!nextMap[nextId]) {
                nextMap[nextId] = {
                  unlocked: true,
                  completed: false,
                  stars: 0,
                  bestMoves: null,
                };
              }
            }
            return nextMap;
          });

          window.setTimeout(() => {
            soundEngine.playVictory();
            setLevelStatus('won');
          }, 420);
        }
      } else if (outcome.status === 'SHATTER_FRAGILE') {
        setHistory((h) => [...h, snapshot]);
        setTiles(nextTiles);
        setMoves((m) => m + 1);
        setCombo(0);
        soundEngine.playCrystalShatter();
        showToast('Crystal Barrier Shattered', 'info');
      } else if (outcome.status === 'HIT_MINE') {
        const nextHearts = Math.max(0, hearts - 1);
        setHearts(nextHearts);
        setMistakes((m) => m + 1);
        setCombo(0);
        soundEngine.playMineHit();
        showToast('Hazard Mine Hit · -1 Heart', 'danger');
        if (nextHearts === 0) {
          window.setTimeout(() => {
            setLevelStatus('lost');
          }, 340);
        }
      } else if (outcome.status === 'BLOCKED_GATE') {
        setMistakes((m) => m + 1);
        setCombo(0);
        soundEngine.playBump();
        showToast('Blocked by Energy Gate · Free the Golden Key first', 'warning');
      } else if (outcome.status === 'BLOCKED_WALL') {
        setMistakes((m) => m + 1);
        setCombo(0);
        soundEngine.playBump();
        showToast('Blocked by Steel Pillar', 'warning');
      } else {
        setMistakes((m) => m + 1);
        setCombo(0);
        soundEngine.playBump();
      }

      return { outcome, unlockedGateIds };
    },
    [
      levelStatus,
      tiles,
      moves,
      mistakes,
      hearts,
      currentLevel,
      currentLevelIdx,
      combo,
      showToast,
    ]
  );

  // Keyboard shortcuts (H: toggle HUD dock, Z: Undo, R: Reset)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((d) => !d);
      } else if ((e.key === 'z' || e.key === 'Z') && !showLevelSelect && !showGuide) {
        handleUndo();
      } else if ((e.key === 'r' || e.key === 'R') && !showLevelSelect && !showGuide) {
        handleReset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleReset, showLevelSelect, showGuide]);

  const remainingArrows = useMemo(() => countRemainingArrows(tiles), [tiles]);

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0d111a]">
      <PuzzleViewport
        level={currentLevel}
        tiles={tiles}
        hintTileId={hintTileId}
        cameraPreset={cameraPreset}
        cameraTrigger={cameraTrigger}
        disabled={levelStatus !== 'playing' || showLevelSelect || showGuide}
        onAttemptArrow={handleAttemptArrow}
      />

      <GameHUD
        levels={LEVELS}
        currentLevel={currentLevel}
        remainingArrows={remainingArrows}
        moves={moves}
        hearts={hearts}
        maxHearts={MAX_HEARTS}
        canUndo={history.length > 0}
        muted={muted}
        dockCollapsed={dockCollapsed}
        cameraPreset={cameraPreset}
        feedbackText={feedbackText}
        feedbackTone={feedbackTone}
        levelStatus={levelStatus}
        earnedStars={earnedStars}
        showLevelSelect={showLevelSelect}
        showGuide={showGuide}
        progress={progress}
        onToggleMute={handleToggleMute}
        onToggleDock={() => setDockCollapsed((c) => !c)}
        onUndo={handleUndo}
        onHint={handleHint}
        onReset={handleReset}
        onSelectCamera={handleSelectCamera}
        onSelectLevel={handleSelectLevel}
        onNextLevel={handleNextLevel}
        onSetShowLevelSelect={setShowLevelSelect}
        onSetShowGuide={setShowGuide}
      />
    </main>
  );
}

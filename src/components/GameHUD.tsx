import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Gem,
  Grid3X3,
  Heart,
  Info,
  KeyRound,
  Lightbulb,
  Lock,
  RotateCcw,
  ShieldAlert,
  Star,
  Undo2,
  Volume2,
  VolumeX,
  X,
  ArrowRight,
  Box,
} from 'lucide-react';
import { CameraPreset, LevelDef, LevelSaveData, TileKind } from '../types/game';

interface GameHUDProps {
  levels: LevelDef[];
  currentLevel: LevelDef;
  remainingArrows: number;
  moves: number;
  hearts: number;
  maxHearts: number;
  canUndo: boolean;
  muted: boolean;
  dockCollapsed: boolean;
  cameraPreset: CameraPreset;
  feedbackText: string | null;
  feedbackTone: 'info' | 'success' | 'warning' | 'danger';
  levelStatus: 'playing' | 'won' | 'lost';
  earnedStars: number;
  showLevelSelect: boolean;
  showGuide: boolean;
  progress: Record<number, LevelSaveData>;
  onToggleMute: () => void;
  onToggleDock: () => void;
  onUndo: () => void;
  onHint: () => void;
  onReset: () => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onSelectLevel: (levelId: number) => void;
  onNextLevel: () => void;
  onSetShowLevelSelect: (open: boolean) => void;
  onSetShowGuide: (open: boolean) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  levels,
  currentLevel,
  remainingArrows,
  moves,
  hearts,
  maxHearts,
  canUndo,
  muted,
  dockCollapsed,
  cameraPreset,
  feedbackText,
  feedbackTone,
  levelStatus,
  earnedStars,
  showLevelSelect,
  showGuide,
  progress,
  onToggleMute,
  onToggleDock,
  onUndo,
  onHint,
  onReset,
  onSelectCamera,
  onSelectLevel,
  onNextLevel,
  onSetShowLevelSelect,
  onSetShowGuide,
}) => {
  const hasNextLevel = currentLevel.id < levels.length;

  const feedbackStyle =
    feedbackTone === 'danger'
      ? 'border-rose-500/40 bg-[#1f1218]/95 text-rose-200'
      : feedbackTone === 'success'
      ? 'border-emerald-500/40 bg-[#0f1f1a]/95 text-emerald-200'
      : feedbackTone === 'warning'
      ? 'border-amber-500/40 bg-[#1f1a10]/95 text-amber-200'
      : 'border-sky-500/35 bg-[#121826]/95 text-sky-100';

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="pointer-events-auto flex items-center justify-between gap-4 border-b border-slate-800/80 bg-[#0d111a]/90 px-4 py-3 sm:px-6">
        {/* Brand + Level Metadata */}
        <div className="flex min-w-0 items-center gap-4">
          <h1 className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
            Arrow Out 3D
          </h1>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 truncate">
            <span className="font-mono-num text-slate-200 font-medium">
              Level {String(currentLevel.id).padStart(2, '0')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{currentLevel.name}</span>
          </div>
        </div>

        {/* Center / Right Live Metrics & Actions */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          {/* Hearts */}
          <div className="flex items-center gap-1" aria-label={`Hearts: ${hearts} of ${maxHearts}`}>
            {Array.from({ length: maxHearts }).map((_, i) => (
              <Heart
                key={i}
                className={`h-4 w-4 transition-colors duration-150 ${
                  i < hearts ? 'fill-rose-500 text-rose-500' : 'text-slate-700'
                }`}
              />
            ))}
          </div>

          <span className="hidden sm:inline text-slate-700" aria-hidden="true">
            |
          </span>

          {/* Moves & Remaining */}
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono-num">
            <span>
              Moves <strong className="text-slate-100">{moves}</strong>
              <span className="text-slate-500">/{currentLevel.parMoves}</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <span>
              Left <strong className="text-sky-400">{remainingArrows}</strong>
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSetShowLevelSelect(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700/80 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              <Grid3X3 className="h-3.5 w-3.5 text-sky-400" />
              <span>Levels</span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Level Subtitle & Dynamic Feedback Toast */}
      <div className="flex flex-col items-center gap-2 px-4 pt-3">
        <p className="text-center text-xs sm:text-sm text-slate-400 max-w-lg">
          {currentLevel.subtitle}
        </p>

        {feedbackText && (
          <div
            role="status"
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium shadow-lg transition-opacity duration-150 ${feedbackStyle}`}
          >
            {feedbackText}
          </div>
        )}
      </div>

      {/* Spacer keeping center 3D viewport 100% clear */}
      <div className="flex-1" />

      {/* Collapsible Bottom Control Dock */}
      <div
        className={`pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center transition-transform duration-200 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%-26px)]' : 'translate-y-0'
        }`}
        style={{ maxWidth: 'min(880px, 95vw)' }}
      >
        {/* Collapse Toggle Handle */}
        <button
          type="button"
          onClick={onToggleDock}
          className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-700/80 bg-[#121826]/95 px-3 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {/* Main Horizontal Dock */}
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#121826]/95 px-3 py-2.5 shadow-2xl">
          {/* Gameplay Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo || levelStatus !== 'playing'}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={onHint}
              disabled={levelStatus !== 'playing'}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              <span>Hint</span>
            </button>

            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="hidden sm:block h-5 w-px bg-slate-700/70 mx-1" aria-hidden="true" />

          {/* Camera View Segmented Control */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-900/90 p-1 border border-slate-800">
            <Compass className="h-3.5 w-3.5 text-slate-500 mx-1.5 hidden sm:block" />
            {(['iso', 'front', 'top', 'side'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onSelectCamera(preset)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraPreset === preset
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="hidden sm:block h-5 w-px bg-slate-700/70 mx-1" aria-hidden="true" />

          {/* Obstacles Guide Trigger */}
          <button
            type="button"
            onClick={() => onSetShowGuide(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Info className="h-3.5 w-3.5 text-sky-400" />
            <span>Obstacles</span>
          </button>
        </div>
      </div>

      {/* Level Complete Modal */}
      {levelStatus === 'won' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#121826] p-6 text-center shadow-2xl">
            <p className="text-xs font-medium text-emerald-400">
              Level {String(currentLevel.id).padStart(2, '0')} Cleared
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-100">
              {currentLevel.name}
            </h2>

            {/* Stars */}
            <div className="mt-5 flex items-center justify-center gap-3">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`h-9 w-9 transition-transform ${
                    s <= earnedStars
                      ? 'fill-amber-400 text-amber-400 scale-105'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Stats Row */}
            <div className="mt-5 flex items-center justify-center gap-6 border-y border-slate-800 py-3 text-sm font-mono-num">
              <div>
                <div className="text-xs text-slate-400">Moves</div>
                <div className="mt-0.5 font-semibold text-slate-100">{moves}</div>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <div className="text-xs text-slate-400">Par Target</div>
                <div className="mt-0.5 font-semibold text-sky-400">{currentLevel.parMoves}</div>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <div className="text-xs text-slate-400">Hearts Left</div>
                <div className="mt-0.5 font-semibold text-rose-400">
                  {hearts}/{maxHearts}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Replay</span>
              </button>

              {hasNextLevel ? (
                <button
                  type="button"
                  onClick={onNextLevel}
                  className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Next Level</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetShowLevelSelect(true)}
                  className="flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>All Levels Complete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Out of Hearts Modal */}
      {levelStatus === 'lost' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/35 bg-[#121826] p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="mt-3 font-display text-xl font-bold text-slate-100">
              Out of Hearts
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Arrows collided with Hazard Mines too many times. Orbit the 3D grid carefully before tapping.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry Level</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Level Selector Modal */}
      {showLevelSelect && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#121826] p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-100">Select Level</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  12 progressive 3D puzzles with steel pillars, crystals, key gates, and mines
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSetShowLevelSelect(false)}
                aria-label="Close level selector"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-1">
              {levels.map((lvl) => {
                const save = progress[lvl.id];
                const isCurrent = lvl.id === currentLevel.id;
                const hasBlocker = lvl.tiles.some((t) => t.kind === TileKind.BLOCKER);
                const hasFragile = lvl.tiles.some((t) => t.kind === TileKind.FRAGILE);
                const hasGate = lvl.tiles.some((t) => t.kind === TileKind.GATE);
                const hasMine = lvl.tiles.some((t) => t.kind === TileKind.MINE);

                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => {
                      onSelectLevel(lvl.id);
                      onSetShowLevelSelect(false);
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'border-sky-500 bg-sky-500/10'
                        : 'border-slate-800 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-800/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono-num text-xs font-semibold text-sky-400">
                          Level {String(lvl.id).padStart(2, '0')}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={`h-3.5 w-3.5 ${
                                save && s <= save.stars
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-1 font-display text-sm font-semibold text-slate-100 truncate">
                        {lvl.name}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono-num">
                        {lvl.dims.x}×{lvl.dims.y}×{lvl.dims.z}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasBlocker && <Box className="h-3.5 w-3.5 text-slate-400" />}
                        {hasFragile && <Gem className="h-3.5 w-3.5 text-cyan-400" />}
                        {hasGate && <Lock className="h-3.5 w-3.5 text-amber-400" />}
                        {hasMine && <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Obstacles Guide Modal */}
      {showGuide && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-[#121826] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="font-display text-xl font-bold text-slate-100">
                3D Obstacles & Mechanics
              </h2>
              <button
                type="button"
                onClick={() => onSetShowGuide(false)}
                aria-label="Close guide"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <Box className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Steel Pillar</div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Permanent solid obstacle. Arrows pointing into a Steel Pillar are blocked and bounce back.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <Gem className="h-5 w-5 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Fragile Crystal Barrier</div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tap an arrow pointing straight into a Crystal Barrier once to shatter it and open the lane.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-1 mt-0.5 shrink-0">
                  <KeyRound className="h-4 w-4 text-amber-400" />
                  <Lock className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Golden Key & Energy Gate</div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Extract the Golden Ring Key Arrow first — once it flies out, all Energy Gates automatically unlock.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <ShieldAlert className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-100">Hazard Mine</div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spiked crimson mine. Launching an arrow directly into a Hazard Mine costs 1 Heart.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800 pt-4">
              <span>Drag to orbit 3D view · Scroll to zoom · Tap arrow to launch</span>
              <button
                type="button"
                onClick={() => onSetShowGuide(false)}
                className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

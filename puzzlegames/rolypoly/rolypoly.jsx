import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { SVG_UNROLLED } from '../../src/shared/icons/rolyPolyBugUnrolledSvg.js'
import { SVG_ROLLED } from '../../src/shared/icons/rolyPolyBugRolledSvg.js'
import puzzleData from './puzzles.js'
import TopBar from '../../src/shared/TopBar.jsx'
import { isKeyboardUndo } from '../../src/shared/keyboardUndo.js'
import DiceFace from '../../src/shared/DiceFace.jsx'
import SharedModalShell from '../../src/shared/SharedModalShell.jsx'
import SimpleGameStatsModal from '../../src/shared/SimpleGameStatsModal.jsx'
import SuiteGameCompletionModal from '../../src/shared/SuiteGameCompletionModal.jsx'
import useSuiteCompletionTimer from '../../src/shared/useSuiteCompletionTimer.js'
import useBonusCompletionTimer from '../../src/shared/useBonusCompletionTimer.js'
import PlaygroundLinksModal from '../../src/shared/PlaygroundLinksModal.jsx'
import { finalizeBonusGameTimer } from '@shared-contracts/bonusCompletionTimer.js'
import {
  BONUS_SLOT,
  isBonusUnlocked,
} from '@shared-contracts/bonusPuzzle.js'
import useInstructionsGate from '../../src/shared/useInstructionsGate.js'
import { MODAL_INTENTS } from '@shared-contracts/modalIntents.js'
import { GAME_KEYS, getGameChrome } from '@shared-contracts/gameChrome.js'
import {
  PUZZLE_SUITE_CORRECT_GREEN,
  PUZZLE_SUITE_INK,
  PUZZLE_SUITE_PRACTICE_BLUE,
  PUZZLE_SUITE_SURFACE_INCOMPLETE,
} from '@shared-contracts/chromeUi.js'
import { CTA_LABELS } from '@shared-contracts/ctaLabels.js'
import { persistHubDailySlot } from '@shared-contracts/hubEntry.js'
import {
  clampDailyIndexToTierPrefs,
  getEnabledTierIndices,
  isSuiteCompleteForPrefs,
  nextIncompleteEnabledTierExcluding,
  resolveHubDailySlotWithPrefs,
} from '@shared-contracts/suiteDashboardPreferences.js'
import useSuitePrefsEpoch from '../../src/shared/useSuitePrefsEpoch.js'
import {
  getInitialTutorialNav,
  persistTutorialResumeState,
} from '@shared-contracts/tutorialResume.js'
import { hasShareableHubProgress } from '@shared-contracts/hubSharePlaintext.js'
import GameShareNavButton from '../../src/shared/GameShareNavButton.jsx'
import YesterdaySolutionNavButton from '../../src/shared/YesterdaySolutionNavButton.jsx'
import RolyPolyIcon from '../../src/shared/icons/RolyPolyIcon.jsx'
import { buildTierRoster, formatCurateClipboard } from '../../src/shared/curateRoster.js'
import { useCurateModeFromRoster } from '../../src/shared/useCurateMode.js'
import { CurateCopyToast, CurateLevelNav } from '../../src/shared/CurateModeChrome.jsx'
import { useCurateSolutionPlayback } from '../../src/shared/useCurateSolutionPlayback.js'
import SmartRightButton from '../../src/shared/SmartRightButton.jsx'
import { getDailyKey, getDateLabel, getDayIndex } from '@shared-contracts/dailyPuzzleDate.js'
import {
  getYesterdayCalendarKey,
  getYesterdayNavDateLabel,
  toPracticeStorageDateKey,
} from '@shared-contracts/yesterdayPractice.js'

const DEFAULT_ROLYPOLY_GRID = 7
/** Match productiles/sumtiles board cell cap so small grids do not overscale. */
const ROLYPOLY_MAX_CELL_PX = 80
const ROLYPOLY_ANIM_MS = 520
const ROLYPOLY_SUITE_MODAL_MS = 500
const MAX_MOVE_DISPLAY = 99

const ROLYPOLY_TUTORIAL_HINT =
  'Use arrow keys or swipes to slide every bug onto a yellow target. Bugs lock when they land on a target.'

/** Shift hard rotation so today's 3-star stays the pre-expansion puzzle after hard pool grew. */
const HARD_DAY_OFFSET = 144
/** Offset bonus cycle relative to hard so the same day is less likely to share a layout family. */
const BONUS_DAY_OFFSET = 37

function getDailyPuzzles(dateKey = getDailyKey()) {
  const key = dateKey
  const dayIndex = getDayIndex(key)
  const easy = puzzleData.easy || []
  const medium = puzzleData.medium || []
  const hard = puzzleData.hard || []
  const bonus = puzzleData.bonus || []
  return {
    puzzles: [
      easy[dayIndex % easy.length],
      medium[dayIndex % medium.length],
      hard[(dayIndex + HARD_DAY_OFFSET) % hard.length],
      bonus.length ? bonus[(dayIndex + BONUS_DAY_OFFSET) % bonus.length] : null,
    ],
    key,
  }
}

function loadCompletions(dateKey) {
  return [0, 1, 2, 3].map((i) =>
    ['1', '2'].includes(localStorage.getItem(`rolypoly:${dateKey}:${i}`))
  )
}

function loadPerfects(dateKey) {
  return [0, 1, 2, 3].map((i) => localStorage.getItem(`rolypoly:${dateKey}:${i}`) === '2')
}

function getStoredMoveCount(dateKey, idx) {
  const v = localStorage.getItem(`rolypoly:${dateKey}:${idx}:moves`)
  return v != null ? parseInt(v, 10) : null
}

function markComplete(dateKey, idx, movesThisRun, puzzleMinMoves) {
  const hitMin =
    puzzleMinMoves != null && Number.isFinite(puzzleMinMoves) && movesThisRun === puzzleMinMoves
  const starWorthy = hitMin
  const key = `rolypoly:${dateKey}:${idx}`
  const existing = localStorage.getItem(key)
  const storedMoves = getStoredMoveCount(dateKey, idx)
  if (existing !== '1' && existing !== '2') {
    localStorage.setItem(key, starWorthy ? '2' : '1')
    saveMoveCount(dateKey, idx, movesThisRun)
  } else if (storedMoves != null && movesThisRun < storedMoves) {
    localStorage.setItem(key, starWorthy ? '2' : '1')
    saveMoveCount(dateKey, idx, movesThisRun)
  } else if (existing === '1' && hitMin) {
    localStorage.setItem(key, '2')
  }
}

function saveMoveCount(dateKey, idx, moves) {
  localStorage.setItem(`rolypoly:${dateKey}:${idx}:moves`, String(Math.min(moves, MAX_MOVE_DISPLAY)))
}

function loadMoveCounts(dateKey) {
  return [0, 1, 2, 3].map((i) => {
    const v = localStorage.getItem(`rolypoly:${dateKey}:${i}:moves`)
    return v != null ? parseInt(v, 10) : null
  })
}

const GAME_STATE_VERSION = 1

function storageKeyGameState(dateKey, puzzleIndex) {
  return `rolypoly:${dateKey}:${puzzleIndex}:gameState`
}

function getRolyPolyGridSize(data) {
  if (!data || typeof data !== 'object') return DEFAULT_ROLYPOLY_GRID
  const s = data.size
  if (Number.isFinite(s) && s >= 3 && s <= 16) return Math.trunc(s)
  return DEFAULT_ROLYPOLY_GRID
}

function getRolyPolyParMoves(p) {
  if (!p || typeof p !== 'object') return null
  if (Number.isFinite(p.minMoves)) return p.minMoves
  if (Number.isFinite(p.par)) return p.par
  return null
}

function puzzleFingerprint(data) {
  if (!data) return ''
  return JSON.stringify({
    b: data.balls,
    t: data.targets,
    bl: data.blocks,
    sz: getRolyPolyGridSize(data),
  })
}

function loadGameState(dateKey, puzzleIndex, data) {
  try {
    const raw = localStorage.getItem(storageKeyGameState(dateKey, puzzleIndex))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== GAME_STATE_VERSION) return null
    if (parsed.fp !== puzzleFingerprint(data)) return null
    if (!Array.isArray(parsed.balls) || !Array.isArray(parsed.history)) return null
    return parsed
  } catch {
    return null
  }
}

function saveGameState(dateKey, puzzleIndex, data, balls, history, moves, solved) {
  try {
    if (!data) return
    const payload = {
      version: GAME_STATE_VERSION,
      fp: puzzleFingerprint(data),
      balls,
      history,
      moves,
      solved: !!solved,
    }
    localStorage.setItem(storageKeyGameState(dateKey, puzzleIndex), JSON.stringify(payload))
  } catch {
    // ignore
  }
}

function clearGameState(dateKey, puzzleIndex) {
  try {
    localStorage.removeItem(storageKeyGameState(dateKey, puzzleIndex))
  } catch {
    // ignore
  }
}

function initFromPuzzle(p) {
  const balls = p.balls.map(([r, c], i) => ({ id: i, row: r, col: c, locked: false }))
  const targets = p.targets.map(([r, c]) => ({ row: r, col: c }))
  const blocks = p.blocks.map(([r, c]) => ({ row: r, col: c }))
  return { balls, targets, blocks }
}

function isBlockAt(blocks, r, c) {
  return blocks.some((b) => b.row === r && b.col === c)
}

function checkSolved(balls, targets) {
  return targets.every((t) => balls.some((b) => b.locked && b.row === t.row && b.col === t.col))
}

function dirFromDelta(dr, dc) {
  if (dr === -1 && dc === 0) return 'up'
  if (dr === 1 && dc === 0) return 'down'
  if (dr === 0 && dc === -1) return 'left'
  if (dr === 0 && dc === 1) return 'right'
  return null
}

function slide(dir, ballsIn, targets, blocks, gridSize) {
  const next = ballsIn.map((b) => ({ ...b }))
  let sorted
  if (dir === 'left') sorted = next.slice().sort((a, b) => a.col - b.col)
  if (dir === 'right') sorted = next.slice().sort((a, b) => b.col - a.col)
  if (dir === 'up') sorted = next.slice().sort((a, b) => a.row - b.row)
  if (dir === 'down') sorted = next.slice().sort((a, b) => b.row - a.row)

  let moved = false
  sorted.forEach((ball) => {
    if (ball.locked) return
    let r = ball.row
    let c = ball.col
    while (true) {
      let nr = r
      let nc = c
      if (dir === 'left') nc--
      if (dir === 'right') nc++
      if (dir === 'up') nr--
      if (dir === 'down') nr++
      if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) break
      if (isBlockAt(blocks, nr, nc)) break
      if (next.some((o) => o.id !== ball.id && o.row === nr && o.col === nc)) break
      r = nr
      c = nc
      if (targets.some((t) => t.row === r && t.col === c)) {
        ball.locked = true
        break
      }
    }
    if (r !== ball.row || c !== ball.col) moved = true
    ball.row = r
    ball.col = c
  })

  return { moved, balls: next }
}

function PuzzleBoxes({
  current,
  completions,
  perfects,
  moveCounts,
  onChange,
  tierSlots = [0, 1, 2],
  doneColor = PUZZLE_SUITE_CORRECT_GREEN,
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {tierSlots.map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: completions[i]
              ? doneColor
              : current === i
                ? PUZZLE_SUITE_INK
                : PUZZLE_SUITE_SURFACE_INCOMPLETE,
            color: completions[i] || current === i ? '#fff' : PUZZLE_SUITE_INK,
            fontWeight: 900,
            fontSize: '1.06rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            transform: current === i ? 'scale(1.1)' : 'scale(1)',
            transformOrigin: 'center center',
          }}
        >
          {completions[i] ? (
            perfects && perfects[i] ? (
              '★'
            ) : moveCounts && moveCounts[i] != null ? (
              String(Math.min(moveCounts[i], MAX_MOVE_DISPLAY))
            ) : (
              '✓'
            )
          ) : i === BONUS_SLOT ? (
            '!'
          ) : (
            <DiceFace count={i + 1} size={20} />
          )}
        </button>
      ))}
    </div>
  )
}

export default function RolyPoly() {
  const chrome = getGameChrome(GAME_KEYS.ROLYPOLY)
  const todayKey = useMemo(() => getDailyKey(), [])
  const [viewingYesterday, setViewingYesterday] = useState(false)
  const daily = useMemo(
    () => getDailyPuzzles(viewingYesterday ? getYesterdayCalendarKey() : todayKey),
    [viewingYesterday, todayKey]
  )
  const progressKey = viewingYesterday ? toPracticeStorageDateKey(daily.key) : daily.key
  const dateLabel = useMemo(
    () => (viewingYesterday ? getYesterdayNavDateLabel(daily.key) : getDateLabel(daily.key)),
    [viewingYesterday, daily.key]
  )
  const roster = useMemo(() => buildTierRoster(puzzleData), [])
  const { curateMode, curateIdx, setCurateIdx, exitCurateHref } = useCurateModeFromRoster(roster)

  const wrapperRef = useRef(null)
  const dailyKeyRef = useRef(daily.key)
  const progressKeyRef = useRef(progressKey)
  const dailyIdxRef = useRef(0)
  const modeRef = useRef('daily')
  const curateModeRef = useRef(false)
  const curateIdxRef = useRef(0)
  const animTimerRef = useRef(null)

  const [mode, setMode] = useState(
    () => getInitialTutorialNav(GAME_KEYS.ROLYPOLY, puzzleData.tutorial ?? []).mode
  )
  const [tutorialIdx, setTutorialIdx] = useState(
    () => getInitialTutorialNav(GAME_KEYS.ROLYPOLY, puzzleData.tutorial ?? []).tutorialIdx
  )
  const [dailyIdx, setDailyIdx] = useState(() =>
    resolveHubDailySlotWithPrefs(
      GAME_KEYS.ROLYPOLY,
      getDailyKey(),
      typeof window !== 'undefined' ? window.location.search : ''
    )
  )
  const suitePrefsEpoch = useSuitePrefsEpoch()
  const [completions, setCompletions] = useState(() => loadCompletions(todayKey))
  const [perfects, setPerfects] = useState(() => loadPerfects(todayKey))
  const [moveCounts, setMoveCounts] = useState(() => loadMoveCounts(todayKey))
  // Today: unlock from live progress. Yesterday practice: only if official day was 3-starred.
  const bonusUnlockKey = viewingYesterday ? daily.key : progressKey
  const bonusUnlocked = useMemo(() => {
    void perfects
    return isBonusUnlocked(GAME_KEYS.ROLYPOLY, bonusUnlockKey)
  }, [bonusUnlockKey, perfects])
  const tierSlots = useMemo(() => {
    void suitePrefsEpoch
    const base = getEnabledTierIndices(GAME_KEYS.ROLYPOLY)
    return bonusUnlocked ? [...base, BONUS_SLOT] : base
  }, [suitePrefsEpoch, bonusUnlocked])
  dailyKeyRef.current = daily.key
  progressKeyRef.current = progressKey
  dailyIdxRef.current = dailyIdx
  modeRef.current = mode
  curateModeRef.current = curateMode
  curateIdxRef.current = curateIdx
  const canShareHub = useMemo(() => {
    void completions
    if (viewingYesterday) return false
    return hasShareableHubProgress(GAME_KEYS.ROLYPOLY, todayKey)
  }, [todayKey, completions, viewingYesterday])

  const [balls, setBalls] = useState([])
  const [targets, setTargets] = useState([])
  const [blocks, setBlocks] = useState([])
  const [history, setHistory] = useState([])
  const [moves, setMoves] = useState(0)
  const [solved, setSolved] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [rollingDir, setRollingDir] = useState(null)
  const [pendingLockIds, setPendingLockIds] = useState(() => new Set())
  const [postSolveCtaAttention, setPostSolveCtaAttention] = useState(false)
  const ballsRef = useRef([])
  const targetsRef = useRef([])
  const blocksRef = useRef([])
  const historyRef = useRef([])
  const movesRef = useRef(0)
  ballsRef.current = balls
  targetsRef.current = targets
  blocksRef.current = blocks
  historyRef.current = history
  movesRef.current = moves
  /** Padding-box cell size — must use clientWidth/Height, not offsetWidth (excludes border). */
  const [cellW, setCellW] = useState(40)
  const [cellH, setCellH] = useState(40)

  const [showLinks, setShowLinks] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [curateCopyHint, setCurateCopyHint] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const allDailyDoneCompletionRef = useRef(null)
  const bonusUnlockedModalRef = useRef(null)
  const bonusCompleteModalRef = useRef(null)
  const completionMarkedRef = useRef(false)

  useEffect(() => {
    setCompletions(loadCompletions(progressKey))
    setPerfects(loadPerfects(progressKey))
    setMoveCounts(loadMoveCounts(progressKey))
    allDailyDoneCompletionRef.current = null
    bonusUnlockedModalRef.current = null
    bonusCompleteModalRef.current = null
  }, [progressKey])

  useEffect(() => {
    if (!solved) completionMarkedRef.current = false
  }, [solved])

  const { hasSeenInstructions, showInstructions, setShowInstructions, closeInstructions } =
    useInstructionsGate('rolypoly:hasSeenInstructions', {
      openOnMount: !curateMode,
      completionStoragePrefix: 'rolypoly',
      initiallyClosed: curateMode,
    })

  const currentPuzzleData = useMemo(() => {
    if (curateMode) return roster[curateIdx]?.puzzle
    if (mode === 'tutorial') return puzzleData.tutorial[tutorialIdx]
    return daily.puzzles[dailyIdx]
  }, [curateMode, curateIdx, roster, mode, tutorialIdx, dailyIdx, daily])

  const gridSize = useMemo(() => getRolyPolyGridSize(currentPuzzleData), [currentPuzzleData])
  const gridSizeRef = useRef(gridSize)
  gridSizeRef.current = gridSize

  const resetFromData = useCallback((data, restore) => {
    if (!data) return
    if (restore?.balls) {
      setBalls(restore.balls.map((b) => ({ ...b })))
      setHistory(restore.history || [])
      setMoves(restore.moves ?? 0)
      setSolved(!!restore.solved)
      const init = initFromPuzzle(data)
      setTargets(init.targets)
      setBlocks(init.blocks)
      return
    }
    const init = initFromPuzzle(data)
    setBalls(init.balls)
    setTargets(init.targets)
    setBlocks(init.blocks)
    setHistory([])
    setMoves(0)
    setSolved(false)
  }, [])

  useEffect(() => {
    if (!curateMode) persistTutorialResumeState(GAME_KEYS.ROLYPOLY, mode, tutorialIdx)
  }, [curateMode, mode, tutorialIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily' || viewingYesterday) return
    persistHubDailySlot(GAME_KEYS.ROLYPOLY, daily.key, dailyIdx)
  }, [curateMode, mode, daily.key, dailyIdx, viewingYesterday])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const c = clampDailyIndexToTierPrefs(
      GAME_KEYS.ROLYPOLY,
      dailyIdx,
      undefined,
      bonusUnlockKey
    )
    if (c !== dailyIdx) setDailyIdx(c)
  }, [curateMode, mode, suitePrefsEpoch, dailyIdx, bonusUnlockKey, bonusUnlocked])

  // useLayoutEffect: puzzle switch must clear `solved` before useEffect (markComplete) runs;
  // otherwise stale solved=true from the previous tier marks the new daily slot complete.
  useLayoutEffect(() => {
    completionMarkedRef.current = false
    const data = currentPuzzleData
    if (!data) return
    if (curateMode) {
      const saved = loadGameState('curate', curateIdx, data)
      if (saved?.balls) {
        resetFromData(data, saved)
        return
      }
    } else if (mode === 'daily') {
      const saved = loadGameState(progressKey, dailyIdx, data)
      if (saved?.balls) {
        resetFromData(data, saved)
        setMoveCounts(loadMoveCounts(progressKey))
        return
      }
    }
    resetFromData(data, null)
    if (mode === 'daily' && !curateMode) setMoveCounts(loadMoveCounts(progressKey))
  }, [currentPuzzleData, curateMode, curateIdx, progressKey, dailyIdx, mode, resetFromData])

  const measureCellLayout = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    const g = gridSizeRef.current
    if (cw > 0 && ch > 0 && g > 0) {
      setCellW(cw / g)
      setCellH(ch / g)
    }
  }, [])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return undefined
    measureCellLayout()
    const ro = new ResizeObserver(measureCellLayout)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measureCellLayout])

  useEffect(() => {
    const id = requestAnimationFrame(() => measureCellLayout())
    return () => cancelAnimationFrame(id)
  }, [currentPuzzleData, measureCellLayout])

  const persistNow = useCallback(
    (b, h, m, sol) => {
      const data = currentPuzzleData
      if (!data) return
      if (curateMode) saveGameState('curate', curateIdx, data, b, h, m, sol)
      else if (mode === 'daily') saveGameState(progressKey, dailyIdx, data, b, h, m, sol)
    },
    [currentPuzzleData, curateMode, curateIdx, progressKey, dailyIdx, mode]
  )

  const applyPlaybackStep = useCallback(
    (dr, dc) => {
      if (!currentPuzzleData) return { ok: false }
      const dir = dirFromDelta(dr, dc)
      if (!dir) return { ok: false }
      const ballsNow = ballsRef.current
      const targetsNow = targetsRef.current
      const blocksNow = blocksRef.current
      const { moved, balls: nb } = slide(dir, ballsNow, targetsNow, blocksNow, gridSizeRef.current)
      if (!moved) return { ok: false }

      const newlyLocked = new Set(
        nb
          .filter((b) => b.locked && !ballsNow.find((ob) => ob.id === b.id).locked)
          .map((b) => b.id)
      )
      const snap = ballsNow.map((x) => ({ ...x }))
      const newHist = [...historyRef.current, { balls: snap, moves: movesRef.current }]
      const newMoves = movesRef.current + 1
      const done = checkSolved(nb, targetsNow)

      ballsRef.current = nb
      historyRef.current = newHist
      movesRef.current = newMoves

      setHistory(newHist)
      setMoves(newMoves)
      setIsAnimating(true)
      setRollingDir(dir)
      setPendingLockIds(newlyLocked)
      setBalls(nb)
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
      animTimerRef.current = window.setTimeout(() => {
        setIsAnimating(false)
        setRollingDir(null)
        setPendingLockIds(new Set())
        if (done) {
          setSolved(true)
          setPostSolveCtaAttention(true)
        }
        persistNow(nb, newHist, newMoves, done)
      }, ROLYPOLY_ANIM_MS)
      return { ok: true, done }
    },
    [currentPuzzleData, persistNow]
  )

  const {
    playbackStatus,
    playbackButtonLabel,
    playbackButtonEnabled,
    togglePlayback,
    noteManualInteraction,
    stopPlayback,
  } = useCurateSolutionPlayback({
    active: curateMode || viewingYesterday,
    solution: currentPuzzleData?.solution ?? '',
    resetKey: curateMode ? curateIdx : `${progressKey}:${dailyIdx}`,
    isInitial: history.length === 0,
    onStep: applyPlaybackStep,
    intervalMs: ROLYPOLY_ANIM_MS + 80,
  })

  const runSlide = useCallback(
    (dir) => {
      if (isAnimating || solved || !currentPuzzleData) return
      noteManualInteraction()
      const { moved, balls: nb } = slide(dir, balls, targets, blocks, gridSize)
      if (!moved) return
      const newlyLocked = new Set(
        nb.filter((b) => b.locked && !balls.find((ob) => ob.id === b.id).locked).map((b) => b.id)
      )
      const snap = balls.map((x) => ({ ...x }))
      const newHist = [...history, { balls: snap, moves }]
      const newMoves = moves + 1
      setHistory(newHist)
      setMoves(newMoves)
      setIsAnimating(true)
      setRollingDir(dir)
      setPendingLockIds(newlyLocked)
      setBalls(nb)
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
      animTimerRef.current = window.setTimeout(() => {
        setIsAnimating(false)
        setRollingDir(null)
        setPendingLockIds(new Set())
        const done = checkSolved(nb, targets)
        if (done) {
          setSolved(true)
          setPostSolveCtaAttention(true)
        }
        persistNow(nb, newHist, newMoves, done)
      }, ROLYPOLY_ANIM_MS)
    },
    [
      balls,
      targets,
      blocks,
      history,
      moves,
      isAnimating,
      solved,
      currentPuzzleData,
      persistNow,
      gridSize,
      noteManualInteraction,
    ]
  )

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (
      !solved ||
      curateMode ||
      mode !== 'daily' ||
      !currentPuzzleData ||
      completionMarkedRef.current
    )
      return
    // Use targets from puzzle data, not React state: after "Next puzzle", one frame can still
    // hold the previous tier's balls+targets while dailyIdx already points at the next tier —
    // checkSolved(oldBalls, oldTargets) would still be true and wrongly mark the new slot.
    const { targets: puzzleTargets } = initFromPuzzle(currentPuzzleData)
    if (!checkSolved(balls, puzzleTargets)) return
    completionMarkedRef.current = true
    markComplete(progressKey, dailyIdx, moves, getRolyPolyParMoves(currentPuzzleData))
    if (dailyIdx === BONUS_SLOT && !viewingYesterday) {
      finalizeBonusGameTimer(GAME_KEYS.ROLYPOLY, todayKey)
    }
    setCompletions(loadCompletions(progressKey))
    setPerfects(loadPerfects(progressKey))
    setMoveCounts(loadMoveCounts(progressKey))
  }, [
    solved,
    curateMode,
    mode,
    progressKey,
    dailyIdx,
    moves,
    currentPuzzleData,
    balls,
    viewingYesterday,
    todayKey,
  ])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const done = isSuiteCompleteForPrefs(GAME_KEYS.ROLYPOLY, progressKey)
    const unlocked = isBonusUnlocked(GAME_KEYS.ROLYPOLY, bonusUnlockKey)
    const bonusDoneNow = !!completions[BONUS_SLOT]

    const primed =
      allDailyDoneCompletionRef.current !== null &&
      bonusUnlockedModalRef.current !== null &&
      bonusCompleteModalRef.current !== null

    if (primed) {
      const lateBonusUnlock =
        unlocked && !bonusUnlockedModalRef.current && allDailyDoneCompletionRef.current === true
      const suiteJustFinished = done && !allDailyDoneCompletionRef.current
      const bonusJustFinished = bonusDoneNow && !bonusCompleteModalRef.current
      if (lateBonusUnlock || suiteJustFinished || bonusJustFinished) {
        window.setTimeout(() => setShowCompletionModal(true), ROLYPOLY_SUITE_MODAL_MS)
      }
    }

    allDailyDoneCompletionRef.current = done
    bonusUnlockedModalRef.current = unlocked
    bonusCompleteModalRef.current = bonusDoneNow
  }, [curateMode, mode, completions, perfects, progressKey, bonusUnlockKey, suitePrefsEpoch])

  const suiteDone = isSuiteCompleteForPrefs(GAME_KEYS.ROLYPOLY, progressKey)
  const bonusDone = !!completions[BONUS_SLOT]
  const primaryLabel = solved
    ? curateMode
      ? curateIdx < roster.length - 1
        ? CTA_LABELS.NEXT_PUZZLE
        : null
      : mode === 'tutorial'
        ? tutorialIdx < puzzleData.tutorial.length - 1
          ? CTA_LABELS.NEXT_PUZZLE
          : CTA_LABELS.PLAY_TODAY
        : suiteDone
          ? bonusUnlocked && !bonusDone
            ? CTA_LABELS.BONUS_PUZZLE
            : CTA_LABELS.ALL_PUZZLES
          : CTA_LABELS.NEXT_PUZZLE
    : null

  useSuiteCompletionTimer(GAME_KEYS.ROLYPOLY, todayKey, {
    countingUnsolvedPuzzle:
      !curateMode &&
      mode === 'daily' &&
      !viewingYesterday &&
      dailyIdx !== BONUS_SLOT &&
      !completions[dailyIdx] &&
      !solved,
  })

  useBonusCompletionTimer(GAME_KEYS.ROLYPOLY, todayKey, {
    countingUnsolvedBonus:
      !curateMode &&
      mode === 'daily' &&
      !viewingYesterday &&
      dailyIdx === BONUS_SLOT &&
      !completions[BONUS_SLOT] &&
      !solved,
  })

  useEffect(() => {
    if (!solved) setPostSolveCtaAttention(false)
  }, [solved])

  const handleUndo = useCallback(() => {
    if (history.length === 0 || isAnimating) return
    noteManualInteraction()
    const prev = history[history.length - 1]
    const newHist = history.slice(0, -1)
    setBalls(prev.balls.map((x) => ({ ...x })))
    setMoves(prev.moves)
    setHistory(newHist)
    setSolved(false)
    setRollingDir(null)
    setPendingLockIds(new Set())
    const data = currentPuzzleData
    if (data) {
      if (curateMode)
        saveGameState('curate', curateIdx, data, prev.balls, newHist, prev.moves, false)
      else if (mode === 'daily')
        saveGameState(progressKey, dailyIdx, data, prev.balls, newHist, prev.moves, false)
    }
  }, [
    history,
    isAnimating,
    currentPuzzleData,
    curateMode,
    curateIdx,
    progressKey,
    dailyIdx,
    mode,
    noteManualInteraction,
  ])

  const handleReset = useCallback(() => {
    if (!currentPuzzleData) return
    stopPlayback()
    if (animTimerRef.current) clearTimeout(animTimerRef.current)
    setIsAnimating(false)
    setRollingDir(null)
    setPendingLockIds(new Set())
    resetFromData(currentPuzzleData, null)
    if (curateMode) clearGameState('curate', curateIdx)
    else if (mode === 'daily') clearGameState(progressKey, dailyIdx)
  }, [
    currentPuzzleData,
    resetFromData,
    curateMode,
    curateIdx,
    progressKey,
    dailyIdx,
    mode,
    stopPlayback,
  ])

  const base = import.meta.env.BASE_URL

  const handlePrimary = () => {
    if (curateMode) {
      if (curateIdx < roster.length - 1) setCurateIdx((j) => j + 1)
      return
    }
    if (mode === 'tutorial') {
      if (tutorialIdx < puzzleData.tutorial.length - 1) setTutorialIdx((i) => i + 1)
      else {
        setViewingYesterday(false)
        setMode('daily')
        setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.ROLYPOLY, 0, undefined, progressKey))
      }
    } else if (
      isSuiteCompleteForPrefs(GAME_KEYS.ROLYPOLY, progressKey) &&
      isBonusUnlocked(GAME_KEYS.ROLYPOLY, bonusUnlockKey) &&
      !completions[BONUS_SLOT]
    ) {
      setSolved(false)
      setDailyIdx(BONUS_SLOT)
    } else {
      const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.ROLYPOLY, progressKey, dailyIdx)
      if (next !== null) {
        setSolved(false)
        setDailyIdx(next)
      }
    }
  }

  const exitYesterdayToToday = useCallback(() => {
    setShowCompletionModal(false)
    setViewingYesterday(false)
    setMode('daily')
    setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.ROLYPOLY, 0, undefined, todayKey))
  }, [todayKey])

  const goToBonusPuzzle = useCallback(() => {
    setShowCompletionModal(false)
    setMode('daily')
    setSolved(false)
    setDailyIdx(BONUS_SLOT)
  }, [])

  const handleToggleYesterday = useCallback(() => {
    setShowCompletionModal(false)
    setViewingYesterday((was) => {
      const next = !was
      if (next) {
        setMode('daily')
        const pk = toPracticeStorageDateKey(getYesterdayCalendarKey())
        const first = nextIncompleteEnabledTierExcluding(GAME_KEYS.ROLYPOLY, pk, -1)
        setDailyIdx(first ?? clampDailyIndexToTierPrefs(GAME_KEYS.ROLYPOLY, 0, undefined, pk))
      } else {
        setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.ROLYPOLY, 0, undefined, todayKey))
      }
      return next
    })
  }, [todayKey])

  const handleStatsClick = useCallback(() => {
    if (curateMode) {
      const entry = roster[curateIdx]
      const p = currentPuzzleData
      if (!entry || !p) return
      const text = formatCurateClipboard('rolypoly', entry.tier, entry.indexInTier + 1, p, 200)
      void navigator.clipboard.writeText(text).then(
        () => {
          setCurateCopyHint('Copied puzzle id')
          window.setTimeout(() => setCurateCopyHint(null), 2500)
        },
        () => {
          setCurateCopyHint('Copy failed')
          window.setTimeout(() => setCurateCopyHint(null), 2500)
        }
      )
      return
    }
    setShowStats(true)
  }, [curateMode, roster, curateIdx, currentPuzzleData])

  useEffect(() => {
    const onKey = (e) => {
      if (isKeyboardUndo(e)) {
        e.preventDefault()
        handleUndo()
        return
      }
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
      if (map[e.key]) {
        e.preventDefault()
        runSlide(map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runSlide, handleUndo])

  const pointerIdRef = useRef(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const onPointerDown = (e) => {
    if (e.button !== 0) return
    pointerIdRef.current = e.pointerId
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }
  const finishPointerSlide = (clientX, clientY) => {
    const dx = clientX - dragStartRef.current.x
    const dy = clientY - dragStartRef.current.y
    if (Math.hypot(dx, dy) < 40) return
    if (Math.abs(dx) >= Math.abs(dy)) runSlide(dx > 0 ? 'right' : 'left')
    else runSlide(dy > 0 ? 'down' : 'up')
  }
  const onPointerUp = (e) => {
    if (e.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    finishPointerSlide(e.clientX, e.clientY)
  }

  const gridCells = useMemo(() => {
    const cells = []
    for (let r = 0; r < gridSize; r++)
      for (let c = 0; c < gridSize; c++) {
        const isT = targets.some((t) => t.row === r && t.col === c)
        const isB = blocks.some((b) => b.row === r && b.col === c)
        cells.push({ r, c, isT, isB })
      }
    return cells
  }, [targets, blocks, gridSize])

  return (
    <div className="game-container rolypoly-game">
      <style>{`
        .rolypoly-game {
          --rolypoly-black: #000000;
          --rolypoly-green: #16a34a;
          font-family: Outfit, system-ui, sans-serif;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
        }
        .rolypoly-game .game-stage {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 10px 0;
          flex-grow: 1;
          flex-shrink: 1;
          min-height: 0;
        }
        .rolypoly-game #rolypoly-canvas-wrap {
          width: 100%;
          aspect-ratio: 1 / 1;
          position: relative;
          margin: 0 auto;
          background: #fff;
          border: 2px solid #0a0a0a;
          min-width: 280px;
          touch-action: none;
          cursor: default;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
        }
        /* iOS paints tap highlight on the hit target; grid cells were the target. Pass touches
           through to #rolypoly-canvas-wrap (pointer handlers stay on the wrap). */
        .rolypoly-game .grid-overlay,
        .rolypoly-game .grid-line {
          pointer-events: none;
        }
        .rolypoly-game .grid-overlay {
          position: absolute;
          inset: 0;
          display: grid;
          width: 100%;
          height: 100%;
        }
        .rolypoly-game .grid-line {
          border: 1px solid rgba(0,0,0,0.1);
          box-sizing: border-box;
          position: relative;
        }
        .rolypoly-game .grid-line.target { background: #ffea80; }
        .rolypoly-game .grid-line.block { background: var(--rolypoly-black); }
        .rolypoly-game .ball-layer {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          will-change: left, top;
          transition: left 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
            top 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .rolypoly-game .bug-svg {
          width: 92%;
          height: 92%;
          display: block;
        }
        @keyframes rolypoly-rollFlip {
          0%, 49%   { transform: scaleY(1); }
          50%, 100% { transform: scaleY(-1); }
        }
        @keyframes rolypoly-rollFlipLR {
          0%, 49%   { transform: rotate(90deg) scaleY(1); }
          50%, 100% { transform: rotate(90deg) scaleY(-1); }
        }
        .rolypoly-game .bug-svg.rolling-ud { animation: rolypoly-rollFlip   0.18s steps(1) infinite; }
        .rolypoly-game .bug-svg.rolling-lr { animation: rolypoly-rollFlipLR 0.18s steps(1) infinite; }
        .rolypoly-game .stats-num.at-par { color: var(--rolypoly-green); }
      `}</style>

      <TopBar
        title={chrome.title}
        onHome={() => {
          window.location.href = base
        }}
        onCube={() => setShowLinks(true)}
        linksViaTitleOnly
        puzzleChrome={{
          gameKey: GAME_KEYS.ROLYPOLY,
          onStats: handleStatsClick,
          onHelp: () => setShowInstructions(true),
          onTutorial: () => {
            setViewingYesterday(false)
            setMode('tutorial')
            setTutorialIdx(0)
          },
          hasTutorial: (puzzleData.tutorial?.length ?? 0) > 0,
          showYesterdayToggle: !curateMode && mode === 'daily',
          viewingYesterday,
          onToggleYesterday: handleToggleYesterday,
        }}
      />

      <CurateCopyToast message={curateCopyHint} />

      {curateMode ? (
        <CurateLevelNav
          exitCurateHref={exitCurateHref}
          curateIdx={curateIdx}
          setCurateIdx={setCurateIdx}
          roster={roster}
          puzzleData={puzzleData}
          metricsSlot={
            <>
              <span className="stats-label">Moves</span>
              <span className="stats-num">{Math.min(moves, MAX_MOVE_DISPLAY)}</span>
              <span className="stats-label">{`min=${getRolyPolyParMoves(currentPuzzleData) ?? '?'}`}</span>
            </>
          }
          rightSlot={
            <button
              type="button"
              className="skip-link"
              disabled={!playbackButtonEnabled}
              onClick={togglePlayback}
            >
              {playbackButtonLabel}
            </button>
          }
        />
      ) : mode === 'tutorial' ? (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Moves</span>
            <span className="stats-num">{Math.min(moves, MAX_MOVE_DISPLAY)}</span>
            <span className="stats-label">{`min=${getRolyPolyParMoves(currentPuzzleData) ?? '?'}`}</span>
          </div>
          <div className="selector-group">
            <button
              type="button"
              className={`nav-arrow ${tutorialIdx === 0 ? 'disabled' : ''}`}
              onClick={() => {
                if (tutorialIdx > 0) setTutorialIdx((i) => i - 1)
              }}
            >
              ←
            </button>
            <div className="level-label">
              <span className="sub">Tutorial</span>
              <span className="num">{tutorialIdx + 1}</span>
            </div>
            <button
              type="button"
              className={`nav-arrow ${tutorialIdx === puzzleData.tutorial.length - 1 ? 'disabled' : ''}`}
              onClick={() => {
                if (tutorialIdx < puzzleData.tutorial.length - 1) setTutorialIdx((i) => i + 1)
              }}
            >
              →
            </button>
          </div>
          <div className="level-nav__right-slot">
            <button
              type="button"
              className="skip-link"
              onClick={() => {
                setMode('daily')
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.ROLYPOLY, 0, undefined, todayKey))
              }}
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      ) : (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Moves</span>
            <span
              className={`stats-num${solved && moves <= (getRolyPolyParMoves(currentPuzzleData) ?? 999) ? ' at-par' : ''}`}
            >
              {Math.min(moves, MAX_MOVE_DISPLAY)}
            </span>
            <span className="stats-label">{`min=${getRolyPolyParMoves(currentPuzzleData) ?? '?'}`}</span>
          </div>
          <div className="selector-group" style={{ flexDirection: 'column', gap: '4px' }}>
            <div className="level-label" style={{ textAlign: 'center' }}>
              <span className="sub">{dateLabel}</span>
            </div>
            <div
              className="game-dice-share-anchor"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <PuzzleBoxes
                current={dailyIdx}
                completions={completions}
                perfects={perfects}
                moveCounts={moveCounts}
                onChange={setDailyIdx}
                tierSlots={tierSlots}
                doneColor={viewingYesterday ? PUZZLE_SUITE_PRACTICE_BLUE : PUZZLE_SUITE_CORRECT_GREEN}
              />
            </div>
          </div>
          <div className="level-nav__right-slot">
            {viewingYesterday ? (
              <YesterdaySolutionNavButton
                playbackEnabled={playbackButtonEnabled}
                playbackStatus={playbackStatus}
                onTogglePlayback={togglePlayback}
                onReset={handleReset}
                canReset={history.length > 0}
              />
            ) : (
              <GameShareNavButton
                gameKey={GAME_KEYS.ROLYPOLY}
                dateKey={todayKey}
                canShare={canShareHub}
              />
            )}
          </div>
        </div>
      )}

      <div className="game-stage">
        <div
          id="rolypoly-canvas-wrap"
          ref={wrapperRef}
          style={{
            maxWidth: `min(460px, calc(100dvh - 300px), ${gridSize * ROLYPOLY_MAX_CELL_PX}px)`,
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            pointerIdRef.current = null
          }}
        >
          <div
            className="grid-overlay"
            aria-hidden
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            }}
          >
            {gridCells.map(({ r, c, isT, isB }) => (
              <div
                key={`${r}-${c}`}
                className={`grid-line${isT ? ' target' : ''}${isB ? ' block' : ''}`}
              />
            ))}
          </div>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {balls.map((b) => {
              const isRolling = rollingDir !== null && (!b.locked || pendingLockIds.has(b.id))
              const useRolled = isRolling
              const isLR = rollingDir === 'left' || rollingDir === 'right'
              const rollingClass = isRolling ? (isLR ? ' rolling-lr' : ' rolling-ud') : ''
              return (
                <div
                  key={b.id}
                  className="ball-layer"
                  style={{
                    width: cellW,
                    height: cellH,
                    left: b.col * cellW,
                    top: b.row * cellH,
                  }}
                >
                  <div
                    className={`bug-svg${rollingClass}`}
                    dangerouslySetInnerHTML={{ __html: useRolled ? SVG_ROLLED : SVG_UNROLLED }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="button-tray" style={{ marginTop: '16px' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleUndo}
          disabled={history.length === 0 || isAnimating}
        >
          Undo
        </button>
        <SmartRightButton
          primaryLabel={primaryLabel}
          primaryHref={
            primaryLabel === CTA_LABELS.ALL_PUZZLES || primaryLabel === CTA_LABELS.ALL_PUZZLES_UPPER
              ? base
              : undefined
          }
          onPrimaryClick={handlePrimary}
          attention={postSolveCtaAttention}
          resetDisabled={history.length === 0}
          onReset={handleReset}
        />
      </div>

      <SharedModalShell
        show={showInstructions}
        onClose={closeInstructions}
        intent={MODAL_INTENTS.INSTRUCTIONS}
      >
        <h1 className="title" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          Roly Poly
        </h1>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <RolyPolyIcon size={80} />
          </div>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            Use the <b>arrow keys</b> or <b>swipe on the board</b> to slide all bugs in a direction.
            Bugs stop at the edge, a black block, or another bug. A bug on a <b>yellow target</b>{' '}
            locks in place.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!hasSeenInstructions ? (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  closeInstructions()
                  setMode('tutorial')
                  setTutorialIdx(0)
                }}
              >
                {CTA_LABELS.PLAY_TUTORIAL}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  closeInstructions()
                  setMode('daily')
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.ROLYPOLY, 0, undefined, todayKey))
                }}
              >
                {CTA_LABELS.SKIP_TUTORIAL}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                closeInstructions()
                setMode('daily')
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.ROLYPOLY, 0, undefined, todayKey))
              }}
            >
              {CTA_LABELS.PLAY_TODAYS_PUZZLES_UPPER}
            </button>
          )}
        </div>
      </SharedModalShell>

      <PlaygroundLinksModal show={showLinks} onClose={() => setShowLinks(false)} />
      <SimpleGameStatsModal
        show={showStats}
        onClose={() => setShowStats(false)}
        gameKey={GAME_KEYS.ROLYPOLY}
        dailySuiteFooter={{
          dateKey: todayKey,
          completions: viewingYesterday ? loadCompletions(todayKey) : completions,
          perfects: viewingYesterday ? loadPerfects(todayKey) : perfects,
          moveCounts: viewingYesterday ? loadMoveCounts(todayKey) : moveCounts,
        }}
      />
      <SuiteGameCompletionModal
        show={showCompletionModal && !curateMode}
        onClose={() => setShowCompletionModal(false)}
        gameKey={GAME_KEYS.ROLYPOLY}
        dateKey={daily.key}
        hubDiceCompletions={completions}
        hubDicePerfects={perfects}
        hubDiceMoveCounts={moveCounts}
        practiceMode={viewingYesterday}
        onTodaysPuzzle={exitYesterdayToToday}
        bonusUnlocked={bonusUnlocked}
        bonusComplete={bonusDone}
        onBonusPuzzle={goToBonusPuzzle}
      />
    </div>
  )
}

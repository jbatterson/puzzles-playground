import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { SVG_UNROLLED } from '../../src/shared/icons/swipeBugUnrolledSvg.js'
import { SVG_ROLLED } from '../../src/shared/icons/swipeBugRolledSvg.js'
import puzzleData from './puzzles.js'
import TopBar from '../../src/shared/TopBar.jsx'
import DiceFace from '../../src/shared/DiceFace.jsx'
import SharedModalShell from '../../src/shared/SharedModalShell.jsx'
import SimpleGameStatsModal from '../../src/shared/SimpleGameStatsModal.jsx'
import SuiteGameCompletionModal from '../../src/shared/SuiteGameCompletionModal.jsx'
import useSuiteCompletionTimer from '../../src/shared/useSuiteCompletionTimer.js'
import PlaygroundLinksModal from '../../src/shared/PlaygroundLinksModal.jsx'
import useInstructionsGate from '../../src/shared/useInstructionsGate.js'
import { MODAL_INTENTS } from '@shared-contracts/modalIntents.js'
import { GAME_KEYS, getGameChrome } from '@shared-contracts/gameChrome.js'
import { PUZZLE_SUITE_INK, PUZZLE_SUITE_SURFACE_INCOMPLETE } from '@shared-contracts/chromeUi.js'
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
import SwipeIcon from '../../src/shared/icons/SwipeIcon.jsx'
import { buildTierRoster, formatCurateClipboard } from '../../src/shared/curateRoster.js'
import { useCurateModeFromRoster } from '../../src/shared/useCurateMode.js'
import { CurateCopyToast, CurateLevelNav } from '../../src/shared/CurateModeChrome.jsx'
import SmartRightButton from '../../src/shared/SmartRightButton.jsx'
import { getDailyKey, getDateLabel, getDayIndex } from '@shared-contracts/dailyPuzzleDate.js'

const DEFAULT_SWIPE_GRID = 7
/** Match productiles/sumtiles board cell cap so small grids do not overscale. */
const SWIPE_MAX_CELL_PX = 80
const SWIPE_ANIM_MS = 520
const SWIPE_SUITE_MODAL_MS = 500
const MAX_MOVE_DISPLAY = 99

const SWIPE_TUTORIAL_HINT =
  'Use arrow keys or swipes to slide every bug onto a yellow target. Bugs lock when they land on a target.'

function getDailyPuzzles() {
  const key = getDailyKey()
  const dayIndex = getDayIndex(key)
  const easy = puzzleData.easy || []
  const medium = puzzleData.medium || []
  const hard = puzzleData.hard || []
  return {
    puzzles: [
      easy[dayIndex % easy.length],
      medium[dayIndex % medium.length],
      hard[dayIndex % hard.length],
    ],
    key,
  }
}

function loadCompletions(dateKey) {
  return [0, 1, 2].map((i) => ['1', '2'].includes(localStorage.getItem(`swipe:${dateKey}:${i}`)))
}

function loadPerfects(dateKey) {
  return [0, 1, 2].map((i) => localStorage.getItem(`swipe:${dateKey}:${i}`) === '2')
}

function getStoredMoveCount(dateKey, idx) {
  const v = localStorage.getItem(`swipe:${dateKey}:${idx}:moves`)
  return v != null ? parseInt(v, 10) : null
}

function markComplete(dateKey, idx, movesThisRun, puzzleMinMoves) {
  const hitMin =
    puzzleMinMoves != null && Number.isFinite(puzzleMinMoves) && movesThisRun === puzzleMinMoves
  const starWorthy = hitMin
  const key = `swipe:${dateKey}:${idx}`
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
  localStorage.setItem(`swipe:${dateKey}:${idx}:moves`, String(Math.min(moves, MAX_MOVE_DISPLAY)))
}

function loadMoveCounts(dateKey) {
  return [0, 1, 2].map((i) => {
    const v = localStorage.getItem(`swipe:${dateKey}:${i}:moves`)
    return v != null ? parseInt(v, 10) : null
  })
}

const GAME_STATE_VERSION = 1

function storageKeyGameState(dateKey, puzzleIndex) {
  return `swipe:${dateKey}:${puzzleIndex}:gameState`
}

function getSwipeGridSize(data) {
  if (!data || typeof data !== 'object') return DEFAULT_SWIPE_GRID
  const s = data.size
  if (Number.isFinite(s) && s >= 3 && s <= 16) return Math.trunc(s)
  return DEFAULT_SWIPE_GRID
}

function getSwipeParMoves(p) {
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
    sz: getSwipeGridSize(data),
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
              ? '#6b9b3b'
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
          ) : (
            <DiceFace count={i + 1} size={20} />
          )}
        </button>
      ))}
    </div>
  )
}

export default function Swipe() {
  const chrome = getGameChrome(GAME_KEYS.SWIPE)
  const daily = useMemo(() => getDailyPuzzles(), [])
  const dateLabel = useMemo(() => getDateLabel(daily.key), [daily.key])
  const roster = useMemo(() => buildTierRoster(puzzleData), [])
  const { curateMode, curateIdx, setCurateIdx, exitCurateHref } = useCurateModeFromRoster(roster)

  const wrapperRef = useRef(null)
  const dailyKeyRef = useRef(daily.key)
  const dailyIdxRef = useRef(0)
  const modeRef = useRef('daily')
  const curateModeRef = useRef(false)
  const curateIdxRef = useRef(0)
  const animTimerRef = useRef(null)

  const [mode, setMode] = useState(
    () => getInitialTutorialNav(GAME_KEYS.SWIPE, puzzleData.tutorial ?? []).mode
  )
  const [tutorialIdx, setTutorialIdx] = useState(
    () => getInitialTutorialNav(GAME_KEYS.SWIPE, puzzleData.tutorial ?? []).tutorialIdx
  )
  const [dailyIdx, setDailyIdx] = useState(() =>
    resolveHubDailySlotWithPrefs(
      GAME_KEYS.SWIPE,
      getDailyKey(),
      typeof window !== 'undefined' ? window.location.search : ''
    )
  )
  const suitePrefsEpoch = useSuitePrefsEpoch()
  const tierSlots = useMemo(() => {
    void suitePrefsEpoch
    return getEnabledTierIndices(GAME_KEYS.SWIPE)
  }, [suitePrefsEpoch])
  dailyKeyRef.current = daily.key
  dailyIdxRef.current = dailyIdx
  modeRef.current = mode
  curateModeRef.current = curateMode
  curateIdxRef.current = curateIdx

  const [completions, setCompletions] = useState(() => loadCompletions(daily.key))
  const [perfects, setPerfects] = useState(() => loadPerfects(daily.key))
  const [moveCounts, setMoveCounts] = useState(() => loadMoveCounts(daily.key))
  const canShareHub = useMemo(() => {
    void completions
    return hasShareableHubProgress(GAME_KEYS.SWIPE, daily.key)
  }, [daily.key, completions])

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
  /** Padding-box cell size — must use clientWidth/Height, not offsetWidth (excludes border). */
  const [cellW, setCellW] = useState(40)
  const [cellH, setCellH] = useState(40)

  const [showLinks, setShowLinks] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [curateCopyHint, setCurateCopyHint] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const allDailyDoneCompletionRef = useRef(null)
  const completionMarkedRef = useRef(false)

  useEffect(() => {
    if (!solved) completionMarkedRef.current = false
  }, [solved])

  const { hasSeenInstructions, showInstructions, setShowInstructions, closeInstructions } =
    useInstructionsGate('swipe:hasSeenInstructions', {
      openOnMount: !curateMode,
      completionStoragePrefix: 'swipe',
      initiallyClosed: curateMode,
    })

  const currentPuzzleData = useMemo(() => {
    if (curateMode) return roster[curateIdx]?.puzzle
    if (mode === 'tutorial') return puzzleData.tutorial[tutorialIdx]
    return daily.puzzles[dailyIdx]
  }, [curateMode, curateIdx, roster, mode, tutorialIdx, dailyIdx, daily])

  const gridSize = useMemo(() => getSwipeGridSize(currentPuzzleData), [currentPuzzleData])
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
    if (!curateMode) persistTutorialResumeState(GAME_KEYS.SWIPE, mode, tutorialIdx)
  }, [curateMode, mode, tutorialIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    persistHubDailySlot(GAME_KEYS.SWIPE, daily.key, dailyIdx)
  }, [curateMode, mode, daily.key, dailyIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const c = clampDailyIndexToTierPrefs(GAME_KEYS.SWIPE, dailyIdx)
    if (c !== dailyIdx) setDailyIdx(c)
  }, [curateMode, mode, suitePrefsEpoch, dailyIdx])

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
      const saved = loadGameState(daily.key, dailyIdx, data)
      if (saved?.balls) {
        resetFromData(data, saved)
        setMoveCounts(loadMoveCounts(daily.key))
        return
      }
    }
    resetFromData(data, null)
    if (mode === 'daily' && !curateMode) setMoveCounts(loadMoveCounts(daily.key))
  }, [currentPuzzleData, curateMode, curateIdx, daily.key, dailyIdx, mode, resetFromData])

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
      else if (mode === 'daily') saveGameState(daily.key, dailyIdx, data, b, h, m, sol)
    },
    [currentPuzzleData, curateMode, curateIdx, daily.key, dailyIdx, mode]
  )

  const runSlide = useCallback(
    (dir) => {
      if (isAnimating || solved || !currentPuzzleData) return
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
      }, SWIPE_ANIM_MS)
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
    markComplete(daily.key, dailyIdx, moves, getSwipeParMoves(currentPuzzleData))
    setCompletions(loadCompletions(daily.key))
    setPerfects(loadPerfects(daily.key))
    setMoveCounts(loadMoveCounts(daily.key))
    clearGameState(daily.key, dailyIdx)
  }, [solved, curateMode, mode, daily.key, dailyIdx, moves, currentPuzzleData, balls])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const done = isSuiteCompleteForPrefs(GAME_KEYS.SWIPE, daily.key)
    if (allDailyDoneCompletionRef.current === null) {
      allDailyDoneCompletionRef.current = done
      return
    }
    if (done && !allDailyDoneCompletionRef.current) {
      window.setTimeout(() => setShowCompletionModal(true), SWIPE_SUITE_MODAL_MS)
    }
    allDailyDoneCompletionRef.current = done
  }, [curateMode, mode, completions, daily.key, suitePrefsEpoch])

  const suiteDone = isSuiteCompleteForPrefs(GAME_KEYS.SWIPE, daily.key)
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
          ? CTA_LABELS.ALL_PUZZLES
          : CTA_LABELS.NEXT_PUZZLE
    : null

  useSuiteCompletionTimer(GAME_KEYS.SWIPE, daily.key, {
    track: !curateMode && mode === 'daily',
    alreadyFullyComplete: isSuiteCompleteForPrefs(GAME_KEYS.SWIPE, daily.key),
    pauseForHubCompleteCta:
      primaryLabel === CTA_LABELS.ALL_PUZZLES || primaryLabel === CTA_LABELS.NEXT_PUZZLE,
  })

  useEffect(() => {
    if (!solved) setPostSolveCtaAttention(false)
  }, [solved])

  const handleUndo = useCallback(() => {
    if (history.length === 0 || isAnimating) return
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
        saveGameState(daily.key, dailyIdx, data, prev.balls, newHist, prev.moves, false)
    }
  }, [history, isAnimating, currentPuzzleData, curateMode, curateIdx, daily.key, dailyIdx, mode])

  const handleReset = useCallback(() => {
    if (!currentPuzzleData) return
    setRollingDir(null)
    setPendingLockIds(new Set())
    resetFromData(currentPuzzleData, null)
    if (curateMode) clearGameState('curate', curateIdx)
    else if (mode === 'daily') clearGameState(daily.key, dailyIdx)
  }, [currentPuzzleData, resetFromData, curateMode, curateIdx, daily.key, dailyIdx, mode])

  const base = import.meta.env.BASE_URL

  const handlePrimary = () => {
    if (curateMode) {
      if (curateIdx < roster.length - 1) setCurateIdx((j) => j + 1)
      return
    }
    if (mode === 'tutorial') {
      if (tutorialIdx < puzzleData.tutorial.length - 1) setTutorialIdx((i) => i + 1)
      else {
        setMode('daily')
        setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SWIPE, 0))
      }
    } else {
      const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.SWIPE, daily.key, dailyIdx)
      if (next !== null) {
        setSolved(false)
        setDailyIdx(next)
      }
    }
  }

  const handleStatsClick = useCallback(() => {
    if (curateMode) {
      const entry = roster[curateIdx]
      const p = currentPuzzleData
      if (!entry || !p) return
      const text = formatCurateClipboard('swipe', entry.tier, entry.indexInTier + 1, p, 200)
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
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
      if (map[e.key]) {
        e.preventDefault()
        runSlide(map[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runSlide])

  const swipePtr = useRef(null)
  const swipeStart = useRef({ x: 0, y: 0 })
  const onPointerDown = (e) => {
    if (e.button !== 0) return
    swipePtr.current = e.pointerId
    swipeStart.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }
  const finishSwipe = (clientX, clientY) => {
    const dx = clientX - swipeStart.current.x
    const dy = clientY - swipeStart.current.y
    if (Math.hypot(dx, dy) < 40) return
    if (Math.abs(dx) >= Math.abs(dy)) runSlide(dx > 0 ? 'right' : 'left')
    else runSlide(dy > 0 ? 'down' : 'up')
  }
  const onPointerUp = (e) => {
    if (e.pointerId !== swipePtr.current) return
    swipePtr.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    finishSwipe(e.clientX, e.clientY)
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
    <div className="game-container swipe-game">
      <style>{`
        .swipe-game {
          --swipe-black: #000000;
          --swipe-green: #16a34a;
          font-family: Outfit, system-ui, sans-serif;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
        }
        .swipe-game .game-stage {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 10px 0;
          flex-grow: 1;
          flex-shrink: 1;
          min-height: 0;
        }
        .swipe-game #swipe-canvas-wrap {
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
           through to #swipe-canvas-wrap (pointer handlers stay on the wrap). */
        .swipe-game .grid-overlay,
        .swipe-game .grid-line {
          pointer-events: none;
        }
        .swipe-game .grid-overlay {
          position: absolute;
          inset: 0;
          display: grid;
          width: 100%;
          height: 100%;
        }
        .swipe-game .grid-line {
          border: 1px solid rgba(0,0,0,0.1);
          box-sizing: border-box;
          position: relative;
        }
        .swipe-game .grid-line.target { background: #ffea80; }
        .swipe-game .grid-line.block { background: var(--swipe-black); }
        .swipe-game .ball-layer {
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          will-change: left, top;
          transition: left 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94),
            top 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .swipe-game .bug-svg {
          width: 92%;
          height: 92%;
          display: block;
        }
        @keyframes swipe-rollFlip {
          0%, 49%   { transform: scaleY(1); }
          50%, 100% { transform: scaleY(-1); }
        }
        @keyframes swipe-rollFlipLR {
          0%, 49%   { transform: rotate(90deg) scaleY(1); }
          50%, 100% { transform: rotate(90deg) scaleY(-1); }
        }
        .swipe-game .bug-svg.rolling-ud { animation: swipe-rollFlip   0.18s steps(1) infinite; }
        .swipe-game .bug-svg.rolling-lr { animation: swipe-rollFlipLR 0.18s steps(1) infinite; }
        .swipe-game .stats-num.at-par { color: var(--swipe-green); }
      `}</style>

      <TopBar
        title={chrome.title}
        onHome={() => {
          window.location.href = base
        }}
        onCube={() => setShowLinks(true)}
        linksViaTitleOnly
        puzzleChrome={{
          gameKey: GAME_KEYS.SWIPE,
          onStats: handleStatsClick,
          onHelp: () => setShowInstructions(true),
          onTutorial: () => {
            setMode('tutorial')
            setTutorialIdx(0)
          },
          hasTutorial: (puzzleData.tutorial?.length ?? 0) > 0,
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
              <span className="stats-label">{`min=${getSwipeParMoves(currentPuzzleData) ?? '?'}`}</span>
            </>
          }
        />
      ) : mode === 'tutorial' ? (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Moves</span>
            <span className="stats-num">{Math.min(moves, MAX_MOVE_DISPLAY)}</span>
            <span className="stats-label">{`min=${getSwipeParMoves(currentPuzzleData) ?? '?'}`}</span>
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SWIPE, 0))
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
              className={`stats-num${solved && moves <= (getSwipeParMoves(currentPuzzleData) ?? 999) ? ' at-par' : ''}`}
            >
              {Math.min(moves, MAX_MOVE_DISPLAY)}
            </span>
            <span className="stats-label">{`min=${getSwipeParMoves(currentPuzzleData) ?? '?'}`}</span>
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
              />
            </div>
          </div>
          <div className="level-nav__right-slot">
            <GameShareNavButton
              gameKey={GAME_KEYS.SWIPE}
              dateKey={daily.key}
              canShare={canShareHub}
            />
          </div>
        </div>
      )}

      <div className="game-stage">
        <div
          id="swipe-canvas-wrap"
          ref={wrapperRef}
          style={{
            maxWidth: `min(460px, calc(100dvh - 300px), ${gridSize * SWIPE_MAX_CELL_PX}px)`,
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            swipePtr.current = null
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
          primaryHref={primaryLabel === CTA_LABELS.ALL_PUZZLES ? base : undefined}
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
            <SwipeIcon size={80} />
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
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SWIPE, 0))
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SWIPE, 0))
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
        gameKey={GAME_KEYS.SWIPE}
        dailySuiteFooter={{
          dateKey: daily.key,
          completions,
          perfects,
          moveCounts,
        }}
      />
      <SuiteGameCompletionModal
        show={showCompletionModal && !curateMode}
        onClose={() => setShowCompletionModal(false)}
        gameKey={GAME_KEYS.SWIPE}
        dateKey={daily.key}
        hubDiceCompletions={completions}
        hubDicePerfects={perfects}
        hubDiceMoveCounts={moveCounts}
      />
    </div>
  )
}

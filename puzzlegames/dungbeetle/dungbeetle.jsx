import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import rawPuzzleData from './puzzles.js'
import {
  DEFAULT_SIZE,
  clone,
  normalizePuzzleInput,
  getParPushes,
  pieceAtIn,
  pieceTypeClass,
  tryMove,
  checkWon,
  puzzleFingerprint,
  initPlayState,
} from './engine.js'
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
import DungBeetleIcon from '../../src/shared/icons/DungBeetleIcon.jsx'
import { buildTierRoster, formatCurateClipboard } from '../../src/shared/curateRoster.js'
import { useCurateModeFromRoster } from '../../src/shared/useCurateMode.js'
import { CurateCopyToast, CurateLevelNav } from '../../src/shared/CurateModeChrome.jsx'
import SmartRightButton from '../../src/shared/SmartRightButton.jsx'
import { getDailyKey, getDateLabel, getDayIndex } from '@shared-contracts/dailyPuzzleDate.js'

const DUNGBEETLE_MAX_CELL_PX = 80
const DUNGBEETLE_SUITE_MODAL_MS = 500
const MAX_PUSH_DISPLAY = 99
const SWIPE_THRESHOLD_PX = 36
/** Dominant axis must beat the other by this ratio so diagonal flicks don't pick the wrong way. */
const SWIPE_AXIS_RATIO = 1.2

const BEETLE_SVG = `<svg viewBox="0 0 28 28" aria-hidden="true">
  <path d="M10 6 Q 8 2 6 4" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M18 6 Q 20 2 22 4" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  <g stroke="#000" stroke-width="1.5" stroke-linecap="round">
    <line x1="8" y1="12" x2="3" y2="10"/><line x1="7" y1="16" x2="2" y2="16"/><line x1="8" y1="20" x2="3" y2="22"/>
    <line x1="20" y1="12" x2="25" y2="10"/><line x1="21" y1="16" x2="26" y2="16"/><line x1="20" y1="20" x2="25" y2="22"/>
  </g>
  <circle cx="14" cy="16" r="9" fill="#FF3B30" stroke="#000" stroke-width="1"/>
  <path d="M8 13 A 7 7 0 0 1 20 13" fill="#000"/>
  <circle cx="11" cy="17" r="1.5" fill="white"/>
  <circle cx="17" cy="17" r="1.5" fill="white"/>
</svg>`

function normalizeTier(data) {
  const out = {}
  for (const tier of ['tutorial', 'easy', 'medium', 'hard']) {
    out[tier] = (data[tier] || []).map((p) => normalizePuzzleInput(p, true))
  }
  return out
}

const puzzleData = normalizeTier(rawPuzzleData)

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
  return [0, 1, 2].map((i) => ['1', '2'].includes(localStorage.getItem(`dungbeetle:${dateKey}:${i}`)))
}

function loadPerfects(dateKey) {
  return [0, 1, 2].map((i) => localStorage.getItem(`dungbeetle:${dateKey}:${i}`) === '2')
}

function getStoredPushCount(dateKey, idx) {
  const v = localStorage.getItem(`dungbeetle:${dateKey}:${idx}:moves`)
  return v != null ? parseInt(v, 10) : null
}

function savePushCount(dateKey, idx, pushes) {
  localStorage.setItem(`dungbeetle:${dateKey}:${idx}:moves`, String(Math.min(pushes, MAX_PUSH_DISPLAY)))
}

function markComplete(dateKey, idx, pushesThisRun, puzzleMinPushes) {
  const hitMin =
    puzzleMinPushes != null && Number.isFinite(puzzleMinPushes) && pushesThisRun === puzzleMinPushes
  const starWorthy = hitMin
  const key = `dungbeetle:${dateKey}:${idx}`
  const existing = localStorage.getItem(key)
  const storedPushes = getStoredPushCount(dateKey, idx)
  if (existing !== '1' && existing !== '2') {
    localStorage.setItem(key, starWorthy ? '2' : '1')
    savePushCount(dateKey, idx, pushesThisRun)
  } else if (storedPushes != null && pushesThisRun < storedPushes) {
    localStorage.setItem(key, starWorthy ? '2' : '1')
    savePushCount(dateKey, idx, pushesThisRun)
  } else if (existing === '1' && hitMin) {
    localStorage.setItem(key, '2')
  }
}

function loadMoveCounts(dateKey) {
  return [0, 1, 2].map((i) => {
    const v = localStorage.getItem(`dungbeetle:${dateKey}:${i}:moves`)
    return v != null ? parseInt(v, 10) : null
  })
}

const GAME_STATE_VERSION = 1

function storageKeyGameState(dateKey, puzzleIndex) {
  return `dungbeetle:${dateKey}:${puzzleIndex}:gameState`
}

function loadGameState(dateKey, puzzleIndex, data) {
  try {
    const raw = localStorage.getItem(storageKeyGameState(dateKey, puzzleIndex))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== GAME_STATE_VERSION) return null
    if (parsed.fp !== puzzleFingerprint(data)) return null
    if (!Array.isArray(parsed.pieces) || !Array.isArray(parsed.history)) return null
    if (!parsed.player || !parsed.ball) return null
    return parsed
  } catch {
    return null
  }
}

function saveGameState(dateKey, puzzleIndex, data, play, history, pushes, solved) {
  try {
    if (!data || !play) return
    const payload = {
      version: GAME_STATE_VERSION,
      fp: puzzleFingerprint(data),
      pieces: play.pieces,
      player: play.player,
      ball: play.ball,
      history,
      pushes,
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
              String(Math.min(moveCounts[i], MAX_PUSH_DISPLAY))
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

export default function DungBeetle() {
  const chrome = getGameChrome(GAME_KEYS.DUNGBEETLE)
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

  const [mode, setMode] = useState(
    () => getInitialTutorialNav(GAME_KEYS.DUNGBEETLE, puzzleData.tutorial ?? []).mode
  )
  const [tutorialIdx, setTutorialIdx] = useState(
    () => getInitialTutorialNav(GAME_KEYS.DUNGBEETLE, puzzleData.tutorial ?? []).tutorialIdx
  )
  const [dailyIdx, setDailyIdx] = useState(() =>
    resolveHubDailySlotWithPrefs(
      GAME_KEYS.DUNGBEETLE,
      getDailyKey(),
      typeof window !== 'undefined' ? window.location.search : ''
    )
  )
  const suitePrefsEpoch = useSuitePrefsEpoch()
  const tierSlots = useMemo(() => {
    void suitePrefsEpoch
    return getEnabledTierIndices(GAME_KEYS.DUNGBEETLE)
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
    return hasShareableHubProgress(GAME_KEYS.DUNGBEETLE, daily.key)
  }, [daily.key, completions])

  const [play, setPlay] = useState(null)
  const [history, setHistory] = useState([])
  const [pushes, setPushes] = useState(0)
  const [solved, setSolved] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [postSolveCtaAttention, setPostSolveCtaAttention] = useState(false)
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
    useInstructionsGate('dungbeetle:hasSeenInstructions', {
      openOnMount: !curateMode,
      completionStoragePrefix: 'dungbeetle',
      initiallyClosed: curateMode,
    })

  const currentPuzzleData = useMemo(() => {
    if (curateMode) return roster[curateIdx]?.puzzle
    if (mode === 'tutorial') return puzzleData.tutorial[tutorialIdx]
    return daily.puzzles[dailyIdx]
  }, [curateMode, curateIdx, roster, mode, tutorialIdx, dailyIdx, daily])

  const gridSize = currentPuzzleData?.size ?? DEFAULT_SIZE
  const gridSizeRef = useRef(gridSize)
  gridSizeRef.current = gridSize

  const resetFromData = useCallback((data, restore) => {
    if (!data) return
    if (restore?.pieces && restore?.player && restore?.ball) {
      setPlay({
        pieces: clone(restore.pieces),
        player: clone(restore.player),
        ball: clone(restore.ball),
        target: clone(data.target),
        size: data.size ?? DEFAULT_SIZE,
      })
      setHistory(restore.history || [])
      setPushes(restore.pushes ?? 0)
      setSolved(!!restore.solved)
      setCelebrating(!!restore.solved)
      return
    }
    setPlay(initPlayState(data))
    setHistory([])
    setPushes(0)
    setSolved(false)
    setCelebrating(false)
  }, [])

  useEffect(() => {
    if (!curateMode) persistTutorialResumeState(GAME_KEYS.DUNGBEETLE, mode, tutorialIdx)
  }, [curateMode, mode, tutorialIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    persistHubDailySlot(GAME_KEYS.DUNGBEETLE, daily.key, dailyIdx)
  }, [curateMode, mode, daily.key, dailyIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const c = clampDailyIndexToTierPrefs(GAME_KEYS.DUNGBEETLE, dailyIdx)
    if (c !== dailyIdx) setDailyIdx(c)
  }, [curateMode, mode, suitePrefsEpoch, dailyIdx])

  useLayoutEffect(() => {
    completionMarkedRef.current = false
    const data = currentPuzzleData
    if (!data) return
    if (curateMode) {
      const saved = loadGameState('curate', curateIdx, data)
      if (saved?.pieces) {
        resetFromData(data, saved)
        return
      }
    } else if (mode === 'daily') {
      const saved = loadGameState(daily.key, dailyIdx, data)
      if (saved?.pieces) {
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
    (p, h, pushCount, sol) => {
      const data = currentPuzzleData
      if (!data) return
      if (curateMode) saveGameState('curate', curateIdx, data, p, h, pushCount, sol)
      else if (mode === 'daily') saveGameState(daily.key, dailyIdx, data, p, h, pushCount, sol)
    },
    [currentPuzzleData, curateMode, curateIdx, daily.key, dailyIdx, mode]
  )

  const applyDirection = useCallback(
    (dr, dc) => {
      if (solved || !play || !currentPuzzleData) return
      const result = tryMove(play, dr, dc)
      if (!result.ok) return

      const snap = clone(play)
      const newHist = [...history, { play: snap, pushes }]
      const newPushes = result.pushedTetromino ? pushes + 1 : pushes
      const nextPlay = result.state
      const done = checkWon(nextPlay)

      setHistory(newHist)
      setPushes(newPushes)
      setPlay(nextPlay)

      if (done) {
        setSolved(true)
        setCelebrating(true)
        setPostSolveCtaAttention(true)
      }
      persistNow(nextPlay, newHist, newPushes, done)
    },
    [solved, play, currentPuzzleData, history, pushes, persistNow]
  )

  useEffect(() => {
    if (
      !solved ||
      curateMode ||
      mode !== 'daily' ||
      !currentPuzzleData ||
      !play ||
      completionMarkedRef.current
    )
      return
    // Guard against stale play from a previous tier during puzzle switches.
    if (
      play.target.r !== currentPuzzleData.target.r ||
      play.target.c !== currentPuzzleData.target.c
    )
      return
    if (
      play.ball.r !== currentPuzzleData.target.r ||
      play.ball.c !== currentPuzzleData.target.c
    )
      return
    completionMarkedRef.current = true
    markComplete(daily.key, dailyIdx, pushes, getParPushes(currentPuzzleData))
    setCompletions(loadCompletions(daily.key))
    setPerfects(loadPerfects(daily.key))
    setMoveCounts(loadMoveCounts(daily.key))
    clearGameState(daily.key, dailyIdx)
  }, [solved, curateMode, mode, daily.key, dailyIdx, pushes, currentPuzzleData, play])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const done = isSuiteCompleteForPrefs(GAME_KEYS.DUNGBEETLE, daily.key)
    if (allDailyDoneCompletionRef.current === null) {
      allDailyDoneCompletionRef.current = done
      return
    }
    if (done && !allDailyDoneCompletionRef.current) {
      window.setTimeout(() => setShowCompletionModal(true), DUNGBEETLE_SUITE_MODAL_MS)
    }
    allDailyDoneCompletionRef.current = done
  }, [curateMode, mode, completions, daily.key, suitePrefsEpoch])

  const suiteDone = isSuiteCompleteForPrefs(GAME_KEYS.DUNGBEETLE, daily.key)
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

  useSuiteCompletionTimer(GAME_KEYS.DUNGBEETLE, daily.key, {
    track: !curateMode && mode === 'daily',
    alreadyFullyComplete: isSuiteCompleteForPrefs(GAME_KEYS.DUNGBEETLE, daily.key),
    pauseForHubCompleteCta:
      primaryLabel === CTA_LABELS.ALL_PUZZLES || primaryLabel === CTA_LABELS.NEXT_PUZZLE,
  })

  useEffect(() => {
    if (!solved) setPostSolveCtaAttention(false)
  }, [solved])

  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    const newHist = history.slice(0, -1)
    setPlay(clone(prev.play))
    setPushes(prev.pushes)
    setHistory(newHist)
    setSolved(false)
    setCelebrating(false)
    const data = currentPuzzleData
    if (data) {
      if (curateMode)
        saveGameState('curate', curateIdx, data, prev.play, newHist, prev.pushes, false)
      else if (mode === 'daily')
        saveGameState(daily.key, dailyIdx, data, prev.play, newHist, prev.pushes, false)
    }
  }, [history, currentPuzzleData, curateMode, curateIdx, daily.key, dailyIdx, mode])

  const handleReset = useCallback(() => {
    if (!currentPuzzleData) return
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
        setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.DUNGBEETLE, 0))
      }
    } else {
      const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.DUNGBEETLE, daily.key, dailyIdx)
      if (next !== null) {
        setSolved(false)
        setCelebrating(false)
        setDailyIdx(next)
      }
    }
  }

  const handleStatsClick = useCallback(() => {
    if (curateMode) {
      const entry = roster[curateIdx]
      const p = currentPuzzleData
      if (!entry || !p) return
      const text = formatCurateClipboard('dungbeetle', entry.tier, entry.indexInTier + 1, p, 200)
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
      const map = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
        w: [-1, 0],
        W: [-1, 0],
        s: [1, 0],
        S: [1, 0],
        a: [0, -1],
        A: [0, -1],
        d: [0, 1],
        D: [0, 1],
      }
      if (map[e.key]) {
        e.preventDefault()
        const [dr, dc] = map[e.key]
        applyDirection(dr, dc)
      } else if (e.key.toLowerCase() === 'u') {
        handleUndo()
      } else if (e.key.toLowerCase() === 'r') {
        handleReset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [applyDirection, handleUndo, handleReset])

  const pointerIdRef = useRef(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const swipeCommittedRef = useRef(false)

  const tryCommitSwipe = (clientX, clientY) => {
    if (!play || swipeCommittedRef.current) return false
    const dx = clientX - dragStartRef.current.x
    const dy = clientY - dragStartRef.current.y
    const dist = Math.hypot(dx, dy)
    if (dist < SWIPE_THRESHOLD_PX) return false

    const adx = Math.abs(dx)
    const ady = Math.abs(dy)
    const dominant = Math.max(adx, ady)
    const other = Math.min(adx, ady)
    // Hold off on near-diagonals until one axis clearly wins.
    if (other > 0 && dominant / other < SWIPE_AXIS_RATIO) return false

    swipeCommittedRef.current = true
    if (adx >= ady) applyDirection(0, dx > 0 ? 1 : -1)
    else applyDirection(dy > 0 ? 1 : -1, 0)
    return true
  }

  const tryAdjacentTap = (clientX, clientY) => {
    if (!play) return
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const g = gridSizeRef.current
    const c = Math.floor((clientX - rect.left) / (rect.width / g))
    const r = Math.floor((clientY - rect.top) / (rect.height / g))
    const dr = r - play.player.r
    const dc = c - play.player.c
    if (Math.abs(dr) + Math.abs(dc) === 1) applyDirection(dr, dc)
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    pointerIdRef.current = e.pointerId
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    swipeCommittedRef.current = false
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const onPointerMove = (e) => {
    if (e.pointerId !== pointerIdRef.current) return
    tryCommitSwipe(e.clientX, e.clientY)
  }

  const onPointerUp = (e) => {
    if (e.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    if (swipeCommittedRef.current) return
    if (tryCommitSwipe(e.clientX, e.clientY)) return
    // Short press: step into an orthogonally adjacent cell (no d-pad).
    tryAdjacentTap(e.clientX, e.clientY)
  }

  const onPointerCancel = () => {
    pointerIdRef.current = null
    swipeCommittedRef.current = false
  }

  const targetCovered =
    play && pieceAtIn(play.pieces, play.target.r, play.target.c) !== -1

  const parPushes = getParPushes(currentPuzzleData)
  const pushesDisplay = Math.min(pushes, MAX_PUSH_DISPLAY)

  return (
    <div className="game-container dungbeetle-game">
      <style>{`
        .dungbeetle-game {
          --db-ink: #111;
          --db-green: #16a34a;
          --db-yellow: #f4c542;
          --db-blue: #6bb6d9;
          --db-piece-green: #77ba74;
          --db-purple: #b67ac6;
          --db-orange: #e98a52;
          font-family: Outfit, system-ui, sans-serif;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
        }
        .dungbeetle-game .game-stage {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 10px 0;
          flex-grow: 1;
          flex-shrink: 1;
          min-height: 0;
        }
        .dungbeetle-game #dungbeetle-canvas-wrap {
          width: 100%;
          aspect-ratio: 1 / 1;
          position: relative;
          margin: 0 auto;
          background: #fff;
          border: 2px solid #0a0a0a;
          min-width: 280px;
          touch-action: none;
          cursor: default;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
        }
        .dungbeetle-game .grid-overlay,
        .dungbeetle-game .grid-line {
          pointer-events: none;
        }
        .dungbeetle-game .grid-overlay {
          position: absolute;
          inset: 0;
          display: grid;
          width: 100%;
          height: 100%;
        }
        .dungbeetle-game .grid-line {
          border-right: 1.5px solid #bbb;
          border-bottom: 1.5px solid #bbb;
          box-sizing: border-box;
          position: relative;
          background: #fff;
        }
        .dungbeetle-game .grid-line.target::after {
          content: "";
          position: absolute;
          inset: 24%;
          border-radius: 50%;
          background: #2b211b;
          box-shadow: inset 0 0 0 5px rgba(0,0,0,.18);
          z-index: 1;
        }
        .dungbeetle-game .piece-block {
          position: absolute;
          border: 3px solid var(--db-ink);
          z-index: 3;
          box-sizing: border-box;
          transition: left 90ms linear, top 90ms linear;
          pointer-events: none;
        }
        .dungbeetle-game .piece-block::after {
          content: "";
          position: absolute;
          inset: 6px;
          border: 2px solid rgba(255,255,255,.42);
          pointer-events: none;
        }
        .dungbeetle-game .piece-I { background: var(--db-blue); }
        .dungbeetle-game .piece-L { background: var(--db-orange); }
        .dungbeetle-game .piece-O { background: var(--db-yellow); }
        .dungbeetle-game .piece-S { background: var(--db-piece-green); }
        .dungbeetle-game .piece-T { background: var(--db-purple); }
        .dungbeetle-game .piece-unknown { background: #9da7b1; }
        .dungbeetle-game .dung-ball {
          position: absolute;
          border-radius: 50%;
          background: #6b4b2f;
          border: 3px solid var(--db-ink);
          z-index: 7;
          box-shadow: inset -7px -7px 0 rgba(0,0,0,.10);
          transition: left 90ms linear, top 90ms linear;
          pointer-events: none;
        }
        .dungbeetle-game .hole-overlay {
          position: absolute;
          border-radius: 50%;
          background: #2b211b;
          box-shadow: inset 0 0 0 5px rgba(0,0,0,.18);
          opacity: .22;
          z-index: 6;
          pointer-events: none;
        }
        .dungbeetle-game .player-layer {
          position: absolute;
          z-index: 8;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: left 90ms linear, top 90ms linear;
          pointer-events: none;
          transform-origin: 50% 55%;
        }
        .dungbeetle-game .player-layer svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        @keyframes dungbeetle-celebrate {
          0%   { transform: rotate(0deg) scale(1); }
          15%  { transform: rotate(-14deg) scale(1.06); }
          30%  { transform: rotate(14deg) scale(1.06); }
          45%  { transform: rotate(-11deg) scale(1.05); }
          60%  { transform: rotate(11deg) scale(1.05); }
          75%  { transform: rotate(-6deg) scale(1.03); }
          90%  { transform: rotate(6deg) scale(1.02); }
          100% { transform: rotate(0deg) scale(1); }
        }
        .dungbeetle-game .player-layer.celebrating {
          animation: dungbeetle-celebrate 700ms ease-in-out 1;
        }
        .dungbeetle-game .stats-num.at-par { color: var(--db-green); }
      `}</style>

      <TopBar
        title={chrome.title}
        onHome={() => {
          window.location.href = base
        }}
        onCube={() => setShowLinks(true)}
        linksViaTitleOnly
        puzzleChrome={{
          gameKey: GAME_KEYS.DUNGBEETLE,
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
              <span className="stats-label">Pushes</span>
              <span className="stats-num">{pushesDisplay}</span>
              <span className="stats-label">{`min=${parPushes ?? '?'}`}</span>
            </>
          }
        />
      ) : mode === 'tutorial' ? (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Pushes</span>
            <span className="stats-num">{pushesDisplay}</span>
            <span className="stats-label">{`min=${parPushes ?? '?'}`}</span>
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.DUNGBEETLE, 0))
              }}
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      ) : (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Pushes</span>
            <span
              className={`stats-num${solved && pushes <= (parPushes ?? 999) ? ' at-par' : ''}`}
            >
              {pushesDisplay}
            </span>
            <span className="stats-label">{`min=${parPushes ?? '?'}`}</span>
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
              gameKey={GAME_KEYS.DUNGBEETLE}
              dateKey={daily.key}
              canShare={canShareHub}
            />
          </div>
        </div>
      )}

      <div className="game-stage">
        <div
          id="dungbeetle-canvas-wrap"
          ref={wrapperRef}
          style={{
            maxWidth: `min(460px, calc(100dvh - 300px), ${gridSize * DUNGBEETLE_MAX_CELL_PX}px)`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div
            className="grid-overlay"
            aria-hidden
            style={{
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            }}
          >
            {Array.from({ length: gridSize * gridSize }, (_, i) => {
              const r = Math.floor(i / gridSize)
              const c = i % gridSize
              const isTarget = play && play.target.r === r && play.target.c === c
              const edgeRight = c === gridSize - 1
              const edgeBottom = r === gridSize - 1
              return (
                <div
                  key={`${r}-${c}`}
                  className={`grid-line${isTarget ? ' target' : ''}`}
                  style={{
                    borderRight: edgeRight ? 'none' : undefined,
                    borderBottom: edgeBottom ? 'none' : undefined,
                  }}
                />
              )
            })}
          </div>

          {play && (
            <>
              {play.pieces.map((piece, pi) =>
                piece.cells.map((cell, ci) => (
                  <div
                    key={`p${pi}-${ci}`}
                    className={`piece-block ${pieceTypeClass(piece)}`}
                    style={{
                      width: cellW,
                      height: cellH,
                      left: cell.c * cellW,
                      top: cell.r * cellH,
                    }}
                  />
                ))
              )}

              {targetCovered && (
                <div
                  className="hole-overlay"
                  style={{
                    width: cellW * 0.55,
                    height: cellH * 0.55,
                    left: play.target.c * cellW + (cellW - cellW * 0.55) / 2,
                    top: play.target.r * cellH + (cellH - cellH * 0.55) / 2,
                  }}
                />
              )}

              <div
                className="dung-ball"
                style={{
                  width: Math.min(56, cellW * 0.7),
                  height: Math.min(56, cellH * 0.7),
                  left: play.ball.c * cellW + (cellW - Math.min(56, cellW * 0.7)) / 2,
                  top: play.ball.r * cellH + (cellH - Math.min(56, cellH * 0.7)) / 2,
                }}
              />

              <div
                className={`player-layer${celebrating ? ' celebrating' : ''}`}
                style={{
                  width: Math.min(62, cellW * 0.78),
                  height: Math.min(62, cellH * 0.78),
                  left: play.player.c * cellW + (cellW - Math.min(62, cellW * 0.78)) / 2,
                  top: play.player.r * cellH + (cellH - Math.min(62, cellH * 0.78)) / 2,
                }}
                dangerouslySetInnerHTML={{ __html: BEETLE_SVG }}
              />
            </>
          )}
        </div>
      </div>

      <div className="button-tray" style={{ marginTop: '16px' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleUndo}
          disabled={history.length === 0}
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
          Dung Beetle
        </h1>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <DungBeetleIcon size={80} />
          </div>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            Roll the brown dung ball into the hole. Walk with <b>arrow keys</b>/<b>WASD</b> or{' '}
            <b>swipe on the board</b>. Push tetrominoes (each counts as a push). Pushing the ball is
            free.
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
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.DUNGBEETLE, 0))
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.DUNGBEETLE, 0))
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
        gameKey={GAME_KEYS.DUNGBEETLE}
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
        gameKey={GAME_KEYS.DUNGBEETLE}
        dateKey={daily.key}
        hubDiceCompletions={completions}
        hubDicePerfects={perfects}
        hubDiceMoveCounts={moveCounts}
      />
    </div>
  )
}

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import puzzleData from './puzzles.js'
import { applyScurryDailyPresentation } from './scurryDailyPresentation.js'
import TopBar from '../../src/shared/TopBar.jsx'
import DiceFace from '../../src/shared/DiceFace.jsx'
import SharedModalShell from '../../src/shared/SharedModalShell.jsx'
import SimpleGameStatsModal from '../../src/shared/SimpleGameStatsModal.jsx'
import SuiteGameCompletionModal from '../../src/shared/SuiteGameCompletionModal.jsx'
import useSuiteCompletionTimer from '../../src/shared/useSuiteCompletionTimer.js'
import AllTenLinksModal from '../../src/shared/AllTenLinksModal.jsx'
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
import BugIconPuzzle from '../../src/shared/icons/BugIconPuzzle.jsx'
import DismissibleHintToast from '../../src/shared/DismissibleHintToast.jsx'
import { buildTierRoster, formatCurateClipboard } from '../../src/shared/curateRoster.js'
import { useCurateModeFromRoster } from '../../src/shared/useCurateMode.js'
import { CurateCopyToast, CurateLevelNav } from '../../src/shared/CurateModeChrome.jsx'
import SmartRightButton from '../../src/shared/SmartRightButton.jsx'
import { getDailyKey, getDateLabel, getDayIndex } from '@shared-contracts/dailyPuzzleDate.js'

/** After the last winning placement: 300ms pre-celebration + 800ms `celebrating-bug` (see `placeBug`). */
const SCURRY_SUITE_MODAL_AFTER_WIN_MS = 300 + 800 + 150
/** Bottom CTA text pulse starts after settle + celebration (see `placeBug` timeouts). */
const SCURRY_POST_WIN_CTA_PULSE_MS = 500 + 300 + 800 + 50

const SCURRY_TUTORIAL_HINTS = [
  {
    idx: 0,
    message:
      'Tap a yellow square to place a bug in it.\nThe bug on the grid will scurry one square away.',
  },
  {
    idx: 1,
    message: 'This puzzle takes 2 bugs to solve.\nTry to get all bugs into the target squares.',
  },
  {
    idx: 3,
    message: 'One bug can push two bugs into target squares.',
  },
  {
    idx: 4,
    message: 'Use what you learned in the last puzzle to help you solve this one.',
  },
  {
    idx: 6,
    message: 'Bugs do not need to be placed next to other bugs.',
  },
  {
    idx: 8,
    message: 'If two bugs are side-by-side, pushing one into the other will move them both.',
  },
  {
    idx: 9,
    message: 'On daily puzzles, earn a ★ by solving without using an Undo or Reset.',
  },
]

// ── Daily puzzle selection ───────────────────────────────────────────────────

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

// ── Completion tracking ──────────────────────────────────────────────────────
function loadCompletions(dateKey) {
  return [0, 1, 2].map((i) => ['1', '2'].includes(localStorage.getItem(`scurry:${dateKey}:${i}`)))
}

function loadPerfects(dateKey) {
  return [0, 1, 2].map((i) => localStorage.getItem(`scurry:${dateKey}:${i}`) === '2')
}

function markComplete(dateKey, idx, isPerfect) {
  const key = `scurry:${dateKey}:${idx}`
  const existing = localStorage.getItem(key)
  if (existing === '1' || existing === '2') return
  localStorage.setItem(key, isPerfect ? '2' : '1')
}

function scurryWipKey(dateKey, idx) {
  return `scurry:${dateKey}:${idx}:wip`
}

function scurryLevelFingerprint(level) {
  if (!level) return ''
  return JSON.stringify({ t: level.targets, p: level.prePlaced, m: level.maxBugs })
}

function clearScurryWip(dateKey, idx) {
  try {
    localStorage.removeItem(scurryWipKey(dateKey, idx))
  } catch {
    // ignore
  }
}

function loadScurryWip(dateKey, idx, level) {
  const fp = scurryLevelFingerprint(level)
  if (!fp) return null
  try {
    const raw = localStorage.getItem(scurryWipKey(dateKey, idx))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (
      !d ||
      d.v !== 1 ||
      d.fp !== fp ||
      !Array.isArray(d.bugs) ||
      typeof d.bugsPlacedCount !== 'number' ||
      !Array.isArray(d.history)
    ) {
      return null
    }
    return { bugs: d.bugs, bugsPlacedCount: d.bugsPlacedCount, history: d.history }
  } catch {
    return null
  }
}

function saveScurryWip(dateKey, idx, level, bugs, bugsPlacedCount, history) {
  const fp = scurryLevelFingerprint(level)
  if (!fp) return
  try {
    localStorage.setItem(
      scurryWipKey(dateKey, idx),
      JSON.stringify({ v: 1, fp, bugs, bugsPlacedCount, history })
    )
  } catch {
    // ignore
  }
}

// ── Bug component ────────────────────────────────────────────────────────────
const Bug = ({ isMoving, isFalling, isCelebrating, size = 42 }) => (
  <div className={`${isFalling ? 'falling-bug' : ''} ${isCelebrating ? 'celebrating-bug' : ''}`}>
    <BugIconPuzzle size={size} className={isMoving ? 'moving-bug' : ''} />
  </div>
)

// ── Puzzle number boxes ──────────────────────────────────────────────────────
function PuzzleBoxes({ current, completions, perfects, onChange, tierSlots = [0, 1, 2] }) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {tierSlots.map((i) => (
        <button
          key={i}
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

// ── Main component ───────────────────────────────────────────────────────────
const Scurry = () => {
  const chrome = getGameChrome(GAME_KEYS.SCURRY)
  const daily = useMemo(() => getDailyPuzzles(), [])
  const dateLabel = useMemo(() => getDateLabel(daily.key), [daily.key])
  const roster = useMemo(() => buildTierRoster(puzzleData), [])
  const { curateMode, curateIdx, setCurateIdx, exitCurateHref } = useCurateModeFromRoster(roster)

  const usedUndoOrResetRef = useRef(false)
  const [mode, setMode] = useState(
    () => getInitialTutorialNav(GAME_KEYS.SCURRY, puzzleData.tutorial ?? []).mode
  )
  const [tutorialIdx, setTutorialIdx] = useState(
    () => getInitialTutorialNav(GAME_KEYS.SCURRY, puzzleData.tutorial ?? []).tutorialIdx
  )
  const [dailyIdx, setDailyIdx] = useState(() =>
    resolveHubDailySlotWithPrefs(
      GAME_KEYS.SCURRY,
      getDailyKey(),
      typeof window !== 'undefined' ? window.location.search : ''
    )
  )
  const suitePrefsEpoch = useSuitePrefsEpoch()
  const tierSlots = useMemo(() => {
    void suitePrefsEpoch
    return getEnabledTierIndices(GAME_KEYS.SCURRY)
  }, [suitePrefsEpoch])
  const [completions, setCompletions] = useState(() => loadCompletions(daily.key))
  const [perfects, setPerfects] = useState(() => loadPerfects(daily.key))
  const canShareHub = useMemo(
    () => hasShareableHubProgress(GAME_KEYS.SCURRY, daily.key),
    [daily.key, completions]
  )
  const { hasSeenInstructions, showInstructions, setShowInstructions, closeInstructions } =
    useInstructionsGate('scurry:hasSeenInstructions', {
      openOnMount: !curateMode,
      completionStoragePrefix: 'scurry',
      initiallyClosed: curateMode,
    })
  const [showLinks, setShowLinks] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [curateCopyHint, setCurateCopyHint] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const allDailyDoneCompletionRef = useRef(null)

  const [tutorialHintsDismissed, setTutorialHintsDismissed] = useState(() =>
    Object.fromEntries(SCURRY_TUTORIAL_HINTS.map(({ idx }) => [idx, false]))
  )

  useEffect(() => {
    if (!curateMode) persistTutorialResumeState(GAME_KEYS.SCURRY, mode, tutorialIdx)
  }, [curateMode, mode, tutorialIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    persistHubDailySlot(GAME_KEYS.SCURRY, daily.key, dailyIdx)
  }, [curateMode, mode, daily.key, dailyIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const c = clampDailyIndexToTierPrefs(GAME_KEYS.SCURRY, dailyIdx)
    if (c !== dailyIdx) setDailyIdx(c)
  }, [curateMode, mode, suitePrefsEpoch, dailyIdx])

  const [bugs, setBugs] = useState([])
  const [bugsPlacedCount, setBugsPlacedCount] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [scurryPostWinCtaAttention, setScurryPostWinCtaAttention] = useState(false)
  const [history, setHistory] = useState([])

  const level = useMemo(() => {
    if (curateMode) return roster[curateIdx]?.puzzle
    if (mode === 'tutorial') return puzzleData.tutorial[tutorialIdx]
    const raw = daily.puzzles[dailyIdx]
    return applyScurryDailyPresentation(raw, daily.key, dailyIdx)
  }, [curateMode, curateIdx, roster, mode, tutorialIdx, dailyIdx, daily])

  const applyFreshBoard = useCallback(() => {
    if (!level) return
    const initial = level.prePlaced.map((sq, i) => ({
      id: `pre-${i}-${Date.now()}`,
      square: sq,
      isMoving: false,
      isFalling: false,
      virtualPos: null,
    }))
    setBugs(initial)
    setBugsPlacedCount(0)
    setHistory([])
    setIsAnimating(false)
    setIsCelebrating(false)
  }, [level])

  const resetLevel = useCallback(() => {
    if (curateMode) clearScurryWip('curate', curateIdx)
    else if (mode === 'daily') clearScurryWip(daily.key, dailyIdx)
    applyFreshBoard()
  }, [curateMode, mode, daily.key, dailyIdx, curateIdx, applyFreshBoard])

  useEffect(() => {
    if (curateMode) {
      const loaded = loadScurryWip('curate', curateIdx, level)
      if (loaded) {
        setBugs(loaded.bugs)
        setBugsPlacedCount(loaded.bugsPlacedCount)
        setHistory(loaded.history)
        setIsAnimating(false)
        setIsCelebrating(false)
        usedUndoOrResetRef.current = false
        return
      }
      applyFreshBoard()
      usedUndoOrResetRef.current = false
      return
    }
    if (mode === 'tutorial') {
      applyFreshBoard()
      usedUndoOrResetRef.current = false
      return
    }
    const loaded = loadScurryWip(daily.key, dailyIdx, level)
    if (loaded) {
      setBugs(loaded.bugs)
      setBugsPlacedCount(loaded.bugsPlacedCount)
      setHistory(loaded.history)
      setIsAnimating(false)
      setIsCelebrating(false)
      usedUndoOrResetRef.current = false
      return
    }
    applyFreshBoard()
    usedUndoOrResetRef.current = false
  }, [curateMode, curateIdx, mode, tutorialIdx, daily.key, dailyIdx, level, applyFreshBoard])

  useEffect(() => {
    if (!level || isAnimating) return
    if (curateMode) {
      saveScurryWip('curate', curateIdx, level, bugs, bugsPlacedCount, history)
      return
    }
    if (mode !== 'daily') return
    saveScurryWip(daily.key, dailyIdx, level, bugs, bugsPlacedCount, history)
  }, [
    curateMode,
    curateIdx,
    mode,
    daily.key,
    dailyIdx,
    level,
    bugs,
    bugsPlacedCount,
    history,
    isAnimating,
  ])

  useEffect(() => {
    const filled =
      level?.targets?.length > 0 && level.targets.every((t) => bugs.some((b) => b.square === t))
    if (!filled) {
      setScurryPostWinCtaAttention(false)
      return
    }
    const tid = window.setTimeout(
      () => setScurryPostWinCtaAttention(true),
      SCURRY_POST_WIN_CTA_PULSE_MS
    )
    return () => clearTimeout(tid)
  }, [level, bugs])

  const allTargetsFilled =
    level?.targets.length > 0 && level.targets.every((t) => bugs.some((b) => b.square === t))

  const bugsLeft = Math.max(0, (level?.maxBugs ?? 0) - bugsPlacedCount)
  const isOutOfBugs = bugsPlacedCount >= (level?.maxBugs ?? 0) && !allTargetsFilled

  const getPos = (sq) => ({ row: Math.floor((sq - 1) / 5), col: (sq - 1) % 5 })
  const getSq = (r, c) => (r < 0 || r > 4 || c < 0 || c > 4 ? null : r * 5 + c + 1)

  const resolveScurry = (clickSq, currentBugs) => {
    let workingBugs = currentBugs.map((b) => ({ ...b }))
    const cp = getPos(clickSq)
    const neighbors = workingBugs.filter((b) => {
      const bp = getPos(b.square)
      return Math.abs(bp.row - cp.row) <= 1 && Math.abs(bp.col - cp.col) <= 1
    })
    neighbors.forEach((neighbor) => {
      const np = getPos(neighbor.square)
      const dr = np.row - cp.row,
        dc = np.col - cp.col
      let chain = [],
        target = neighbor
      while (target) {
        chain.push(target)
        const tp = getPos(target.square)
        const nextSq = getSq(tp.row + dr, tp.col + dc)
        target = workingBugs.find((b) => b.square === nextSq && !chain.includes(b))
      }
      chain.reverse().forEach((b) => {
        const bp = getPos(b.square)
        const nr = bp.row + dr,
          nc = bp.col + dc
        const nextSq = getSq(nr, nc)
        b.square = nextSq || -100
        b.virtualPos = { row: nr, col: nc }
        b.isFalling = !nextSq
        b.isMoving = true
      })
    })
    return workingBugs
  }

  const placeBug = (square) => {
    if (isAnimating || isCelebrating) return
    if (bugsPlacedCount >= (level?.maxBugs ?? 0)) return
    if (bugs.some((b) => b.square === square)) return

    setHistory((prev) => [...prev, bugs.map((b) => ({ ...b }))])
    setIsAnimating(true)

    const scurriedBugs = resolveScurry(square, bugs)
    const newBug = { id: Date.now(), square, isMoving: false, isFalling: false, virtualPos: null }
    const updatedBugs = [...scurriedBugs, newBug]
    setBugs(updatedBugs)
    setBugsPlacedCount((prev) => prev + 1)

    setTimeout(() => {
      const finalBugs = updatedBugs
        .filter((b) => !b.isFalling)
        .map((b) => ({ ...b, isMoving: false, virtualPos: null }))
      setBugs(finalBugs)
      setIsAnimating(false)

      const won =
        level.targets.length > 0 &&
        level.targets.every((t) => finalBugs.some((b) => b.square === t))
      if (won) {
        if (mode === 'daily') {
          markComplete(daily.key, dailyIdx, !usedUndoOrResetRef.current)
          setCompletions(loadCompletions(daily.key))
          setPerfects(loadPerfects(daily.key))
        }
        setTimeout(() => {
          setIsCelebrating(true)
          setTimeout(() => setIsCelebrating(false), 800)
        }, 300)
      }
    }, 500)
  }

  const undo = () => {
    usedUndoOrResetRef.current = true
    if (history.length === 0) return
    setBugs(history[history.length - 1])
    setHistory((prev) => prev.slice(0, -1))
    setBugsPlacedCount((prev) => prev - 1)
  }

  const handlePrimaryClick = () => {
    if (allTargetsFilled) {
      if (curateMode) {
        clearScurryWip('curate', curateIdx)
        if (curateIdx < roster.length - 1) setCurateIdx((j) => j + 1)
        return
      }
      if (mode === 'daily') clearScurryWip(daily.key, dailyIdx)
      if (mode === 'tutorial') {
        if (tutorialIdx < puzzleData.tutorial.length - 1) setTutorialIdx((i) => i + 1)
        else {
          setMode('daily')
          setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SCURRY, 0))
        }
      } else if (mode === 'daily') {
        const nextUnsolved = nextIncompleteEnabledTierExcluding(
          GAME_KEYS.SCURRY,
          daily.key,
          dailyIdx
        )
        if (nextUnsolved !== null) setDailyIdx(nextUnsolved)
      }
    } else if (isOutOfBugs) {
      usedUndoOrResetRef.current = true
      resetLevel()
    }
  }

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const done = isSuiteCompleteForPrefs(GAME_KEYS.SCURRY, daily.key)
    if (allDailyDoneCompletionRef.current === null) {
      allDailyDoneCompletionRef.current = done
      return
    }
    if (done && !allDailyDoneCompletionRef.current) {
      window.setTimeout(() => {
        setShowCompletionModal(true)
      }, SCURRY_SUITE_MODAL_AFTER_WIN_MS)
    }
    allDailyDoneCompletionRef.current = done
  }, [curateMode, mode, completions, daily.key, suitePrefsEpoch])

  const primaryLabel = allTargetsFilled
    ? curateMode
      ? curateIdx < roster.length - 1
        ? CTA_LABELS.NEXT_PUZZLE
        : null
      : mode === 'tutorial'
        ? tutorialIdx < puzzleData.tutorial.length - 1
          ? CTA_LABELS.NEXT_PUZZLE
          : CTA_LABELS.PLAY_TODAY
        : mode === 'daily'
          ? nextIncompleteEnabledTierExcluding(GAME_KEYS.SCURRY, daily.key, dailyIdx) != null
            ? CTA_LABELS.NEXT_PUZZLE
            : CTA_LABELS.ALL_PUZZLES
          : null
    : isOutOfBugs
      ? 'Retry Puzzle'
      : null

  useSuiteCompletionTimer(GAME_KEYS.SCURRY, daily.key, {
    track: !curateMode && mode === 'daily',
    alreadyFullyComplete: isSuiteCompleteForPrefs(GAME_KEYS.SCURRY, daily.key),
    pauseForHubCompleteCta:
      primaryLabel === CTA_LABELS.ALL_PUZZLES || primaryLabel === CTA_LABELS.NEXT_PUZZLE,
  })

  const base = import.meta.env.BASE_URL

  const handleStatsClick = useCallback(() => {
    if (curateMode) {
      const entry = roster[curateIdx]
      if (!entry || !level) return
      const text = formatCurateClipboard('scurry', entry.tier, entry.indexInTier + 1, level)
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
  }, [curateMode, roster, curateIdx, level])

  return (
    <div className="game-container">
      <TopBar
        title={chrome.title}
        onHome={() => {
          window.location.href = base
        }}
        onCube={() => setShowLinks(true)}
        linksViaTitleOnly
        puzzleChrome={{
          gameKey: GAME_KEYS.SCURRY,
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

      {/* INFO BAR */}
      {curateMode ? (
        <CurateLevelNav
          exitCurateHref={exitCurateHref}
          curateIdx={curateIdx}
          setCurateIdx={setCurateIdx}
          roster={roster}
          puzzleData={puzzleData}
          metricsSlot={
            <>
              <span className="stats-label">Bugs</span>
              <span className="stats-num">{bugsLeft}</span>
            </>
          }
        />
      ) : mode === 'tutorial' ? (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Bugs</span>
            <span className="stats-num">{bugsLeft}</span>
          </div>
          <div className="selector-group">
            <button
              className={`nav-arrow ${tutorialIdx === 0 ? 'disabled' : ''}`}
              onClick={() => {
                if (tutorialIdx > 0) setTutorialIdx((i) => i - 1)
              }}
            >
              ←
            </button>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div className="level-label">
                <span className="sub">Tutorial</span>
                <span className="num">{tutorialIdx + 1}</span>
              </div>
              {SCURRY_TUTORIAL_HINTS.map(({ idx, message }) =>
                tutorialIdx === idx && !tutorialHintsDismissed[idx] ? (
                  <DismissibleHintToast
                    key={idx}
                    message={message}
                    align="center"
                    onDismiss={() => {
                      setTutorialHintsDismissed((d) => ({ ...d, [idx]: true }))
                    }}
                  />
                ) : null
              )}
            </div>
            <button
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SCURRY, 0))
              }}
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      ) : (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Bugs</span>
            <span className="stats-num">{bugsLeft}</span>
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
                onChange={setDailyIdx}
                tierSlots={tierSlots}
              />
            </div>
          </div>
          <div className="level-nav__right-slot">
            <GameShareNavButton
              gameKey={GAME_KEYS.SCURRY}
              dateKey={daily.key}
              canShare={canShareHub}
            />
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      <div className="game-stage">
        <div id="canvas-wrapper">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gridTemplateRows: 'repeat(5, 1fr)',
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            {[...Array(25)].map((_, i) => {
              const sq = i + 1
              const isTarget = level?.targets.includes(sq)
              return (
                <div
                  key={sq}
                  onClick={() => placeBug(sq)}
                  onTouchStart={(e) => {
                    if (e.cancelable) e.preventDefault()
                    placeBug(sq)
                  }}
                  className={`grid-line ${isTarget ? 'target-square' : ''}`}
                  style={{ position: 'relative', cursor: 'pointer', padding: '5px' }}
                />
              )
            })}
          </div>
          {bugs.map((bug) => {
            const pos = bug.virtualPos || getPos(bug.square)
            return (
              <div
                key={bug.id}
                className="bug-layer"
                style={{
                  left: `${pos.col * 20}%`,
                  top: `${pos.row * 20}%`,
                  width: '20%',
                  height: '20%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                <Bug
                  isMoving={bug.isMoving}
                  isFalling={bug.isFalling}
                  isCelebrating={isCelebrating && level?.targets.includes(bug.square)}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* BUTTONS */}
      <div className="button-tray">
        <button className="btn-secondary" onClick={undo} disabled={history.length === 0}>
          Undo
        </button>
        <SmartRightButton
          primaryLabel={primaryLabel}
          primaryHref={primaryLabel === CTA_LABELS.ALL_PUZZLES ? base : undefined}
          onPrimaryClick={handlePrimaryClick}
          attention={scurryPostWinCtaAttention}
          resetDisabled={history.length === 0}
          onReset={() => {
            usedUndoOrResetRef.current = true
            resetLevel()
          }}
        />
      </div>

      {/* INSTRUCTIONS */}
      <SharedModalShell
        show={showInstructions}
        onClose={closeInstructions}
        intent={MODAL_INTENTS.INSTRUCTIONS}
      >
        <h1 className="title" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          Scurry
        </h1>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <BugIconPuzzle size={80} />
          </div>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            Place bugs to fill all of the highlighted squares.
            <br />
            <br />
            Placing a bug causes its neighbors to <b>scurry</b>, <br />
            pushing them away in all directions.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!hasSeenInstructions ? (
            <>
              <button
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
                className="btn-secondary"
                onClick={() => {
                  closeInstructions()
                  setMode('daily')
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SCURRY, 0))
                }}
              >
                {CTA_LABELS.SKIP_TUTORIAL}
              </button>
            </>
          ) : (puzzleData.tutorial?.length ?? 0) > 0 ? (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  closeInstructions()
                  setMode('daily')
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SCURRY, 0))
                }}
              >
                {CTA_LABELS.PLAY_TODAYS_PUZZLES_UPPER}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  closeInstructions()
                  setMode('tutorial')
                  setTutorialIdx(0)
                }}
              >
                {CTA_LABELS.PLAY_TUTORIAL_UPPER}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                closeInstructions()
                setMode('daily')
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.SCURRY, 0))
              }}
            >
              {CTA_LABELS.PLAY_TODAYS_PUZZLES_UPPER}
            </button>
          )}
        </div>
      </SharedModalShell>

      <AllTenLinksModal show={showLinks} onClose={() => setShowLinks(false)} />
      <SimpleGameStatsModal
        show={showStats}
        onClose={() => setShowStats(false)}
        gameKey={GAME_KEYS.SCURRY}
        dailySuiteFooter={{
          dateKey: daily.key,
          completions,
          perfects,
        }}
      />
      <SuiteGameCompletionModal
        show={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        gameKey={GAME_KEYS.SCURRY}
        dateKey={daily.key}
        hubDiceCompletions={completions}
        hubDicePerfects={perfects}
      />
    </div>
  )
}

export default Scurry

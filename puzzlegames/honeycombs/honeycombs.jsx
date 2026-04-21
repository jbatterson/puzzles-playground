import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react'
import puzzleData from './puzzles.js'
import HoneycombsBoard from './HoneycombsBoard.jsx'
import { getMaxWinTraceCompleteMs } from './useHoneycombsTrace.js'
import { honeycombCellCount } from './honeycombsGeometry.js'
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
import HoneycombsIcon from '../../src/shared/icons/HoneycombsIcon.jsx'
import DismissibleHintToast from '../../src/shared/DismissibleHintToast.jsx'
import { buildTierRoster, formatCurateClipboard } from '../../src/shared/curateRoster.js'
import { useCurateModeFromRoster } from '../../src/shared/useCurateMode.js'
import { CurateCopyToast, CurateLevelNav } from '../../src/shared/CurateModeChrome.jsx'
import './honeycombs.css'
import { getDailyKey, getDateLabel, getDayIndex } from '@shared-contracts/dailyPuzzleDate.js'
import { puzzleFingerprint } from './honeycombsPersistence.js'

const HONEYCOMBS_TUTORIAL_HINT_PATH =
  'Tap empty hexagons to place the missing numbers.\nMake a continuous path from 1-10.'
const HONEYCOMBS_TUTORIAL_HINT_KEYBOARD =
  'Tap a dark-blue keyboard key to set it to active. \n Try starting this puzzle by placing the 5 and 6.'
const HONEYCOMBS_TUTORIAL_HINT_ERASE =
  'Tap any placed number to erase it. \nThis sets it to active on the keyboard.'
const HONEYCOMBS_TUTORIAL_HINT_STAR =
  'On daily puzzles, earn a ★ by solving without an erase, Undo, or Reset.'

function getDailyHoneycombsPuzzles() {
  const key = getDailyKey()
  const dayIndex = getDayIndex(key)
  const easy = puzzleData.easy || []
  const medium = puzzleData.medium || []
  const hard = puzzleData.hard || []
  return {
    key,
    puzzles: [
      easy[dayIndex % easy.length],
      medium[dayIndex % medium.length],
      hard[dayIndex % hard.length],
    ],
  }
}

function storageKey(dateKey, idx) {
  return `honeycombs:${dateKey}:${idx}`
}

function loadCompletions(dateKey) {
  return [0, 1, 2].map((i) => ['1', '2'].includes(localStorage.getItem(storageKey(dateKey, i))))
}

function loadPerfects(dateKey) {
  return [0, 1, 2].map((i) => localStorage.getItem(storageKey(dateKey, i)) === '2')
}

function PuzzleBoxes({ current, completions, perfects, onChange, tierSlots = [0, 1, 2] }) {
  return (
    <div id="puzzle-boxes" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
          {completions[i] ? perfects[i] ? '★' : '✓' : <DiceFace count={i + 1} size={20} />}
        </button>
      ))}
    </div>
  )
}

export default function Honeycombs() {
  const chrome = getGameChrome(GAME_KEYS.HONEYCOMBS)
  const daily = useMemo(() => getDailyHoneycombsPuzzles(), [])
  const dateLabel = useMemo(() => getDateLabel(daily.key), [daily.key])
  const baseRaw = import.meta.env.BASE_URL || '/'
  const base = baseRaw.endsWith('/') ? baseRaw : `${baseRaw}/`

  const [mode, setMode] = useState(
    () => getInitialTutorialNav(GAME_KEYS.HONEYCOMBS, puzzleData.tutorial ?? []).mode
  )
  const [tutorialIdx, setTutorialIdx] = useState(
    () => getInitialTutorialNav(GAME_KEYS.HONEYCOMBS, puzzleData.tutorial ?? []).tutorialIdx
  )
  const [dailyIdx, setDailyIdx] = useState(() =>
    resolveHubDailySlotWithPrefs(
      GAME_KEYS.HONEYCOMBS,
      getDailyKey(),
      typeof window !== 'undefined' ? window.location.search : ''
    )
  )
  const suitePrefsEpoch = useSuitePrefsEpoch()
  const tierSlots = useMemo(() => {
    void suitePrefsEpoch
    return getEnabledTierIndices(GAME_KEYS.HONEYCOMBS)
  }, [suitePrefsEpoch])
  const [completions, setCompletions] = useState(() => loadCompletions(daily.key))
  const [perfects, setPerfects] = useState(() => loadPerfects(daily.key))
  const canShareHub = useMemo(
    () => hasShareableHubProgress(GAME_KEYS.HONEYCOMBS, daily.key),
    [daily.key, completions]
  )
  const [showLinks, setShowLinks] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [curateCopyHint, setCurateCopyHint] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [suitePauseAllPuzzlesCta, setSuitePauseAllPuzzlesCta] = useState(false)
  const roster = useMemo(() => buildTierRoster(puzzleData), [])
  const { curateMode, curateIdx, setCurateIdx, exitCurateHref } = useCurateModeFromRoster(roster)
  const [tutorialHintPathDismissed, setTutorialHintPathDismissed] = useState(false)
  const [tutorialHintKeyboardDismissed, setTutorialHintKeyboardDismissed] = useState(false)
  const [tutorialHintEraseDismissed, setTutorialHintEraseDismissed] = useState(false)
  const [tutorialHintStarDismissed, setTutorialHintStarDismissed] = useState(false)

  const { hasSeenInstructions, showInstructions, setShowInstructions, closeInstructions } =
    useInstructionsGate('honeycombs:hasSeenInstructions', {
      openOnMount: !curateMode,
      completionStoragePrefix: 'honeycombs',
      initiallyClosed: curateMode,
    })

  useSuiteCompletionTimer(GAME_KEYS.HONEYCOMBS, daily.key, {
    track: !curateMode && mode === 'daily',
    alreadyFullyComplete: isSuiteCompleteForPrefs(GAME_KEYS.HONEYCOMBS, daily.key),
    pauseForHubCompleteCta: suitePauseAllPuzzlesCta,
  })

  const modalsOpenRef = useRef(false)
  const pendingSuiteModalAfterTraceRef = useRef(false)
  const suiteModalFallbackTimeoutRef = useRef(null)
  const allDailyDoneCompletionRef = useRef(null)
  const tutorialPuzzles = useMemo(() => puzzleData.tutorial || [], [])

  const clearSuiteModalFallback = useCallback(() => {
    if (suiteModalFallbackTimeoutRef.current != null) {
      window.clearTimeout(suiteModalFallbackTimeoutRef.current)
      suiteModalFallbackTimeoutRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      clearSuiteModalFallback()
    },
    [clearSuiteModalFallback]
  )

  useEffect(() => {
    if (curateMode || mode !== 'daily') {
      pendingSuiteModalAfterTraceRef.current = false
      clearSuiteModalFallback()
    }
  }, [curateMode, mode, clearSuiteModalFallback])

  useEffect(() => {
    if (!curateMode) persistTutorialResumeState(GAME_KEYS.HONEYCOMBS, mode, tutorialIdx)
  }, [curateMode, mode, tutorialIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    persistHubDailySlot(GAME_KEYS.HONEYCOMBS, daily.key, dailyIdx)
  }, [curateMode, mode, daily.key, dailyIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const c = clampDailyIndexToTierPrefs(GAME_KEYS.HONEYCOMBS, dailyIdx)
    if (c !== dailyIdx) setDailyIdx(c)
  }, [curateMode, mode, suitePrefsEpoch, dailyIdx])

  const activePuzzles = useMemo(
    () =>
      curateMode
        ? roster.map((r) => r.puzzle)
        : mode === 'tutorial'
          ? tutorialPuzzles
          : daily.puzzles,
    [curateMode, roster, mode, tutorialPuzzles, daily.puzzles]
  )
  const activePuzzleIdx = curateMode ? curateIdx : mode === 'tutorial' ? tutorialIdx : dailyIdx

  const honeycombsBoardKey = useMemo(() => {
    const scope = curateMode ? 'curate' : mode
    const dk = curateMode ? 'curate' : daily.key
    const p = activePuzzles[activePuzzleIdx]
    const fp = puzzleFingerprint(p)
    return `${scope}:${dk}:${activePuzzleIdx}:${fp ?? 'none'}`
  }, [curateMode, mode, daily.key, activePuzzles, activePuzzleIdx])

  const bumpCompletions = useCallback(() => {
    setCompletions(loadCompletions(daily.key))
    setPerfects(loadPerfects(daily.key))
  }, [daily.key])

  const onRequestNext = useCallback(() => {
    if (curateMode) {
      setCurateIdx((i) => Math.min(roster.length - 1, i + 1))
      return
    }
    if (mode === 'tutorial') {
      setTutorialIdx((i) => Math.min(Math.max(0, tutorialPuzzles.length - 1), i + 1))
      return
    }
    setDailyIdx((i) => {
      const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.HONEYCOMBS, daily.key, i)
      return next !== null ? next : i
    })
  }, [curateMode, roster.length, mode, tutorialPuzzles.length, daily.key])

  const handleWinAnimationComplete = useCallback(() => {
    if (curateMode) return
    if (mode !== 'daily') return
    if (!pendingSuiteModalAfterTraceRef.current) return
    pendingSuiteModalAfterTraceRef.current = false
    clearSuiteModalFallback()
    setShowCompletionModal(true)
  }, [curateMode, mode, clearSuiteModalFallback])

  const tutorialFinalAction = useMemo(() => {
    if (curateMode) return null
    if (mode !== 'tutorial') return null
    return {
      label: CTA_LABELS.PLAY_TODAY,
      onClick: () => {
        setMode('daily')
        setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.HONEYCOMBS, 0))
      },
    }
  }, [mode, curateMode])

  useLayoutEffect(() => {
    modalsOpenRef.current = showInstructions || showStats || showLinks
  }, [showInstructions, showStats, showLinks])

  // When the suite becomes complete, wait for the board's win-trace `onWin` (bee + pulse), with a
  // size-aware fallback deadline so any tier (small / medium / large) still opens the modal.
  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const done = isSuiteCompleteForPrefs(GAME_KEYS.HONEYCOMBS, daily.key)
    if (allDailyDoneCompletionRef.current === null) {
      allDailyDoneCompletionRef.current = done
      return
    }
    if (!done) {
      pendingSuiteModalAfterTraceRef.current = false
      clearSuiteModalFallback()
    }
    if (done && !allDailyDoneCompletionRef.current) {
      pendingSuiteModalAfterTraceRef.current = true
      const maxTraceMs = daily.puzzles.reduce(
        (max, p) => Math.max(max, getMaxWinTraceCompleteMs(honeycombCellCount(p.size))),
        getMaxWinTraceCompleteMs(1)
      )
      clearSuiteModalFallback()
      suiteModalFallbackTimeoutRef.current = window.setTimeout(() => {
        suiteModalFallbackTimeoutRef.current = null
        if (!pendingSuiteModalAfterTraceRef.current) return
        pendingSuiteModalAfterTraceRef.current = false
        setShowCompletionModal(true)
      }, maxTraceMs)
    }
    allDailyDoneCompletionRef.current = done
  }, [
    curateMode,
    mode,
    completions,
    daily.key,
    daily.puzzles,
    suitePrefsEpoch,
    clearSuiteModalFallback,
  ])

  const handleStatsClick = useCallback(() => {
    if (curateMode) {
      const entry = roster[curateIdx]
      const p = entry?.puzzle
      if (!entry || !p) return
      const text = formatCurateClipboard('honeycombs', entry.tier, entry.indexInTier + 1, p)
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
  }, [curateMode, roster, curateIdx])

  return (
    <div className="game-container honeycombs">
      <TopBar
        title={chrome.title}
        onHome={() => {
          window.location.href = base
        }}
        onCube={() => setShowLinks(true)}
        linksViaTitleOnly
        puzzleChrome={{
          gameKey: GAME_KEYS.HONEYCOMBS,
          onStats: handleStatsClick,
          onHelp: () => setShowInstructions(true),
          onTutorial: () => {
            setMode('tutorial')
            setTutorialIdx(0)
          },
          hasTutorial: tutorialPuzzles.length > 0,
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
        />
      ) : mode === 'tutorial' ? (
        <div className="level-nav">
          <div className="left-spacer" aria-hidden />
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
              {tutorialIdx === 0 && !tutorialHintPathDismissed && (
                <DismissibleHintToast
                  message={HONEYCOMBS_TUTORIAL_HINT_PATH}
                  align="center"
                  onDismiss={() => setTutorialHintPathDismissed(true)}
                />
              )}
              {tutorialIdx === 1 && !tutorialHintEraseDismissed && (
                <DismissibleHintToast
                  message={HONEYCOMBS_TUTORIAL_HINT_ERASE}
                  align="center"
                  onDismiss={() => setTutorialHintEraseDismissed(true)}
                />
              )}
              {tutorialIdx === 3 && !tutorialHintKeyboardDismissed && (
                <DismissibleHintToast
                  message={HONEYCOMBS_TUTORIAL_HINT_KEYBOARD}
                  align="center"
                  onDismiss={() => setTutorialHintKeyboardDismissed(true)}
                />
              )}
              {tutorialIdx === 4 && !tutorialHintStarDismissed && (
                <DismissibleHintToast
                  message={HONEYCOMBS_TUTORIAL_HINT_STAR}
                  align="center"
                  onDismiss={() => setTutorialHintStarDismissed(true)}
                />
              )}
            </div>
            <button
              className={`nav-arrow ${tutorialIdx === tutorialPuzzles.length - 1 ? 'disabled' : ''}`}
              onClick={() => {
                if (tutorialIdx < tutorialPuzzles.length - 1) setTutorialIdx((i) => i + 1)
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.HONEYCOMBS, 0))
              }}
            >
              {CTA_LABELS.SKIP_TUTORIAL}
            </button>
          </div>
        </div>
      ) : (
        <div className="level-nav">
          <div className="left-spacer" aria-hidden />
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
              gameKey={GAME_KEYS.HONEYCOMBS}
              dateKey={daily.key}
              canShare={canShareHub}
            />
          </div>
        </div>
      )}

      <HoneycombsBoard
        key={honeycombsBoardKey}
        puzzle={activePuzzles[activePuzzleIdx]}
        puzzleIdx={activePuzzleIdx}
        totalPuzzles={activePuzzles.length}
        dateKey={curateMode ? 'curate' : daily.key}
        hubBaseHref={base}
        onRequestNextPuzzle={onRequestNext}
        onCompletionsUpdated={bumpCompletions}
        isBlockingModalOpen={() => modalsOpenRef.current}
        onWin={handleWinAnimationComplete}
        trackCompletion={!curateMode && mode === 'daily'}
        finalSolvedAction={tutorialFinalAction}
        onHubCompleteCtaPauseChange={setSuitePauseAllPuzzlesCta}
      />

      <SharedModalShell
        show={showInstructions}
        onClose={closeInstructions}
        intent={MODAL_INTENTS.INSTRUCTIONS}
      >
        <h1 className="title" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          Honeycombs
        </h1>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <HoneycombsIcon size={80} />
          </div>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#333' }}>
            Fill the honeycomb so the numbered hexagons form one connected path that visits every
            hexagon in the honeycomb.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!hasSeenInstructions ? (
            <>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: '1.25rem', width: '100%' }}
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
                style={{ width: '100%' }}
                onClick={() => {
                  closeInstructions()
                  setMode('daily')
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.HONEYCOMBS, 0))
                }}
              >
                {CTA_LABELS.SKIP_TUTORIAL}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '1.25rem', width: '100%' }}
              onClick={() => {
                closeInstructions()
                setMode('daily')
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.HONEYCOMBS, 0))
              }}
            >
              {CTA_LABELS.PLAY_TODAY}
            </button>
          )}
        </div>
      </SharedModalShell>

      <AllTenLinksModal show={showLinks} onClose={() => setShowLinks(false)} />
      <SimpleGameStatsModal
        show={showStats}
        onClose={() => setShowStats(false)}
        gameKey={GAME_KEYS.HONEYCOMBS}
        dailySuiteFooter={{
          dateKey: daily.key,
          completions,
          perfects,
        }}
      />

      <SuiteGameCompletionModal
        show={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        gameKey={GAME_KEYS.HONEYCOMBS}
        dateKey={daily.key}
        hubDiceCompletions={completions}
        hubDicePerfects={perfects}
      />
    </div>
  )
}

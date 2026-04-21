import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import puzzleData from './puzzles.js'
import TopBar from '../../src/shared/TopBar.jsx'
import DiceFace from '../../src/shared/DiceFace.jsx'
import SharedModalShell from '../../src/shared/SharedModalShell.jsx'
import SimpleGameStatsModal from '../../src/shared/SimpleGameStatsModal.jsx'
import SuiteGameCompletionModal from '../../src/shared/SuiteGameCompletionModal.jsx'
import useSuiteCompletionTimer from '../../src/shared/useSuiteCompletionTimer.js'
import AllTenLinksModal from '../../src/shared/AllTenLinksModal.jsx'
import useInstructionsGate from '../../src/shared/useInstructionsGate.js'
import { MODAL_INTENTS, getModalCloseAriaLabel } from '@shared-contracts/modalIntents.js'
import { GAME_KEYS, getGameChrome } from '@shared-contracts/gameChrome.js'
import {
  PUZZLE_SUITE_INK,
  PUZZLE_SUITE_INK_FAINT,
  PUZZLE_SUITE_SURFACE_INCOMPLETE,
} from '@shared-contracts/chromeUi.js'
import CluelessIcon from '../../src/shared/icons/CluelessIcon.jsx'
import { persistHubDailySlot } from '@shared-contracts/hubEntry.js'
import {
  clampDailyIndexToTierPrefs,
  getEnabledTierIndices,
  isSuiteCompleteForPrefs,
  nextIncompleteEnabledTierExcluding,
  resolveHubDailySlotWithPrefs,
} from '@shared-contracts/suiteDashboardPreferences.js'
import useSuitePrefsEpoch from '../../src/shared/useSuitePrefsEpoch.js'
import { hasShareableHubProgress } from '@shared-contracts/hubSharePlaintext.js'
import GameShareNavButton from '../../src/shared/GameShareNavButton.jsx'
import { buildTierRoster, formatCurateClipboard } from '../../src/shared/curateRoster.js'
import { useCurateModeFromRoster } from '../../src/shared/useCurateMode.js'
import { CurateCopyToast, CurateLevelNav } from '../../src/shared/CurateModeChrome.jsx'
import {
  PostSolvePrimaryButton,
  PostSolvePrimaryLink,
} from '../../src/shared/PostSolvePrimaryCta.jsx'
import { getDailyKey, getDateLabel, getDayIndex } from '@shared-contracts/dailyPuzzleDate.js'
import { HubDiceStar } from '../../src/shared/HubDiceStar.jsx'

/** Curate uses easy geometry for all roster puzzles (full word on middle row/col). */
const CURATE_PUZZLE_DIFFICULTY = 'easy'

// ── Daily puzzle selection ───────────────────────────────────────────────────

const DIFFS = ['easy', 'medium', 'hard']

/** Daily pick: same pattern as Scurry — each tier has its own batch; index = dayIndex % tier.length (no cross-tier offset). */
function getDailyPuzzle(difficulty) {
  const key = getDailyKey()
  const dayIndex = getDayIndex(key)
  const easy = puzzleData.easy || []
  const medium = puzzleData.medium || []
  const hard = puzzleData.hard || []

  let puzzle
  let idx = 0
  if (difficulty === 'easy') {
    const n = easy.length
    idx = n > 0 ? dayIndex % n : 0
    puzzle = easy[idx]
  } else if (difficulty === 'medium') {
    const n = medium.length
    idx = n > 0 ? dayIndex % n : 0
    puzzle = medium[idx]
  } else {
    const n = hard.length
    idx = n > 0 ? dayIndex % n : 0
    puzzle = hard[idx]
  }

  return { puzzle, key, idx }
}

// ── Completion tracking ──────────────────────────────────────────────────────
// bestAttempts: 1..99 (number of CHECKs used to complete). Legacy: failed, 1..5.

function storageKeyBestAttempts(dateKey, difficulty) {
  return `clueless:${dateKey}:${difficulty}:bestAttempts`
}

function storageKeyLegacyBestAttempts(dateKey) {
  return `clueless:${dateKey}:bestAttempts`
}

function loadBestAttempts(dateKey, difficulty) {
  const v = localStorage.getItem(storageKeyBestAttempts(dateKey, difficulty))
  if (v != null) {
    const n = parseInt(v, 10)
    if (n >= 1 && n <= 99) return n
  }

  // Legacy (pre-difficulty) keys: treat as MEDIUM.
  if (difficulty === 'medium') {
    const legacyV = localStorage.getItem(storageKeyLegacyBestAttempts(dateKey))
    if (legacyV != null) {
      const n = parseInt(legacyV, 10)
      if (n >= 1 && n <= 99) return n
    }
  }

  // Migrate very old schema: '2' = perfect (1 attempt), '1' = completed (treat as 2 attempts)
  const legacy = localStorage.getItem(`clueless:${dateKey}`)
  if (legacy === '2') return 1
  if (legacy === '1') return 2
  return null
}

function loadFailed(dateKey) {
  return localStorage.getItem(`clueless:${dateKey}:failed`) === '1'
}

function markComplete(dateKey, difficulty, attemptsUsed) {
  const existing = loadBestAttempts(dateKey, difficulty)
  if (existing != null && attemptsUsed >= existing) return
  const value = Math.min(Math.max(1, attemptsUsed), 99)
  localStorage.setItem(storageKeyBestAttempts(dateKey, difficulty), String(value))
}

// ── Game state persist/restore ──────────────────────────────────────────────

function storageKeyGameState(dateKey, difficulty) {
  return `clueless:${dateKey}:${difficulty}:gameState`
}

function storageKeyLegacyGameState(dateKey) {
  return `clueless:${dateKey}:gameState`
}

function loadGameState(dateKey, difficulty, validCellKeys) {
  try {
    const raw =
      localStorage.getItem(storageKeyGameState(dateKey, difficulty)) ||
      (difficulty === 'medium' ? localStorage.getItem(storageKeyLegacyGameState(dateKey)) : null)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (
      !data ||
      typeof data.guesses !== 'object' ||
      !Array.isArray(data.locked) ||
      typeof data.guessCount !== 'number' ||
      typeof data.solved !== 'boolean'
    )
      return null
    if (data.guessCount < 0) return null
    for (const k of data.locked) {
      if (!validCellKeys.has(k)) return null
    }
    // Optional: letters tried (wrong) per cell for keyboard highlighting
    let triedLettersByCell = {}
    if (data.triedLettersByCell != null && typeof data.triedLettersByCell === 'object') {
      for (const [cellKey, arr] of Object.entries(data.triedLettersByCell)) {
        if (Array.isArray(arr) && arr.every((c) => typeof c === 'string' && c.length === 1)) {
          triedLettersByCell[cellKey] = arr
        }
      }
    }
    let checkedSignatures = []
    if (
      Array.isArray(data.checkedSignatures) &&
      data.checkedSignatures.every((s) => typeof s === 'string')
    ) {
      checkedSignatures = data.checkedSignatures
    }
    return { ...data, triedLettersByCell, checkedSignatures }
  } catch {
    return null
  }
}

function saveGameState(dateKey, difficulty, state) {
  try {
    const payload = {
      guesses: state.guesses,
      locked: [...state.locked],
      guessCount: state.guessCount,
      solved: state.solved,
      triedLettersByCell: state.triedLettersByCell || {},
      checkedSignatures: state.checkedSignatures || [],
    }
    localStorage.setItem(storageKeyGameState(dateKey, difficulty), JSON.stringify(payload))
  } catch {
    // ignore
  }
}

/** Letter pattern for all input cells (fixed order); used to dedupe redundant CHECKs. */
function boardCheckSignature(inputOrder, guesses) {
  return inputOrder
    .map(({ r, c }) => {
      const g = guesses[`${r},${c}`]
      return g && /^[a-z]$/.test(g) ? g : '.'
    })
    .join('')
}

// ── Grid geometry ────────────────────────────────────────────────────────────
// 5×5 grid. Corners of every 2-cell interval are INPUT cells (9 total).
// Odd-row or odd-col cells (not blocked) are CLUE cells (12 total).
// (1,1), (1,3), (3,1), (3,3) are BLOCKED (4 total).

const BLOCKED = new Set(['1,1', '1,3', '3,1', '3,3'])

/**
 * True when the non-blocked cell (r, c) is a clue (pre-revealed) rather than
 * an input for the given difficulty. Call only for cells not in BLOCKED.
 */
function isClueCellForDifficulty(r, c, difficulty) {
  if (difficulty === 'easy') {
    // Easy: only the crossing middle letter of each word is an input; everything else is a clue.
    return !(r % 2 === 0 && c === 2) && !(c % 2 === 0 && r === 2)
  }
  // Medium/Hard: odd-index positions (within each word) are inputs; even-index are clues.
  // For row words (r even) the index within the word is c; for col words (c even) it is r.
  const indexParity = r % 2 === 0 ? c % 2 : r % 2
  if (indexParity === 1) return true
  // Medium bonus hints: top-left and bottom-right corner letters revealed.
  if (difficulty === 'medium' && ((r === 0 && c === 0) || (r === 4 && c === 4))) return true
  return false
}

const ALL_PLAYABLE_KEYS = new Set()

for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const key = `${r},${c}`
    if (BLOCKED.has(key)) continue
    ALL_PLAYABLE_KEYS.add(key)
  }
}

// ── Extract clue/answer letters from a puzzle object ────────────────────────

function getPuzzleData(p, difficulty) {
  const clues = {}
  const answers = {}

  // Horizontal words fill rows 0, 2, 4
  const hWords = [p.h1, p.h2, p.h3]
  const vWords = [p.v1, p.v2, p.v3]

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const key = `${r},${c}`
      if (BLOCKED.has(key)) continue

      let letter = null
      if (r % 2 === 0) {
        const w = hWords[r / 2]
        letter = w[c]
      }
      if (c % 2 === 0) {
        const w = vWords[c / 2]
        const vLetter = w[r]
        if (letter == null) letter = vLetter
      }

      if (isClueCellForDifficulty(r, c, difficulty)) clues[key] = letter
      else answers[key] = letter
    }
  }

  return { clues, answers }
}

// ── Keyboard rows ────────────────────────────────────────────────────────────

const KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

/** Red cell when current guess is a letter already ruled wrong for this cell (persists with triedLettersByCell). */
function cellGuessShowsWrong(cellKey, locked, guesses, triedLettersByCell) {
  if (locked.has(cellKey)) return false
  const g = guesses[cellKey]
  if (!g) return false
  return (triedLettersByCell[cellKey] || []).includes(g)
}

function firstUnlockedInputIndex(inputOrder, locked) {
  for (let i = 0; i < inputOrder.length; i++) {
    const { r, c } = inputOrder[i]
    if (!locked.has(`${r},${c}`)) return i
  }
  return -1
}

/** Clue letters outside the active row/column band. */
const CLUELESS_CLUE_FONT = 'clamp(1rem, 4vw, 1.5rem)'
/** Matches input cells; active-band clues use this so they read at the same scale. */
const CLUELESS_INPUT_FONT = 'clamp(1.2rem, 5vw, 2rem)'

/** Board outer max-width — caps the grid+keyboard to the height-available space and an absolute max.
 *  Intentionally excludes vw: horizontal sizing comes from width:'100%' on the container so it
 *  always matches the padded parent rather than the raw viewport (which diverges when a scrollbar
 *  is present and was the cause of the board drifting right as the window narrowed). */
const CLUELESS_STAGE_MAX_WIDTH = 'min(calc(100dvh - 346px), 460px)'
/** Keyboard + CTA share this min height in both play and solved states so the board doesn’t jump on win. */
const CLUELESS_KEYBOARD_BAND_MIN_HEIGHT = 'clamp(100px, 22vh, 170px)'

/** Next/prev typeable cell index in `inputOrder`, wrapping; +1 forward, -1 back. */
function nextUnlockedNavIndex(inputOrder, locked, fromIdx, delta) {
  const unlocked = []
  for (let i = 0; i < inputOrder.length; i++) {
    const { r, c } = inputOrder[i]
    if (!locked.has(`${r},${c}`)) unlocked.push(i)
  }
  if (unlocked.length === 0) return null
  const pos = unlocked.indexOf(fromIdx)
  if (pos < 0) return unlocked[delta > 0 ? 0 : unlocked.length - 1]
  const nextPos = (pos + delta + unlocked.length) % unlocked.length
  return unlocked[nextPos]
}

const GRID_LINES = [0, 2, 4]

function inputIndicesInRow(inputOrder, r) {
  return inputOrder
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.r === r)
    .sort((a, b) => a.c - b.c)
    .map((p) => p.i)
}

function inputIndicesInCol(inputOrder, c) {
  return inputOrder
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.c === c)
    .sort((a, b) => a.r - b.r)
    .map((p) => p.i)
}

function nextLineRow(r) {
  const idx = GRID_LINES.indexOf(r)
  const i = idx >= 0 ? idx : 0
  return GRID_LINES[(i + 1) % GRID_LINES.length]
}

function prevLineRow(r) {
  const idx = GRID_LINES.indexOf(r)
  const i = idx >= 0 ? idx : 0
  return GRID_LINES[(i - 1 + GRID_LINES.length) % GRID_LINES.length]
}

function nextLineCol(c) {
  return nextLineRow(c)
}

function prevLineCol(c) {
  return prevLineRow(c)
}

function cellUnlocked(inputOrder, idx, locked) {
  const { r, c } = inputOrder[idx]
  return !locked.has(`${r},${c}`)
}

/** Next unlocked cell: along row/col, then first unlocked of next grid line (0→2→4→0). */
function advanceAlongAxis(fromIdx, axisMode, inputOrder, locked) {
  if (fromIdx < 0 || fromIdx >= inputOrder.length) return fromIdx

  if (axisMode === 'row') {
    const { r } = inputOrder[fromIdx]
    const sameRow = inputIndicesInRow(inputOrder, r).filter((i) =>
      cellUnlocked(inputOrder, i, locked)
    )
    const pos = sameRow.indexOf(fromIdx)
    if (pos >= 0 && pos + 1 < sameRow.length) return sameRow[pos + 1]
    if (pos < 0 && sameRow.length > 0) return sameRow[0]

    let lineR = r
    for (let step = 0; step < GRID_LINES.length; step++) {
      lineR = nextLineRow(lineR)
      const chain = inputIndicesInRow(inputOrder, lineR).filter((i) =>
        cellUnlocked(inputOrder, i, locked)
      )
      if (chain.length > 0) return chain[0]
    }
    return fromIdx
  }

  const { c } = inputOrder[fromIdx]
  const sameCol = inputIndicesInCol(inputOrder, c).filter((i) =>
    cellUnlocked(inputOrder, i, locked)
  )
  const posC = sameCol.indexOf(fromIdx)
  if (posC >= 0 && posC + 1 < sameCol.length) return sameCol[posC + 1]
  if (posC < 0 && sameCol.length > 0) return sameCol[0]

  let lineC = c
  for (let step = 0; step < GRID_LINES.length; step++) {
    lineC = nextLineCol(lineC)
    const chain = inputIndicesInCol(inputOrder, lineC).filter((i) =>
      cellUnlocked(inputOrder, i, locked)
    )
    if (chain.length > 0) return chain[0]
  }
  return fromIdx
}

/** Previous unlocked along axis; previous grid line’s last unlocked when at start of line. */
function retreatAlongAxis(fromIdx, axisMode, inputOrder, locked) {
  if (fromIdx < 0 || fromIdx >= inputOrder.length) return null

  if (axisMode === 'row') {
    const { r } = inputOrder[fromIdx]
    const sameRow = inputIndicesInRow(inputOrder, r).filter((i) =>
      cellUnlocked(inputOrder, i, locked)
    )
    const pos = sameRow.indexOf(fromIdx)
    if (pos > 0) return sameRow[pos - 1]

    let lineR = r
    for (let step = 0; step < GRID_LINES.length; step++) {
      lineR = prevLineRow(lineR)
      const chain = inputIndicesInRow(inputOrder, lineR).filter((i) =>
        cellUnlocked(inputOrder, i, locked)
      )
      if (chain.length > 0) return chain[chain.length - 1]
    }
    return null
  }

  const { c } = inputOrder[fromIdx]
  const sameCol = inputIndicesInCol(inputOrder, c).filter((i) =>
    cellUnlocked(inputOrder, i, locked)
  )
  const posC = sameCol.indexOf(fromIdx)
  if (posC > 0) return sameCol[posC - 1]

  let lineC = c
  for (let step = 0; step < GRID_LINES.length; step++) {
    lineC = prevLineCol(lineC)
    const chain = inputIndicesInCol(inputOrder, lineC).filter((i) =>
      cellUnlocked(inputOrder, i, locked)
    )
    if (chain.length > 0) return chain[chain.length - 1]
  }
  return null
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Clueless() {
  const chrome = getGameChrome(GAME_KEYS.CLUELESS)
  const [difficultyIdx, setDifficultyIdx] = useState(() =>
    resolveHubDailySlotWithPrefs(
      GAME_KEYS.CLUELESS,
      getDailyKey(),
      typeof window !== 'undefined' ? window.location.search : ''
    )
  )
  const suitePrefsEpoch = useSuitePrefsEpoch()
  const tierSlots = useMemo(() => {
    void suitePrefsEpoch
    return getEnabledTierIndices(GAME_KEYS.CLUELESS)
  }, [suitePrefsEpoch])
  const difficulty = DIFFS[difficultyIdx] || 'easy'
  const roster = useMemo(() => buildTierRoster(puzzleData, ['easy', 'medium', 'hard']), [])
  const { curateMode, curateIdx, setCurateIdx, exitCurateHref } = useCurateModeFromRoster(roster)

  const daily = useMemo(() => {
    if (curateMode) {
      const p = roster[curateIdx]?.puzzle
      return { puzzle: p, key: 'curate', idx: curateIdx }
    }
    return getDailyPuzzle(difficulty)
  }, [curateMode, curateIdx, roster, difficulty])

  const dateLabel = useMemo(() => getDateLabel(daily.key), [daily.key])
  const puzzleDifficulty = curateMode ? CURATE_PUZZLE_DIFFICULTY : difficulty
  const { clues, answers } = useMemo(() => {
    if (!daily.puzzle) return { clues: {}, answers: {} }
    return getPuzzleData(daily.puzzle, puzzleDifficulty)
  }, [daily.puzzle, puzzleDifficulty])

  const usedHintRef = useRef(false)
  const selectedRef = useRef(-1)

  const geometry = useMemo(() => {
    const clueCells = new Set()
    const inputOrder = []

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const key = `${r},${c}`
        if (BLOCKED.has(key)) continue
        if (isClueCellForDifficulty(r, c, puzzleDifficulty)) clueCells.add(key)
        else inputOrder.push({ r, c })
      }
    }
    const inputIndexByKey = new Map(inputOrder.map(({ r, c }, i) => [`${r},${c}`, i]))
    return { clueCells, inputOrder, inputIndexByKey }
  }, [puzzleDifficulty])

  // Puzzle state (loaded per difficulty via effect below)
  const [guesses, setGuesses] = useState({})
  const [locked, setLocked] = useState(new Set())
  const [triedLettersByCell, setTriedLettersByCell] = useState({})
  const [selected, setSelected] = useState(-1)
  const [guessCount, setGuessCount] = useState(0)
  const [solved, setSolved] = useState(false)
  const [selectionHighlighted, setSelectionHighlighted] = useState(true)
  const [axisMode, setAxisMode] = useState('row')
  const [bestAttempts, setBestAttempts] = useState(null)
  const [checkedSignatures, setCheckedSignatures] = useState([])
  const [hasInteracted, setHasInteracted] = useState(false)
  const [showCheckModal, setShowCheckModal] = useState(false)
  /** True only while diagonal scale pop runs on the grid. */
  const [winFlourishActive, setWinFlourishActive] = useState(false)
  /** Pause + flourish + pause until CTA; keyboard hidden as soon as solved. */
  const [winCelebrationActive, setWinCelebrationActive] = useState(false)

  const lastAutoWinKeyRef = useRef(null)
  const winAnimTimerRef = useRef(null)
  const winAnimGenRef = useRef(0)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const allDifficultiesDoneCompletionRef = useRef(null)
  const pendingSuiteCompletionModalRef = useRef(false)

  selectedRef.current = selected

  useEffect(
    () => () => {
      winAnimGenRef.current += 1
      if (winAnimTimerRef.current != null) {
        clearTimeout(winAnimTimerRef.current)
        winAnimTimerRef.current = null
      }
    },
    []
  )

  const attemptsByDiff = useMemo(() => {
    if (curateMode) return [null, null, null]
    return DIFFS.map((d) => loadBestAttempts(daily.key, d))
  }, [curateMode, daily.key, difficulty, bestAttempts])

  const canShareHub = useMemo(
    () => hasShareableHubProgress(GAME_KEYS.CLUELESS, daily.key),
    [daily.key, attemptsByDiff]
  )

  const cluelessStatsDailyFooter = useMemo(() => {
    const att = DIFFS.map((d) => loadBestAttempts(daily.key, d))
    return {
      dateKey: daily.key,
      completions: att.map((a) => a != null),
      perfects: att.map((a) => a === 1),
      cluelessAttempts: att,
    }
  }, [daily.key, bestAttempts, difficulty])

  /** Pause while post-win CTA is showing (“Next Puzzle” or “All Puzzles”). */
  const pauseForHubCompleteCta = useMemo(() => !curateMode && solved, [curateMode, solved])

  useSuiteCompletionTimer(GAME_KEYS.CLUELESS, daily.key, {
    track: !curateMode,
    alreadyFullyComplete: isSuiteCompleteForPrefs(GAME_KEYS.CLUELESS, daily.key),
    pauseForHubCompleteCta,
  })

  useEffect(() => {
    if (curateMode) return
    persistHubDailySlot(GAME_KEYS.CLUELESS, daily.key, difficultyIdx)
  }, [curateMode, daily.key, difficultyIdx])

  useEffect(() => {
    if (curateMode) return
    const c = clampDailyIndexToTierPrefs(GAME_KEYS.CLUELESS, difficultyIdx)
    if (c !== difficultyIdx) setDifficultyIdx(c)
  }, [curateMode, suitePrefsEpoch, difficultyIdx])

  useEffect(() => {
    if (curateMode) return
    const done = isSuiteCompleteForPrefs(GAME_KEYS.CLUELESS, daily.key)
    if (allDifficultiesDoneCompletionRef.current === null) {
      allDifficultiesDoneCompletionRef.current = done
      return
    }
    if (done && !allDifficultiesDoneCompletionRef.current) {
      allDifficultiesDoneCompletionRef.current = done
      if (winCelebrationActive) {
        pendingSuiteCompletionModalRef.current = true
      } else {
        window.setTimeout(() => setShowCompletionModal(true), 500)
      }
      return
    }
    allDifficultiesDoneCompletionRef.current = done
  }, [curateMode, attemptsByDiff, winCelebrationActive, daily.key, suitePrefsEpoch])

  useEffect(() => {
    if (curateMode || winCelebrationActive) return
    if (!pendingSuiteCompletionModalRef.current) return
    if (!isSuiteCompleteForPrefs(GAME_KEYS.CLUELESS, daily.key)) {
      pendingSuiteCompletionModalRef.current = false
      return
    }
    pendingSuiteCompletionModalRef.current = false
    const t = window.setTimeout(() => setShowCompletionModal(true), 500)
    return () => window.clearTimeout(t)
  }, [winCelebrationActive, curateMode, attemptsByDiff, daily.key, suitePrefsEpoch])

  // Load/restore state whenever difficulty changes
  useEffect(() => {
    if (!daily.puzzle) return
    lastAutoWinKeyRef.current = null
    pendingSuiteCompletionModalRef.current = false
    winAnimGenRef.current += 1
    if (winAnimTimerRef.current != null) {
      clearTimeout(winAnimTimerRef.current)
      winAnimTimerRef.current = null
    }
    setWinFlourishActive(false)
    setWinCelebrationActive(false)
    const storageDiff = curateMode ? String(curateIdx) : difficulty
    const saved = loadGameState(daily.key, storageDiff, ALL_PLAYABLE_KEYS)
    const best = curateMode ? null : loadBestAttempts(daily.key, difficulty)

    let nextLocked = new Set()
    let nextSolved = false

    if (saved) {
      nextLocked = new Set(saved.locked || [])
      setGuesses(saved.guesses || {})
      setLocked(nextLocked)
      setGuessCount(typeof saved.guessCount === 'number' ? saved.guessCount : 0)
      nextSolved = !!saved.solved
      setSolved(nextSolved)
      setTriedLettersByCell(saved.triedLettersByCell || {})
      setCheckedSignatures(saved.checkedSignatures || [])
      setBestAttempts(best)
    } else if (best != null) {
      const revealed = {}
      for (const { r, c } of geometry.inputOrder) revealed[`${r},${c}`] = answers[`${r},${c}`]
      nextLocked = new Set(geometry.inputOrder.map(({ r, c }) => `${r},${c}`))
      setGuesses(revealed)
      setLocked(nextLocked)
      setGuessCount(best)
      nextSolved = true
      setSolved(true)
      setTriedLettersByCell({})
      setCheckedSignatures([])
      setBestAttempts(best)
    } else {
      setGuesses({})
      setLocked(new Set())
      setGuessCount(0)
      setSolved(false)
      setTriedLettersByCell({})
      setCheckedSignatures([])
      setBestAttempts(null)
    }

    const nextSel = nextSolved ? -1 : firstUnlockedInputIndex(geometry.inputOrder, nextLocked)
    setSelected(nextSel)
    setAxisMode('row')
    setSelectionHighlighted(true)
    setHasInteracted(false)
  }, [curateMode, curateIdx, daily.key, daily.puzzle, difficulty, geometry.inputOrder, answers])

  // Persist game state when it changes
  useEffect(() => {
    if (!daily.puzzle) return
    const storageDiff = curateMode ? String(curateIdx) : difficulty
    saveGameState(daily.key, storageDiff, {
      guesses,
      locked,
      guessCount,
      solved,
      triedLettersByCell,
      checkedSignatures,
    })
  }, [
    curateMode,
    curateIdx,
    daily.key,
    daily.puzzle,
    difficulty,
    guesses,
    locked,
    guessCount,
    solved,
    triedLettersByCell,
    checkedSignatures,
  ])

  // UI
  const { showInstructions, setShowInstructions, closeInstructions } = useInstructionsGate(
    'clueless:hasSeenInstructions',
    {
      openOnMount: false,
      initiallyClosed: curateMode,
    }
  )
  const [showLinks, setShowLinks] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [curateCopyHint, setCurateCopyHint] = useState(null)

  // ── Input handling ─────────────────────────────────────────────────────

  const advanceAfterType = useCallback(
    (fromIdx) => {
      setHasInteracted(true)
      setSelected(advanceAlongAxis(fromIdx, axisMode, geometry.inputOrder, locked))
    },
    [axisMode, geometry.inputOrder, locked]
  )

  const navigateUnlockedCell = useCallback(
    (delta) => {
      if (solved) return
      const next = nextUnlockedNavIndex(geometry.inputOrder, locked, selected, delta)
      if (next == null) return
      if (next !== selected) setAxisMode('row')
      setHasInteracted(true)
      setSelected(next)
      setSelectionHighlighted(true)
    },
    [solved, geometry.inputOrder, locked, selected]
  )

  const handleKey = useCallback(
    (key) => {
      if (solved) return
      if (selected < 0 || selected >= geometry.inputOrder.length) return

      if (key === 'Backspace') {
        const pos = geometry.inputOrder[selected]
        const k = `${pos.r},${pos.c}`
        if (locked.has(k)) return
        if (guesses[k]) {
          setGuesses((prev) => {
            const g = { ...prev }
            delete g[k]
            return g
          })
        } else {
          const prevIdx = retreatAlongAxis(selected, axisMode, geometry.inputOrder, locked)
          if (prevIdx != null) {
            setSelected(prevIdx)
            const pk = `${geometry.inputOrder[prevIdx].r},${geometry.inputOrder[prevIdx].c}`
            setGuesses((g) => {
              const ng = { ...g }
              delete ng[pk]
              return ng
            })
          }
        }
        return
      }

      if (/^[a-zA-Z]$/.test(key)) {
        const pos = geometry.inputOrder[selected]
        const k = `${pos.r},${pos.c}`
        if (locked.has(k)) return
        const letter = key.toLowerCase()
        setGuesses((prev) => ({ ...prev, [k]: letter }))
        advanceAfterType(selected)
      }
    },
    [
      solved,
      geometry.inputOrder,
      selected,
      axisMode,
      guesses,
      locked,
      advanceAfterType,
      triedLettersByCell,
    ]
  )

  const clearAllUnlockedEntries = useCallback(() => {
    if (solved) return
    setGuesses((prev) => {
      const next = {}
      for (const [k, letter] of Object.entries(prev)) {
        if (locked.has(k)) next[k] = letter
      }
      return next
    })
  }, [solved, locked])

  /** Enter runs full puzzle check in one step; the on-screen CHECK key opens the menu. */
  const checkAnswerRef = useRef(null)

  // Physical keyboard
  useEffect(() => {
    if (showInstructions) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (showCheckModal) {
          e.preventDefault()
          setShowCheckModal(false)
        }
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        navigateUnlockedCell(e.shiftKey ? -1 : 1)
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateUnlockedCell(1)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateUnlockedCell(-1)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        handleKey('Backspace')
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (showCheckModal) setShowCheckModal(false)
        checkAnswerRef.current?.()
      } else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showInstructions, showCheckModal, handleKey, navigateUnlockedCell])

  /** Solve → pause → flourish → pause → CTA (see .clueless-win-flourish-pop). */
  const WIN_PRE_FLOURISH_MS = 400
  const WIN_POST_FLOURISH_MS = 400
  const FLOURISH_DIAG_STAGGER_MS = 52
  const FLOURISH_POP_DURATION_MS = 420
  const FLOURISH_MAX_DIAG = 8

  const finalizePuzzleWin = useCallback(
    (nextGuessCount, opts = {}) => {
      const fromAutoWin = opts.fromAutoWin === true
      const attemptsUsed = Math.min(nextGuessCount, 99)
      if (!curateMode) markComplete(daily.key, difficulty, attemptsUsed)
      setBestAttempts((prev) => (prev != null && prev <= attemptsUsed ? prev : attemptsUsed))
      setSolved(true)
      setSelected(-1)
      if (fromAutoWin) {
        setLocked(new Set(geometry.inputOrder.map(({ r, c }) => `${r},${c}`)))
      }

      setWinCelebrationActive(true)
      setWinFlourishActive(false)

      const flourishMs =
        FLOURISH_MAX_DIAG * FLOURISH_DIAG_STAGGER_MS + FLOURISH_POP_DURATION_MS + 120
      if (winAnimTimerRef.current != null) {
        clearTimeout(winAnimTimerRef.current)
        winAnimTimerRef.current = null
      }
      const myGen = ++winAnimGenRef.current

      winAnimTimerRef.current = window.setTimeout(() => {
        if (myGen !== winAnimGenRef.current) return
        setWinFlourishActive(true)
        winAnimTimerRef.current = window.setTimeout(() => {
          if (myGen !== winAnimGenRef.current) return
          setWinFlourishActive(false)
          winAnimTimerRef.current = window.setTimeout(() => {
            if (myGen !== winAnimGenRef.current) return
            setWinCelebrationActive(false)
            winAnimTimerRef.current = null
          }, WIN_POST_FLOURISH_MS)
        }, flourishMs)
      }, WIN_PRE_FLOURISH_MS)
    },
    [curateMode, daily.key, difficulty, geometry.inputOrder]
  )

  // ── Check puzzle (full board) ──────────────────────────────────────────

  const checkPuzzle = useCallback(() => {
    if (solved) return

    const newCorrect = []
    const newWrong = []
    let hadAnyGuess = false

    for (const { r, c } of geometry.inputOrder) {
      const k = `${r},${c}`
      if (locked.has(k)) continue
      const guess = guesses[k]
      const answer = answers[k]
      if (!guess) continue
      hadAnyGuess = true
      if (guess === answer) newCorrect.push(k)
      else newWrong.push(k)
    }

    if (!hadAnyGuess) return

    const sig = boardCheckSignature(geometry.inputOrder, guesses)
    if (checkedSignatures.includes(sig)) return

    setCheckedSignatures((prev) => [...prev, sig])

    const nextGuessCount = guessCount + 1
    setGuessCount(nextGuessCount)

    const newLocked = new Set([...locked, ...newCorrect])
    setLocked(newLocked)

    if (newWrong.length === 0) {
      const allInputsLocked = geometry.inputOrder.every(({ r, c }) => newLocked.has(`${r},${c}`))
      if (allInputsLocked) {
        finalizePuzzleWin(nextGuessCount)
      }
    } else {
      setTriedLettersByCell((prev) => {
        const next = { ...prev }
        for (const k of newWrong) {
          const letter = guesses[k]
          if (letter) {
            const arr = next[k] ? [...next[k]] : []
            if (!arr.includes(letter)) arr.push(letter)
            next[k] = arr
          }
        }
        return next
      })
      const firstWrongIdx = geometry.inputOrder.findIndex(({ r, c }) =>
        newWrong.includes(`${r},${c}`)
      )
      if (firstWrongIdx >= 0) {
        setSelected(firstWrongIdx)
        setAxisMode('row')
      }
    }
  }, [
    solved,
    curateMode,
    geometry.inputOrder,
    guessCount,
    guesses,
    locked,
    answers,
    daily.key,
    difficulty,
    checkedSignatures,
    finalizePuzzleWin,
  ])

  // ── Check single highlighted square ─────────────────────────────────────

  const checkSelectedSquare = useCallback(() => {
    if (solved) return
    if (selected < 0 || selected >= geometry.inputOrder.length) return
    const { r, c } = geometry.inputOrder[selected]
    const k = `${r},${c}`
    if (locked.has(k)) return
    const guess = guesses[k]
    if (!guess) return

    const nextGuessCount = guessCount + 1
    setGuessCount(nextGuessCount)
    const answer = answers[k]

    if (guess === answer) {
      const newLocked = new Set([...locked, k])
      setLocked(newLocked)
      const allInputsLocked = geometry.inputOrder.every(({ r: rr, c: cc }) =>
        newLocked.has(`${rr},${cc}`)
      )
      if (allInputsLocked) {
        finalizePuzzleWin(nextGuessCount)
      }
    } else {
      setTriedLettersByCell((prev) => {
        const next = { ...prev }
        const arr = next[k] ? [...next[k]] : []
        if (!arr.includes(guess)) arr.push(guess)
        next[k] = arr
        return next
      })
    }
  }, [
    solved,
    selected,
    geometry.inputOrder,
    locked,
    guesses,
    answers,
    guessCount,
    finalizePuzzleWin,
  ])

  checkAnswerRef.current = checkPuzzle

  // Auto-solve when every entry is correct (instant green + same celebration as CHECK win).
  useEffect(() => {
    if (solved || showInstructions) return

    const allCorrect = geometry.inputOrder.every(({ r, c }) => {
      const k = `${r},${c}`
      return guesses[k] === answers[k]
    })
    if (!allCorrect) {
      lastAutoWinKeyRef.current = null
      return
    }

    const sig = boardCheckSignature(geometry.inputOrder, guesses)
    const winKey = `${daily.key}:${curateMode ? String(curateIdx) : difficulty}:${sig}`
    if (lastAutoWinKeyRef.current === winKey) return
    lastAutoWinKeyRef.current = winKey

    const nextGuessCount = Math.min(guessCount + 1, 99)
    setCheckedSignatures((prev) => (prev.includes(sig) ? prev : [...prev, sig]))
    setGuessCount((prev) => Math.min(prev + 1, 99))
    finalizePuzzleWin(nextGuessCount, { fromAutoWin: true })
  }, [
    solved,
    showInstructions,
    geometry.inputOrder,
    guesses,
    answers,
    daily.key,
    difficulty,
    curateMode,
    curateIdx,
    guessCount,
    finalizePuzzleWin,
  ])

  useEffect(() => {
    if (solved) setShowCheckModal(false)
  }, [solved])

  // ── Cell click ─────────────────────────────────────────────────────────

  const selectCell = useCallback(
    (idx) => {
      if (solved) return
      const { r, c } = geometry.inputOrder[idx]
      if (locked.has(`${r},${c}`)) return
      setSelectionHighlighted(true)
      if (selectedRef.current === idx) {
        setAxisMode((m) => (m === 'row' ? 'col' : 'row'))
      } else {
        setAxisMode('row')
        setSelected(idx)
      }
      setHasInteracted(true)
    },
    [solved, geometry.inputOrder, locked]
  )

  // ── Render helpers ─────────────────────────────────────────────────────

  const hasCheckableLetter = geometry.inputOrder.some(({ r, c }) => {
    const k = `${r},${c}`
    return !locked.has(k) && !!guesses[k]
  })

  const currentBoardSig = boardCheckSignature(geometry.inputOrder, guesses)
  const boardAlreadyChecked = checkedSignatures.includes(currentBoardSig)
  const canCheckPuzzle = hasCheckableLetter && !boardAlreadyChecked

  const base = import.meta.env.BASE_URL
  const nextUnsolvedIdx = nextIncompleteEnabledTierExcluding(
    GAME_KEYS.CLUELESS,
    daily.key,
    difficultyIdx
  )

  const cluelessPostSolveCtaAttention = !winCelebrationActive

  const postSolveCta = useMemo(() => {
    void suitePrefsEpoch
    const att = cluelessPostSolveCtaAttention
    if (curateMode) {
      return curateIdx < roster.length - 1 ? (
        <PostSolvePrimaryButton attention={att} onClick={() => setCurateIdx((j) => j + 1)}>
          Next Puzzle
        </PostSolvePrimaryButton>
      ) : null
    }
    if (nextUnsolvedIdx != null) {
      return (
        <PostSolvePrimaryButton attention={att} onClick={() => setDifficultyIdx(nextUnsolvedIdx)}>
          Next Puzzle
        </PostSolvePrimaryButton>
      )
    }
    return (
      <PostSolvePrimaryLink
        attention={att}
        href={base}
        style={{
          textAlign: 'center',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        All Puzzles
      </PostSolvePrimaryLink>
    )
  }, [
    curateMode,
    curateIdx,
    roster.length,
    nextUnsolvedIdx,
    base,
    cluelessPostSolveCtaAttention,
    daily.key,
    suitePrefsEpoch,
  ])

  const handleStatsClick = useCallback(async () => {
    if (curateMode) {
      const entry = roster[curateIdx]
      const p = entry?.puzzle
      if (!p) return
      const text = formatCurateClipboard('clueless', entry.tier, entry.indexInTier + 1, p, 200)
      try {
        await navigator.clipboard.writeText(text)
        setCurateCopyHint('Copied puzzle id')
      } catch {
        setCurateCopyHint('Copy failed')
      }
      window.setTimeout(() => setCurateCopyHint(null), 2500)
      return
    }
    setShowStats(true)
  }, [curateMode, roster, curateIdx])

  // Letters already tried (wrong) in the selected cell, for keyboard highlighting
  const selectedKey =
    !solved && selected >= 0 && selected < geometry.inputOrder.length
      ? `${geometry.inputOrder[selected].r},${geometry.inputOrder[selected].c}`
      : null
  const triedInSelected = selectedKey ? triedLettersByCell[selectedKey] || [] : []

  const selPos =
    !solved && selected >= 0 && selected < geometry.inputOrder.length
      ? geometry.inputOrder[selected]
      : null

  let canCheckSelectedSquare = false
  if (selected >= 0 && selected < geometry.inputOrder.length) {
    const { r, c } = geometry.inputOrder[selected]
    const sk = `${r},${c}`
    canCheckSelectedSquare = !locked.has(sk) && !!guesses[sk]
  }

  const canOpenCheckMenu = canCheckPuzzle || canCheckSelectedSquare

  // ── Grid cells ─────────────────────────────────────────────────────────

  const GOLD_FILL = '#faa80a'
  const WRONG_COLOR = '#9d270c'
  const CORRECT_COLOR = '#6b9b3b'
  const CORRECT_BORDER = '#6b9b3b'
  const SMALL_TILE_INSET = 5
  const LARGE_TILE_INSET = 2
  const ENTRY_BORDER_WIDTH = '0.6vmin'
  const ACTIVE_CELL_FILL = '#fff0cb'

  const cells = []
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const key = `${r},${c}`

      const inBand =
        hasInteracted &&
        selPos != null &&
        ((axisMode === 'row' && r === selPos.r) || (axisMode === 'col' && c === selPos.c))

      const slotStyle = {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        userSelect: 'none',
      }

      const sizeForInset = (inset) => `calc(100% - ${inset * 2}px)`

      if (BLOCKED.has(key)) {
        cells.push(
          <div key={key} style={slotStyle}>
            <div
              style={{
                width: sizeForInset(SMALL_TILE_INSET),
                height: sizeForInset(SMALL_TILE_INSET),
                background: '#ffffff',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )
        continue
      }

      if (geometry.clueCells.has(key)) {
        const clueIsLarge = inBand
        const clueInset = clueIsLarge ? LARGE_TILE_INSET : SMALL_TILE_INSET
        const diagFlourish = r + c
        const clueFlourish = solved && winFlourishActive
        cells.push(
          <div key={key} style={slotStyle}>
            <div
              className={clueFlourish ? 'clueless-win-flourish-pop' : undefined}
              style={{
                width: sizeForInset(clueInset),
                height: sizeForInset(clueInset),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: GOLD_FILL,
                color: '#ffffff',
                border: clueIsLarge ? `${ENTRY_BORDER_WIDTH}px solid ${GOLD_FILL}` : 'none',
                fontWeight: 900,
                fontSize: clueIsLarge ? CLUELESS_INPUT_FONT : CLUELESS_CLUE_FONT,
                transition: 'width 0.15s ease, height 0.15s ease, font-size 0.15s ease',
                textTransform: 'uppercase',
                boxSizing: 'border-box',
                ...(clueFlourish
                  ? {
                      ['--clueless-flourish-wave']: diagFlourish,
                      ['--clueless-flourish-stagger']: `${FLOURISH_DIAG_STAGGER_MS}ms`,
                      ['--clueless-flourish-pop-duration']: `${FLOURISH_POP_DURATION_MS}ms`,
                    }
                  : {}),
              }}
            >
              {clues[key] || ''}
            </div>
          </div>
        )
        continue
      }

      const idx = geometry.inputIndexByKey.get(key) ?? -1
      const isSelected = idx === selected && !solved
      const isLocked = locked.has(key)
      const isWrong = cellGuessShowsWrong(key, locked, guesses, triedLettersByCell)
      const letter = guesses[key] || ''

      let bg = '#ffffff'
      let color = PUZZLE_SUITE_INK
      let borderColor = PUZZLE_SUITE_INK
      let borderWidth = ENTRY_BORDER_WIDTH
      let tileInset = LARGE_TILE_INSET
      let tileFontSize = CLUELESS_INPUT_FONT

      // Base state: correct / wrong / default
      if (isLocked) {
        // Correct cells: small solid green tiles with small white letters,
        // growing to entry size when in the active row/column band.
        bg = CORRECT_COLOR
        color = '#ffffff'
        borderColor = CORRECT_COLOR
        borderWidth = 0
        tileInset = inBand ? LARGE_TILE_INSET : SMALL_TILE_INSET
        tileFontSize = inBand ? CLUELESS_INPUT_FONT : CLUELESS_CLUE_FONT
      } else if (isWrong) {
        bg = '#ffffff'
        color = WRONG_COLOR
        borderColor = WRONG_COLOR
      }

      // Selection overlay: pale gold fill on the active cell (except locked)
      if (isSelected && selectionHighlighted && !isLocked) {
        bg = ACTIVE_CELL_FILL
      }

      const diagFlourish = r + c
      const entryFlourish = solved && winFlourishActive && isLocked

      const innerTileCommon = {
        width: sizeForInset(tileInset),
        height: sizeForInset(tileInset),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: tileFontSize,
        textTransform: 'uppercase',
        boxSizing: 'border-box',
      }

      cells.push(
        <div
          key={key}
          onClick={() => selectCell(idx)}
          style={{
            ...slotStyle,
            cursor: solved || isLocked ? 'default' : 'pointer',
          }}
        >
          <div
            className={entryFlourish ? 'clueless-win-flourish-pop' : undefined}
            style={{
              ...innerTileCommon,
              background: bg,
              color,
              border: `${borderWidth} solid ${borderColor}`,
              transition:
                'width 0.15s ease, height 0.15s ease, font-size 0.15s ease, background 0.15s, border-color 0.15s',
              ...(entryFlourish
                ? {
                    ['--clueless-flourish-wave']: diagFlourish,
                    ['--clueless-flourish-stagger']: `${FLOURISH_DIAG_STAGGER_MS}ms`,
                    ['--clueless-flourish-pop-duration']: `${FLOURISH_POP_DURATION_MS}ms`,
                  }
                : {}),
            }}
          >
            {letter}
          </div>
        </div>
      )
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="game-container clueless">
      <TopBar
        title={chrome.title}
        onHome={() => {
          window.location.href = base
        }}
        onCube={() => setShowLinks(true)}
        linksViaTitleOnly
        puzzleChrome={{
          gameKey: GAME_KEYS.CLUELESS,
          onStats: handleStatsClick,
          onHelp: () => setShowInstructions(true),
          hasTutorial: false,
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
              <span className="stats-label">Guesses</span>
              <span className="stats-num">{Math.min(guessCount, 99)}</span>
            </>
          }
        />
      ) : (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Guesses</span>
            <span className="stats-num">{Math.min(guessCount, 99)}</span>
          </div>
          <div className="selector-group" style={{ flexDirection: 'column', gap: '4px' }}>
            <div className="level-label" style={{ textAlign: 'center' }}>
              <span className="sub">{dateLabel}</span>
            </div>
            <div
              className="game-dice-share-anchor"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {tierSlots.map((i) => {
                  const label = ['Easy', 'Med', 'Hard'][i]
                  const isActive = i === difficultyIdx
                  const a = attemptsByDiff[i]
                  const done = a != null
                  const content = done ? (
                    a === 1 ? (
                      <HubDiceStar />
                    ) : (
                      String(Math.min(a, 99))
                    )
                  ) : (
                    <DiceFace count={i + 1} size={20} />
                  )
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDifficultyIdx(i)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        background: done
                          ? '#6b9b3b'
                          : isActive
                            ? PUZZLE_SUITE_INK
                            : PUZZLE_SUITE_SURFACE_INCOMPLETE,
                        color: done || isActive ? '#fff' : PUZZLE_SUITE_INK,
                        fontWeight: 900,
                        fontSize: '0.94rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        transform: isActive ? 'scale(1.1)' : 'scale(1)',
                        transformOrigin: 'center center',
                      }}
                      aria-label={`Select ${label}`}
                    >
                      {content}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="level-nav__right-slot">
            <GameShareNavButton
              gameKey={GAME_KEYS.CLUELESS}
              dateKey={daily.key}
              canShare={canShareHub}
            />
          </div>
        </div>
      )}

      {/* STATUS MESSAGE */}
      <div
        className="clueless-status"
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: solved ? CORRECT_COLOR : PUZZLE_SUITE_INK,
          minHeight: '1.35em',
          lineHeight: 1.35,
        }}
      >
        {solved ? 'Solved!' : '\u00a0'}
      </div>

      {/* GAME BOARD + check modal + keyboard (shared stage width) */}
      {/*
       * Size the grid to fit whatever vertical space is left after the
       * fixed chrome (header ~60px, nav ~60px, status ~24px, keyboard
       * ~170px, bottom padding ~32px = ~346px total).  We also cap it
       * at the viewport width so it stays square on wide screens.
       * flex-shrink:0 on the outer div prevents the flex column from
       * squashing the board when the keyboard rows are tall.
       */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '6px 0',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: CLUELESS_STAGE_MAX_WIDTH,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              position: 'relative',
              background: '#fff',
              minWidth: '200px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gridTemplateRows: 'repeat(5, 1fr)',
                width: '100%',
                height: '100%',
              }}
            >
              {cells}
            </div>
          </div>
          {/* Keyboard while playing; CTA as soon as solved (same band min-height either way — no layout jump). */}
          <div
            style={{
              marginTop: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: '4px',
              width: '100%',
              flexShrink: 0,
              minHeight: CLUELESS_KEYBOARD_BAND_MIN_HEIGHT,
            }}
          >
            {solved ? (
              postSolveCta
            ) : (
              <>
                {KB_ROWS.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                    {ri === 2 && (
                      <button
                        type="button"
                        aria-label="Clear all entries"
                        className="clueless-action-key"
                        disabled={solved}
                        onClick={clearAllUnlockedEntries}
                        style={{
                          minWidth: 'clamp(36px, 9vw, 52px)',
                          height: 'clamp(32px, 7vh, 50px)',
                        }}
                      >
                        <i
                          className="fas fa-arrow-rotate-left"
                          style={{ fontSize: '1.5em' }}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                    {[...row].map((ch) => {
                      const isTried = triedInSelected.includes(ch.toLowerCase())
                      return (
                        <button
                          key={ch}
                          type="button"
                          disabled={isTried || solved}
                          onClick={() => {
                            if (!isTried && !solved) handleKey(ch)
                          }}
                          className={isTried ? 'clueless-key clueless-key--tried' : 'clueless-key'}
                          style={{
                            minWidth: 'clamp(24px, 7vw, 36px)',
                            height: 'clamp(32px, 7vh, 50px)',
                            fontSize: 'clamp(0.7rem, 2.5vw, 1rem)',
                          }}
                        >
                          {ch}
                        </button>
                      )
                    })}
                    {ri === 2 && (
                      <>
                        <button
                          type="button"
                          aria-label="Backspace"
                          className="clueless-action-key"
                          disabled={solved}
                          onClick={() => handleKey('Backspace')}
                          style={{
                            minWidth: 'clamp(36px, 9vw, 52px)',
                            height: 'clamp(32px, 7vh, 50px)',
                          }}
                        >
                          <i
                            className="fa-solid fa-delete-left"
                            style={{ fontSize: '1.5em' }}
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          className="clueless-action-key clueless-check-key"
                          disabled={solved || !canOpenCheckMenu}
                          onClick={() => {
                            if (canOpenCheckMenu) setShowCheckModal(true)
                          }}
                          style={{
                            minWidth: 'clamp(36px, 9vw, 52px)',
                            height: 'clamp(32px, 7vh, 50px)',
                            fontSize: 'clamp(0.55rem, 1.8vw, 0.75rem)',
                          }}
                        >
                          CHECK
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* INSTRUCTIONS OVERLAY */}
      <SharedModalShell
        show={showInstructions}
        onClose={closeInstructions}
        intent={MODAL_INTENTS.INSTRUCTIONS}
      >
        <h1 className="title" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          Clueless
        </h1>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <CluelessIcon size={80} />
          </div>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '1rem' }}>
            Each puzzle uses six five-letter, classroom-appropriate words — no plurals, proper
            nouns, abbreviations, or acronyms.
          </p>
        </div>

        <button className="btn-primary" onClick={closeInstructions}>
          Play
        </button>
      </SharedModalShell>

      <AllTenLinksModal show={showLinks} onClose={() => setShowLinks(false)} />
      <SimpleGameStatsModal
        show={showStats}
        onClose={() => setShowStats(false)}
        gameKey={GAME_KEYS.CLUELESS}
        dailySuiteFooter={cluelessStatsDailyFooter}
      />
      <SuiteGameCompletionModal
        show={showCompletionModal && !curateMode && !winCelebrationActive}
        onClose={() => setShowCompletionModal(false)}
        gameKey={GAME_KEYS.CLUELESS}
        dateKey={daily.key}
        hubDiceCompletions={attemptsByDiff.map((a) => a != null)}
        hubDicePerfects={attemptsByDiff.map((a) => a === 1)}
        hubCluelessAttempts={attemptsByDiff}
      />

      {showCheckModal && (
        <div
          className="floating-modal-backdrop clueless-check-modal-backdrop"
          role="presentation"
          onClick={() => setShowCheckModal(false)}
        >
          <div
            className="floating-modal-panel shared-modal-content clueless-check-modal-panel"
            role="dialog"
            aria-label="Check options"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="shared-modal-close"
              onClick={() => setShowCheckModal(false)}
              aria-label={getModalCloseAriaLabel()}
            >
              ✕
            </button>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                className="btn-secondary"
                disabled={!canCheckPuzzle}
                onClick={() => {
                  setShowCheckModal(false)
                  checkPuzzle()
                }}
              >
                Check puzzle
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!canCheckSelectedSquare}
                onClick={() => {
                  setShowCheckModal(false)
                  checkSelectedSquare()
                }}
              >
                Check square
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowCheckModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import puzzleData from './puzzles.js'
import { fillColor, FOLDS_OVERLAP_MIX } from './palette.js'
import { applyFoldsDailyPresentation } from './foldsDailyPresentation.js'
import {
  S,
  H,
  PAD,
  N,
  up,
  cent,
  pts,
  HEX_POLY,
  HEX_BOUNDS,
  HEX_ROTATE_DEG,
  HEX_ROTATED_VIEWBOX,
  isInsideHex,
  isPointInsideHex,
  snap,
  ALL_TRIANGLES,
  FOLD_FLOURISH_MIN_RC,
  isBoardOuterEdgeFoldLine,
} from './foldsGeometry.js'
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
import FoldsIcon from '../../src/shared/icons/FoldsIcon.jsx'
import DismissibleHintToast from '../../src/shared/DismissibleHintToast.jsx'
import { buildTierRoster, formatCurateClipboard } from '../../src/shared/curateRoster.js'
import { useCurateModeFromRoster } from '../../src/shared/useCurateMode.js'
import { CurateCopyToast, CurateLevelNav } from '../../src/shared/CurateModeChrome.jsx'
import SmartRightButton from '../../src/shared/SmartRightButton.jsx'
import { getDailyKey, getDateLabel, getDayIndex } from '@shared-contracts/dailyPuzzleDate.js'

/** Clueless-style wave flourish: cap × stagger + pop + tail (keep in sync with `src/shared/style.css` `.folds-win-flourish-pop`). */
const FOLDS_FLOURISH_STAGGER_MS = 52
const FOLDS_FLOURISH_POP_MS = 420
const FOLDS_FLOURISH_WAVE_CAP = 14
const FOLDS_WIN_FLOURISH_TOTAL_MS =
  FOLDS_FLOURISH_WAVE_CAP * FOLDS_FLOURISH_STAGGER_MS + FOLDS_FLOURISH_POP_MS + 120
/** Crossfade from solved board → start board before replaying folds. */
const FOLDS_WIN_REWIND_FADE_MS = 800
/** After replay: delay before flourish (0 = none; still one async tick via setTimeout). */
const FOLDS_WIN_REPLAY_PAUSE_MS = 100

const ANIM_MS = 450
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
/** Emphasized fold line / touch confirm (lighter than suite ink for legibility on the grid). */
const FOLD_LINE_ACCENT = '#205786'

function foldFlourishWaveIndex(r, c) {
  return Math.min(FOLDS_FLOURISH_WAVE_CAP, Math.max(0, r + c - FOLD_FLOURISH_MIN_RC))
}

const triangleVertices = (r, c) => {
  const s = pts(r, c)
  return s.split(' ').map((p) => {
    const [x, y] = p.split(',').map(Number)
    return { x, y }
  })
}

function pointToSegmentDistSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return (px - x1) ** 2 + (py - y1) ** 2
  let t = ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const qx = x1 + t * dx,
    qy = y1 + t * dy
  return (px - qx) ** 2 + (py - qy) ** 2
}

function getFoldButtonPosition(line, anchor) {
  const midX = (line.x1 + line.x2) / 2,
    midY = (line.y1 + line.y2) / 2
  if (!anchor || typeof anchor.x !== 'number' || typeof anchor.y !== 'number')
    return { cx: midX, cy: midY }
  const ax = anchor.x,
    ay = anchor.y
  const a = -Math.sin(line.theta),
    b = Math.cos(line.theta),
    c = a * line.px + b * line.py
  const onLine = (x, y) => Math.abs(a * x + b * y - c) < 1e-6
  const lineLen2 = (line.x2 - line.x1) ** 2 + (line.y2 - line.y1) ** 2

  let bestDist2 = Infinity,
    bestCx = midX,
    bestCy = midY

  const [r0, c0] = snap(ax, ay)
  const candidates = []
  if (isInsideHex(r0, c0)) candidates.push([r0, c0])
  const re = Math.round((ay - PAD) / H),
    ce = Math.round((2 * (ax - PAD)) / S) - 1
  for (let r = Math.max(0, re - 3); r <= Math.min(10, re + 3); r++)
    for (let col = Math.max(-6, ce - 4); col <= Math.min(20, ce + 4); col++) {
      if (!isInsideHex(r, col)) continue
      if (candidates.some(([rr, cc]) => rr === r && cc === col)) continue
      candidates.push([r, col])
    }

  for (const [r, col] of candidates) {
    const verts = triangleVertices(r, col)
    for (let i = 0; i < 3; i++) {
      const v0 = verts[i],
        v1 = verts[(i + 1) % 3]
      if (!onLine(v0.x, v0.y) || !onLine(v1.x, v1.y)) continue
      const dist2 = pointToSegmentDistSq(ax, ay, v0.x, v0.y, v1.x, v1.y)
      if (dist2 < bestDist2) {
        bestDist2 = dist2
        bestCx = (v0.x + v1.x) / 2
        bestCy = (v0.y + v1.y) / 2
      }
    }
  }

  if (bestDist2 < Infinity) return { cx: bestCx, cy: bestCy }

  if (lineLen2 >= 1e-12) {
    const dx = line.x2 - line.x1,
      dy = line.y2 - line.y1
    let t = ((ax - line.x1) * dx + (ay - line.y1) * dy) / lineLen2
    t = Math.max(0, Math.min(1, t))
    let px = line.x1 + t * dx,
      py = line.y1 + t * dy
    const vEps = 8
    if ((px - line.x1) ** 2 + (py - line.y1) ** 2 < vEps * vEps)
      t = Math.min(1, vEps / Math.sqrt(lineLen2))
    else if ((px - line.x2) ** 2 + (py - line.y2) ** 2 < vEps * vEps)
      t = Math.max(0, 1 - vEps / Math.sqrt(lineLen2))
    px = line.x1 + t * dx
    py = line.y1 + t * dy
    return { cx: px, cy: py }
  }
  return { cx: midX, cy: midY }
}

const ALL_LINES = (() => {
  const seen = {},
    lines = []
  const addLine = (theta, px, py) => {
    const tn = ((theta % Math.PI) + Math.PI) % Math.PI,
      a = -Math.sin(tn),
      b = Math.cos(tn),
      c = a * px + b * py
    const key = `${Math.round(tn * 1000)}_${Math.round(c * 100)}`
    if (seen[key]) return
    const hits = []
    for (let i = 0; i < HEX_POLY.length; i++) {
      const p1 = HEX_POLY[i],
        p2 = HEX_POLY[(i + 1) % HEX_POLY.length],
        dx = p2.x - p1.x,
        dy = p2.y - p1.y,
        denom = a * dx + b * dy
      if (Math.abs(denom) < 1e-9) continue
      const t = (c - (a * p1.x + b * p1.y)) / denom
      if (t >= -0.01 && t <= 1.01) hits.push({ x: p1.x + t * dx, y: p1.y + t * dy })
    }
    if (hits.length >= 2) {
      let dMax = -1,
        pA = hits[0],
        pB = hits[1]
      for (let i = 0; i < hits.length; i++)
        for (let j = i + 1; j < hits.length; j++) {
          const d = (hits[i].x - hits[j].x) ** 2 + (hits[i].y - hits[j].y) ** 2
          if (d > dMax) {
            dMax = d
            pA = hits[i]
            pB = hits[j]
          }
        }
      seen[key] = true
      lines.push({ lineKey: key, theta: tn, px, py, x1: pA.x, y1: pA.y, x2: pB.x, y2: pB.y })
    }
  }
  for (let r = -1; r <= 9; r++)
    for (let c = -1; c <= 17; c++) {
      const x = PAD + (c * S) / 2,
        y = PAD + r * H
      if (up(r, c)) {
        addLine(Math.atan2(H, -S / 2), x + S / 2, y)
        addLine(Math.atan2(H, S / 2), x + S / 2, y)
        addLine(0, x, y + H)
      } else {
        addLine(0, x, y)
        addLine(Math.atan2(H, -S / 2), x, y)
        addLine(Math.atan2(H, S / 2), x + S, y)
      }
    }
  return lines.map((line) => ({
    ...line,
    isBoardOuterEdge: isBoardOuterEdgeFoldLine(line),
  }))
})()

/** Fold lines the player can select (excludes the six outer-hex boundary creases). */
const INTERACTIVE_FOLD_LINES = ALL_LINES.filter((l) => !l.isBoardOuterEdge)

/** Half of fold-hit strokeWidth (22) in grid space — a sample counts only if within this distance of a segment. */
const FOLD_PICK_TOL = 11
const FOLD_PICK_TOL_SQ = FOLD_PICK_TOL * FOLD_PICK_TOL
/** Squared grid displacement from first sample; below this, skip multi-sample refinement (tap-like). */
const FOLD_TRACE_MIN_DISP_SQ = 12 * 12
const FOLD_TRACE_MIN_SAMPLES = 5
const FOLD_TRACE_MIN_FRACTION = 0.42
const FOLD_TRACE_MIN_COUNT_LEAD = 2

/**
 * Pick the fold line best supported by stroke samples. Only lines within FOLD_PICK_TOL count.
 * Returns null if ambiguous or weak evidence (no global closest-line fallback).
 */
function pickLineFromStrokePoints(points, lines = INTERACTIVE_FOLD_LINES) {
  if (!points || points.length < FOLD_TRACE_MIN_SAMPLES) return null
  const n = points.length
  const scored = lines.map((line) => {
    let cnt = 0
    let sumD = 0
    for (const p of points) {
      const d2 = pointToSegmentDistSq(p.x, p.y, line.x1, line.y1, line.x2, line.y2)
      if (d2 <= FOLD_PICK_TOL_SQ) {
        cnt++
        sumD += Math.sqrt(d2)
      }
    }
    return { line, cnt, meanD: cnt > 0 ? sumD / cnt : Infinity }
  })
  scored.sort((a, b) => b.cnt - a.cnt || a.meanD - b.meanD)
  const win = scored[0]
  const second = scored[1]
  if (!win || win.cnt === 0) return null
  if (win.cnt / n < FOLD_TRACE_MIN_FRACTION) return null
  if (second && win.cnt - second.cnt < FOLD_TRACE_MIN_COUNT_LEAD) return null
  const last = points[points.length - 1]
  return { lineKey: win.line.lineKey, anchor: last }
}

// ── Daily helpers ────────────────────────────────────────────────────────────

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
  return [0, 1, 2].map((i) => ['1', '2'].includes(localStorage.getItem(`folds:${dateKey}:${i}`)))
}

function loadPerfects(dateKey) {
  return [0, 1, 2].map((i) => localStorage.getItem(`folds:${dateKey}:${i}`) === '2')
}

function markComplete(dateKey, idx, isPerfect) {
  const key = `folds:${dateKey}:${idx}`
  const existing = localStorage.getItem(key)
  if (existing === '1' || existing === '2') return
  localStorage.setItem(key, isPerfect ? '2' : '1')
}

function foldsWipKey(dateKey, idx) {
  return `folds:${dateKey}:${idx}:wip`
}

function foldsLevelFingerprint(puzzle) {
  if (!puzzle) return ''
  return JSON.stringify({ s: puzzle.start, t: puzzle.target, f: puzzle.folds })
}

function clearFoldsWip(dateKey, idx) {
  try {
    localStorage.removeItem(foldsWipKey(dateKey, idx))
  } catch {
    // ignore
  }
}

function loadFoldsWip(dateKey, idx, puzzle) {
  const fp = foldsLevelFingerprint(puzzle)
  if (!fp) return null
  try {
    const raw = localStorage.getItem(foldsWipKey(dateKey, idx))
    if (!raw) return null
    const d = JSON.parse(raw)
    if (
      !d ||
      d.v !== 1 ||
      d.fp !== fp ||
      typeof d.board !== 'object' ||
      !Array.isArray(d.history) ||
      typeof d.folds !== 'number'
    ) {
      return null
    }
    return { board: d.board, history: d.history, folds: d.folds }
  } catch {
    return null
  }
}

function saveFoldsWip(dateKey, idx, puzzle, board, folds, history) {
  const fp = foldsLevelFingerprint(puzzle)
  if (!fp) return
  try {
    localStorage.setItem(
      foldsWipKey(dateKey, idx),
      JSON.stringify({ v: 1, fp, board, folds, history })
    )
  } catch {
    // ignore
  }
}

function boardsMatchTarget(board, target) {
  const tK = Object.keys(target),
    bK = Object.keys(board)
  if (bK.length !== tK.length) return false
  for (const k of tK) if (board[k] !== target[k]) return false
  return true
}

const FOLD_RESULT_TOL_SQ = (S * 0.6) ** 2

/** Pure fold step for replay / sequence inference (mirrors `handleFold` geometry). */
function computeFoldedBoardFromBoard(board, lineKey) {
  const line = ALL_LINES.find((l) => l.lineKey === lineKey)
  if (!line) return null
  const next = { ...board }
  const lostKeys = {}
  const c2 = Math.cos(2 * line.theta),
    s2 = Math.sin(2 * line.theta)
  for (const [key, color] of Object.entries(board)) {
    const [r, c] = key.split(',').map(Number)
    const cp = cent(r, c)
    const nx = line.px + (cp.x - line.px) * c2 + (cp.y - line.py) * s2
    const ny = line.py + (cp.x - line.px) * s2 - (cp.y - line.py) * c2
    const [nr, nc] = snap(nx, ny)
    const sp = cent(nr, nc)
    const dist2 = (sp.x - nx) ** 2 + (sp.y - ny) ** 2
    if (isPointInsideHex(nx, ny) && isInsideHex(nr, nc) && dist2 <= FOLD_RESULT_TOL_SQ) {
      const destKey = `${nr},${nc}`
      const prev = next[destKey]
      if (prev === undefined || prev === color) next[destKey] = color
      else next[destKey] = FOLDS_OVERLAP_MIX
    } else {
      lostKeys[key] = true
    }
  }
  return { next, lostKeys, line }
}

function boardsEqual(a, b) {
  const ak = Object.keys(a)
  if (ak.length !== Object.keys(b).length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/** Returns line keys between consecutive history boards, or `null` if any step is ambiguous. */
function inferFoldSequence(historyBoards) {
  if (!historyBoards || historyBoards.length < 2) return []
  const lineKeys = []
  for (let i = 0; i < historyBoards.length - 1; i++) {
    const prev = historyBoards[i]
    const exp = historyBoards[i + 1]
    let found = null
    for (const l of INTERACTIVE_FOLD_LINES) {
      const r = computeFoldedBoardFromBoard(prev, l.lineKey)
      if (r && boardsEqual(r.next, exp)) {
        found = l.lineKey
        break
      }
    }
    if (found == null) return null
    lineKeys.push(found)
  }
  return lineKeys
}

// ── Puzzle boxes ─────────────────────────────────────────────────────────────
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

const FOLDS_TUTORIAL_HINT_TOUCH =
  'Tap or trace a fold line to select it, then use the FOLD button to fold the colored triangles onto the faded ones.'
const FOLDS_TUTORIAL_HINT_FINE_POINTER =
  'Select a fold line to fold the colored triangles onto the faded ones.'
const FOLDS_TUTORIAL_HINT_TWO_FOLDS = 'It takes two folds to match this pattern.'

// ── Main component ───────────────────────────────────────────────────────────
const Folds = () => {
  const chrome = getGameChrome(GAME_KEYS.FOLDS)
  const daily = useMemo(() => getDailyPuzzles(), [])
  const dateLabel = useMemo(() => getDateLabel(daily.key), [daily.key])
  const roster = useMemo(() => buildTierRoster(puzzleData), [])
  const { curateMode, curateIdx, setCurateIdx, exitCurateHref } = useCurateModeFromRoster(roster)

  const usedUndoOrResetRef = useRef(false)
  const [mode, setMode] = useState(
    () => getInitialTutorialNav(GAME_KEYS.FOLDS, puzzleData.tutorial ?? []).mode
  )
  const [tutorialIdx, setTutorialIdx] = useState(
    () => getInitialTutorialNav(GAME_KEYS.FOLDS, puzzleData.tutorial ?? []).tutorialIdx
  )
  const [dailyIdx, setDailyIdx] = useState(() =>
    resolveHubDailySlotWithPrefs(
      GAME_KEYS.FOLDS,
      getDailyKey(),
      typeof window !== 'undefined' ? window.location.search : ''
    )
  )
  const suitePrefsEpoch = useSuitePrefsEpoch()
  const tierSlots = useMemo(() => {
    void suitePrefsEpoch
    return getEnabledTierIndices(GAME_KEYS.FOLDS)
  }, [suitePrefsEpoch])
  const [completions, setCompletions] = useState(() => loadCompletions(daily.key))
  const [perfects, setPerfects] = useState(() => loadPerfects(daily.key))
  const canShareHub = useMemo(
    () => hasShareableHubProgress(GAME_KEYS.FOLDS, daily.key),
    [daily.key, completions]
  )
  const {
    hasSeenInstructions,
    showInstructions,
    setShowInstructions,
    closeInstructions: closeInstructionsBase,
  } = useInstructionsGate('folds:hasSeenInstructions', {
    openOnMount: !curateMode,
    completionStoragePrefix: 'folds',
    initiallyClosed: curateMode,
  })
  const [showLinks, setShowLinks] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [curateCopyHint, setCurateCopyHint] = useState(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const allDailyDoneCompletionRef = useRef(null)
  /** When the suite becomes all-complete during daily play, open modal after win flourish (not during rewind/replay). */
  const pendingSuiteModalAfterCelebrationRef = useRef(false)

  const [tutorialHint1Dismissed, setTutorialHint1Dismissed] = useState(false)
  /** Puzzle 5 in the UI (tutorial index 4): two-folds hint. */
  const [tutorialHintTwoFoldsDismissed, setTutorialHintTwoFoldsDismissed] = useState(false)
  const [tutorialHintStarDismissed, setTutorialHintStarDismissed] = useState(false)
  const [coarsePointer, setCoarsePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  )

  useEffect(() => {
    if (!curateMode) persistTutorialResumeState(GAME_KEYS.FOLDS, mode, tutorialIdx)
  }, [curateMode, mode, tutorialIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    persistHubDailySlot(GAME_KEYS.FOLDS, daily.key, dailyIdx)
  }, [curateMode, mode, daily.key, dailyIdx])

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const c = clampDailyIndexToTierPrefs(GAME_KEYS.FOLDS, dailyIdx)
    if (c !== dailyIdx) setDailyIdx(c)
  }, [curateMode, mode, suitePrefsEpoch, dailyIdx])

  const [tapFlash, setTapFlash] = useState(null)
  const [hoverLine, setHoverLine] = useState(null)
  const [pendingFoldLine, setPendingFoldLine] = useState(null)
  const [pendingFoldAnchor, setPendingFoldAnchor] = useState(null)
  const pendingFoldLineRef = useRef(null)
  const svgRef = useRef(null)
  const canvasWrapperRef = useRef(null)
  const t0 = useRef(0)
  const hoverDelayRef = useRef(null)
  const ignoreBoardPointerUntilRef = useRef(0)
  const foldTracePointerIdRef = useRef(null)
  const foldTraceActiveRef = useRef(false)
  const foldTraceSamplesRef = useRef([])
  const foldTraceFirstRef = useRef(null)
  const foldTraceMaxDispSqRef = useRef(0)
  const foldTraceListenersRef = useRef(null)
  const foldTraceHitLineKeyRef = useRef(null)

  const clientToGrid = useCallback((clientX, clientY) => {
    const svg = svgRef.current
    if (!svg || !svg.createSVGPoint) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse())
    const cx = HEX_BOUNDS.minX + HEX_BOUNDS.width / 2
    const cy = HEX_BOUNDS.minY + HEX_BOUNDS.height / 2
    const angle = -Math.PI / 6
    const cos = Math.cos(angle),
      sin = Math.sin(angle)
    const rx = svgPt.x - cx,
      ry = svgPt.y - cy
    return { x: cx + rx * cos - ry * sin, y: cy + rx * sin + ry * cos }
  }, [])

  const endFoldTouchTrace = () => {
    const pid = foldTracePointerIdRef.current
    const svg = svgRef.current
    if (svg && pid != null) {
      try {
        if (svg.hasPointerCapture?.(pid)) svg.releasePointerCapture(pid)
      } catch (_) {
        /* ignore */
      }
    }
    foldTracePointerIdRef.current = null
    foldTraceActiveRef.current = false
    foldTraceHitLineKeyRef.current = null
    const rm = foldTraceListenersRef.current
    if (rm) {
      foldTraceListenersRef.current = null
      rm()
    }
  }

  const beginFoldTouchTrace = (e, grid, hitLineKey) => {
    endFoldTouchTrace()
    if (hoverDelayRef.current) {
      clearTimeout(hoverDelayRef.current)
      hoverDelayRef.current = null
    }
    setHoverLine(null)
    const svg = svgRef.current
    if (!svg) return
    const pointerIdForTrace = e.pointerId
    foldTracePointerIdRef.current = pointerIdForTrace
    foldTraceActiveRef.current = true
    foldTraceHitLineKeyRef.current = hitLineKey
    foldTraceSamplesRef.current = grid ? [grid] : []
    foldTraceFirstRef.current = grid || null
    foldTraceMaxDispSqRef.current = 0
    try {
      svg.setPointerCapture(pointerIdForTrace)
    } catch (_) {
      /* ignore */
    }

    const onMove = (ev) => {
      if (ev.pointerId !== pointerIdForTrace) return
      if (foldTracePointerIdRef.current !== pointerIdForTrace) return
      const g = clientToGrid(ev.clientX, ev.clientY)
      if (!g) return
      foldTraceSamplesRef.current.push(g)
      if (!foldTraceFirstRef.current) foldTraceFirstRef.current = g
      const fx = foldTraceFirstRef.current
      if (fx) {
        const d2 = (g.x - fx.x) ** 2 + (g.y - fx.y) ** 2
        if (d2 > foldTraceMaxDispSqRef.current) foldTraceMaxDispSqRef.current = d2
      }
    }

    const onEnd = (ev) => {
      if (ev.pointerId !== pointerIdForTrace) return
      if (foldTracePointerIdRef.current !== pointerIdForTrace) return
      const gUp = clientToGrid(ev.clientX, ev.clientY)
      if (gUp) foldTraceSamplesRef.current.push(gUp)
      const samples = foldTraceSamplesRef.current
      const maxDispSq = foldTraceMaxDispSqRef.current
      const hitKey = foldTraceHitLineKeyRef.current
      endFoldTouchTrace()
      if (!hitKey) return
      let lineKey = hitKey
      let anchor = gUp || (samples.length ? samples[samples.length - 1] : null)
      if (maxDispSq >= FOLD_TRACE_MIN_DISP_SQ && samples.length >= FOLD_TRACE_MIN_SAMPLES) {
        const picked = pickLineFromStrokePoints(samples)
        if (picked) {
          lineKey = picked.lineKey
          anchor = picked.anchor
        }
      }
      setHoverLine(null)
      setPendingFoldLine(lineKey)
      setPendingFoldAnchor(anchor)
    }

    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', onEnd)
    svg.addEventListener('pointercancel', onEnd)
    foldTraceListenersRef.current = () => {
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', onEnd)
      svg.removeEventListener('pointercancel', onEnd)
    }
  }

  /**
   * Clears hover / pending fold UI. Use ignorePointerMs (e.g. 400) after modal close to absorb stray pointer events.
   *
   * Touch UX invariant: a highlighted fold line with no FOLD chip should only appear when
   * `pendingFoldLine` is set (or brief `tapFlash`). Stale `hoverLine` is cleared on touch down
   * (`onSvgPointerDownCapture`) and when `(pointer: coarse)` matches — do not remove those without
   * checking ghost-line regressions on hybrid devices.
   */
  const clearFoldLineInteractionState = useCallback((options = {}) => {
    const { ignorePointerMs = false } = options
    endFoldTouchTrace()
    if (hoverDelayRef.current) {
      clearTimeout(hoverDelayRef.current)
      hoverDelayRef.current = null
    }
    setHoverLine(null)
    setPendingFoldLine(null)
    setPendingFoldAnchor(null)
    setTapFlash(null)
    if (typeof ignorePointerMs === 'number' && ignorePointerMs > 0) {
      ignoreBoardPointerUntilRef.current = Date.now() + ignorePointerMs
    }
  }, [])

  const closeInstructions = useCallback(() => {
    clearFoldLineInteractionState({ ignorePointerMs: 400 })
    closeInstructionsBase()
  }, [closeInstructionsBase, clearFoldLineInteractionState])

  const closeStats = useCallback(() => {
    clearFoldLineInteractionState({ ignorePointerMs: 400 })
    setShowStats(false)
  }, [clearFoldLineInteractionState])

  const closeLinks = useCallback(() => {
    clearFoldLineInteractionState({ ignorePointerMs: 400 })
    setShowLinks(false)
  }, [clearFoldLineInteractionState])

  const puzzle = useMemo(() => {
    if (curateMode) return roster[curateIdx]?.puzzle
    if (mode === 'tutorial') return puzzleData.tutorial[tutorialIdx]
    const raw = daily.puzzles[dailyIdx]
    return applyFoldsDailyPresentation(raw, daily.key, dailyIdx)
  }, [curateMode, curateIdx, roster, mode, tutorialIdx, dailyIdx, daily])

  const [board, setBoard] = useState(puzzle.start)
  const [history, setHistory] = useState([puzzle.start])
  const [folds, setFolds] = useState(puzzle.folds)
  const [anim, setAnim] = useState(null)
  const [winFlourishActive, setWinFlourishActive] = useState(false)
  /** 0–1 during `rewindFade` win phase (null otherwise). */
  const [rewindFadeT, setRewindFadeT] = useState(null)
  /** Win celebration: replay folds from history, pause, then pulse flourish (null = idle). */
  const [winShowcase, setWinShowcase] = useState(null)
  /** Previous commit: board already matched target (avoids pulse when reopening a solved puzzle / WIP). */
  const prevBoardMatchedTargetRef = useRef(false)
  const boardRef = useRef(board)
  const puzzleRef = useRef(puzzle)
  const historyRef = useRef(history)
  const winShowcaseRef = useRef(null)
  boardRef.current = board
  puzzleRef.current = puzzle
  historyRef.current = history
  winShowcaseRef.current = winShowcase

  useLayoutEffect(() => {
    clearFoldLineInteractionState()
    let nextBoard = puzzle.start
    let nextHistory = [puzzle.start]
    let nextFolds = puzzle.folds
    if (curateMode) {
      const loaded = loadFoldsWip('curate', curateIdx, puzzle)
      if (loaded) {
        nextBoard = loaded.board
        nextHistory = loaded.history
        nextFolds = loaded.folds
      }
      setBoard(nextBoard)
      setHistory(nextHistory)
      setFolds(nextFolds)
      setAnim(null)
      usedUndoOrResetRef.current = false
      setWinFlourishActive(false)
      setRewindFadeT(null)
      setWinShowcase(null)
      prevBoardMatchedTargetRef.current = boardsMatchTarget(nextBoard, puzzle.target)
      return
    }
    if (mode === 'tutorial') {
      setBoard(nextBoard)
      setHistory(nextHistory)
      setFolds(nextFolds)
      setAnim(null)
      usedUndoOrResetRef.current = false
      setWinFlourishActive(false)
      setRewindFadeT(null)
      setWinShowcase(null)
      prevBoardMatchedTargetRef.current = boardsMatchTarget(nextBoard, puzzle.target)
      return
    }
    const loaded = loadFoldsWip(daily.key, dailyIdx, puzzle)
    if (loaded) {
      nextBoard = loaded.board
      nextHistory = loaded.history
      nextFolds = loaded.folds
      setBoard(nextBoard)
      setHistory(nextHistory)
      setFolds(nextFolds)
      setAnim(null)
      usedUndoOrResetRef.current = false
      setWinFlourishActive(false)
      setRewindFadeT(null)
      setWinShowcase(null)
      prevBoardMatchedTargetRef.current = boardsMatchTarget(nextBoard, puzzle.target)
      return
    }
    setBoard(nextBoard)
    setHistory(nextHistory)
    setFolds(nextFolds)
    setAnim(null)
    usedUndoOrResetRef.current = false
    setWinFlourishActive(false)
    setRewindFadeT(null)
    setWinShowcase(null)
    prevBoardMatchedTargetRef.current = boardsMatchTarget(nextBoard, puzzle.target)
  }, [puzzle, curateMode, curateIdx, mode, daily.key, dailyIdx, clearFoldLineInteractionState])

  /** Defer transition check to next frame so layout hydration ref + latest board (via ref) stay aligned when switching puzzles. */
  useEffect(() => {
    let raf = 0
    raf = requestAnimationFrame(() => {
      raf = 0
      const won = boardsMatchTarget(boardRef.current, puzzleRef.current.target)
      const wasWon = prevBoardMatchedTargetRef.current
      if (winShowcaseRef.current != null) {
        if (won) prevBoardMatchedTargetRef.current = true
        return
      }
      if (won && !wasWon) {
        prevBoardMatchedTargetRef.current = true
        const boardsSnap = historyRef.current.map((b) => ({ ...b }))
        const lineKeys = inferFoldSequence(boardsSnap)
        if (lineKeys === null) {
          setWinShowcase({ kind: 'pause' })
          return
        }
        if (lineKeys.length > 0) {
          setWinShowcase({ kind: 'rewindFade', lineKeys, boards: boardsSnap })
        } else {
          setWinShowcase({ kind: 'pause' })
        }
        return
      }
      if (!won) setWinFlourishActive(false)
      prevBoardMatchedTargetRef.current = won
    })
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [board, puzzle])

  /** Crossfade solved board → start over `FOLDS_WIN_REWIND_FADE_MS`, then enter replay phase. */
  useEffect(() => {
    if (!winShowcase || winShowcase.kind !== 'rewindFade') {
      setRewindFadeT(null)
      return
    }
    const start = performance.now()
    let rafId = 0
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / FOLDS_WIN_REWIND_FADE_MS)
      setRewindFadeT(t)
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
        return
      }
      const sc = winShowcaseRef.current
      if (sc?.kind === 'rewindFade') {
        setBoard(sc.boards[0])
        setWinShowcase({ kind: 'replay', lineKeys: sc.lineKeys, boards: sc.boards, index: 0 })
      }
      setRewindFadeT(null)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [winShowcase])

  /** After replay: brief pause, then Clueless-style scale flourish on triangles. */
  useEffect(() => {
    if (!winShowcase || winShowcase.kind !== 'pause') return
    const tid = window.setTimeout(() => {
      setWinShowcase(null)
      setWinFlourishActive(true)
    }, FOLDS_WIN_REPLAY_PAUSE_MS)
    return () => clearTimeout(tid)
  }, [winShowcase])

  /** Start each replay fold once `anim` is clear (chained after prior fold completes). */
  useEffect(() => {
    if (!winShowcase || winShowcase.kind !== 'replay' || anim != null) return
    const { lineKeys, boards, index } = winShowcase
    const lineKey = lineKeys[index]
    const startBoard = boards[index]
    const computed = computeFoldedBoardFromBoard(startBoard, lineKey)
    if (!computed) {
      setWinShowcase({ kind: 'pause' })
      return
    }
    t0.current = performance.now()
    setAnim({
      line: computed.line,
      startBoard: { ...startBoard },
      finalBoard: computed.next,
      lostKeys: computed.lostKeys,
      rawT: 0,
    })
  }, [winShowcase, anim])

  /** Drop flourish class after last triangle’s animation can finish; then suite completion modal if pending. */
  useEffect(() => {
    if (!winFlourishActive) return
    const t = setTimeout(() => {
      setWinFlourishActive(false)
      if (pendingSuiteModalAfterCelebrationRef.current && mode === 'daily' && !curateMode) {
        pendingSuiteModalAfterCelebrationRef.current = false
        setShowCompletionModal(true)
      }
    }, FOLDS_WIN_FLOURISH_TOTAL_MS)
    return () => clearTimeout(t)
  }, [winFlourishActive, mode, curateMode])

  useEffect(() => {
    if (!puzzle || anim) return
    if (winShowcase != null) return
    if (curateMode) {
      saveFoldsWip('curate', curateIdx, puzzle, board, folds, history)
      return
    }
    if (mode !== 'daily') return
    saveFoldsWip(daily.key, dailyIdx, puzzle, board, folds, history)
  }, [
    curateMode,
    curateIdx,
    mode,
    daily.key,
    dailyIdx,
    puzzle,
    board,
    folds,
    history,
    anim,
    winShowcase,
  ])

  useEffect(
    () => () => {
      if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current)
    },
    []
  )

  useEffect(() => {
    pendingFoldLineRef.current = pendingFoldLine
  }, [pendingFoldLine])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = () => setCoarsePointer(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  /** Mouse-hover fold emphasis must not linger when the device is touch-primary (see onSvgPointerDownCapture). */
  useEffect(() => {
    if (!coarsePointer) return
    if (hoverDelayRef.current) {
      clearTimeout(hoverDelayRef.current)
      hoverDelayRef.current = null
    }
    setHoverLine(null)
  }, [coarsePointer])

  useEffect(() => {
    if (mode !== 'tutorial') {
      setTutorialHint1Dismissed(false)
      setTutorialHintTwoFoldsDismissed(false)
    }
  }, [mode])

  useEffect(() => {
    if (tutorialIdx !== 0) setTutorialHint1Dismissed(false)
  }, [tutorialIdx])

  useEffect(() => {
    if (tutorialIdx !== 4) setTutorialHintTwoFoldsDismissed(false)
  }, [tutorialIdx])

  useEffect(() => () => endFoldTouchTrace(), [])

  useEffect(() => {
    const onPointerDownCapture = (e) => {
      if (foldTraceActiveRef.current) return
      if (showInstructions || showStats || showLinks) return
      const wrap = canvasWrapperRef.current
      if (!wrap || wrap.contains(e.target)) return
      const el = e.target instanceof Element ? e.target : e.target?.parentElement
      if (el && el.closest('[data-fold-confirm]')) return
      clearFoldLineInteractionState()
    }
    window.addEventListener('pointerdown', onPointerDownCapture, true)
    return () => window.removeEventListener('pointerdown', onPointerDownCapture, true)
  }, [showInstructions, showStats, showLinks, clearFoldLineInteractionState])

  /**
   * Touch / hybrid devices: `hoverLine` (mouse-only pointerenter) can stick because touch does not
   * always deliver pointerleave to the line under the cursor. That shows the thick “emphasis”
   * stroke without `pendingFoldLine`, so there is no in-SVG FOLD chip — looks like a ghost fold.
   * Clear hover on any finger down on the board; keep the pending-dismiss branch below unchanged.
   *
   * Do not drop this touch-first hover reset without re-testing iPad / Win hybrid / Chrome “synthetic mouse”.
   */
  const onSvgPointerDownCapture = useCallback(
    (e) => {
      if (e.pointerType !== 'touch') return
      if (Date.now() < ignoreBoardPointerUntilRef.current) return
      if (hoverDelayRef.current) {
        clearTimeout(hoverDelayRef.current)
        hoverDelayRef.current = null
      }
      setHoverLine(null)

      if (foldTraceActiveRef.current) return
      if (!pendingFoldLineRef.current) return
      if (showInstructions || showStats || showLinks) return
      const raw = e.target
      const el = raw instanceof Element ? raw : raw?.parentElement
      if (!el || !(el instanceof Element)) return
      if (el.closest('.fold-group') || el.closest('[data-fold-overlay]')) return
      clearFoldLineInteractionState()
    },
    [showInstructions, showStats, showLinks, clearFoldLineInteractionState]
  )

  const isWon = useMemo(() => boardsMatchTarget(board, puzzle.target), [board, puzzle])
  /** Treat as solved during win replay / pause so CTAs stay in “won” mode. */
  const uiWon = isWon || winShowcase != null
  /** Rewind / replay / pause / flourish — bottom chrome should match post-solve state during replay `anim`. */
  const foldsCelebrationActive = winShowcase != null || winFlourishActive

  /** Skip celebration and snap to final solved board (Undo / Reset / primary CTA during celebration). */
  const cancelFoldsWinCelebration = () => {
    endFoldTouchTrace()
    setAnim(null)
    setWinShowcase(null)
    setWinFlourishActive(false)
    setRewindFadeT(null)
    const h = historyRef.current
    if (h.length > 0) setBoard({ ...h[h.length - 1] })
    if (pendingSuiteModalAfterCelebrationRef.current && mode === 'daily' && !curateMode) {
      const allDone = loadCompletions(daily.key).every(Boolean)
      if (allDone) {
        pendingSuiteModalAfterCelebrationRef.current = false
        setShowCompletionModal(true)
      }
    }
  }

  // Mark complete when won
  useEffect(() => {
    if (isWon && !curateMode && mode === 'daily') {
      markComplete(daily.key, dailyIdx, !usedUndoOrResetRef.current)
      setCompletions(loadCompletions(daily.key))
      setPerfects(loadPerfects(daily.key))
    }
  }, [isWon, curateMode, mode, daily.key, dailyIdx])

  const SNAP_TOL = (S * 0.6) ** 2

  const validateFold = (lineKey) => {
    const line = ALL_LINES.find((l) => l.lineKey === lineKey)
    if (!line) return { ok: false, reason: 'offboard' }
    if (line.isBoardOuterEdge) return { ok: false, reason: 'outer-edge' }
    const c2 = Math.cos(2 * line.theta),
      s2 = Math.sin(2 * line.theta)
    for (const [key, color] of Object.entries(board)) {
      const [r, c] = key.split(',').map(Number)
      const cp = cent(r, c)
      const nx = line.px + (cp.x - line.px) * c2 + (cp.y - line.py) * s2
      const ny = line.py + (cp.x - line.px) * s2 - (cp.y - line.py) * c2
      const [nr, nc] = snap(nx, ny)
      const sp = cent(nr, nc)
      const dist2 = (sp.x - nx) ** 2 + (sp.y - ny) ** 2
      if (!isInsideHex(nr, nc) || dist2 > SNAP_TOL) continue
      const destKey = `${nr},${nc}`
      // Color overlaps are allowed; conflicts will become brown in the fold application.
    }
    return { ok: true, reason: null }
  }

  const handleFold = (lineKey) => {
    if (folds <= 0 || anim || isWon || winShowcase != null) return
    const result = validateFold(lineKey)
    if (!result.ok) return
    const line = ALL_LINES.find((l) => l.lineKey === lineKey)
    const next = { ...board }
    const lostKeys = {}
    const c2 = Math.cos(2 * line.theta),
      s2 = Math.sin(2 * line.theta)
    for (const [key, color] of Object.entries(board)) {
      const [r, c] = key.split(',').map(Number)
      const cp = cent(r, c)
      const nx = line.px + (cp.x - line.px) * c2 + (cp.y - line.py) * s2
      const ny = line.py + (cp.x - line.px) * s2 - (cp.y - line.py) * c2
      const [nr, nc] = snap(nx, ny)
      const sp = cent(nr, nc)
      const dist2 = (sp.x - nx) ** 2 + (sp.y - ny) ** 2
      if (isPointInsideHex(nx, ny) && isInsideHex(nr, nc) && dist2 <= SNAP_TOL) {
        const destKey = `${nr},${nc}`
        const prev = next[destKey]
        if (prev === undefined || prev === color) next[destKey] = color
        else next[destKey] = FOLDS_OVERLAP_MIX
      } else {
        lostKeys[key] = true
      }
    }
    t0.current = performance.now()
    setAnim({ line, startBoard: { ...board }, finalBoard: next, lostKeys, rawT: 0 })
    setFolds((f) => f - 1)
  }

  useEffect(() => {
    if (!anim) return
    let rafId = 0
    const tick = () => {
      const rawT = Math.min(1, (performance.now() - t0.current) / ANIM_MS)
      if (rawT >= 1) {
        const sc = winShowcaseRef.current
        if (sc && sc.kind === 'replay') {
          setBoard(anim.finalBoard)
          setAnim(null)
          const nextIndex = sc.index + 1
          if (nextIndex < sc.lineKeys.length) {
            setWinShowcase({
              kind: 'replay',
              lineKeys: sc.lineKeys,
              boards: sc.boards,
              index: nextIndex,
            })
          } else {
            setWinShowcase({ kind: 'pause' })
          }
          return
        }
        setBoard(anim.finalBoard)
        setHistory((h) => [...h, anim.finalBoard])
        setAnim(null)
        return
      }
      setAnim((a) => (a ? { ...a, rawT } : a))
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [anim])

  /** `hoverLine` is mouse-only; never treat it as emphasis on coarse pointers (see touch hover reset above). */
  const isFoldLineEmphasized = (lineKey) =>
    (hoverLine === lineKey && !coarsePointer) || pendingFoldLine === lineKey || tapFlash === lineKey

  const getLineStroke = (lineKey) => {
    if (isFoldLineEmphasized(lineKey)) return FOLD_LINE_ACCENT
    return '#cbd5e1'
  }

  const confirmPendingFold = useCallback(() => {
    if (winShowcase != null || winFlourishActive) return
    const lineKey = pendingFoldLineRef.current
    if (!lineKey) return
    setPendingFoldLine(null)
    setPendingFoldAnchor(null)
    handleFold(lineKey)
  }, [handleFold, winShowcase, winFlourishActive])

  const handlePrimaryClick = () => {
    if (foldsCelebrationActive) cancelFoldsWinCelebration()
    if (uiWon || isWon) {
      if (curateMode) {
        clearFoldsWip('curate', curateIdx)
        if (curateIdx < roster.length - 1) setCurateIdx((j) => j + 1)
        return
      }
      if (mode === 'daily') clearFoldsWip(daily.key, dailyIdx)
      if (mode === 'tutorial') {
        if (tutorialIdx < puzzleData.tutorial.length - 1) setTutorialIdx((i) => i + 1)
        else {
          setMode('daily')
          setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.FOLDS, 0))
        }
      } else {
        const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.FOLDS, daily.key, dailyIdx)
        if (next !== null) setDailyIdx(next)
      }
    } else if (folds <= 0) {
      usedUndoOrResetRef.current = true
      if (curateMode) clearFoldsWip('curate', curateIdx)
      else if (mode === 'daily') clearFoldsWip(daily.key, dailyIdx)
      setBoard(puzzle.start)
      setHistory([puzzle.start])
      setFolds(puzzle.folds)
    }
  }

  const primaryLabel = uiWon
    ? curateMode
      ? curateIdx < roster.length - 1
        ? CTA_LABELS.NEXT_PUZZLE
        : null
      : mode === 'tutorial'
        ? tutorialIdx < puzzleData.tutorial.length - 1
          ? CTA_LABELS.NEXT_PUZZLE
          : CTA_LABELS.PLAY_TODAY
        : nextIncompleteEnabledTierExcluding(GAME_KEYS.FOLDS, daily.key, dailyIdx) != null
          ? CTA_LABELS.NEXT_PUZZLE
          : CTA_LABELS.ALL_PUZZLES
    : folds <= 0 && !anim
      ? 'Retry Puzzle'
      : null

  useSuiteCompletionTimer(GAME_KEYS.FOLDS, daily.key, {
    track: !curateMode && mode === 'daily',
    alreadyFullyComplete: isSuiteCompleteForPrefs(GAME_KEYS.FOLDS, daily.key),
    pauseForHubCompleteCta:
      primaryLabel === CTA_LABELS.ALL_PUZZLES || primaryLabel === CTA_LABELS.NEXT_PUZZLE,
  })

  const foldsPrimaryCtaAttention = uiWon && !foldsCelebrationActive && !!primaryLabel

  useEffect(() => {
    if (curateMode || mode !== 'daily') return
    const done = isSuiteCompleteForPrefs(GAME_KEYS.FOLDS, daily.key)
    if (allDailyDoneCompletionRef.current === null) {
      allDailyDoneCompletionRef.current = done
      return
    }
    if (done && !allDailyDoneCompletionRef.current) {
      pendingSuiteModalAfterCelebrationRef.current = true
    }
    allDailyDoneCompletionRef.current = done
  }, [curateMode, mode, completions, daily.key, suitePrefsEpoch])

  const base = import.meta.env.BASE_URL

  const handleStatsClick = useCallback(() => {
    if (curateMode) {
      const entry = roster[curateIdx]
      if (!entry || !puzzle) return
      const text = formatCurateClipboard('folds', entry.tier, entry.indexInTier + 1, puzzle, 200)
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
  }, [curateMode, roster, curateIdx, puzzle])

  return (
    <div className="game-container folds">
      <TopBar
        title={chrome.title}
        onHome={() => {
          window.location.href = base
        }}
        onCube={() => setShowLinks(true)}
        linksViaTitleOnly
        puzzleChrome={{
          gameKey: GAME_KEYS.FOLDS,
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
              <span className="stats-label">Folds Left</span>
              <span className="stats-num">{folds}</span>
            </>
          }
        />
      ) : mode === 'tutorial' ? (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Folds Left</span>
            <span className="stats-num">{folds}</span>
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
              {tutorialIdx === 0 && !tutorialHint1Dismissed && (
                <DismissibleHintToast
                  message={
                    coarsePointer ? FOLDS_TUTORIAL_HINT_TOUCH : FOLDS_TUTORIAL_HINT_FINE_POINTER
                  }
                  align="center"
                  onDismiss={() => setTutorialHint1Dismissed(true)}
                />
              )}
              {tutorialIdx === 4 && !tutorialHintTwoFoldsDismissed && (
                <DismissibleHintToast
                  message={FOLDS_TUTORIAL_HINT_TWO_FOLDS}
                  align="center"
                  onDismiss={() => setTutorialHintTwoFoldsDismissed(true)}
                />
              )}
              {tutorialIdx === puzzleData.tutorial.length - 1 && !tutorialHintStarDismissed && (
                <DismissibleHintToast
                  message="On daily puzzles, earn a ★ by solving without using Undo or Reset."
                  align="center"
                  onDismiss={() => setTutorialHintStarDismissed(true)}
                />
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.FOLDS, 0))
              }}
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      ) : (
        <div className="level-nav">
          <div className="stats-group stats-group--left">
            <span className="stats-label">Folds Left</span>
            <span className="stats-num">{folds}</span>
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
              gameKey={GAME_KEYS.FOLDS}
              dateKey={daily.key}
              canShare={canShareHub}
            />
          </div>
        </div>
      )}

      <div className="game-stage">
        <div id="canvas-wrapper" ref={canvasWrapperRef}>
          <svg
            ref={svgRef}
            /* Rotation-aware viewBox from geometry is required.
               If this regresses to unrotated bounds, board fit/clip issues return. */
            viewBox={`${HEX_ROTATED_VIEWBOX.x} ${HEX_ROTATED_VIEWBOX.y} ${HEX_ROTATED_VIEWBOX.w} ${HEX_ROTATED_VIEWBOX.h}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              pointerEvents: winShowcase != null ? 'none' : undefined,
            }}
            onPointerDownCapture={onSvgPointerDownCapture}
            onLostPointerCapture={(e) => {
              if (
                foldTracePointerIdRef.current == null ||
                e.pointerId !== foldTracePointerIdRef.current
              )
                return
              endFoldTouchTrace()
            }}
          >
            <g
              transform={`rotate(${HEX_ROTATE_DEG} ${HEX_BOUNDS.minX + HEX_BOUNDS.width / 2} ${HEX_BOUNDS.minY + HEX_BOUNDS.height / 2})`}
            >
              {ALL_TRIANGLES.map((t) => (
                <polygon
                  key={t.key}
                  points={pts(t.r, t.c)}
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="1.5"
                />
              ))}
              {Object.entries(puzzle.target).map(([k, col]) => {
                const [r, c] = k.split(',').map(Number)
                const hex = fillColor(col)
                return (
                  <polygon
                    key={`t-${k}`}
                    points={pts(r, c)}
                    fill={hex}
                    opacity="0.15"
                    stroke={hex}
                    strokeWidth="2"
                  />
                )
              })}
              {winShowcase?.kind === 'rewindFade'
                ? (() => {
                    const bStart = winShowcase.boards[0]
                    const bSolved = winShowcase.boards[winShowcase.boards.length - 1]
                    const fade = rewindFadeT ?? 0
                    return (
                      <g>
                        <g style={{ opacity: fade }}>
                          {Object.entries(bStart).map(([k, col]) => {
                            const [r, c] = k.split(',').map(Number)
                            return (
                              <polygon key={`rw-s-${k}`} points={pts(r, c)} fill={fillColor(col)} />
                            )
                          })}
                        </g>
                        <g style={{ opacity: 1 - fade }}>
                          {Object.entries(bSolved).map(([k, col]) => {
                            const [r, c] = k.split(',').map(Number)
                            return (
                              <polygon key={`rw-w-${k}`} points={pts(r, c)} fill={fillColor(col)} />
                            )
                          })}
                        </g>
                      </g>
                    )
                  })()
                : Object.entries(board).map(([k, col]) => {
                    const [r, c] = k.split(',').map(Number)
                    return (
                      <polygon
                        key={`b-${k}`}
                        points={pts(r, c)}
                        fill={fillColor(col)}
                        className={winFlourishActive ? 'folds-win-flourish-pop' : ''}
                        style={{
                          transformOrigin: `${cent(r, c).x}px ${cent(r, c).y}px`,
                          ...(winFlourishActive
                            ? {
                                ['--folds-flourish-wave']: foldFlourishWaveIndex(r, c),
                                ['--folds-flourish-stagger']: `${FOLDS_FLOURISH_STAGGER_MS}ms`,
                                ['--folds-flourish-pop-duration']: `${FOLDS_FLOURISH_POP_MS}ms`,
                              }
                            : {}),
                        }}
                      />
                    )
                  })}
              {anim && (
                <g
                  transform={`matrix(${1 + easeIO(anim.rawT) * (Math.cos(2 * anim.line.theta) - 1)} ${easeIO(anim.rawT) * Math.sin(2 * anim.line.theta)} ${easeIO(anim.rawT) * Math.sin(2 * anim.line.theta)} ${1 - easeIO(anim.rawT) * (1 + Math.cos(2 * anim.line.theta))} ${easeIO(anim.rawT) * (anim.line.px * (1 - Math.cos(2 * anim.line.theta)) - anim.line.py * Math.sin(2 * anim.line.theta))} ${easeIO(anim.rawT) * (anim.line.py * (1 + Math.cos(2 * anim.line.theta)) - anim.line.px * Math.sin(2 * anim.line.theta))})`}
                >
                  {Object.entries(anim.startBoard).map(([key, col]) => {
                    const [r, c] = key.split(',').map(Number)
                    const fadeT = easeIO(anim.rawT)
                    const isLost = !!anim.lostKeys?.[key]
                    const opacity = isLost ? 0.5 * (1 - fadeT) : 0.5
                    return (
                      <polygon
                        key={`a-${key}`}
                        points={pts(r, c)}
                        fill={fillColor(col)}
                        opacity={opacity}
                      />
                    )
                  })}
                </g>
              )}
              {ALL_LINES.map((l) => (
                <g
                  key={l.lineKey}
                  className="fold-group"
                  style={l.isBoardOuterEdge ? { pointerEvents: 'none' } : undefined}
                  onPointerEnter={
                    l.isBoardOuterEdge
                      ? undefined
                      : (e) => {
                          if (Date.now() < ignoreBoardPointerUntilRef.current) return
                          if (e.pointerType !== 'mouse' || coarsePointer) return
                          if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current)
                          hoverDelayRef.current = setTimeout(() => {
                            if (Date.now() < ignoreBoardPointerUntilRef.current) return
                            setHoverLine(l.lineKey)
                          }, 80)
                        }
                  }
                  onPointerLeave={
                    l.isBoardOuterEdge
                      ? undefined
                      : (e) => {
                          if (Date.now() < ignoreBoardPointerUntilRef.current) return
                          if (e.pointerType !== 'mouse') return
                          if (hoverDelayRef.current) {
                            clearTimeout(hoverDelayRef.current)
                            hoverDelayRef.current = null
                          }
                          setHoverLine((h) => (h === l.lineKey ? null : h))
                        }
                  }
                  onPointerDown={
                    l.isBoardOuterEdge
                      ? undefined
                      : (e) => {
                          if (Date.now() < ignoreBoardPointerUntilRef.current) return
                          e.preventDefault()
                          if (e.pointerType === 'mouse') {
                            setTapFlash(l.lineKey)
                            setTimeout(() => setTapFlash(null), 120)
                            setPendingFoldLine(null)
                            handleFold(l.lineKey)
                            return
                          }
                          if (e.pointerType === 'touch') {
                            if (pendingFoldLine === l.lineKey) {
                              return
                            }
                            const grid = clientToGrid(e.clientX, e.clientY)
                            beginFoldTouchTrace(e, grid, l.lineKey)
                          }
                        }
                  }
                >
                  <line
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    className="fold-hit"
                    stroke="transparent"
                    strokeWidth="22"
                    style={{
                      pointerEvents: l.isBoardOuterEdge ? 'none' : 'stroke',
                    }}
                  />
                  {!isFoldLineEmphasized(l.lineKey) && (
                    <line
                      x1={l.x1}
                      y1={l.y1}
                      x2={l.x2}
                      y2={l.y2}
                      className="fold-visual"
                      strokeWidth={2}
                      style={{ stroke: getLineStroke(l.lineKey) }}
                    />
                  )}
                </g>
              ))}
              {ALL_LINES.filter(
                (l) => isFoldLineEmphasized(l.lineKey) && pendingFoldLine !== l.lineKey
              ).map((l) => (
                <line
                  key={`fold-emphasis-${l.lineKey}`}
                  x1={l.x1}
                  y1={l.y1}
                  x2={l.x2}
                  y2={l.y2}
                  className="fold-visual"
                  strokeWidth={4}
                  style={{ stroke: FOLD_LINE_ACCENT, pointerEvents: 'none' }}
                />
              ))}
              {pendingFoldLine &&
                (() => {
                  const l = ALL_LINES.find((ln) => ln.lineKey === pendingFoldLine)
                  if (!l) return null
                  const { cx, cy } = getFoldButtonPosition(l, pendingFoldAnchor)
                  const confirmFold = (e) => {
                    if (Date.now() < ignoreBoardPointerUntilRef.current) return
                    e.stopPropagation()
                    e.preventDefault()
                    confirmPendingFold()
                  }
                  return (
                    <g key="fold-overlay" data-fold-overlay="">
                      <line
                        x1={l.x1}
                        y1={l.y1}
                        x2={l.x2}
                        y2={l.y2}
                        stroke={getLineStroke(l.lineKey)}
                        strokeWidth={4}
                        style={{ pointerEvents: 'none' }}
                      />
                      <g
                        transform={`rotate(-30 ${cx} ${cy})`}
                        onPointerDown={confirmFold}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle cx={cx} cy={cy} r={20} fill={getLineStroke(l.lineKey)} />
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#fff"
                          fontSize={10}
                          fontWeight={700}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          FOLD
                        </text>
                      </g>
                    </g>
                  )
                })()}
            </g>
          </svg>
        </div>
      </div>

      {/* data-fold-confirm prevents onPointerDownCapture from clearing pendingFoldLine
          before the SmartRightButton click handler can confirm the fold */}
      <div className="button-tray" data-fold-confirm="">
        <button
          onClick={() => {
            if (foldsCelebrationActive) cancelFoldsWinCelebration()
            clearFoldLineInteractionState()
            usedUndoOrResetRef.current = true
            if (history.length <= 1) return
            const prev = history.slice(0, -1)
            setBoard(prev[prev.length - 1])
            setHistory(prev)
            setFolds((f) => f + 1)
          }}
          disabled={history.length <= 1}
          className="btn-secondary"
        >
          Undo
        </button>
        {(() => {
          const foldButtonActive =
            !anim && !uiWon && folds > 0 && pendingFoldLine && !foldsCelebrationActive
          return (
            <SmartRightButton
              primaryLabel={foldButtonActive ? 'FOLD' : primaryLabel}
              primaryHref={primaryLabel === CTA_LABELS.ALL_PUZZLES ? base : undefined}
              onPrimaryClick={foldButtonActive ? confirmPendingFold : handlePrimaryClick}
              attention={foldsPrimaryCtaAttention}
              resetDisabled={history.length <= 1}
              onReset={() => {
                if (foldsCelebrationActive) cancelFoldsWinCelebration()
                clearFoldLineInteractionState()
                usedUndoOrResetRef.current = true
                if (mode === 'daily') clearFoldsWip(daily.key, dailyIdx)
                setBoard(puzzle.start)
                setHistory([puzzle.start])
                setFolds(puzzle.folds)
              }}
            />
          )
        })()}
      </div>

      <SharedModalShell
        show={showInstructions}
        onClose={closeInstructions}
        intent={MODAL_INTENTS.INSTRUCTIONS}
      >
        <h1 className="title" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          Folds
        </h1>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <FoldsIcon size={80} />
          </div>
          <p style={{ fontSize: '1.1rem', lineHeight: '1.6' }}>
            Fold the shapes along the grid lines <br />
            to match the <b>target pattern</b>.
            <br />
            {coarsePointer ? (
              <>
                Tap or trace a line to select it. Use the <b>FOLD</b> button on the line or at the
                bottom to fold the triangles across it.
              </>
            ) : (
              <>
                Hover over a fold line to highlight it. <br />
                Click the line to fold the triangles across it.
              </>
            )}
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
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.FOLDS, 0))
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
                  setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.FOLDS, 0))
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
                setDailyIdx(clampDailyIndexToTierPrefs(GAME_KEYS.FOLDS, 0))
              }}
            >
              {CTA_LABELS.PLAY_TODAYS_PUZZLES_UPPER}
            </button>
          )}
        </div>
      </SharedModalShell>

      <AllTenLinksModal show={showLinks} onClose={closeLinks} />
      <SimpleGameStatsModal
        show={showStats}
        onClose={closeStats}
        gameKey={GAME_KEYS.FOLDS}
        dailySuiteFooter={{
          dateKey: daily.key,
          completions,
          perfects,
        }}
      />
      <SuiteGameCompletionModal
        show={showCompletionModal && !curateMode}
        onClose={() => setShowCompletionModal(false)}
        gameKey={GAME_KEYS.FOLDS}
        dateKey={daily.key}
        hubDiceCompletions={completions}
        hubDicePerfects={perfects}
      />
    </div>
  )
}

export default Folds

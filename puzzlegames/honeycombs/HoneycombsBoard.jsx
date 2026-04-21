import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { CTA_LABELS } from '@shared-contracts/ctaLabels.js'
import {
  HEX_R,
  HONEYCOMBS_MAX_HEX_SCREEN_CR_PX,
  hexPoints,
  buildCells,
  computeViewBox,
  buildPathTrace,
} from './honeycombsGeometry.js'
import {
  saveGameState,
  loadGameState,
  clearGameState,
  markSolved,
} from './honeycombsPersistence.js'
import useHoneycombsTrace from './useHoneycombsTrace.js'
import SmartRightButton from '../../src/shared/SmartRightButton.jsx'
import { GAME_KEYS } from '@shared-contracts/gameChrome.js'
import { nextIncompleteEnabledTierExcluding } from '@shared-contracts/suiteDashboardPreferences.js'

// ─── keyboard layouts ────────────────────────────────────────────────────────

const KB_ROWS = {
  small: [
    [1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10],
  ],
  medium: [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13, 14],
  ],
  large: [
    [1, 2, 3, 4, 5, 6, 7],
    [8, 9, 10, 11, 12, 13],
    [14, 15, 16, 17, 18, 19],
  ],
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function cellKey(r, c) {
  return `${r},${c}`
}

/**
 * Build the baseline (clue-seeded) cell array for a puzzle.
 * cx/cy are in final SVG viewBox coordinates (raw + offX/offY).
 */
function buildBaselineCells(puzzle) {
  const rawCells = buildCells(puzzle.size)
  const { offX, offY } = computeViewBox(puzzle.size)
  const clueMap = {}
  for (const [r, c, v] of puzzle.clues) clueMap[cellKey(r, c)] = v
  return rawCells.map(({ row, col, cx, cy }) => ({
    row,
    col,
    cx: cx + offX,
    cy: cy + offY,
    value: clueMap[cellKey(row, col)] ?? null,
    isClue: !!clueMap[cellKey(row, col)],
  }))
}

function computeActiveDigitMinMissing(cells) {
  const n = cells.length
  const placed = new Set(cells.map((c) => c.value).filter((v) => v !== null))
  for (let k = 1; k <= n; k++) {
    if (!placed.has(k)) return k
  }
  return null
}

function computeActiveDigitAfterFill(cells, lastPlaced) {
  const n = cells.length
  const placed = new Set(cells.map((c) => c.value).filter((v) => v !== null))
  if (placed.size >= n) return null
  for (let k = lastPlaced + 1; k <= n; k++) {
    if (!placed.has(k)) return k
  }
  for (let k = 1; k <= n; k++) {
    if (!placed.has(k)) return k
  }
  return null
}

function cellClassName(cell) {
  if (cell.isClue) return 'hex-cell given'
  if (cell.value !== null) return 'hex-cell filled'
  return 'hex-cell empty'
}

function keyClassName(num, clueSet, playerUsedSet, activeDigit, solved) {
  if (clueSet.has(num)) return 'kb-key kb-clue'
  if (playerUsedSet.has(num)) return 'kb-key used'
  const base = 'kb-key available'
  if (!solved && num === activeDigit) return base + ' kb-active'
  return base
}

// ─── component ───────────────────────────────────────────────────────────────

/**
 * The Honeycombs game board: SVG hex grid + keyboard.
 *
 * Layout uses the shared `.game-stage` pattern. The SVG carries a dynamic
 * `viewBox` and `aspectRatio` computed from the puzzle size, so CSS can scale
 * it without any DOM measurement.
 *
 * @param {{
 *   puzzle: { size: 'small'|'medium'|'large', clues: [number,number,number][] },
 *   puzzleIdx: number,
 *   totalPuzzles: number,
 *   dateKey: string,
 *   trackCompletion: boolean,
 *   onWin: (idx: number) => void,
 *   onRequestNextPuzzle: () => void,
 *   onCompletionsUpdated: () => void,
 *   isBlockingModalOpen: () => boolean,
 *   finalSolvedAction: { label: string, href?: string, onClick?: () => void } | null,
 *   hubBaseHref: string,
 * }} props
 */
export default function HoneycombsBoard({
  puzzle,
  puzzleIdx,
  totalPuzzles,
  dateKey,
  trackCompletion,
  onWin,
  onRequestNextPuzzle,
  onCompletionsUpdated,
  isBlockingModalOpen,
  finalSolvedAction,
  hubBaseHref,
  onHubCompleteCtaPauseChange,
}) {
  const svgRef = useRef(null)
  const stageRef = useRef(null)
  const boardWrapRef = useRef(null)
  const keyboardRef = useRef(null)
  const trayRef = useRef(null)
  const { runTrace, clearTrace, notifyUserInput } = useHoneycombsTrace(svgRef)
  const isBlockingModalOpenRef = useRef(isBlockingModalOpen)
  isBlockingModalOpenRef.current = isBlockingModalOpen

  // ─── game state ────────────────────────────────────────────────────────────

  const [cells, setCells] = useState(() => buildBaselineCells(puzzle))
  const [activeDigit, setActiveDigit] = useState(() =>
    computeActiveDigitMinMissing(buildBaselineCells(puzzle))
  )
  const [moveHistory, setMoveHistory] = useState([])
  const [solved, setSolved] = useState(false)
  const [postWinCtaAttention, setPostWinCtaAttention] = useState(false)
  const [boardMaxHeightPx, setBoardMaxHeightPx] = useState(null)
  const usedUndoOrResetRef = useRef(false)

  // ─── viewBox (memoised; changes only when puzzle size changes) ─────────────

  const vb = useMemo(() => computeViewBox(puzzle.size), [puzzle.size])

  /**
   * Board wrapper sizing via CSS custom properties.
   *
   * React's inline style handling can silently drop modern CSS functions like
   * min()/max()/calc(var(...)). So we pass the dynamic geometry values as CSS
   * custom properties and let a pure CSS rule in honeycombs.css do the actual
   * width / max-height / aspect-ratio work. See `.hc-board-wrap` there.
   */
  const boardCapVars = useMemo(() => {
    const sCap = HONEYCOMBS_MAX_HEX_SCREEN_CR_PX / HEX_R
    const minBoardHeight = Math.ceil((280 * vb.h) / vb.w)
    const vars = {
      '--hc-geom-cap-w': `${Math.round(sCap * vb.w)}px`,
      '--hc-ar': (vb.w / vb.h).toFixed(4),
      '--hc-aspect': `${vb.w} / ${vb.h}`,
      '--hc-min-h': `${minBoardHeight}px`,
    }
    if (boardMaxHeightPx != null) vars['--hc-live-max-h'] = `${Math.max(0, boardMaxHeightPx)}px`
    return vars
  }, [vb.w, vb.h, boardMaxHeightPx])

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    const recomputeBoardHeight = () => {
      const stage = stageRef.current
      const boardWrap = boardWrapRef.current
      const keyboard = keyboardRef.current
      const tray = trayRef.current
      if (!stage || !boardWrap || !keyboard || !tray) return

      const stageRect = stage.getBoundingClientRect()
      const stageStyle = window.getComputedStyle(stage)
      const stagePaddingTop = parseFloat(stageStyle.paddingTop) || 0
      const stagePaddingBottom = parseFloat(stageStyle.paddingBottom) || 0
      const nextMax = Math.floor(stageRect.height - stagePaddingTop - stagePaddingBottom)
      setBoardMaxHeightPx((current) => {
        if (current != null && Math.abs(current - nextMax) <= 1) return current
        return nextMax
      })
    }

    let frame = 0
    const scheduleRecompute = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        recomputeBoardHeight()
      })
    }

    scheduleRecompute()
    window.addEventListener('resize', scheduleRecompute)
    window.visualViewport?.addEventListener('resize', scheduleRecompute)
    window.visualViewport?.addEventListener('scroll', scheduleRecompute)

    let resizeObserver = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleRecompute())
      if (stageRef.current) resizeObserver.observe(stageRef.current)
      if (boardWrapRef.current) resizeObserver.observe(boardWrapRef.current)
      if (keyboardRef.current) resizeObserver.observe(keyboardRef.current)
      if (trayRef.current) resizeObserver.observe(trayRef.current)
      const gameContainer = boardWrapRef.current?.closest('.game-container.honeycombs')
      if (gameContainer) resizeObserver.observe(gameContainer)
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleRecompute)
      window.visualViewport?.removeEventListener('resize', scheduleRecompute)
      window.visualViewport?.removeEventListener('scroll', scheduleRecompute)
    }
  }, [puzzle.size, solved, moveHistory.length])

  // ─── init / puzzle change ──────────────────────────────────────────────────

  useEffect(() => {
    clearTrace()
    const baseline = buildBaselineCells(puzzle)
    const loaded = loadGameState(puzzleIdx, puzzle, baseline, dateKey)
    if (loaded) {
      setCells(loaded.cells)
      setSolved(loaded.solved)
      setMoveHistory(loaded.moveHistory)
      setActiveDigit(loaded.activeDigit ?? computeActiveDigitMinMissing(loaded.cells))
      usedUndoOrResetRef.current = loaded.usedUndoOrReset
    } else {
      clearGameState(puzzleIdx, dateKey)
      setCells(baseline)
      setSolved(false)
      setMoveHistory([])
      setActiveDigit(computeActiveDigitMinMissing(baseline))
      usedUndoOrResetRef.current = false
    }
    // puzzle identity (not reference) drives the reset; dateKey scopes storage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleIdx, dateKey])

  useEffect(() => {
    setPostWinCtaAttention(false)
  }, [puzzleIdx])

  // ─── keyboard shortcut (physical keys 1-9, 0→10) ──────────────────────────

  useEffect(() => {
    const n = cells.length
    const clueSet = new Set(puzzle.clues.map(([, , v]) => v))
    const playerUsed = new Set(
      cells.filter((c) => !c.isClue && c.value !== null).map((c) => c.value)
    )
    function handleKeydown(e) {
      if (e.defaultPrevented) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (isBlockingModalOpenRef.current?.()) return
      const key = e.key
      if (key === 'Escape') {
        if (isBlockingModalOpenRef.current?.()) return
        e.preventDefault()
        notifyUserInput()
        setActiveDigit((cur) => (cur === null ? computeActiveDigitMinMissing(cells) : cur))
        return
      }
      let d = null
      if (key >= '1' && key <= '9') d = parseInt(key, 10)
      else if (key === '0') d = 10
      if (d !== null && d <= n && !clueSet.has(d) && !playerUsed.has(d) && !solved) {
        e.preventDefault()
        notifyUserInput()
        setActiveDigit(d)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [cells, puzzle.clues, solved, notifyUserInput])

  // ─── double-tap prevention ─────────────────────────────────────────────────

  useEffect(() => {
    let lastTouchEnd = 0
    function onTouchEnd(e) {
      const now = Date.now()
      if (
        now - lastTouchEnd <= 300 &&
        e.target?.closest?.('button, .kb-key, #hex-grid, .button-tray')
      ) {
        e.preventDefault()
      }
      lastTouchEnd = now
    }
    document.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => document.removeEventListener('touchend', onTouchEnd)
  }, [])

  // ─── win helper ────────────────────────────────────────────────────────────

  const commitWin = useCallback(
    (winCells, trace, winHistory) => {
      setSolved(true)
      markSolved(
        puzzleIdx,
        usedUndoOrResetRef.current,
        dateKey,
        trackCompletion,
        onCompletionsUpdated
      )
      saveGameState({
        idx: puzzleIdx,
        puzzle,
        cells: winCells,
        solved: true,
        activeDigit,
        moveHistory: winHistory,
        usedUndoOrReset: usedUndoOrResetRef.current,
        dateKey,
      })
      if (trackCompletion) {
        const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.HONEYCOMBS, dateKey, puzzleIdx)
        if (next !== null) setPostWinCtaAttention(true)
      } else if (puzzleIdx < totalPuzzles - 1) {
        setPostWinCtaAttention(true)
      }
      runTrace(trace, () => onWin?.(puzzleIdx))
    },
    [
      puzzleIdx,
      totalPuzzles,
      puzzle,
      activeDigit,
      dateKey,
      trackCompletion,
      onCompletionsUpdated,
      runTrace,
      onWin,
    ]
  )

  // ─── handlers ─────────────────────────────────────────────────────────────

  const handleCellClick = useCallback(
    (row, col) => {
      if (solved) return
      notifyUserInput()
      const cell = cells.find((c) => c.row === row && c.col === col)
      if (!cell || cell.isClue) return

      if (cell.value !== null) {
        // erase: push history and restore digit as active
        usedUndoOrResetRef.current = true
        const newHistory = [...moveHistory, cells.map((c) => c.value)]
        const newCells = cells.map((c) =>
          c.row === row && c.col === col ? { ...c, value: null } : c
        )
        setMoveHistory(newHistory)
        setCells(newCells)
        setActiveDigit(cell.value)
        saveGameState({
          idx: puzzleIdx,
          puzzle,
          cells: newCells,
          solved: false,
          activeDigit: cell.value,
          moveHistory: newHistory,
          usedUndoOrReset: true,
          dateKey,
        })
        return
      }

      if (activeDigit === null) return
      // block if this number is already a clue on another cell
      if (
        cells.some((c) => c.value === activeDigit && c.isClue && !(c.row === row && c.col === col))
      )
        return

      const newHistory = [...moveHistory, cells.map((c) => c.value)]
      const newCells = cells.map((c) =>
        c.row === row && c.col === col ? { ...c, value: activeDigit } : c
      )
      const nextActive = computeActiveDigitAfterFill(newCells, activeDigit)

      setMoveHistory(newHistory)
      setCells(newCells)
      setActiveDigit(nextActive)

      const allNowFilled = newCells.every((c) => c.value !== null)
      if (allNowFilled) {
        const trace = buildPathTrace(newCells, puzzle.size)
        if (trace.complete) {
          commitWin(newCells, trace, newHistory)
          return
        }
      }

      saveGameState({
        idx: puzzleIdx,
        puzzle,
        cells: newCells,
        solved: false,
        activeDigit: nextActive,
        moveHistory: newHistory,
        usedUndoOrReset: usedUndoOrResetRef.current,
        dateKey,
      })
    },
    [
      solved,
      cells,
      activeDigit,
      moveHistory,
      puzzle,
      puzzleIdx,
      dateKey,
      notifyUserInput,
      commitWin,
    ]
  )

  const handleKeyPress = useCallback(
    (num) => {
      if (solved) return
      notifyUserInput()
      const clueSet = new Set(puzzle.clues.map(([, , v]) => v))
      if (clueSet.has(num)) return
      const playerUsed = new Set(
        cells.filter((c) => !c.isClue && c.value !== null).map((c) => c.value)
      )
      if (playerUsed.has(num)) return
      if (activeDigit === num && !playerUsed.has(num)) return
      setActiveDigit(num)
    },
    [solved, cells, activeDigit, puzzle.clues, notifyUserInput]
  )

  const handleUndo = useCallback(() => {
    if (!moveHistory.length) return
    notifyUserInput()
    usedUndoOrResetRef.current = true
    const prev = moveHistory[moveHistory.length - 1]
    const newHistory = moveHistory.slice(0, -1)
    const newCells = cells.map((c, i) => ({ ...c, value: prev[i] }))
    const newActiveDigit = computeActiveDigitMinMissing(newCells)
    setCells(newCells)
    setMoveHistory(newHistory)
    setActiveDigit(newActiveDigit)
    setSolved(false)
    saveGameState({
      idx: puzzleIdx,
      puzzle,
      cells: newCells,
      solved: false,
      activeDigit: newActiveDigit,
      moveHistory: newHistory,
      usedUndoOrReset: true,
      dateKey,
    })
  }, [moveHistory, cells, puzzle, puzzleIdx, dateKey, notifyUserInput])

  const handleClearAll = useCallback(() => {
    if (!moveHistory.length) return
    notifyUserInput()
    usedUndoOrResetRef.current = true
    const baseline = buildBaselineCells(puzzle)
    const newCells = cells.map((cell) => {
      const base = baseline.find((b) => b.row === cell.row && b.col === cell.col)
      return base ? { ...cell, value: base.value } : cell
    })
    const newActiveDigit = computeActiveDigitMinMissing(newCells)
    setCells(newCells)
    setMoveHistory([])
    setActiveDigit(newActiveDigit)
    setSolved(false)
    saveGameState({
      idx: puzzleIdx,
      puzzle,
      cells: newCells,
      solved: false,
      activeDigit: newActiveDigit,
      moveHistory: [],
      usedUndoOrReset: true,
      dateKey,
    })
  }, [moveHistory.length, cells, puzzle, puzzleIdx, dateKey, notifyUserInput])

  const handleCheck = useCallback(() => {
    const allFilled = cells.every((c) => c.value !== null)
    if (!allFilled || solved) return
    notifyUserInput()
    const trace = buildPathTrace(cells, puzzle.size)
    if (trace.bad || !trace.cells.length) return
    if (trace.complete) {
      commitWin(cells, trace, moveHistory)
    } else {
      runTrace(trace, null)
    }
  }, [cells, solved, puzzle.size, moveHistory, notifyUserInput, commitWin, runTrace])

  // ─── derived display values ────────────────────────────────────────────────

  const clueSet = useMemo(() => new Set(puzzle.clues.map(([, , v]) => v)), [puzzle.clues])
  const playerUsedSet = useMemo(
    () => new Set(cells.filter((c) => !c.isClue && c.value !== null).map((c) => c.value)),
    [cells]
  )
  const allFilled = cells.every((c) => c.value !== null)
  const numRows = KB_ROWS[puzzle.size]

  const smartPrimaryLabel = useMemo(() => {
    if (!solved) {
      if (allFilled) return 'Check'
      return null
    }
    if (trackCompletion) {
      const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.HONEYCOMBS, dateKey, puzzleIdx)
      if (next !== null) return CTA_LABELS.NEXT_PUZZLE
      if (finalSolvedAction?.label) return finalSolvedAction.label
      if (hubBaseHref) return CTA_LABELS.ALL_PUZZLES
      return null
    }
    if (puzzleIdx < totalPuzzles - 1) return CTA_LABELS.NEXT_PUZZLE
    if (finalSolvedAction?.label) return finalSolvedAction.label
    if (hubBaseHref) return CTA_LABELS.ALL_PUZZLES
    return null
  }, [
    solved,
    trackCompletion,
    dateKey,
    puzzleIdx,
    totalPuzzles,
    finalSolvedAction?.label,
    hubBaseHref,
    allFilled,
  ])

  const smartPrimaryHref = useMemo(() => {
    if (!solved) return undefined
    if (trackCompletion) {
      const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.HONEYCOMBS, dateKey, puzzleIdx)
      if (next !== null) return undefined
      if (finalSolvedAction?.href) return finalSolvedAction.href
      if (hubBaseHref && !finalSolvedAction?.label) return hubBaseHref
      return undefined
    }
    if (puzzleIdx === totalPuzzles - 1 && finalSolvedAction?.href) return finalSolvedAction.href
    if (puzzleIdx === totalPuzzles - 1 && hubBaseHref && !finalSolvedAction?.label)
      return hubBaseHref
    return undefined
  }, [
    solved,
    trackCompletion,
    dateKey,
    puzzleIdx,
    totalPuzzles,
    finalSolvedAction?.href,
    finalSolvedAction?.label,
    hubBaseHref,
  ])

  useEffect(() => {
    onHubCompleteCtaPauseChange?.(
      smartPrimaryLabel === CTA_LABELS.ALL_PUZZLES || smartPrimaryLabel === CTA_LABELS.NEXT_PUZZLE
    )
  }, [smartPrimaryLabel, onHubCompleteCtaPauseChange])

  const handleSmartPrimaryClick = useCallback(() => {
    if (solved && trackCompletion) {
      const next = nextIncompleteEnabledTierExcluding(GAME_KEYS.HONEYCOMBS, dateKey, puzzleIdx)
      if (next !== null) {
        setPostWinCtaAttention(false)
        onRequestNextPuzzle?.()
        return
      }
      if (finalSolvedAction?.label && !finalSolvedAction.href) {
        finalSolvedAction.onClick?.()
        return
      }
      return
    }
    if (solved && !trackCompletion) {
      if (puzzleIdx < totalPuzzles - 1) {
        setPostWinCtaAttention(false)
        onRequestNextPuzzle?.()
        return
      }
      if (finalSolvedAction?.label && !finalSolvedAction.href) {
        finalSolvedAction.onClick?.()
        return
      }
      return
    }
    if (!solved && allFilled) handleCheck()
  }, [
    solved,
    trackCompletion,
    dateKey,
    puzzleIdx,
    totalPuzzles,
    allFilled,
    finalSolvedAction,
    onRequestNextPuzzle,
    handleCheck,
  ])

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div ref={stageRef} className="game-stage" style={boardCapVars}>
        <div ref={boardWrapRef} className="hc-board-wrap" style={boardCapVars}>
          <svg
            id="hex-grid"
            ref={svgRef}
            viewBox={`0 0 ${vb.w} ${vb.h}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block', width: '100%', height: '100%' }}
          >
            <g id="hex-cells">
              {cells.map((cell) => (
                <g
                  key={cellKey(cell.row, cell.col)}
                  className={cellClassName(cell)}
                  data-row={cell.row}
                  data-col={cell.col}
                  onPointerUp={
                    cell.isClue
                      ? undefined
                      : (e) => {
                          e.stopPropagation()
                          handleCellClick(cell.row, cell.col)
                        }
                  }
                >
                  <polygon points={hexPoints(cell.cx, cell.cy, HEX_R - 1)} />
                  <text
                    x={cell.cx}
                    y={cell.cy}
                    className="hex-label"
                    fontSize={cell.value !== null && cell.value >= 10 ? 12 : undefined}
                  >
                    {cell.value !== null ? cell.value : ''}
                  </text>
                </g>
              ))}
            </g>
            {/* #hex-trace is appended imperatively by useHoneycombsTrace */}
          </svg>
        </div>
      </div>

      <div id="keyboard" ref={keyboardRef}>
        {numRows.map((row, ri) => (
          <div key={ri} className="kb-row">
            {row
              .filter((n) => n <= cells.length)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  className={keyClassName(n, clueSet, playerUsedSet, activeDigit, solved)}
                  onPointerUp={
                    clueSet.has(n)
                      ? undefined
                      : (e) => {
                          e.stopPropagation()
                          handleKeyPress(n)
                        }
                  }
                >
                  {n}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="button-tray" ref={trayRef}>
        <button
          type="button"
          className="btn-secondary"
          disabled={moveHistory.length === 0}
          title="Undo last move"
          onClick={handleUndo}
        >
          Undo
        </button>
        <SmartRightButton
          primaryLabel={smartPrimaryLabel || undefined}
          primaryHref={smartPrimaryHref}
          onPrimaryClick={smartPrimaryHref ? undefined : handleSmartPrimaryClick}
          attention={postWinCtaAttention && smartPrimaryLabel === CTA_LABELS.NEXT_PUZZLE}
          resetDisabled={moveHistory.length === 0}
          onReset={handleClearAll}
        />
      </div>
    </>
  )
}

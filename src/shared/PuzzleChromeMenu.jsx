import React, { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react'
import DiceFace from './DiceFace.jsx'
import { PUZZLE_SUITE_INK, PUZZLE_SUITE_SURFACE_INCOMPLETE } from '@shared-contracts/chromeUi.js'
import {
  SUITE_PREFS_UPDATED_EVENT,
  getTierMask,
  isThreeTierGameKey,
  readSuiteDashboardPreferences,
  trySetTierEnabled,
} from '@shared-contracts/suiteDashboardPreferences.js'

const INK = '#1a3d5b'

const diceBtnBase = {
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.2s, color 0.2s',
}

function diceBtnStyle(tierOn) {
  return {
    ...diceBtnBase,
    background: tierOn ? PUZZLE_SUITE_INK : PUZZLE_SUITE_SURFACE_INCOMPLETE,
    color: tierOn ? '#fff' : PUZZLE_SUITE_INK,
  }
}

const iconStyle = {
  fontSize: '1.05rem',
  lineHeight: 1,
  width: '1.25rem',
  textAlign: 'center',
  color: INK,
}

/**
 * @param {{ puzzleChrome: {
 *   gameKey: string,
 *   onStats: () => void,
 *   onHelp: () => void,
 *   onTutorial?: () => void,
 *   hasTutorial?: boolean,
 *   showYesterdayToggle?: boolean,
 *   viewingYesterday?: boolean,
 *   onToggleYesterday?: () => void,
 * }}} props
 */
export default function PuzzleChromeMenu({ puzzleChrome }) {
  const {
    gameKey,
    onStats,
    onHelp,
    onTutorial,
    hasTutorial,
    showYesterdayToggle,
    viewingYesterday,
    onToggleYesterday,
  } = puzzleChrome
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const btnRef = useRef(null)
  const menuId = useId()

  const [prefsEpoch, bumpPrefs] = useReducer((n) => n + 1, 0)
  useEffect(() => {
    const bump = () => bumpPrefs()
    window.addEventListener(SUITE_PREFS_UPDATED_EVENT, bump)
    return () => window.removeEventListener(SUITE_PREFS_UPDATED_EVENT, bump)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      const root = rootRef.current
      if (!root || root.contains(e.target)) return
      setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  void prefsEpoch
  const prefs = readSuiteDashboardPreferences()
  const showDifficulty = isThreeTierGameKey(gameKey)
  const tiers = showDifficulty ? getTierMask(gameKey, prefs) : null

  const toggleTier = (tierIdx) => {
    const cur = getTierMask(gameKey, readSuiteDashboardPreferences())
    const was = cur[tierIdx]
    trySetTierEnabled(gameKey, tierIdx, !was, readSuiteDashboardPreferences())
  }

  const runStats = () => {
    close()
    onStats()
  }
  const runHelp = () => {
    close()
    onHelp()
  }
  const runTutorial = () => {
    close()
    onTutorial?.()
  }
  const runYesterdayToggle = () => {
    close()
    onToggleYesterday?.()
  }

  return (
    <div ref={rootRef} className="puzzle-chrome-menu-root">
      <button
        ref={btnRef}
        type="button"
        className="titlebar-iconbtn"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '999px',
          border: '2px solid transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
          textDecoration: 'none',
        }}
        aria-label="Open puzzle menu"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <i
          className="fa-solid fa-gear"
          style={{
            fontFamily: '"Font Awesome 6 Free"',
            fontWeight: 900,
            fontSize: '1.15rem',
            lineHeight: 1,
            display: 'block',
          }}
          aria-hidden
        />
      </button>

      {open ? (
        <div id={menuId} className="puzzle-chrome-menu-panel" aria-label="Puzzle menu">
          {showDifficulty && tiers ? (
            <div
              className="puzzle-chrome-menu-row puzzle-chrome-menu-difficulty"
              role="group"
              aria-label="Difficulty"
            >
              <div className="puzzle-chrome-menu-row-label">
                <i className="fa-solid fa-brain" style={iconStyle} aria-hidden />
                <span className="puzzle-chrome-menu-row-text">DIFFICULTY</span>
              </div>
              <div className="puzzle-chrome-menu-dice">
                {[0, 1, 2].map((ti) => {
                  const on = tiers[ti]
                  const onlyOne = tiers.filter(Boolean).length === 1 && on
                  return (
                    <button
                      key={ti}
                      type="button"
                      disabled={onlyOne && on}
                      title={['Easy', 'Medium', 'Hard'][ti]}
                      aria-label={`${['Easy', 'Medium', 'Hard'][ti]} ${on ? 'on' : 'off'}`}
                      aria-pressed={on}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!(onlyOne && on)) toggleTier(ti)
                      }}
                      style={{
                        ...diceBtnStyle(on),
                        cursor: onlyOne && on ? 'default' : 'pointer',
                        opacity: onlyOne && on ? 0.85 : 1,
                      }}
                    >
                      <DiceFace count={ti + 1} size={16} color={on ? '#fff' : undefined} />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <button type="button" className="puzzle-chrome-menu-item" onClick={runStats}>
            <i className="fa-solid fa-chart-column" style={iconStyle} aria-hidden />
            <span className="puzzle-chrome-menu-row-text">STATS</span>
          </button>

          <button type="button" className="puzzle-chrome-menu-item" onClick={runHelp}>
            <i className="fa-solid fa-question" style={iconStyle} aria-hidden />
            <span className="puzzle-chrome-menu-row-text">INSTRUCTIONS</span>
          </button>

          {hasTutorial && typeof onTutorial === 'function' ? (
            <button type="button" className="puzzle-chrome-menu-item" onClick={runTutorial}>
              <i className="fa-solid fa-lightbulb" style={iconStyle} aria-hidden />
              <span className="puzzle-chrome-menu-row-text">TUTORIAL</span>
            </button>
          ) : null}

          {showYesterdayToggle && typeof onToggleYesterday === 'function' ? (
            <button type="button" className="puzzle-chrome-menu-item" onClick={runYesterdayToggle}>
              <i
                className={`fa-solid ${viewingYesterday ? 'fa-calendar-day' : 'fa-calendar-minus'}`}
                style={iconStyle}
                aria-hidden
              />
              <span className="puzzle-chrome-menu-row-text">
                {viewingYesterday ? "TODAY'S PUZZLE" : "YESTERDAY'S PUZZLE"}
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

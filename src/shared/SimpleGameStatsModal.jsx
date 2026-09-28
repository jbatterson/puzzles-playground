import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import FloatingModalShell from './FloatingModalShell.jsx'
import { MODAL_INTENTS } from '@shared-contracts/modalIntents.js'
import { computeSimpleGameStats } from '@shared-contracts/simpleGameStats.js'
import { GAME_KEYS } from '@shared-contracts/gameChrome.js'
import {
  buildHubSharePlaintext,
  hasShareableHubProgress,
} from '@shared-contracts/hubSharePlaintext.js'
import {
  isSuiteCompleteForPrefs,
  isSuiteTimerEnabled,
} from '@shared-contracts/suiteDashboardPreferences.js'
import { isBonusUnlocked } from '@shared-contracts/bonusPuzzle.js'
import {
  formatPuzzleDateHeading,
  readSuiteGameElapsedMs,
} from '@shared-contracts/suiteCompletionTimer.js'
import { readBonusGameElapsedMs } from '@shared-contracts/bonusCompletionTimer.js'
import { isBonusComplete } from '@shared-contracts/bonusPuzzle.js'
import { formatAllTenElapsedMsForShare } from '@shared-contracts/allTenSharePlaintext.js'
import ShareIcon from './ShareIcon.jsx'
import ShareResultToast, { SHARE_RESULT_TOAST_MS } from './ShareResultToast.jsx'
import SuiteCompletionTitle from './SuiteCompletionTitle.jsx'
import SuiteCompletionHubDice from './SuiteCompletionHubDice.jsx'

function pluralUnit(n, singular, plural) {
  return n === 1 ? singular : plural
}

/**
 * @typedef {{
 *   dateKey: string,
 *   completions: boolean[],
 *   perfects: boolean[],
 *   moveCounts?: (number|null)[],
 *   cluelessAttempts?: (number|null)[] | null,
 * }} DailySuiteFooter
 */

/**
 * @param {{ show: boolean, onClose: () => void, gameKey: string, dailySuiteFooter?: DailySuiteFooter | null }} props
 */
export default function SimpleGameStatsModal({ show, onClose, gameKey, dailySuiteFooter = null }) {
  const stats = useMemo(() => {
    if (!show || !gameKey) return { played: 0, streak: 0, stars: 0, avgMoves: '' }
    return computeSimpleGameStats(gameKey)
  }, [show, gameKey])

  const isTileGame = gameKey === GAME_KEYS.SUMTILES || gameKey === GAME_KEYS.PRODUCTILES

  const useSuiteLayout = Boolean(
    dailySuiteFooter &&
    dailySuiteFooter.dateKey &&
    Array.isArray(dailySuiteFooter.completions) &&
    dailySuiteFooter.completions.length >= 3 &&
    Array.isArray(dailySuiteFooter.perfects) &&
    dailySuiteFooter.perfects.length >= 3
  )

  const base = import.meta.env.BASE_URL

  const allDailyComplete = useMemo(() => {
    if (!useSuiteLayout || !dailySuiteFooter || !gameKey) return false
    return isSuiteCompleteForPrefs(gameKey, dailySuiteFooter.dateKey)
  }, [useSuiteLayout, dailySuiteFooter, gameKey])

  const elapsedMsForDay = useMemo(() => {
    if (!show || !useSuiteLayout || !gameKey || !dailySuiteFooter?.dateKey || !allDailyComplete)
      return null
    if (!isSuiteTimerEnabled()) return null
    return readSuiteGameElapsedMs(gameKey, dailySuiteFooter.dateKey)
  }, [show, useSuiteLayout, gameKey, dailySuiteFooter?.dateKey, allDailyComplete])

  const canShareDay = useMemo(() => {
    if (!show || !useSuiteLayout || !gameKey || !dailySuiteFooter?.dateKey) return false
    return hasShareableHubProgress(gameKey, dailySuiteFooter.dateKey)
  }, [show, useSuiteLayout, gameKey, dailySuiteFooter?.dateKey])

  const [shareUi, setShareUi] = useState(null)
  const toastTimeoutRef = useRef(null)
  const shareAnchorRef = useRef(null)

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    },
    []
  )

  useEffect(() => {
    if (show) return
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    const id = requestAnimationFrame(() => setShareUi(null))
    return () => cancelAnimationFrame(id)
  }, [show])

  const pinShareToast = show && shareUi != null

  useEffect(() => {
    if (!pinShareToast) return
    const updateTop = () => {
      const n = shareAnchorRef.current
      if (!n) return
      const top = n.getBoundingClientRect().bottom + 6
      setShareUi((prev) => (prev ? { ...prev, top } : null))
    }
    const id = requestAnimationFrame(updateTop)
    window.addEventListener('resize', updateTop)
    window.addEventListener('scroll', updateTop, true)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', updateTop)
      window.removeEventListener('scroll', updateTop, true)
    }
  }, [pinShareToast])

  const dismissShareToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setShareUi(null)
  }, [])

  const handleShare = useCallback(async () => {
    if (!useSuiteLayout || !dailySuiteFooter?.dateKey) return
    const text = buildHubSharePlaintext(gameKey, dailySuiteFooter.dateKey, base)
    try {
      await navigator.clipboard.writeText(text)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      const r = shareAnchorRef.current?.getBoundingClientRect()
      setShareUi({
        preview: text,
        fadeOut: false,
        top: r ? r.bottom + 6 : undefined,
      })
      toastTimeoutRef.current = setTimeout(() => {
        setShareUi((prev) => (prev ? { ...prev, fadeOut: true } : null))
        toastTimeoutRef.current = null
      }, SHARE_RESULT_TOAST_MS)
    } catch {
      // clipboard unavailable (non-secure context or permission denied) — no-op
    }
  }, [useSuiteLayout, dailySuiteFooter?.dateKey, gameKey, base])

  const shareToastViewportStyle =
    shareUi != null && shareUi.top != null
      ? {
          position: 'fixed',
          top: shareUi.top,
          left: '50%',
          right: 'auto',
          transform: 'translateX(-50%)',
          marginTop: 0,
          zIndex: 10050,
        }
      : undefined

  const statsRow = (
    <div className={`simple-game-stats-row${useSuiteLayout ? ' suite-completion-stats' : ''}`}>
      <div className="simple-game-stats-col">
        <div className="simple-game-stats-label">Played</div>
        <div className="simple-game-stats-value">{stats.played}</div>
        <div className="simple-game-stats-unit">{pluralUnit(stats.played, 'day', 'days')}</div>
      </div>
      <div className="simple-game-stats-col">
        <div className="simple-game-stats-label">Streak</div>
        <div className="simple-game-stats-value">{stats.streak}</div>
        <div className="simple-game-stats-unit">{pluralUnit(stats.streak, 'day', 'days')}</div>
      </div>
      {isTileGame ? (
        <div className="simple-game-stats-col">
          <div className="simple-game-stats-label">AVG MOVES</div>
          <div className="simple-game-stats-value">{stats.avgMoves || '–|–|–'}</div>
          <div className="simple-game-stats-unit"></div>
        </div>
      ) : (
        <div className="simple-game-stats-col">
          <div className="simple-game-stats-label">Stars</div>
          <div className="simple-game-stats-value">{stats.stars}</div>
          <div className="simple-game-stats-unit">{pluralUnit(stats.stars, 'time', 'times')}</div>
        </div>
      )}
    </div>
  )

  if (useSuiteLayout && dailySuiteFooter) {
    const suiteTimeHms =
      elapsedMsForDay != null ? formatAllTenElapsedMsForShare(elapsedMsForDay) : null
    const bonusMs =
      suiteTimeHms != null &&
      isBonusComplete(gameKey, dailySuiteFooter.dateKey) &&
      isSuiteTimerEnabled()
        ? readBonusGameElapsedMs(gameKey, dailySuiteFooter.dateKey)
        : null
    const timeHms =
      suiteTimeHms == null
        ? null
        : bonusMs != null
          ? `${suiteTimeHms} (+${formatAllTenElapsedMsForShare(bonusMs)})`
          : suiteTimeHms

    return (
      <>
        <FloatingModalShell
          show={show}
          onClose={onClose}
          intent={MODAL_INTENTS.STATS}
          contentClassName="suite-completion-shell"
        >
          <SuiteCompletionTitle>STATS</SuiteCompletionTitle>
          {statsRow}
          <div className="suite-completion-hub-dice-block">
            <div className="suite-completion-puzzle-date">
              {formatPuzzleDateHeading(dailySuiteFooter.dateKey)}
            </div>
            <SuiteCompletionHubDice
              gameKey={gameKey}
              completions={dailySuiteFooter.completions}
              perfects={dailySuiteFooter.perfects}
              moveCounts={dailySuiteFooter.moveCounts}
              bonusUnlocked={isBonusUnlocked(gameKey, dailySuiteFooter.dateKey)}
            />
            {timeHms != null ? (
              <div
                className="suite-completion-solve-elapsed"
                aria-label={`Elapsed time ${timeHms}`}
              >
                {timeHms}
              </div>
            ) : null}
          </div>
          {canShareDay ? (
            <div ref={shareAnchorRef} className="suite-completion-share-block">
              <button
                type="button"
                className="suite-completion-share-btn"
                onClick={handleShare}
                aria-label="Share results"
              >
                Share
                <ShareIcon size={18} />
              </button>
            </div>
          ) : null}
        </FloatingModalShell>
        {show && shareUi != null && (
          <ShareResultToast
            preview={shareUi.preview}
            fadeOut={shareUi.fadeOut}
            align="center"
            style={shareToastViewportStyle}
            onDismiss={dismissShareToast}
            onTransitionEnd={(e) => {
              if (e.target !== e.currentTarget || e.propertyName !== 'opacity') return
              setShareUi((prev) => (prev?.fadeOut ? null : prev))
            }}
          />
        )}
      </>
    )
  }

  return (
    <FloatingModalShell
      show={show}
      onClose={onClose}
      intent={MODAL_INTENTS.STATS}
      contentClassName="simple-game-stats-shell"
    >
      <h2 className="simple-game-stats-title">Stats</h2>
      {statsRow}
    </FloatingModalShell>
  )
}

import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import FloatingModalShell from './FloatingModalShell.jsx'
import { MODAL_INTENTS } from '@shared-contracts/modalIntents.js'
import { computeSimpleGameStats } from '@shared-contracts/simpleGameStats.js'
import { buildHubSharePlaintext } from '@shared-contracts/hubSharePlaintext.js'
import { GAME_KEYS, getGameChrome } from '@shared-contracts/gameChrome.js'
import { CTA_LABELS } from '@shared-contracts/ctaLabels.js'
import { isSuiteTimerEnabled } from '@shared-contracts/suiteDashboardPreferences.js'
import {
  finalizeSuiteGameTimerFromModal,
  formatPuzzleDateHeading,
  readSuiteGameElapsedMs,
} from '@shared-contracts/suiteCompletionTimer.js'
import { formatAllTenElapsedMsForShare } from '@shared-contracts/allTenSharePlaintext.js'
import ShareIcon from './ShareIcon.jsx'
import ShareResultToast, { SHARE_RESULT_TOAST_MS } from './ShareResultToast.jsx'
import SuiteCompletionTitle from './SuiteCompletionTitle.jsx'
import SuiteCompletionHubDice from './SuiteCompletionHubDice.jsx'
import SuiteCompletionBaPlug from './SuiteCompletionBaPlug.jsx'

/** Win-modal headings (uppercase + punctuation per design). */
const COMPLETION_HEADLINE = Object.freeze({
  [GAME_KEYS.SUMTILES]: 'AWE-SUM!',
  [GAME_KEYS.PRODUCTILES]: 'PRODUCTIVE!',
  [GAME_KEYS.ROLYPOLY]: 'ON A ROLL!',
})

function pluralUnit(n, singular, plural) {
  return n === 1 ? singular : plural
}

/**
 * All Ten–style completion surface: suite stats, hub dice, share + hub CTAs, BA plug.
 * @param {{ show: boolean, onClose: () => void, gameKey: string, dateKey: string, hubDiceCompletions: boolean[], hubDicePerfects: boolean[], hubDiceMoveCounts?: (number|null)[] }} props
 */
export default function SuiteGameCompletionModal({
  show,
  onClose,
  gameKey,
  dateKey,
  hubDiceCompletions,
  hubDicePerfects,
  hubDiceMoveCounts,
}) {
  const base = import.meta.env.BASE_URL
  const { title: gameTitle } = getGameChrome(gameKey)
  const modalTitle = COMPLETION_HEADLINE[gameKey] ?? `${gameTitle.toUpperCase()}!`

  const stats = useMemo(() => {
    if (!show || !gameKey) return { played: 0, streak: 0, stars: 0, avgMoves: '' }
    return computeSimpleGameStats(gameKey)
  }, [show, gameKey])

  const isTileGame = gameKey === GAME_KEYS.SUMTILES || gameKey === GAME_KEYS.PRODUCTILES

  const [elapsedMsDisplay, setElapsedMsDisplay] = useState(null)

  useLayoutEffect(() => {
    if (!show || !gameKey || !dateKey) return
    finalizeSuiteGameTimerFromModal(gameKey, dateKey)
    setElapsedMsDisplay(readSuiteGameElapsedMs(gameKey, dateKey))
  }, [show, gameKey, dateKey])

  useEffect(() => {
    if (show) return
    setElapsedMsDisplay(null)
  }, [show])

  /** Clipboard preview toast: lives outside the modal panel so it is not clipped by overflow. */
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
    const id = requestAnimationFrame(() => {
      setShareUi(null)
    })
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
    const text = buildHubSharePlaintext(gameKey, dateKey, base)
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
  }, [gameKey, dateKey, base])

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

  const timerEnabled = isSuiteTimerEnabled()
  const timeHms = timerEnabled ? formatAllTenElapsedMsForShare(elapsedMsDisplay ?? 0) : null

  const showDiceBlock =
    Array.isArray(hubDiceCompletions) &&
    hubDiceCompletions.length === 3 &&
    Array.isArray(hubDicePerfects) &&
    hubDicePerfects.length === 3

  return (
    <>
      <FloatingModalShell
        show={show}
        onClose={onClose}
        intent={MODAL_INTENTS.RESULTS}
        contentClassName="suite-completion-shell"
      >
        <SuiteCompletionTitle>{modalTitle}</SuiteCompletionTitle>

        <div className="simple-game-stats-row suite-completion-stats">
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
              <div className="simple-game-stats-unit">
                {pluralUnit(stats.stars, 'time', 'times')}
              </div>
            </div>
          )}
        </div>

        {showDiceBlock ? (
          <div className="suite-completion-hub-dice-block">
            <div className="suite-completion-puzzle-date">{formatPuzzleDateHeading(dateKey)}</div>
            <SuiteCompletionHubDice
              gameKey={gameKey}
              completions={hubDiceCompletions}
              perfects={hubDicePerfects}
              moveCounts={hubDiceMoveCounts}
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
        ) : null}

        <div className="suite-completion-actions-row">
          <button
            ref={shareAnchorRef}
            type="button"
            className="btn-secondary suite-completion-action-btn"
            onClick={handleShare}
            aria-label="Share results"
          >
            Share
            <ShareIcon size={18} />
          </button>
          <a
            href={base}
            className="btn-primary suite-completion-action-btn suite-completion-all-puzzles"
          >
            {CTA_LABELS.ALL_PUZZLES}
          </a>
        </div>

        <SuiteCompletionBaPlug />
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

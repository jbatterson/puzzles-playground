import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildAllHubSharePlaintext,
  hasAnyShareableHubProgress,
} from '@shared-contracts/hubSharePlaintext.js'
import ShareResultToast, { SHARE_RESULT_TOAST_MS } from './ShareResultToast.jsx'

/**
 * Hub aggregate share control (same 28×28 control as in-game).
 * Copies all games with progress; short toast with no preview body.
 */
export default function HubShareNavButton({ dateKey }) {
  const base = import.meta.env.BASE_URL
  const canShare = hasAnyShareableHubProgress(dateKey)
  const [shareToast, setShareToast] = useState(null)
  const toastTimeoutRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    },
    []
  )

  const dismissShareToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setShareToast(null)
  }, [])

  const handleClick = useCallback(async () => {
    if (!canShare) return
    const text = buildAllHubSharePlaintext(dateKey, base)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      setShareToast({ fadeOut: false })
      toastTimeoutRef.current = setTimeout(() => {
        setShareToast((prev) => (prev ? { ...prev, fadeOut: true } : null))
        toastTimeoutRef.current = null
      }, SHARE_RESULT_TOAST_MS)
    } catch {
      // clipboard unavailable (non-secure context or permission denied) — no-op
    }
  }, [canShare, dateKey, base])

  return (
    <div ref={wrapRef} className="game-nav-share-wrap hp-section-share" style={{ position: 'relative' }}>
      <button
        type="button"
        className="game-nav-share-btn"
        disabled={!canShare}
        onClick={handleClick}
        aria-label={canShare ? 'Share all results' : 'Share all results (no progress yet)'}
      >
        <i className="fa-solid fa-share-nodes" aria-hidden="true" />
      </button>
      {shareToast != null && (
        <ShareResultToast
          short
          fadeOut={shareToast.fadeOut}
          align="end"
          onDismiss={dismissShareToast}
          onTransitionEnd={(e) => {
            if (e.target !== e.currentTarget || e.propertyName !== 'opacity') return
            setShareToast((prev) => (prev?.fadeOut ? null : prev))
          }}
        />
      )}
    </div>
  )
}

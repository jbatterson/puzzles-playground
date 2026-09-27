import React from 'react'

/** Visible duration before fade-out for share preview toasts (hub, in-game, completion modal). */
export const SHARE_RESULT_TOAST_MS = 2500

/**
 * Shared navy toast after copying share plaintext.
 * Positioned below the anchor (`top: 100%`). Parent must be `position: relative` (wide anchor for in-game rows).
 * Pass `onDismiss` to show a close control and clear the auto-hide timer when dismissed.
 * When `short` is true, only “Results copied to clipboard.” is shown (no preview body).
 */
export default function ShareResultToast({
  preview,
  fadeOut,
  onTransitionEnd,
  onDismiss,
  align = 'end',
  short = false,
  /** Merged onto root; use for e.g. fixed viewport positioning (in-game share). */
  style: rootStyle,
}) {
  const alignClass =
    align === 'center' ? 'share-result-toast--align-center' : 'share-result-toast--align-end'

  return (
    <div
      className={`toast-panel share-result-toast share-result-toast--below ${alignClass}${short ? ' share-result-toast--short' : ''}${fadeOut ? ' share-result-toast--fadeOut' : ''}`}
      style={rootStyle}
      role="status"
      onTransitionEnd={onTransitionEnd}
    >
      <div className="toast-row share-result-toast__row">
        <div className="toast-text share-result-toast__inner">
          <div className="share-result-toast__head">
            {short ? 'Results copied to clipboard.' : 'Results copied to clipboard:'}
          </div>
          {!short && <div className="share-result-toast__body">{preview}</div>}
        </div>
        {onDismiss != null && (
          <button
            type="button"
            className="toast-close share-result-toast__close"
            aria-label="Dismiss notification"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

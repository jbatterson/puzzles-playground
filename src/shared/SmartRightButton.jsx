import React from 'react'

function mergeClass(...parts) {
  return parts.filter(Boolean).join(' ')
}

/**
 * Right-hand button in the two-button tray. Defaults to a secondary "Reset"
 * button, but promotes to a primary CTA when `primaryLabel` is set
 * (e.g. "Next Puzzle", "Retry Puzzle", "FOLD", "Check").
 *
 * When `primaryHref` is provided the primary state renders as an `<a>` to
 * preserve native link semantics (middle-click, etc.).
 */
export default function SmartRightButton({
  primaryLabel,
  primaryHref,
  onPrimaryClick,
  attention,
  resetDisabled,
  onReset,
  className = '',
  ...rest
}) {
  if (primaryHref) {
    return (
      <a
        className={mergeClass(
          'btn-primary',
          attention && 'btn-primary--solve-attention',
          className
        )}
        href={primaryHref}
        style={{ textAlign: 'center', textDecoration: 'none' }}
        {...rest}
      >
        {attention ? (
          <span className="btn-primary__pulse-label">{primaryLabel}</span>
        ) : (
          primaryLabel
        )}
      </a>
    )
  }

  if (primaryLabel) {
    return (
      <button
        type="button"
        className={mergeClass(
          'btn-primary',
          attention && 'btn-primary--solve-attention',
          className
        )}
        onClick={onPrimaryClick}
        {...rest}
      >
        {attention ? (
          <span className="btn-primary__pulse-label">{primaryLabel}</span>
        ) : (
          primaryLabel
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={mergeClass('btn-secondary', className)}
      disabled={resetDisabled}
      onClick={onReset}
      {...rest}
    >
      Reset
    </button>
  )
}

import React from 'react'

/**
 * Decorative star for a perfect-score puzzle slot.
 * The translateY nudge corrects the star glyph's optical baseline.
 */
export function HubDiceStar() {
  return (
    <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }} aria-hidden="true">
      ★
    </span>
  )
}

/** Decorative checkmark for a completed (non-perfect) puzzle slot. */
export function HubDiceCheck() {
  return <span aria-hidden="true">✓</span>
}

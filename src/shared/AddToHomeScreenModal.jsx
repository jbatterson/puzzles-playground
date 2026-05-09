import React from 'react'
import FloatingModalShell from './FloatingModalShell.jsx'
import { MODAL_INTENTS } from '@shared-contracts/modalIntents.js'
import { PUZZLE_SUITE_INK, PUZZLE_SUITE_INK_SOFT } from '@shared-contracts/chromeUi.js'
import appleTouchIconPreview from '../assets/apple-touch-icon.png'

/**
 * Mobile Safari: steps to pin the site to the home screen (no programmatic shortcut on iOS).
 * @param {{ show: boolean, onClose: () => void }} props
 */
export default function AddToHomeScreenModal({ show, onClose }) {
  return (
    <FloatingModalShell
      show={show}
      onClose={onClose}
      intent={MODAL_INTENTS.ADD_TO_HOME_SCREEN}
      contentClassName="add-to-home-screen-shell"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '18px',
        }}
      >
        <img
          src={appleTouchIconPreview}
          alt="BA Puzzles home screen icon preview"
          width={120}
          height={120}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '26px',
            boxShadow: '0 2px 12px rgba(26, 61, 91, 0.15), 0 1px 4px rgba(15, 10, 8, 0.08)',
            display: 'block',
          }}
        />
      </div>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: '0.95rem',
          fontWeight: 800,
          lineHeight: 1.45,
          color: PUZZLE_SUITE_INK,
          textAlign: 'center',
        }}
      >
        To add an app icon to your home screen:
      </p>
      <ol
        style={{
          margin: 0,
          paddingLeft: '1.35rem',
          fontSize: '0.92rem',
          lineHeight: 1.55,
          color: PUZZLE_SUITE_INK_SOFT,
        }}
      >
        <li style={{ marginBottom: '12px' }}>
          Find and click <strong style={{ color: PUZZLE_SUITE_INK }}>SHARE</strong> in the Safari
          toolbar or menu.
        </li>
        <li style={{ marginBottom: '12px' }}>
          Find and click <strong style={{ color: PUZZLE_SUITE_INK }}>ADD TO HOME SCREEN</strong> in
          the share menu. It may be tucked away in a{' '}
          <strong style={{ color: PUZZLE_SUITE_INK }}>VIEW MORE</strong> menu.
        </li>
        <li>
          Click the <strong style={{ color: PUZZLE_SUITE_INK }}>ADD</strong> button and you can play{' '}
          <strong style={{ color: PUZZLE_SUITE_INK }}>BA Puzzles</strong> just like an app.
        </li>
      </ol>
    </FloatingModalShell>
  )
}

import React from 'react'
import FloatingModalShell from './FloatingModalShell.jsx'
import { MODAL_INTENTS } from '@shared-contracts/modalIntents.js'
import { ALLTEN_LINK_TARGETS, CHROME_ASSET_URLS } from '@shared-contracts/chromeUi.js'
import { isNowSchoolTime } from '@shared-contracts/schoolTime.js'

/**
 * Beast Academy links modal (TopBar cube on hub; logo + title on puzzle pages).
 * @param {{ show: boolean, onClose: () => void, compact?: boolean }} props
 */
export default function PlaygroundLinksModal({ show, onClose, compact = false }) {
  const schoolTime = isNowSchoolTime()
  const primaryHref = schoolTime ? ALLTEN_LINK_TARGETS.SCHOOL : ALLTEN_LINK_TARGETS.HOME
  const primaryCardId = schoolTime ? 'allten-educators-card' : 'allten-online-card'
  const primaryButtonId = schoolTime
    ? 'allten-educators-modal-button'
    : 'allten-online-modal-button'

  const wrapClass = `allten-links-wrap allten-links-wrap--floating${compact ? ' allten-links-wrap--compact' : ''}`

  return (
    <FloatingModalShell show={show} onClose={onClose} intent={MODAL_INTENTS.LINKS}>
      <div className={wrapClass}>
        <div className="allten-links-stack">
          <div className="allten-links-card" id={primaryCardId}>
            <img
              className="allten-links-banner"
              src={CHROME_ASSET_URLS.BA_LOGO_BANNER}
              alt="Beast Academy logo"
            />
            <p className="allten-links-copy">
              {schoolTime
                ? 'Looking for more fun and challenging math activities for your classroom?'
                : 'Looking for more fun and challenging math activities for your student?'}
            </p>
            <div className="allten-links-bottom">
              <a
                className="allten-links-cta allten-links-btn"
                id={primaryButtonId}
                href={primaryHref}
                target="_blank"
                rel="noreferrer"
              >
                Learn More
              </a>
              <img
                className="allten-links-image"
                src={CHROME_ASSET_URLS.LINKS_MODAL_IMAGE}
                alt="BA books with laptop"
              />
            </div>
          </div>

          <div
            className="allten-links-card allten-links-card--hidden"
            id="allten-playground-card"
            aria-hidden="true"
          >
            <img
              className="allten-links-banner"
              src={CHROME_ASSET_URLS.BA_LOGO_BANNER}
              alt="Beast Academy logo"
            />
            <p className="allten-links-copy">
              Looking for more fun and challenging math activities for your classroom?
            </p>
            <div className="allten-links-bottom" id="allten-playground-card-bottom">
              <a
                className="allten-links-cta allten-links-btn"
                id="allten-playground-modal-button"
                href={ALLTEN_LINK_TARGETS.PLAYGROUND}
                target="_blank"
                rel="noreferrer"
              >
                Visit BA Playground
              </a>
              <img
                className="allten-links-image allten-links-image--playground"
                src={CHROME_ASSET_URLS.LINKS_MODAL_PLAYGROUND_LOGO}
                alt="BA books with laptop"
              />
            </div>
          </div>
        </div>
      </div>
    </FloatingModalShell>
  )
}

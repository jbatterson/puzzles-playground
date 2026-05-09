import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { shouldShowSafariAddToHomeInstructions, isAppleTouchDevice } from '../iosSafariAddToHome.js'

function stubNavigator({ userAgent, platform, maxTouchPoints, standalone }) {
  if (userAgent !== undefined) {
    Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
  }
  if (platform !== undefined) {
    Object.defineProperty(navigator, 'platform', { value: platform, configurable: true })
  }
  if (maxTouchPoints !== undefined) {
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: maxTouchPoints,
      configurable: true,
    })
  }
  if (standalone === undefined) {
    Reflect.deleteProperty(navigator, 'standalone')
  } else {
    Object.defineProperty(navigator, 'standalone', {
      value: standalone,
      configurable: true,
      writable: true,
    })
  }
}

describe('iosSafariAddToHome', () => {
  const safariIphoneUa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  const chromeIphoneUa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'

  let snapshot

  beforeEach(() => {
    snapshot = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: Object.prototype.hasOwnProperty.call(navigator, 'standalone')
        ? navigator.standalone
        : undefined,
    }
  })

  afterEach(() => {
    stubNavigator({
      userAgent: snapshot.userAgent,
      platform: snapshot.platform,
      maxTouchPoints: snapshot.maxTouchPoints,
      standalone: snapshot.standalone,
    })
  })

  it('detects iPhone as Apple touch device', () => {
    stubNavigator({
      userAgent: safariIphoneUa,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: undefined,
    })
    expect(isAppleTouchDevice()).toBe(true)
  })

  it('shows instructions for Mobile Safari on iPhone', () => {
    stubNavigator({
      userAgent: safariIphoneUa,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: undefined,
    })
    expect(shouldShowSafariAddToHomeInstructions()).toBe(true)
  })

  it('hides instructions for Chrome on iPhone', () => {
    stubNavigator({
      userAgent: chromeIphoneUa,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: undefined,
    })
    expect(shouldShowSafariAddToHomeInstructions()).toBe(false)
  })

  it('hides instructions when launched from home screen (standalone)', () => {
    stubNavigator({
      userAgent: safariIphoneUa,
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
    })
    expect(shouldShowSafariAddToHomeInstructions()).toBe(false)
  })

  it('treats iPad desktop UA with touch as Apple touch device', () => {
    stubNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      standalone: undefined,
    })
    expect(isAppleTouchDevice()).toBe(true)
    expect(shouldShowSafariAddToHomeInstructions()).toBe(true)
  })
})

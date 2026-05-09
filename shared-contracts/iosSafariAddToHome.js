/**
 * Whether to show “Add to Home Screen” help for Mobile Safari on iPhone / iPad.
 * Other iOS browsers (Chrome, Firefox, Edge, Opera) use different UI paths.
 */

export function isAppleTouchDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  return false
}

/**
 * @returns {boolean}
 */
export function shouldShowSafariAddToHomeInstructions() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (!isAppleTouchDevice()) return false
  if (navigator.standalone === true) return false
  const ua = navigator.userAgent || ''
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/\d/.test(ua)) return false
  return true
}

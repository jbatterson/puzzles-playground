/**
 * Undo shortcut: Z alone, or Ctrl+Z (Windows/Linux) / Cmd+Z (Mac).
 * Shift is reserved for redo. Text fields keep the browser's own undo.
 */
export function isKeyboardUndo(e) {
  if (e.key !== 'z' && e.key !== 'Z') return false
  if (e.shiftKey || e.altKey) return false
  const el = e.target
  if (
    el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  ) {
    return false
  }
  return true
}

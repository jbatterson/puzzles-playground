export const MODAL_INTENTS = Object.freeze({
  INSTRUCTIONS: 'instructions',
  LINKS: 'links',
  STATS: 'stats',
  RESULTS: 'results',
  SETTINGS: 'settings',
  ADD_TO_HOME_SCREEN: 'addToHomeScreen',
})

export const MODAL_CLOSE_ARIA_LABELS = Object.freeze({
  [MODAL_INTENTS.INSTRUCTIONS]: 'Close instructions',
  [MODAL_INTENTS.LINKS]: 'Close links',
  [MODAL_INTENTS.STATS]: 'Close stats',
  [MODAL_INTENTS.RESULTS]: 'Close results',
  [MODAL_INTENTS.SETTINGS]: 'Close settings',
  [MODAL_INTENTS.ADD_TO_HOME_SCREEN]: 'Close add to home instructions',
  default: 'Close modal',
})

export function getModalCloseAriaLabel(intent) {
  return MODAL_CLOSE_ARIA_LABELS[intent] || MODAL_CLOSE_ARIA_LABELS.default
}

const MODAL_DIALOG_LABELS = Object.freeze({
  [MODAL_INTENTS.INSTRUCTIONS]: 'Instructions',
  [MODAL_INTENTS.LINKS]: 'Links',
  [MODAL_INTENTS.STATS]: 'Stats',
  [MODAL_INTENTS.RESULTS]: 'Results',
  [MODAL_INTENTS.SETTINGS]: 'Settings',
  [MODAL_INTENTS.ADD_TO_HOME_SCREEN]: 'Add to Home Screen',
  default: 'Dialog',
})

export function getModalDialogLabel(intent) {
  return MODAL_DIALOG_LABELS[intent] || MODAL_DIALOG_LABELS.default
}

export const GAME_KEYS = Object.freeze({
  SUMTILES: 'sumtiles',
  PRODUCTILES: 'productiles',
  ROLYPOLY: 'rolypoly',
  DUNGBEETLE: 'dungbeetle',
  SCUTTLEBUG: 'scuttlebug',
})

const GAME_CHROME = Object.freeze({
  [GAME_KEYS.SUMTILES]: { title: 'Sum Tiles', showStats: true },
  [GAME_KEYS.PRODUCTILES]: { title: 'Productiles', showStats: true },
  [GAME_KEYS.ROLYPOLY]: { title: 'Roly Poly', showStats: true },
  [GAME_KEYS.DUNGBEETLE]: { title: 'Dung Beetle', showStats: true },
  [GAME_KEYS.SCUTTLEBUG]: { title: 'Scuttlebug', showStats: true },
})

export function getGameChrome(gameKey) {
  return GAME_CHROME[gameKey] || { title: 'Puzzle', showStats: false }
}

const TILE_GAME_KEYS = new Set([
  GAME_KEYS.SUMTILES,
  GAME_KEYS.PRODUCTILES,
  GAME_KEYS.ROLYPOLY,
  GAME_KEYS.DUNGBEETLE,
  GAME_KEYS.SCUTTLEBUG,
])

/** True for games that track move counts in share text and on hub dice. */
export function isTileGameKey(gameKey) {
  return TILE_GAME_KEYS.has(gameKey)
}

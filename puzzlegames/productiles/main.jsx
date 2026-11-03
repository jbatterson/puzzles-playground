import { pruneStaleGameStateStorage } from '@shared-contracts/pruneGameStateStorage.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import GameErrorBoundary from '../../src/shared/GameErrorBoundary.jsx'
import Productiles from './productiles.jsx'

pruneStaleGameStateStorage()

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameErrorBoundary>
    <Productiles />
  </GameErrorBoundary>
)

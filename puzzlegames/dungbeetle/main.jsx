import React from 'react'
import ReactDOM from 'react-dom/client'
import GameErrorBoundary from '../../src/shared/GameErrorBoundary.jsx'
import DungBeetle from './dungbeetle.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameErrorBoundary>
    <DungBeetle />
  </GameErrorBoundary>
)

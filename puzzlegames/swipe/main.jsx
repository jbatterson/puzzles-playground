import React from 'react'
import ReactDOM from 'react-dom/client'
import GameErrorBoundary from '../../src/shared/GameErrorBoundary.jsx'
import Swipe from './swipe.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameErrorBoundary>
    <Swipe />
  </GameErrorBoundary>
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import { brandTokensCss } from './design-tokens.js'
import './index.css'

/* Runtime inject keeps CSS vars in lockstep with design-tokens.js */
const brandStyle = document.createElement('style')
brandStyle.setAttribute('data-brand-tokens', '')
brandStyle.textContent = brandTokensCss()
document.head.appendChild(brandStyle)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
)

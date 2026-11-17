import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../design-system/tokens.css'
import '../design-system/components/bundle.css'
import './styles/status-tokens.css'
import './styles/app.css'
import './styles/calendar.css'
import { App } from './App'
import { applyPreferences, PreferencesProvider, savedLocale, savedTheme } from './components/Preferences'

applyPreferences(savedLocale(), savedTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <App />
    </PreferencesProvider>
  </StrictMode>,
)

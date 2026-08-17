import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './index.css'
import './pwaUpdate.js'
import App from './App.jsx'
import { editorMediaPersistOptions, queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={editorMediaPersistOptions}>
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)

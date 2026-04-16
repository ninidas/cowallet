import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PushProvider } from './context/PushContext'
import './i18n/i18n'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PushProvider>
          <App />
        </PushProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

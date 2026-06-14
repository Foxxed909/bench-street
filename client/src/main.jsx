import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './store/auth.jsx'
import { PricesProvider } from './store/prices.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PricesProvider>
          <App />
        </PricesProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)

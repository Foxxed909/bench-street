import { Routes, Route, Navigate } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import TickerTape from './components/TickerTape.jsx'
import Floor from './pages/Floor.jsx'
import ModelDetail from './pages/ModelDetail.jsx'
import Portfolio from './pages/Portfolio.jsx'
import Predictions from './pages/Predictions.jsx'
import Arena from './pages/Arena.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Login from './pages/Login.jsx'
import { useAuth } from './store/auth.jsx'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <TickerTape />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Floor />} />
          <Route path="/m/:slug" element={<ModelDetail />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/arena" element={<Arena />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route
            path="/portfolio"
            element={
              <Protected>
                <Portfolio />
              </Protected>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="max-w-6xl mx-auto px-4 py-8 text-xs text-slate-600 border-t border-edge/50 mt-6">
        Bench Street · play-money AI model exchange · prices are set by the community — every model
        starts at $0 and moves on your votes. Not investment advice.
      </footer>
    </div>
  )
}

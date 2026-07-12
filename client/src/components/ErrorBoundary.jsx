import React from 'react'

// Keep a single render exception from turning the entire SPA into an unexplained
// blank screen. React still requires class boundaries for render-time errors.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ui] uncaught render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6 py-16">
        <div className="card w-full p-6 text-center">
          <div className="font-display text-2xl font-bold text-white">Bench Street hit a UI error</div>
          <p className="mt-2 text-sm text-slate-400">
            Your account and positions are stored on the server. Reload the app to reconnect.
          </p>
          <button className="btn-primary mt-5" onClick={() => window.location.reload()}>
            Reload Bench Street
          </button>
        </div>
      </main>
    )
  }
}

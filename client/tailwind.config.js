/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Premium terminal palette — deep near-black canvas, gold + green identity.
        ink: '#07080c',
        panel: '#0c1018',
        panel2: '#131925',
        edge: '#1f2736',
        up: '#27d18b',
        down: '#fb5a6a',
        accent: '#f0c04e',
        gold: '#f0c04e'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
      },
      letterSpacing: {
        tightest: '-0.03em'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(240,192,78,0.25), 0 10px 40px -12px rgba(240,192,78,0.28)',
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -34px rgba(0,0,0,0.9)'
      }
    }
  },
  plugins: []
}

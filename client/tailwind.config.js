/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Premium terminal palette — deep indigo canvas (not void-black), gold + green
        // identity. Surfaces lift toward a warmer blue-violet so cards feel raised.
        ink: '#0a0b16',
        panel: '#13152a',
        panel2: '#1d2142',
        edge: '#2b3055',
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
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -34px rgba(0,0,0,0.9)',
        // Skeuomorphic raised surface: bright top edge + ambient + contact shadow.
        raise:
          'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 0 1px rgba(255,255,255,0.025), 0 1px 1px rgba(0,0,0,0.4), 0 12px 28px -14px rgba(0,0,0,0.85)',
        sunken: 'inset 0 2px 6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)'
      },
      backgroundImage: {
        'panel-raise': 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012) 38%, rgba(0,0,0,0.12))'
      }
    }
  },
  plugins: []
}

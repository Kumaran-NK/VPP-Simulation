/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Surfaces (almost-black, layered) ──────────────
        void: '#05070B',
        panel: {
          DEFAULT: '#0A0E15',
          raised: '#0E131C',
          inset: '#070A11',
          hover: '#111825',
        },
        // ── Hairlines ─────────────────────────────────────
        line: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          strong: 'rgba(255,255,255,0.11)',
          faint: 'rgba(255,255,255,0.035)',
        },
        // ── Text ──────────────────────────────────────────
        ink: {
          DEFAULT: '#E6EAF0',
          dim: '#8A93A3',
          mute: '#5A6373',
          faint: '#3B4250',
        },
        // ── Restrained accents ────────────────────────────
        energy: {
          cyan: '#22D3EE',
          green: '#34D399',
        },
        solar: '#F5C451',
        warn: '#F5A623',
        fault: '#FF5C6C',
        agent: '#8B7CF6',
        // ── Legacy (kept so retired components don't break) ─
        navy: { 950: '#030712', 900: '#06111F', 800: '#081525', 700: '#0C1E33', 600: '#122A42' },
        'vpp-cyan': { DEFAULT: '#22D3EE', 50: '#ECFEFF', 400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2' },
        'vpp-emerald': { DEFAULT: '#34D399', 400: '#34D399', 500: '#10B981' },
        'vpp-violet': { DEFAULT: '#8B5CF6', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED' },
        'vpp-amber': { DEFAULT: '#FBBF24', 400: '#FBBF24', 500: '#F59E0B' },
        'vpp-red': { DEFAULT: '#F87171', 400: '#F87171', 500: '#EF4444' },
        'vpp-gold': { DEFAULT: '#FCD34D', 400: '#FCD34D' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }], // 11px
      },
      letterSpacing: {
        widest2: '0.22em',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -4px rgba(34,211,238,0.35)',
        'glow-green': '0 0 20px -4px rgba(52,211,153,0.35)',
        'glow-warn': '0 0 20px -4px rgba(245,166,35,0.4)',
        'glow-fault': '0 0 22px -4px rgba(255,92,108,0.45)',
        'panel': '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -24px rgba(0,0,0,0.9)',
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.35s ease-out',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'spin-slow': 'spin 10s linear infinite',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
    },
  },
  plugins: [],
};

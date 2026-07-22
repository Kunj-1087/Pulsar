import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Typography Scale ──
      fontSize: {
        'micro':     ['11px', { lineHeight: '14px', letterSpacing: '0.1em' }],
        'caption':   ['12px', { lineHeight: '16px', letterSpacing: '0' }],
        'small':     ['14px', { lineHeight: '20px', letterSpacing: '0' }],
        'body':      ['16px', { lineHeight: '24px', letterSpacing: '0' }],
        'lead':      ['18px', { lineHeight: '28px', letterSpacing: '0' }],
        'h4':        ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        'h3':        ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        'h2':        ['32px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
        'h1':        ['44px', { lineHeight: '52px', letterSpacing: '-0.02em' }],
        'display':   ['64px', { lineHeight: '68px', letterSpacing: '-0.04em' }],
        'mega':      ['96px', { lineHeight: '96px', letterSpacing: '-0.04em' }],
      },

      // ── Letter Spacing (Tracking) ──
      letterSpacing: {
        'hero':   '-0.04em',
        'tight':  '-0.02em',
        'normal': '0em',
        'wide':   '0.05em',
        'wider':  '0.1em',
        'widest': '0.2em',
      },

      // ── Color Tokens (Deep Field Palette) ──
      colors: {
        void: "#000000",
        surface: {
          DEFAULT: "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          hover:    "var(--bg-hover)",
          active:   "var(--bg-active)",
        },
        bg: {
          base:     "var(--bg-base)",
          surface:  "var(--bg-surface)",
          elevated: "var(--bg-elevated)",
          hover:    "var(--bg-hover)",
          active:   "var(--bg-active)",
        },
        fg: {
          primary:   "var(--fg-primary)",
          secondary: "var(--fg-secondary)",
          muted:     "var(--fg-muted)",
          subtle:    "var(--fg-subtle)",
          disabled:  "var(--fg-disabled)",
        },
        border: {
          subtle:  "var(--border-subtle)",
          dim:     "var(--border-dim)",
          DEFAULT: "var(--border-default)",
          strong:  "var(--border-strong)",
          focus:   "var(--border-focus)",
        },
        // Core Deep Field Astrophysics Accents
        pulsar: {
          DEFAULT: "var(--accent-pulsar)",
          hover:   "var(--accent-pulsar-hover)",
          dim:     "var(--accent-pulsar-dim)",
        },
        nebula: {
          DEFAULT: "var(--accent-nebula)",
          hover:   "var(--accent-nebula-hover)",
          dim:     "var(--accent-nebula-dim)",
        },
        accretion: {
          DEFAULT: "var(--accent-accretion)",
          hover:   "var(--accent-accretion-hover)",
          dim:     "var(--accent-accretion-dim)",
        },
        redshift: {
          DEFAULT: "var(--accent-redshift)",
          hover:   "var(--accent-redshift-hover)",
          dim:     "var(--accent-redshift-dim)",
        },
        quasar: {
          DEFAULT: "var(--accent-quasar)",
          hover:   "var(--accent-quasar-hover)",
          dim:     "var(--accent-quasar-dim)",
        },
        // Legacy compat aliases
        photon: {
          DEFAULT: "var(--accent-pulsar)",
          hover:   "var(--accent-pulsar-hover)",
          dim:     "var(--accent-pulsar-dim)",
        },
        quantum: {
          DEFAULT: "var(--accent-quasar)",
          hover:   "var(--accent-quasar-hover)",
          dim:     "var(--accent-quasar-dim)",
        },
        flux: {
          DEFAULT: "var(--accent-pulsar)",
          hover:   "var(--accent-pulsar-hover)",
        },
        pulse: {
          DEFAULT: "var(--accent-accretion)",
          hover:   "var(--accent-accretion-hover)",
        },
        decay: {
          DEFAULT: "var(--accent-redshift)",
          hover:   "var(--accent-redshift-hover)",
        },
      },

      // ── Font Families ──
      fontFamily: {
        sans:  ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },

      // ── Spacing Scale ──
      spacing: {
        '4.5': '18px',
        '13': '52px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
        '26': '104px',
        '30': '120px',
      },

      // ── Border Radius ──
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        'full': '9999px',
      },

      // ── Keyframes ──
      keyframes: {
        'quark-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'quark-slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'quark-slide-down': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'quark-glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'quark-cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },

      // ── Animation ──
      animation: {
        'fade-in': 'quark-fade-in 200ms var(--ease-decelerate, cubic-bezier(0,0,0.2,1)) forwards',
        'slide-up': 'quark-slide-up 200ms var(--ease-decelerate, cubic-bezier(0,0,0.2,1)) forwards',
        'slide-down': 'quark-slide-down 200ms var(--ease-decelerate, cubic-bezier(0,0,0.2,1)) forwards',
        'glow-pulse': 'quark-glow-pulse 600ms ease-in-out',
        'cursor-blink': 'quark-cursor-blink 1s steps(2, start) infinite',
      },

      // ── Transition Timing ──
      transitionTimingFunction: {
        'standard':   'cubic-bezier(0.4, 0, 0.2, 1)',
        'decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
        'accelerate': 'cubic-bezier(0.4, 0, 1, 1)',
        'precise':    'cubic-bezier(0.4, 0, 0.6, 1)',
      },
    },
  },
  plugins: [],
};
export default config;

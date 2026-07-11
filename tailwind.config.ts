import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-surface': 'var(--bg-surface)',
        'bg-elevated': 'var(--bg-elevated)',
        'border-default': 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-bright': 'var(--text-bright)',
        'text-muted': 'var(--text-muted)',
        'sent': 'var(--sent-bubble)',
        'received': 'var(--received-bubble)',
        'status-green': 'var(--status-green)',
        'status-red': 'var(--status-red)',
        'status-yellow': 'var(--status-yellow)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
        code: ['var(--font-jetbrains-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;

// Colours come from CSS variables (see src/style.css) so light/dark is one switch.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Nunito', 'system-ui', 'sans-serif'] },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        highlight: 'var(--highlight)',
        'on-primary': 'var(--on-primary)',
      },
      borderRadius: {
        md: 'calc(0.375rem * var(--r))', lg: 'calc(0.5rem * var(--r))', xl: 'calc(0.75rem * var(--r))',
        '2xl': 'calc(1rem * var(--r))', '3xl': 'calc(1.5rem * var(--r))',
      },
      boxShadow: { card: '0 1px 2px rgb(60 70 40 / 0.08), 0 3px 8px rgb(60 70 40 / 0.07)' },
    },
  },
}

/** Tailwind build for mvhlsp.site.
 *
 * This config reproduces the theme that was previously supplied at runtime by
 * the Tailwind Play CDN (`<script src="https://cdn.tailwindcss.com">` plus an
 * inline `tailwind.config = {...}` block on each page). Keeping the exact same
 * palette/fonts/shadows guarantees the compiled CSS renders identically while
 * letting the Worker serve a strict CSP with no 'unsafe-inline'/'unsafe-eval'.
 */
module.exports = {
  content: ['./public/**/*.html', './public/assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        slate: { 50: '#FAFAF9', 100: '#F3F3F1', 200: '#E5E5E2', 300: '#D2D2CE', 400: '#7C7C75', 500: '#6A6A63', 600: '#585852', 700: '#46463F', 800: '#363630', 900: '#2A2A26' },
        ink: { DEFAULT: '#2A2A26', soft: '#5E5E58' },
        brand: {
          50: '#EEF6F9', 100: '#D9ECF3', 200: '#C4DEE9',
          600: '#115C7B', 700: '#0C4659', 800: '#0B394C',
        },
        line: '#E5E5E2',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -16px rgba(15,23,42,0.18)',
        lift: '0 2px 6px rgba(16,92,124,0.18), 0 16px 32px -18px rgba(16,92,124,0.55)',
      },
    },
  },
  plugins: [],
};

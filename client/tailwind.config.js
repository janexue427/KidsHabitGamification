export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      screens: {
        // A real mouse — i.e. not a phone or tablet in any orientation.
        fine: { raw: '(hover: hover) and (pointer: fine)' },
      },
      colors: {
        kid: {
          purple: '#7c3aed',
          pink: '#ec4899',
          yellow: '#facc15',
          teal: '#14b8a6',
          orange: '#fb923c',
        },
      },
      fontFamily: {
        fun: ['"Baloo 2"', '"Comic Sans MS"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

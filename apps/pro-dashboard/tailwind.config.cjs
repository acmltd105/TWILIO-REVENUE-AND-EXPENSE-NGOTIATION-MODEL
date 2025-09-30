const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        midnight: '#061328',
        ocean: '#0f1f44',
        wave: '#09b3fb',
        foam: '#3af7b8',
        sage: '#f2f7f4',
        ink: '#0d203a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 18px 60px rgba(6, 25, 65, 0.28)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        pulseSlow: 'pulseSlow 10s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(-2px) translateX(0)' },
          '50%': { transform: 'translateY(4px) translateX(2px)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: 0.4 },
          '50%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};

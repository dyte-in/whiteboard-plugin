/** @type import('tailwindcss').Config} */
module.exports = {
  content: ['index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'open-sans': ['Open Sans', 'sans-serif']
      },
      colors: {
        bg: {
          400: '#d7d8d9',
        },
        fade: {
          100: 'rgba(242,249,255,0.6)',
          200: 'rgba(242,249,255, 1)',
        },
      }
    },
  },
  plugins: [],
}


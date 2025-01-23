/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'pangram': ['Pangram Sans Rounded', 'sans-serif']
      }
    }
  },
  plugins: [],
}
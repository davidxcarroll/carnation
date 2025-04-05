/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'pressura': ['GT Pressura Extended', 'monospace'],
        'pressura-ext': ['GT Pressura Extended', 'monospace'],
        'pressura-std': ['GT Pressura Standard', 'monospace']
      },
      fontFeatureSettings: {
        'ss01': '"ss01" 1',
        'ss02': '"ss02" 1',
        'ss03': '"ss03" 1',
        'ss04': '"ss04" 1',
        'ss-all': '"ss01" 1, "ss02" 1, "ss03" 1, "ss04" 1',
      }
    }
  },
  plugins: [],
}
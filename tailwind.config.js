/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Palette officielle Bureau Yves Péchard (pechard.be)
        'pechard': {
          blue:    '#016CB8', // --clr-secondary : bleu logo & accents
          'blue-dark': '#0158A0', // hover
          'blue-light': '#1A8FE3', // clair
          charcoal: '#1A1A19', // --clr-primary : fond sombre, texte
          'charcoal-soft': '#2A2A29', // variante hover
        },
      },
    },
  },
  plugins: [],
}

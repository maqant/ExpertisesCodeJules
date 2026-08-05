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
          blue:          '#016CB8', // --clr-secondary : bleu logo & accents
          'blue-dark':   '#0158A0', // hover
          'blue-light':  '#1A8FE3', // clair
          'blue-pale':   '#EAF4FB', // fond badges / subtil
          charcoal:      '#1A1A19', // --clr-primary : fond sombre, texte
          'charcoal-soft': '#2A2A29', // variante hover
          'gray-bg':     '#F8F9FA', // fond clair
          'gray-border': '#E2E8F0', // séparateurs
          'gray-text':   '#1E293B', // texte principal
        },
      },
      boxShadow: {
        'pechard': '0 2px 8px rgba(1, 108, 184, 0.25)',
      }
    },
  },
  plugins: [],
}

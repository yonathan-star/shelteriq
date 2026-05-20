/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          primary: "#1A7A4A",
          dark: "#0F5233",
          light: "#E8F5EE",
          mid: "#2D9E63",
          accent: "#5ECFA0"
        }
      },
      fontFamily: {
        body: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"]
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px"
      }
    },
  },
  plugins: [],
}

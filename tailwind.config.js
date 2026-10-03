/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef3f2",
          100: "#fde8e6",
          200: "#fbd5d0",
          300: "#f8b4a9",
          400: "#f38a78",
          500: "#ea5e4d",
          600: "#d63828",
          700: "#b4241e",
          800: "#98241c",
          900: "#7f271d",
        },
      },
    },
  },
  plugins: [],
}

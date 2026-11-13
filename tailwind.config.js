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
        gold: { 50: "#fffbea", 100: "#fff3c4", 300: "#f4d77c", 500: "#c99a2e", 700: "#8a6418" },
        primary: {
          50: "#fff3f4",
          100: "#ffe6eb",
          200: "#f6c8d4",
          300: "#ec9cae",
          400: "#d86682",
          500: "#a22037",
          600: "#82172a",
          700: "#6b1426",
          800: "#541322",
          900: "#471320",
        },
      },
    },
  },
  plugins: [],
}

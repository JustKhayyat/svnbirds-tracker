/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bebas: ["'Bebas Neue'", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      colors: {
        yellow: {
          400: "#FFD95C",
          500: "#FFC700",
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1DB954", // Spotify green for the music vibe
        dark: "#121212",    // Dark background
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        heading: ["Bebas Neue", "cursive"],
      },
    },
  },
  plugins: [],
};

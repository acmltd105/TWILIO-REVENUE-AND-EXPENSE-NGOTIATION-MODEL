/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        glass: {
          light: "rgba(255, 255, 255, 0.7)",
          dark: "rgba(15, 23, 42, 0.6)"
        }
      },
      backdropBlur: {
        xs: "2px"
      },
      boxShadow: {
        glass: "0 10px 60px rgba(15, 23, 42, 0.25)"
      }
    }
  },
  plugins: []
};

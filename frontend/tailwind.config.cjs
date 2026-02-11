const forms = require("@tailwindcss/forms");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{vue,ts,js}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f4ef",
        ink: "#1f2a30",
        mist: "#e4ece8",
        brand: "#1f7a69",
        "brand-strong": "#185a4f",
        danger: "#b42318",
        warning: "#b54708",
      },
      borderRadius: {
        shell: "1.25rem",
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "sans-serif"],
        heading: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        panel: "0 20px 55px rgba(24, 42, 40, 0.14)",
      },
    },
  },
  plugins: [forms],
};

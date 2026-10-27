/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Every text/background pair is verified by tests/colorContrast.test.js.
      colors: {
        ground: "#F4F2F8",
        surface: "#FFFFFF",
        line: "#DDD8E8",
        edge: "#8E86A0", // input borders (>= 3:1 against white)
        ink: { DEFAULT: "#1B1626", soft: "#5A5368" },
        plum: { DEFAULT: "#2B1B45", dark: "#1E1230", mid: "#4A3170" },
        marigold: { DEFAULT: "#F2A71B", light: "#F7BE4D" },
        "on-dark": "#E3D9F2",
        ok: { DEFAULT: "#1F5A33", bg: "#E6F3EA" },
        warn: { DEFAULT: "#7A4A00", bg: "#FCEFD2" },
        bad: { DEFAULT: "#8A2418", bg: "#FBE7E3" },
        info: { DEFAULT: "#2B1B45", bg: "#EEE8F7" },
      },
      fontFamily: {
        sans: ["-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      maxWidth: { prose: "42rem", page: "64rem" },
    },
  },
  plugins: [],
};

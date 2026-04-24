/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef8ff",
          100: "#d8eeff",
          200: "#b9e1ff",
          300: "#89cfff",
          400: "#52b5ff",
          500: "#2896ff",
          600: "#1175f5",
          700: "#125edb",
          800: "#164bae",
          900: "#183f89"
        }
      },
      boxShadow: {
        panel: "0 20px 45px rgba(15, 23, 42, 0.16)"
      }
    },
  },
  plugins: [],
};


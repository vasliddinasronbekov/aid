const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        clinical: {
          ink: "#172033",
          slate: "#536174",
          blue: "#2f6fdb",
          cyan: "#0e9fb7",
          red: "#d33f49",
          amber: "#b7791f",
          green: "#24845f",
          line: "#d9e2ec",
          wash: "#f6f9fc",
        },
      },
      boxShadow: {
        clinical: "0 16px 38px rgba(23, 32, 51, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

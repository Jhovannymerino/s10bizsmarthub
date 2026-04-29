/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0D3B5E',
        orange: '#E25C1A',
        'green-kpi': '#1E8449',
        'red-kpi': '#C0392B',
      },
    },
  },
  plugins: [],
};

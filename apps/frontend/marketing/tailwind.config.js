/** @type {import('tailwindcss').Config} */
export default {
  presets: [require("@smo/ui/tailwind.config")],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../../packages/ui/components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        'soft-in': 'inset 2px 2px 6px rgba(0, 0, 0, 0.05), inset -2px -2px 6px rgba(255, 255, 255, 0.5)',
        'soft-in-dark': 'inset 2px 2px 6px rgba(0, 0, 0, 0.3), inset -2px -2px 6px rgba(255, 255, 255, 0.05)',
      },
    }
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  presets: [require("@smo/ui/tailwind.config")],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../../packages/ui/components/**/*.{js,jsx}"
  ]
}

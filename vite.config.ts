import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { name } from "./package.json";

// https://vite.dev/config/
export default defineConfig({
  base: `/${name}`,
  plugins: [tailwindcss(), react()],
  optimizeDeps: { exclude: ["fsevents"] },
});

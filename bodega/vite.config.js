import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" → el build sirve desde cualquier ruta (subcarpeta o estático simple)
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5180 },
});

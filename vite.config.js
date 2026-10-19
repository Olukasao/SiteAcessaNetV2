import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Acesso pela rede (ex.: 192.168.x.x:4181): a API é chamada por caminho
    // relativo, então o dev server repassa para o backend local.
    proxy: {
      "/api": "http://localhost:9531",
      "/admin/api": "http://localhost:9531",
    },
  },
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        // three.js em chunk próprio: só baixa quando o hero decide renderizar o globo 3D.
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/gsap")) return "gsap";
        },
      },
    },
  },
});

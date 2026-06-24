import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Configuración estándar de TanStack Start (sin Lovable).
// El plugin netlify() arma el build (servidor SSR) compatible con Netlify.
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Usa nuestro envoltorio de servidor en src/server.ts (manejo de errores SSR).
      server: { entry: "server" },
    }),
    netlify(),
    viteReact(),
  ],
});

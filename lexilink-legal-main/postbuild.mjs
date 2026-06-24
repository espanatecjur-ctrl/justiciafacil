// Deja el build listo como sitio estático (SPA) para Netlify:
// - copia el shell a index.html
// - crea _redirects para que todas las rutas carguen la app
import { copyFileSync, writeFileSync } from "node:fs";

const dir = "dist/client";
copyFileSync(`${dir}/_shell.html`, `${dir}/index.html`);
writeFileSync(`${dir}/_redirects`, "/*  /index.html  200\n");
console.log("✅ postbuild: index.html y _redirects creados en dist/client");

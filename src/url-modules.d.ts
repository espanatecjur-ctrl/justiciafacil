// Módulos que se importan por URL en tiempo de ejecución (esm.sh).
// TypeScript no puede "resolverlos" porque no son paquetes de npm, así que
// aquí solo le decimos que existen y los trata como `any`. No cambia nada
// en ejecución: jspdf se sigue cargando igual desde esm.sh.
declare module "https://esm.sh/jspdf@2.5.1";

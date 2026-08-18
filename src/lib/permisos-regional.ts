// JusticiaFácil · Alcance regional del rol ABG_MZT (Abogada Regional Mazatlán)
//
// Regla de negocio:
// - Solo ve/trabaja asuntos cuya GARANTÍA esté en Mazatlán o Culiacán (sin importar
//   si el registro administrativo dice CDMX u otra entidad — lo que importa es dónde
//   está la garantía físicamente, vía ciudad-judicial.ts).
// - En Mazatlán: acceso completo, con seguimiento (puede hacer todo, incluyendo
//   cerrar/concluir el asunto).
// - En Culiacán: solo "ayudante" — puede editar y subir documentos, pero NO puede
//   marcar el asunto como concluido/cerrado/archivado.
//
// Otros roles no tienen ninguna restricción de este tipo — esta lógica es exclusiva
// del rol ABG_MZT.

import type { UbicacionJudicial } from "@/lib/ciudad-judicial";

export const ROL_REGIONAL_MZT = "ABG_MZT";
const CIUDADES_PLENAS = ["Mazatlán"]; // acceso completo, incluye cerrar/concluir
const CIUDADES_AYUDANTE = ["Culiacán"]; // puede editar/subir, no puede cerrar

export function esRolRegionalMazatlan(rol: string | null): boolean {
  return rol === ROL_REGIONAL_MZT;
}

/** ¿Puede ver/trabajar este asunto? (para el rol regional, solo Mazatlán o Culiacán). */
export function permiteVerAsunto(rol: string | null, ubicacion: UbicacionJudicial | null): boolean {
  if (!esRolRegionalMazatlan(rol)) return true; // sin restricción para el resto de roles
  const ciudad = ubicacion?.ciudad;
  if (!ciudad) return false; // sin ubicación detectada: no se le muestra (evita fugas de otras plazas)
  return CIUDADES_PLENAS.includes(ciudad) || CIUDADES_AYUDANTE.includes(ciudad);
}

/** ¿Es "solo ayudante" en este asunto? (Culiacán, para el rol regional). */
export function esSoloAyudante(rol: string | null, ubicacion: UbicacionJudicial | null): boolean {
  if (!esRolRegionalMazatlan(rol)) return false;
  return CIUDADES_AYUDANTE.includes(ubicacion?.ciudad || "");
}

/** ¿Puede cerrar/concluir/archivar este asunto? (ayudante en Culiacán: no). */
export function puedeConcluirAsunto(rol: string | null, ubicacion: UbicacionJudicial | null): boolean {
  return !esSoloAyudante(rol, ubicacion);
}

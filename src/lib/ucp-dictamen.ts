// ============================================================
// UCP · Lógica de dictaminación (Unidad de Consolidación Patrimonial)
// ------------------------------------------------------------
// Vive APARTE de URRJ, pero REÚSA sus motores de cálculo
// (prescripción, caducidad, usucapión, viabilidad). Aquí solo
// se arma el dictamen jurídico de los 10 HITOS del manual UCP:
//   - 4 hitos los calcula el motor (reusados de URRJ)
//   - 6 hitos son de criterio del abogado (semáforo + nota)
// y se obtiene el veredicto del bloque jurídico.
// ============================================================
import {
  motorPrescripcion, type EntradaPrescripcion,
  motorCaducidad, type EntradaCaducidad,
  motorUsucapion, type EntradaUsucapion,
  viabilidad,
  type Semaforo, type ResultadoMotor,
} from "@/lib/urrj-motores";

export type { Semaforo, ResultadoMotor } from "@/lib/urrj-motores";

// ---------- Los 10 hitos ----------
export type ClaveHito =
  | "posicion_procesal" | "prescripcion" | "caducidad" | "usucapion"
  | "jurisdiccion_voluntaria" | "litispendencia" | "cosa_juzgada"
  | "legitimacion" | "competencia_territorial" | "viabilidad_economica";

export type TipoHito = "motor" | "criterio";

export interface DefHito {
  clave: ClaveHito;
  num: number;
  label: string;
  tipo: TipoHito;       // "motor" = lo calcula el sistema; "criterio" = lo decide el abogado
  ayuda: string;        // qué determina el hito (del manual UCP)
}

export const HITOS_UCP: DefHito[] = [
  { clave: "posicion_procesal",       num: 1,  label: "Posición procesal",       tipo: "criterio", ayuda: "Etapa del juicio, carga procesal y siguiente paso." },
  { clave: "prescripcion",            num: 2,  label: "Prescripción",            tipo: "motor",    ayuda: "Si el derecho sigue vivo y cómo interrumpirlo." },
  { clave: "caducidad",               num: 3,  label: "Caducidad",               tipo: "motor",    ayuda: "Días desde la última promoción válida (120/180)." },
  { clave: "usucapion",               num: 4,  label: "Usucapión",               tipo: "motor",    ayuda: "Posesión apta para usucapir (5/10 años)." },
  { clave: "jurisdiccion_voluntaria", num: 5,  label: "Jurisdicción voluntaria", tipo: "criterio", ayuda: "Reactivación de casos con 5+ años sin avance." },
  { clave: "litispendencia",          num: 6,  label: "Litispendencia",          tipo: "criterio", ayuda: "Otro juicio paralelo sobre el mismo inmueble/partes." },
  { clave: "cosa_juzgada",            num: 7,  label: "Cosa juzgada",            tipo: "criterio", ayuda: "Sentencia firme previa entre las mismas partes." },
  { clave: "legitimacion",            num: 8,  label: "Legitimación",            tipo: "criterio", ayuda: "Si DIIPA puede demandar (cesión formalizada) y a quién." },
  { clave: "competencia_territorial", num: 9,  label: "Competencia territorial", tipo: "criterio", ayuda: "Juzgado correcto según el tipo de acción." },
  { clave: "viabilidad_economica",    num: 10, label: "Viabilidad económica",    tipo: "motor",    ayuda: "Costo-beneficio: >30% reconsiderar, >50% no procede." },
];

// claves de los 4 hitos que calcula el motor
export type ClaveMotor = "prescripcion" | "caducidad" | "usucapion" | "viabilidad_economica";

// ---------- Estado guardado de cada hito ----------
export interface EstadoHito {
  semaforo: Semaforo;     // verde | amarillo | naranja | rojo | gris
  etiqueta?: string;      // "Vigente", "Prescrita", etc. (del motor) o libre
  dato?: string;          // número clave del motor (ej. "6.2 de 10 años")
  detalle?: string;       // explicación en lenguaje sencillo
  nota?: string;          // justificación que escribe el abogado (sobre todo en los de criterio)
}

export type HitosJuridico = Partial<Record<ClaveHito, EstadoHito>>;

export interface DictamenJuridico {
  hitos: HitosJuridico;
  veredicto: VeredictoTxt;
  actualizado?: string;   // ISO de la última edición
}

// ---------- Entradas y cálculo de los 4 motores ----------
export interface EntradaViabilidadUCP {
  valorComercial: number;
  adeudo: number;
  costos: number;
  precioCesion: number;
  margenObjetivo: number;
}

export interface EntradaMotoresUCP {
  prescripcion: EntradaPrescripcion;
  caducidad: EntradaCaducidad;
  usucapion: EntradaUsucapion;
  viabilidad: EntradaViabilidadUCP;
}

/** Corre los 4 motores reusados de URRJ y devuelve su resultado por clave de hito. */
export function calcularMotores(e: EntradaMotoresUCP): Record<ClaveMotor, ResultadoMotor> {
  return {
    prescripcion: motorPrescripcion(e.prescripcion),
    caducidad: motorCaducidad(e.caducidad),
    usucapion: motorUsucapion(e.usucapion),
    viabilidad_economica: viabilidad(
      e.viabilidad.valorComercial,
      e.viabilidad.adeudo,
      e.viabilidad.costos,
      e.viabilidad.precioCesion,
      e.viabilidad.margenObjetivo,
    ),
  };
}

/** Convierte un ResultadoMotor en EstadoHito para guardar. */
export function resultadoAHito(r: ResultadoMotor, nota?: string): EstadoHito {
  return { semaforo: r.semaforo, etiqueta: r.etiqueta, dato: r.dato, detalle: r.detalle, nota };
}

// ---------- Veredicto del bloque jurídico ----------
export type VeredictoTxt = "POSITIVO" | "CONDICIONADO" | "NEGATIVO" | "FALTAN DATOS" | "PENDIENTE";

export interface Veredicto {
  txt: VeredictoTxt;
  color: string;  // clases para el badge
}

const COLOR: Record<VeredictoTxt, string> = {
  POSITIVO:       "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONDICIONADO:   "bg-amber-50 text-amber-800 border-amber-200",
  NEGATIVO:       "bg-red-50 text-red-800 border-red-200",
  "FALTAN DATOS": "bg-muted text-muted-foreground border-border",
  PENDIENTE:      "bg-muted text-muted-foreground border-border",
};

/**
 * Regla del manual: con los 10 hitos evaluados se decide el veredicto.
 *   algún rojo            -> NEGATIVO
 *   algún gris (falta)    -> FALTAN DATOS
 *   amarillo / naranja    -> CONDICIONADO
 *   todo verde            -> POSITIVO
 *   falta evaluar alguno  -> PENDIENTE (candado: no se puede cerrar)
 */
export function veredictoJuridico(hitos: HitosJuridico): Veredicto {
  const sems = HITOS_UCP.map((h) => hitos[h.clave]?.semaforo);
  if (sems.some((s) => !s)) return { txt: "PENDIENTE", color: COLOR.PENDIENTE };
  if (sems.includes("rojo")) return { txt: "NEGATIVO", color: COLOR.NEGATIVO };
  if (sems.includes("gris")) return { txt: "FALTAN DATOS", color: COLOR["FALTAN DATOS"] };
  if (sems.includes("naranja") || sems.includes("amarillo")) return { txt: "CONDICIONADO", color: COLOR.CONDICIONADO };
  return { txt: "POSITIVO", color: COLOR.POSITIVO };
}

/** Candado Regla 1: el dictamen jurídico solo se puede cerrar con los 10 hitos evaluados (ninguno gris/sin evaluar). */
export function juridicoCompleto(hitos: HitosJuridico): boolean {
  return HITOS_UCP.every((h) => {
    const s = hitos[h.clave]?.semaforo;
    return !!s && s !== "gris";
  });
}

/** Cuántos hitos van evaluados (no gris/no vacío), para mostrar progreso X/10. */
export function hitosEvaluados(hitos: HitosJuridico): number {
  return HITOS_UCP.filter((h) => {
    const s = hitos[h.clave]?.semaforo;
    return !!s && s !== "gris";
  }).length;
}

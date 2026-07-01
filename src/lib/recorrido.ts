// ============================================================
// JusticiaFácil · Recorrido del expediente por áreas (Línea de Vida)
// ------------------------------------------------------------
// Cada área tiene DOS dictámenes: registral y jurídico.
// Cada uno: 'positivo' | 'negativo' | 'espera' | null(gris).
// El COLOR de la bolita se calcula con ambos (los dos deben ser
// positivos para que quede VERDE).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// Orden de la línea de vida. SVT por ahora va "gris" (aún no se usa).
export const AREAS_LINEA = ["URRJ", "SVT", "UCP", "UFC", "UCM"] as const;
export type AreaLinea = (typeof AREAS_LINEA)[number];

export type Dictamen = "positivo" | "negativo" | "espera" | null;
export type ColorArea = "verde" | "rojo" | "naranja" | "gris";

export interface PasoRecorrido {
  id?: string;
  caso_id: string | null;
  expediente: string | null;
  area: string;
  dic_registral: Dictamen;
  dic_juridico: Dictamen;
  nota: string | null;
  marcado_por: string | null;
  updated_at?: string;
}

// Colores y etiquetas por color final.
export const COLOR: Record<ColorArea, { color: string; bg: string; texto: string }> = {
  verde:   { color: "#0C5C46", bg: "#0C5C4615", texto: "Positivo" },
  rojo:    { color: "#A32D2D", bg: "#A32D2D15", texto: "Negativo" },
  naranja: { color: "#B26B00", bg: "#B26B0015", texto: "En espera" },
  gris:    { color: "#8A8F98", bg: "#8A8F9812", texto: "Sin dictamen" },
};

// Regla del color: los DOS deben ser positivos para verde.
export function colorDeArea(p?: PasoRecorrido): ColorArea {
  if (!p || (!p.dic_registral && !p.dic_juridico)) return "gris";
  const r = p.dic_registral, j = p.dic_juridico;
  if (r === "negativo" || j === "negativo") return "rojo";
  if (r === "positivo" && j === "positivo") return "verde";
  if (r === "espera" || j === "espera" || r === "positivo" || j === "positivo") return "naranja";
  return "gris";
}

// Etiqueta corta de un dictamen suelto.
export function textoDictamen(d: Dictamen): string {
  if (d === "positivo") return "Positivo";
  if (d === "negativo") return "Negativo";
  if (d === "espera") return "En espera";
  return "Sin marcar";
}

// Trae los pasos registrados de un caso (por área).
export async function obtenerRecorrido(caso: CasoJuridico): Promise<Record<string, PasoRecorrido>> {
  const filtro = caso.id ? `caso_id=eq.${caso.id}` : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
  const mapa: Record<string, PasoRecorrido> = {};
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/recorrido_area?select=*&${filtro}`, { headers });
    if (r.ok) {
      const filas: PasoRecorrido[] = await r.json();
      for (const f of filas) mapa[f.area] = f;
    }
  } catch { /* silencioso */ }
  return mapa;
}

// Marca (o actualiza) los dictámenes de un área. Se pasan los dos (registral y jurídico).
export async function marcarArea(caso: CasoJuridico, area: string, dicRegistral: Dictamen, dicJuridico: Dictamen, nota: string | null, quien: string | null): Promise<boolean> {
  const cuerpo = {
    caso_id: caso.id || null,
    expediente: caso.expediente || null,
    area,
    dic_registral: dicRegistral,
    dic_juridico: dicJuridico,
    nota,
    marcado_por: quien,
    updated_at: new Date().toISOString(),
  };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/recorrido_area?on_conflict=caso_id,area`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(cuerpo),
    });
    return r.ok;
  } catch {
    return false;
  }
}

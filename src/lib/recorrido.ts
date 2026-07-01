// ============================================================
// JusticiaFácil · Recorrido del expediente por áreas (Línea de Vida)
// ------------------------------------------------------------
// Cada área tiene un estado marcado por decisión humana:
//   'positivo' (verde) · 'negativo' (rojo) · 'espera' (naranja)
//   sin registro = gris (no aplica todavía)
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// El orden de la línea de vida. SVT por ahora va "gris" (aún no se usa).
export const AREAS_LINEA = ["URRJ", "SVT", "UCP", "UFC", "UCM"] as const;
export type AreaLinea = (typeof AREAS_LINEA)[number];

export type EstadoArea = "positivo" | "negativo" | "espera";

export interface PasoRecorrido {
  id?: string;
  caso_id: string | null;
  expediente: string | null;
  area: string;
  estado: EstadoArea;
  nota: string | null;
  marcado_por: string | null;
  updated_at?: string;
}

// Colores y etiquetas por estado (para pintar la línea de vida).
export const COLOR_ESTADO: Record<string, { color: string; bg: string; texto: string }> = {
  positivo: { color: "#0C5C46", bg: "#0C5C4615", texto: "Positivo" },
  negativo: { color: "#A32D2D", bg: "#A32D2D15", texto: "Negativo" },
  espera:   { color: "#B26B00", bg: "#B26B0015", texto: "En espera" },
  gris:     { color: "#8A8F98", bg: "#8A8F9812", texto: "No aplica todavía" },
};

// Trae todos los pasos registrados de un caso (por área).
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

// Marca (o actualiza) el estado de un área para un caso.
export async function marcarArea(caso: CasoJuridico, area: string, estado: EstadoArea, nota: string | null, quien: string | null): Promise<boolean> {
  const cuerpo: PasoRecorrido = {
    caso_id: caso.id || null,
    expediente: caso.expediente || null,
    area,
    estado,
    nota,
    marcado_por: quien,
  };
  try {
    // upsert por (caso_id, area) gracias al índice único
    const r = await fetch(`${SUPABASE_URL}/rest/v1/recorrido_area?on_conflict=caso_id,area`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ ...cuerpo, updated_at: new Date().toISOString() }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

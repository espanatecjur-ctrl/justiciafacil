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
// Excepción URRJ: manda el jurídico (el registral no bloquea).
export function colorDeArea(p?: PasoRecorrido): ColorArea {
  if (!p || (!p.dic_registral && !p.dic_juridico)) return "gris";
  const r = p.dic_registral, j = p.dic_juridico;
  if (p.area === "URRJ") {
    if (j === "negativo") return "rojo";
    if (j === "positivo") return "verde";
    if (j === "espera") return "naranja";
    return "gris";
  }
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
// --- Reflejar el resultado de un dictamen en la línea de vida (automático) ---
export function decisionADictamen(decision: string): Dictamen {
  const d = (decision || "").toLowerCase();
  if (d.includes("no pasa")) return "negativo";
  if (d.includes("pasa")) return "positivo"; // "sí pasa" o "pasa a ucp"
  return null;
}

export async function reflejarDictamen(
  caso: CasoJuridico, area: string, tipo: "registral" | "juridico", dictamen: Dictamen, quien: string | null,
): Promise<boolean> {
  if (!caso?.id || !dictamen) return false;
  const actual = await obtenerRecorrido(caso);
  const p = actual[area];
  const reg = tipo === "registral" ? dictamen : (p?.dic_registral ?? null);
  const jur = tipo === "juridico" ? dictamen : (p?.dic_juridico ?? null);
  return marcarArea(caso, area, reg, jur, "Reflejado automáticamente del dictamen", quien);
}

// --- Conectar la bolita URRJ al PRE-DICTAMEN abierto (automático) ---
// La bolita URRJ manda el jurídico. Si hay un pre-dictamen VIGENTE, refleja su
// resultado: POSITIVO→verde, NEGATIVO→rojo, resto (CONDICIONADO / FALTAN DATOS)
// →naranja (abierto/en proceso). Si NO hay pre-dictamen, regresa null → la bolita
// queda gris ("no pasa nada").
function veredictoADictamen(v?: string | null): Dictamen {
  const s = (v || "").toUpperCase();
  if (s.includes("POSITIVO")) return "positivo";
  if (s.includes("NEGATIVO")) return "negativo";
  return "espera"; // pre-dictamen abierto, aún sin concluir
}

export async function preDictamenURRJ(caso: CasoJuridico): Promise<Dictamen> {
  const filtro = caso.id ? `caso_id=eq.${caso.id}` : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=dictamen_sugerido,vigente,created_at&${filtro}&vigente=eq.true&order=created_at.desc&limit=1`, { headers });
    if (!r.ok) return null;
    const filas: { dictamen_sugerido?: string | null }[] = await r.json();
    if (!filas.length) return null; // no hay pre-dictamen abierto → gris
    return veredictoADictamen(filas[0].dictamen_sugerido);
  } catch {
    return null;
  }
}

// --- Conectar la bolita UCP a sus DOS decisiones (jurídico + registral) ---
// Verde solo si AMBOS positivos; roja si cualquiera es negativo (lo resuelve
// colorDeArea). Fuentes: jurídico = dictamen.veredicto; registral =
// dictamen.registral.veredicto (respaldo: dictamen.rppc.resultado).
function veredictoUCP(v?: string | null): Dictamen {
  const s = (v || "").toUpperCase();
  if (s.includes("POSITIVO")) return "positivo";
  if (s.includes("NEGATIVO")) return "negativo";
  if (s.includes("CONDICIONADO")) return "espera";
  return null; // PENDIENTE / FALTAN DATOS / vacío
}

export async function dictamenUCP(caso: CasoJuridico): Promise<{ dic_juridico: Dictamen; dic_registral: Dictamen } | null> {
  if (!caso.id) return null; // el dictamen de UCP se liga por caso_id
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=veredicto,juridico,registral,rppc,updated_at&caso_id=eq.${caso.id}&order=updated_at.desc&limit=1`, { headers });
    if (!r.ok) return null;
    const filas: { veredicto?: string | null; juridico?: { veredicto?: string } | null; registral?: { veredicto?: string } | null; rppc?: { resultado?: string } | null }[] = await r.json();
    if (!filas.length) return null; // sin dictamen UCP → gris
    const d = filas[0];
    const jurTxt = d.veredicto || d.juridico?.veredicto || null;
    const regTxt = d.registral?.veredicto || d.rppc?.resultado || null;
    if (!jurTxt && !regTxt) return null;
    return { dic_juridico: veredictoUCP(jurTxt), dic_registral: veredictoUCP(regTxt) };
  } catch {
    return null;
  }
}

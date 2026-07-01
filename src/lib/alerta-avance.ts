// ============================================================
// JusticiaFácil · Alerta de "días sin avance"
// ------------------------------------------------------------
// Un caso "avanza" cuando se registra: un documento/movimiento,
// una actuación procesal, un acuerdo del boletín, o una marca de
// recorrido. Si pasan 15+ días sin ninguno → alerta.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// umbral de días para la alerta
export const DIAS_ALERTA = 15;

// Trae la fecha más reciente de la tabla dada para un caso (o null si no hay).
async function ultimaFecha(tabla: string, campoFecha: string, filtro: string): Promise<string | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=${campoFecha}&${filtro}&order=${campoFecha}.desc&limit=1`, { headers });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0]?.[campoFecha] || null;
  } catch { return null; }
}

// Calcula los días sin avance de UN caso. Devuelve { dias, ultima }.
export async function diasSinAvance(caso: CasoJuridico): Promise<{ dias: number | null; ultima: string | null }> {
  const filtroCaso = caso.id ? `caso_id=eq.${caso.id}` : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
  const fechas: string[] = [];

  // 1) documentos y movimientos
  const f1 = await ultimaFecha("documento_garantia", "created_at", `${filtroCaso}&en_papelera=eq.false`);
  if (f1) fechas.push(f1);
  // 2) seguimiento procesal (actuaciones del juicio)
  const f2 = await ultimaFecha("seguimiento_procesal", "created_at", filtroCaso);
  if (f2) fechas.push(f2);
  // 3) recorrido / marcas de dictamen
  const f3 = await ultimaFecha("recorrido_area", "updated_at", filtroCaso);
  if (f3) fechas.push(f3);

  if (fechas.length === 0) return { dias: null, ultima: null };

  // la más reciente
  const ultima = fechas.sort().reverse()[0];
  const ms = Date.now() - new Date(ultima).getTime();
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  return { dias, ultima };
}

// ¿Está en alerta? (15+ días o nunca tuvo avance)
export function enAlerta(dias: number | null): boolean {
  return dias === null || dias >= DIAS_ALERTA;
}

// ---- VERSIÓN EN LOTE (para listas de muchos casos) ----
// Trae, en pocas consultas, la última fecha de avance de MUCHOS casos a la vez.
// Devuelve un mapa { caso_id -> días sin avance }.
export async function diasSinAvanceLote(casoIds: string[]): Promise<Record<string, number>> {
  const mapa: Record<string, number> = {};
  const ids = casoIds.filter(Boolean);
  if (ids.length === 0) return mapa;
  const lista = `(${ids.map((x) => `"${x}"`).join(",")})`;

  // guarda la fecha más reciente vista por caso
  const ultimas: Record<string, string> = {};
  const registrar = (caso_id: string | null, fecha: string | null) => {
    if (!caso_id || !fecha) return;
    if (!ultimas[caso_id] || fecha > ultimas[caso_id]) ultimas[caso_id] = fecha;
  };

  const traer = async (tabla: string, campo: string, extra = "") => {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=caso_id,${campo}&caso_id=in.${lista}${extra}`, { headers });
      if (r.ok) { const filas = await r.json(); for (const f of filas) registrar(f.caso_id, f[campo]); }
    } catch { /* silencioso */ }
  };

  await traer("documento_garantia", "created_at", "&en_papelera=eq.false");
  await traer("seguimiento_procesal", "created_at");
  await traer("recorrido_area", "updated_at");

  for (const id of ids) {
    const u = ultimas[id];
    mapa[id] = u ? Math.floor((Date.now() - new Date(u).getTime()) / (1000 * 60 * 60 * 24)) : 99999;
  }
  return mapa;
}

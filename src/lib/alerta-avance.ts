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

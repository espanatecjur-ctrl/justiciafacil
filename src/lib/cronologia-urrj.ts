// ============================================================
// Cronología URRJ · registra y lee eventos de una garantía
// (dictámenes firmados y correos preparados). Nunca rompe el
// flujo: si falla el guardado, solo se ignora en silencio.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export type TipoEvento = "dictamen_juridico" | "dictamen_registral" | "correo_juridico" | "correo_registral";

export interface EventoCronologia {
  id?: string;
  caso_id?: string | null;
  expediente?: string | null;
  tipo: TipoEvento;
  resultado?: string | null;
  firma_elabora?: string | null;
  firma_valida?: string | null;
  vista_previa?: string | null;
  detalle?: string | null;
  creado_por?: string | null;
  created_at?: string;
}

/** Registra un evento. Silencioso: nunca lanza. */
export async function registrarEvento(ev: EventoCronologia): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/cronologia_urrj`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        caso_id: ev.caso_id || null,
        expediente: ev.expediente || null,
        tipo: ev.tipo,
        resultado: ev.resultado || null,
        firma_elabora: ev.firma_elabora || null,
        firma_valida: ev.firma_valida || null,
        vista_previa: ev.vista_previa || null,
        detalle: ev.detalle || null,
        creado_por: ev.creado_por || null,
      }),
    });
  } catch { /* la cronología nunca debe romper el flujo */ }
}

/** Lee los eventos de una garantía (por caso_id o expediente), más nuevos primero. */
export async function leerCronologia(casoId?: string | null, expediente?: string | null): Promise<EventoCronologia[]> {
  const filtros: string[] = [];
  if (casoId) filtros.push(`caso_id=eq.${encodeURIComponent(casoId)}`);
  else if (expediente) filtros.push(`expediente=eq.${encodeURIComponent(expediente)}`);
  else return [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/cronologia_urrj?select=*&${filtros.join("&")}&order=created_at.desc`, { headers });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

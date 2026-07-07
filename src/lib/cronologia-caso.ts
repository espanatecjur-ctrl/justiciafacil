import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export type TipoEventoCaso = "cambio" | "documento" | "dictamen" | "actuacion" | "nota" | "coincidencia";

export interface EventoCaso {
  id?: string;
  caso_id?: string | null;
  expediente?: string | null;
  area?: string | null;
  tipo: TipoEventoCaso;
  texto: string;
  autor?: string | null;
  created_at?: string;
}

export async function registrarEvento(ev: EventoCaso): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/evento_caso`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        caso_id: ev.caso_id ?? null,
        expediente: ev.expediente ?? null,
        area: (ev.area || "").toUpperCase() || null,
        tipo: ev.tipo,
        texto: ev.texto,
        autor: ev.autor ?? null,
      }),
    });
  } catch { /* silencioso */ }
}

export async function leerCronologia(casoId?: string | null, expediente?: string | null): Promise<EventoCaso[]> {
  try {
    const filtros: string[] = [];
    if (casoId) filtros.push(`caso_id=eq.${encodeURIComponent(casoId)}`);
    else if (expediente) filtros.push(`expediente=eq.${encodeURIComponent(expediente.trim())}`);
    else return [];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/evento_caso?select=*&${filtros.join("&")}&order=created_at.desc&limit=200`, { headers });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

// ============================================================
//  Calendario · eventos, tareas, recordatorios y citas
// ------------------------------------------------------------
//  Requiere la tabla `evento_agenda` (ver SQL de esta parte).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export const TIPOS_EVENTO = ["evento", "tarea", "recordatorio", "cita"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Color y etiqueta de cada tipo (para pintar el calendario). */
export const ESTILO_EVENTO: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  evento:       { label: "Evento",       bg: "bg-[#0B1E3A]/10", text: "text-[#0B1E3A]", dot: "#0B1E3A" },
  tarea:        { label: "Tarea",        bg: "bg-[color:var(--teal)]/15", text: "text-[color:var(--teal)]", dot: "#0C5C46" },
  recordatorio: { label: "Recordatorio", bg: "bg-[#C2A24C]/20", text: "text-[#8A6E22]", dot: "#C2A24C" },
  cita:         { label: "Cita",         bg: "bg-emerald-100", text: "text-emerald-800", dot: "#059669" },
};

export interface Evento {
  id?: string;
  titulo?: string | null;
  tipo?: string | null;
  fecha?: string | null;   // "YYYY-MM-DD"
  hora?: string | null;    // "HH:MM"
  nota?: string | null;
  estado?: string | null;  // tareas: pendiente / hecho
  expediente?: string | null;
  creado_por?: string | null;
  created_at?: string | null;
}

/** Lista los eventos de un mes (año, mes 0-11). */
export async function listarEventosMes(anio: number, mes: number): Promise<Evento[]> {
  try {
    const ini = `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
    const finDate = new Date(anio, mes + 1, 0); // último día del mes
    const fin = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(finDate.getDate()).padStart(2, "0")}`;
    return await sbSelect<Evento>(
      "evento_agenda",
      `select=*&fecha=gte.${ini}&fecha=lte.${fin}&order=fecha.asc,hora.asc`,
    );
  } catch {
    return [];
  }
}

export async function crearEvento(e: Omit<Evento, "id" | "created_at">): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/evento_agenda`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...e, estado: e.tipo === "tarea" ? (e.estado ?? "pendiente") : e.estado ?? null }),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message || err) };
  }
}

export async function actualizarEvento(id: string, cambios: Partial<Evento>): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/evento_agenda?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(cambios),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function eliminarEvento(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/evento_agenda?id=eq.${id}`, {
      method: "DELETE",
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

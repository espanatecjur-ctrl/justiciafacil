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
  asignado_a?: string | null; // correo del colaborador al que se le asignó (Fase 1)
  creado_por?: string | null;
  created_at?: string | null;
  // ---- Puente con JurisConecta (cliente) ----
  cliente_nombre?: string | null;         // nombre del cliente tecleado/elegido
  cliente_jc_id?: string | null;          // id del cliente en JurisConecta, si se encontró
  cliente_estado?: "vinculado" | "no_encontrado" | null;
  jc_tarea_id?: string | null;            // tarea-espejo creada en JurisConecta
  jc_solicitud_id?: string | null;        // solicitud pendiente en JurisConecta (si no se encontró)
}

/** Persona del equipo (para asignar tareas). */
export interface Colaborador { nombre: string; correo: string; rol?: string | null; }

/** Lista los colaboradores activos, para el selector "Asignar a". */
export async function listarColaboradores(): Promise<Colaborador[]> {
  try {
    return await sbSelect<Colaborador>(
      "colaboradores",
      "select=nombre,correo,rol&activo=eq.true&order=nombre.asc",
    );
  } catch {
    return [];
  }
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

/** Próximos `n` eventos de hoy en adelante (para la página de inicio). */
export async function listarProximos(n: number = 6): Promise<Evento[]> {
  try {
    const hoy = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    return await sbSelect<Evento>(
      "evento_agenda",
      `select=*&fecha=gte.${hoy}&order=fecha.asc,hora.asc&limit=${n}`,
    );
  } catch {
    return [];
  }
}

export async function crearEvento(e: Omit<Evento, "id" | "created_at">): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/evento_agenda`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ ...e, estado: e.tipo === "tarea" ? (e.estado ?? "pendiente") : e.estado ?? null }),
    });
    if (!res.ok) return { ok: false, error: `Supabase ${res.status}` };
    const creado = await res.json();
    return { ok: true, id: creado?.[0]?.id };
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

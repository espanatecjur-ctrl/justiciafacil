// ===================================================================
// Puente hacia JusticiaFácil (dirección inversa)  →  src/lib/justiciaFacil.ts
// Cuando en JurisConecta se crea/edita una tarea para alguien del
// área "juridico" (abogados), se refleja en el Calendario de
// JusticiaFácil (evento_agenda) — sin importar desde qué pantalla
// de JurisConecta se haya creado (Tareas del cliente, Llamadas,
// Calendario, Mi agenda…).
// ===================================================================
const JF_URL = "https://dquoysougxqknvgooiqg.supabase.co";
const JF_KEY = "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";
const jfHeaders = { apikey: JF_KEY, Authorization: `Bearer ${JF_KEY}` };

export interface DatosEventoEspejo {
  tipo: string;              // "tarea" | "llamada" | "correo" | "cita"
  titulo: string;
  detalle?: string | null;
  fecha?: string | null;     // "YYYY-MM-DD"
  asignadoCorreo: string;
  clienteNombre?: string | null;
  clienteId?: string | null;
  jcTareaId?: string | null;
}

const tipoParaJF = (t: string) => (t === "cita" ? "cita" : "tarea"); // JF solo distingue evento/tarea/recordatorio/cita

/** Crea el evento-espejo en JusticiaFácil (tarea nueva creada en JurisConecta para un abogado). */
export async function crearEventoEspejoJF(d: DatosEventoEspejo): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const r = await fetch(`${JF_URL}/rest/v1/evento_agenda`, {
      method: "POST",
      headers: { ...jfHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        titulo: d.titulo,
        tipo: tipoParaJF(d.tipo),
        fecha: d.fecha || null,
        nota: d.detalle || null,
        estado: "pendiente",
        asignado_a: d.asignadoCorreo,
        creado_por: null,
        cliente_nombre: d.clienteNombre || null,
        cliente_jc_id: d.clienteId || null,
        cliente_estado: d.clienteId ? "vinculado" : null,
        jc_tarea_id: d.jcTareaId || null,
      }),
    });
    if (!r.ok) return { ok: false, error: `JusticiaFácil respondió ${r.status}` };
    const creado = await r.json();
    return { ok: true, id: creado?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Actualiza un evento-espejo ya existente en JusticiaFácil (p.ej. al resolver una solicitud). */
export async function actualizarEventoEspejoJF(id: string, campos: Record<string, unknown>): Promise<boolean> {
  try {
    const r = await fetch(`${JF_URL}/rest/v1/evento_agenda?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...jfHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(campos),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** ¿Este correo pertenece al área jurídico (equipo que trabaja del lado de JusticiaFácil)? */
export function esAreaJuridico(area: string | null | undefined): boolean {
  return (area || "").toLowerCase() === "juridico";
}

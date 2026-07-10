// ============================================================
// JusticiaFácil · Puente de tareas hacia JurisConecta
// ------------------------------------------------------------
// Cuando en el Calendario se crea/edita una tarea o cita con
// CLIENTE + ASIGNADO A, se refleja también en JurisConecta:
//  · si el cliente SÍ se encuentra → se crea la tarea allá
//    (aparece en "Mi día" del asignado y en la ficha del cliente)
//    y se manda un aviso a su campanita.
//  · si el cliente NO se encuentra → se guarda como una
//    "solicitud" pendiente de resolver (desde aquí o desde
//    JurisConecta): Vincular con otro / Conservar (crear nuevo) /
//    Eliminar.
// ============================================================
import { JC_URL, jcHeaders, type ClienteJC } from "@/lib/juris-clientes";

/** Colaborador tal como lo guarda JurisConecta (para el selector "Asignar a"). */
export interface ColaboradorJC { nombre: string; correo: string; rol?: string | null; }

/** Lista los colaboradores activos de JurisConecta (roles y personal registrado allá). */
export async function listarColaboradoresJC(): Promise<ColaboradorJC[]> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/colaboradores?select=nombre,correo,puesto,rol_sistema&activo=eq.true&order=nombre.asc`, { headers: jcHeaders });
    if (!r.ok) return [];
    const d = await r.json();
    return (d || [])
      .filter((c: any) => c.correo)
      .map((c: any) => ({ nombre: c.nombre, correo: c.correo, rol: c.rol_sistema || c.puesto || null }));
  } catch {
    return [];
  }
}

export interface DatosTareaEspejo {
  tipo: string;              // "tarea" | "cita" | "evento" | "recordatorio"
  titulo: string;
  detalle?: string | null;
  fecha?: string | null;     // "YYYY-MM-DD"
  asignadoCorreo: string;
  asignadoNombre?: string | null;
  autorCorreo?: string | null;
  autorNombre?: string | null;
}

const tipoParaJC = (t: string): "tarea" | "llamada" | "correo" | "cita" =>
  t === "cita" ? "cita" : t === "correo" ? "correo" : t === "llamada" ? "llamada" : "tarea";

/** Crea la tarea-espejo en JurisConecta (cliente YA encontrado) + aviso en su campanita. */
export async function crearTareaEspejoJC(cliente: ClienteJC, d: DatosTareaEspejo): Promise<{ ok: boolean; tareaId?: string; error?: string }> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/tareas`, {
      method: "POST",
      headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        autor_email: d.asignadoCorreo,
        autor_nombre: d.asignadoNombre || null,
        tipo: tipoParaJC(d.tipo),
        titulo: d.titulo,
        detalle: d.detalle || null,
        fecha: d.fecha || null,
        a_quien: d.asignadoNombre || null,
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre,
        estado: "pendiente",
      }),
    });
    if (!r.ok) return { ok: false, error: `JurisConecta respondió ${r.status}` };
    const creada = await r.json();
    const tareaId = creada?.[0]?.id as string | undefined;

    // Aviso dirigido (campanita) a la persona asignada en JurisConecta.
    fetch(`${JC_URL}/rest/v1/eventos`, {
      method: "POST",
      headers: { ...jcHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "tarea",
        accion: "creado",
        titulo: `Nueva tarea desde JusticiaFácil: ${d.titulo}`,
        detalle: `Cliente: ${cliente.nombre}${d.autorNombre ? " · de " + d.autorNombre : ""}`,
        autor: d.autorNombre || "JusticiaFácil",
        modulo: "clientes",
        ref_id: cliente.id,
        icono: "✅",
        meta: { paraEmail: (d.asignadoCorreo || "").trim().toLowerCase() },
      }),
    }).catch(() => {});

    return { ok: true, tareaId };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Marca la tarea-espejo como hecha/pendiente (para mantener sincronizado el "marcar hecha"). */
export async function marcarTareaJC(tareaId: string, estado: "pendiente" | "hecha"): Promise<boolean> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/tareas?id=eq.${tareaId}`, {
      method: "PATCH",
      headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ estado }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface DatosSolicitudJF extends DatosTareaEspejo {
  nombreCliente: string;
  jfEventoId?: string | null;
}

/** Cliente NO encontrado en JurisConecta: crea la solicitud pendiente de resolución. */
export async function crearSolicitudClienteJF(d: DatosSolicitudJF): Promise<{ ok: boolean; solicitudId?: string; error?: string }> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/solicitud_cliente_jf`, {
      method: "POST",
      headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        origen: "justiciafacil",
        nombre_cliente: d.nombreCliente,
        titulo: d.titulo,
        detalle: d.detalle || null,
        tipo: tipoParaJC(d.tipo),
        fecha: d.fecha || null,
        asignado_correo: d.asignadoCorreo,
        asignado_nombre: d.asignadoNombre || null,
        estado: "pendiente",
        jf_evento_id: d.jfEventoId || null,
      }),
    });
    if (!r.ok) return { ok: false, error: `JurisConecta respondió ${r.status}` };
    const creada = await r.json();
    return { ok: true, solicitudId: creada?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export interface EstadoSolicitudJF {
  id: string;
  estado: "pendiente" | "vinculada" | "creada" | "descartada";
  cliente_id: string | null;
}

/** Revisa cómo va una solicitud (para refrescar el indicador en el Calendario). */
export async function estadoSolicitudJF(id: string): Promise<EstadoSolicitudJF | null> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/solicitud_cliente_jf?select=id,estado,cliente_id&id=eq.${id}&limit=1`, { headers: jcHeaders });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0] || null;
  } catch {
    return null;
  }
}

/** Resolver la solicitud directamente desde JusticiaFácil, sin ir a JurisConecta. */
export async function vincularSolicitudJF(solicitudId: string, cliente: ClienteJC, d: DatosTareaEspejo, quien: string): Promise<{ ok: boolean; error?: string }> {
  const espejo = await crearTareaEspejoJC(cliente, d);
  if (!espejo.ok) return { ok: false, error: espejo.error };
  const r = await fetch(`${JC_URL}/rest/v1/solicitud_cliente_jf?id=eq.${solicitudId}`, {
    method: "PATCH",
    headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ estado: "vinculada", cliente_id: cliente.id, resuelto_por: quien, resuelto_en: new Date().toISOString() }),
  });
  return { ok: r.ok };
}

/** Descarta la solicitud (no era un cliente válido / duplicado / etc.). */
export async function descartarSolicitudJF(solicitudId: string, quien: string): Promise<boolean> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/solicitud_cliente_jf?id=eq.${solicitudId}`, {
      method: "PATCH",
      headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ estado: "descartada", resuelto_por: quien, resuelto_en: new Date().toISOString() }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

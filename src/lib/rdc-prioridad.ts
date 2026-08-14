// ============================================================
// JusticiaFácil · Prioridad RDC (Devolución Compensada de JurisConecta)
// ------------------------------------------------------------
// LECTURA: directo a JurisConecta con la llave pública (mismo patrón
// de solo-lectura que juris-clientes.ts).
// APROBAR/RECHAZAR: NUNCA directo — siempre vía nuestra propia función
// de servidor (aprobar-rdc-proxy), que es la única que conoce el
// secreto compartido con JurisConecta.
// ============================================================
import { JC_URL, jcHeaders } from "./juris-clientes";

export interface SolicitudPrioridadRdc {
  id: string;
  clienteId: string;
  solicitadoPor: string;
  motivo: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  creadoEn: string;
  clienteNombre?: string;
}

/** Solicitudes de prioridad RDC pendientes de validar (para la bandeja de GAD/DGE). */
export async function listarPrioridadesPendientesJC(): Promise<SolicitudPrioridadRdc[]> {
  try {
    const r = await fetch(
      `${JC_URL}/rest/v1/solicitudes_prioridad_rdc?select=id,cliente_id,solicitado_por,motivo,estado,creado_en&estado=eq.pendiente&order=creado_en.asc`,
      { headers: jcHeaders }
    );
    if (!r.ok) return [];
    const filas = await r.json();
    if (!Array.isArray(filas) || filas.length === 0) return [];

    // Trae los nombres de los clientes en un solo viaje (in.(...)).
    const ids = [...new Set(filas.map((f: { cliente_id: string }) => f.cliente_id))];
    const nombresPorId = new Map<string, string>();
    if (ids.length > 0) {
      const rc = await fetch(`${JC_URL}/rest/v1/clientes?select=id,nombre&id=in.(${ids.join(",")})`, { headers: jcHeaders });
      if (rc.ok) {
        const clientes = await rc.json();
        for (const c of clientes) nombresPorId.set(String(c.id), c.nombre);
      }
    }

    return filas.map((f: Record<string, unknown>) => ({
      id: String(f.id),
      clienteId: String(f.cliente_id),
      solicitadoPor: String(f.solicitado_por || ""),
      motivo: (f.motivo as string) ?? null,
      estado: (f.estado as SolicitudPrioridadRdc["estado"]) || "pendiente",
      creadoEn: String(f.creado_en || ""),
      clienteNombre: nombresPorId.get(String(f.cliente_id)) || "Cliente sin nombre",
    }));
  } catch {
    return [];
  }
}

/** Aprueba o rechaza una solicitud de prioridad RDC. Pasa por nuestro propio proxy (el secreto nunca sale del servidor). */
export async function resolverPrioridadRdcJF(solicitudId: string, accion: "aprobar" | "rechazar", aprobadoPor: string): Promise<{ ok: boolean; mensaje?: string }> {
  try {
    const r = await fetch("/.netlify/functions/aprobar-rdc-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solicitudId, accion, aprobadoPor }),
    });
    const texto = await r.text();
    if (!r.ok) return { ok: false, mensaje: texto || "No se pudo resolver la solicitud." };
    return { ok: true };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "Error de red." };
  }
}

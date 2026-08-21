// JusticiaFácil · Prioridad RDC — lee las solicitudes de prioridad en la cola
// de Devolución Compensada directo de JurisConecta (solo lectura), y aprueba
// o rechaza a través del proxy de Netlify (que es quien conoce el secreto
// compartido — nunca viaja al navegador).
//
// NOTA (20-ago-2026): este archivo reemplaza una versión anterior que se
// copió por error del repo de JurisConecta (importaba "./expediente",
// "./expedienteDocs" y "./clientes", archivos que nunca existieron aquí, y
// rompía el build completo del sitio desde hace tiempo). Esta versión solo
// tiene lo que la pantalla /rdc-prioridad realmente usa.

import { JC_URL, jcHeaders } from "@/lib/juris-clientes";

export interface SolicitudPrioridadRdc {
  id: string;
  clienteId: string;
  clienteNombre: string;
  solicitadoPor: string;
  motivo: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  creadoEn: string;
}

function mapSolicitud(f: Record<string, any>, nombrePorCliente: Map<string, string>): SolicitudPrioridadRdc {
  return {
    id: String(f.id),
    clienteId: String(f.cliente_id),
    clienteNombre: nombrePorCliente.get(String(f.cliente_id)) || "(cliente sin nombre)",
    solicitadoPor: String(f.solicitado_por || ""),
    motivo: f.motivo ?? null,
    estado: f.estado || "pendiente",
    aprobadoPor: f.aprobado_por ?? null,
    aprobadoEn: f.aprobado_en ?? null,
    creadoEn: f.creado_en || f.created_at || new Date().toISOString(),
  };
}

/** Trae las solicitudes de prioridad RDC pendientes, directo de JurisConecta. */
export async function listarPrioridadesPendientesJC(): Promise<SolicitudPrioridadRdc[]> {
  const r = await fetch(`${JC_URL}/rest/v1/solicitudes_prioridad_rdc?select=*&estado=eq.pendiente&order=creado_en.asc`, { headers: jcHeaders });
  if (!r.ok) return [];
  const filas: any[] = await r.json();
  if (filas.length === 0) return [];

  const clienteIds = [...new Set(filas.map((f) => f.cliente_id).filter(Boolean))];
  const clientes = clienteIds.length > 0
    ? await fetch(`${JC_URL}/rest/v1/clientes?select=id,nombre&id=in.(${clienteIds.join(",")})`, { headers: jcHeaders }).then((r2) => (r2.ok ? r2.json() : []))
    : [];
  const nombrePorCliente = new Map<string, string>(clientes.map((c: any) => [String(c.id), String(c.nombre || "")]));

  return filas.map((f) => mapSolicitud(f, nombrePorCliente));
}

/** Aprueba o rechaza una solicitud de prioridad — vía el proxy de Netlify (guarda el secreto). */
export async function resolverPrioridadRdcJF(
  solicitudId: string, accion: "aprobar" | "rechazar", aprobadoPor: string
): Promise<{ ok: boolean; mensaje?: string }> {
  try {
    const r = await fetch("/.netlify/functions/aprobar-rdc-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solicitudId, accion, aprobadoPor }),
    });
    const texto = await r.text();
    if (!r.ok) return { ok: false, mensaje: texto || `Error ${r.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, mensaje: e?.message || "No se pudo contactar al servidor." };
  }
}

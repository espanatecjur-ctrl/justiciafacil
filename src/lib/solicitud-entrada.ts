// ============================================================
//  Solicitudes de entrada (alta de personal)
// ------------------------------------------------------------
//  Cuando alguien entra y no tiene rol, se registra aquí. Un
//  validador revisa y le asigna rol. Requiere la tabla
//  `solicitud_entrada` (ver SQL de la Parte A).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

/** Tipos de persona que se capturan al registrarse. */
export const TIPOS_ENTRADA = ["abogado", "apoderado", "gestor", "pasante"] as const;
export type TipoEntrada = (typeof TIPOS_ENTRADA)[number];

/** La cédula profesional es obligatoria para estos tipos (no para pasante). */
export const TIPOS_CON_CEDULA: string[] = ["abogado", "apoderado", "gestor"];

export interface SolicitudEntrada {
  id?: string;
  correo?: string | null;
  nombre?: string | null;
  telefono?: string | null;
  cedula_profesional?: string | null;
  tipo?: string | null;
  estado?: string | null;          // pendiente / aprobado / rechazado
  rol_asignado?: string | null;
  revisado_por?: string | null;
  nota?: string | null;
  creado_at?: string | null;
  revisado_at?: string | null;
}

/** Busca la solicitud de un correo (si ya se registró antes). */
export async function solicitudDeCorreo(correo: string): Promise<SolicitudEntrada | null> {
  try {
    const filas = await sbSelect<SolicitudEntrada>(
      "solicitud_entrada",
      `select=*&correo=eq.${encodeURIComponent(correo)}`,
    );
    return filas[0] ?? null;
  } catch {
    return null;
  }
}

/** Crea (o reactiva) la solicitud de entrada de una persona. */
export async function crearSolicitudEntrada(
  d: Omit<SolicitudEntrada, "id" | "estado" | "creado_at" | "revisado_at" | "rol_asignado" | "revisado_por">,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_entrada`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ ...d, estado: "pendiente", creado_at: new Date().toISOString() }),
    });
    if (!res.ok) return { ok: false, error: `Supabase ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

/** Lista las solicitudes por estado (por defecto, las pendientes). */
export async function listarSolicitudesEntrada(estado: string = "pendiente"): Promise<SolicitudEntrada[]> {
  try {
    return await sbSelect<SolicitudEntrada>(
      "solicitud_entrada",
      `select=*&estado=eq.${estado}&order=creado_at.desc`,
    );
  } catch {
    return [];
  }
}

/** Marca una solicitud como aprobada o rechazada (guarda quién y el rol). */
export async function resolverSolicitudEntrada(
  id: string,
  estado: "aprobado" | "rechazado",
  extra: { rol_asignado?: string; revisado_por?: string; nota?: string } = {},
): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_entrada?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...extra, estado, revisado_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

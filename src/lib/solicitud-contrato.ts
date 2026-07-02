// ============================================================
// JusticiaFácil · Solicitudes de Contrato / Documento
// ------------------------------------------------------------
// Cuando un área (p. ej. UFC, por garantía) necesita que Contratos
// elabore un documento (oficio, carta, contrato), llena un mini
// formulario y aquí se guarda la solicitud. Contratos la ve como
// pendiente, con un plazo de 24 horas hábiles para entregarla.
// Requiere la tabla `solicitud_contrato` (ver SQL de esta parte).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

/** Tipos de documento que Contratos puede elaborar. */
export const TIPOS_DOCUMENTO_SOLICITUD = [
  "Oficio de solicitud notarial",
  "Carta de Intención de Cambio",
  "Contrato de Cambio de Garantía",
  "Contrato de prestación de servicios",
  "Otro (especificar en el detalle)",
];

export const ESTADOS_SOLICITUD = ["Pendiente", "En proceso", "Entregada"];

export interface SolicitudContrato {
  id?: string;
  garantia_ref?: string | null;   // ID interno o dirección de la garantía
  origen?: string | null;         // de dónde viene la solicitud (p. ej. UFC)
  tipo_documento?: string | null;  // qué se necesita elaborar
  detalle?: string | null;         // descripción de lo que se necesita
  solicitante?: string | null;     // quién lo pide
  area?: string | null;            // área que solicita
  estado?: string | null;          // Pendiente / En proceso / Entregada
  fecha_solicitud?: string | null; // cuándo se pidió
  fecha_limite?: string | null;    // fecha tope (24 h hábiles)
  created_at?: string | null;
}

/**
 * Calcula la fecha límite: 24 horas hábiles desde el momento dado.
 * Si cae en fin de semana, se recorre al lunes a la misma hora.
 */
export function limite24hHabiles(desde: Date = new Date()): Date {
  const d = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // sábado -> lunes
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1); // domingo -> lunes
  return d;
}

/** Guarda una nueva solicitud. Devuelve true si se guardó. */
export async function crearSolicitud(
  s: Omit<SolicitudContrato, "id" | "created_at">,
): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_contrato`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(s),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Lista las solicitudes (más recientes primero). */
export async function listarSolicitudes(): Promise<SolicitudContrato[]> {
  try {
    return await sbSelect<SolicitudContrato>("solicitud_contrato", "select=*&order=created_at.desc");
  } catch {
    return [];
  }
}

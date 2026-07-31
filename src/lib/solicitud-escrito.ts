// ============================================================
//  Solicitudes de escrito · flujo jurídico
// ------------------------------------------------------------
//  Ciclo: solicitado → en_elaboracion → validado_dil → presentado
//  "zona" solicita y alguien lo elabora (aparece en Escritos ▸
//  Solicitudes). Si el DIL lo elabora directo, puede marcarlo
//  como validado_dil de una vez (se salta la cola de zona).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export const ESTADOS_SOLICITUD = ["solicitado", "en_elaboracion", "validado_dil", "presentado", "cancelado"] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const DECISIONES_RECURSO = ["Ninguno", "Apelación", "Amparo indirecto", "Amparo directo", "Otro"] as const;

export interface SolicitudEscrito {
  id: string;
  caso_id: string | null;
  expediente: string | null;
  garantia_id: string | null;
  etapa: string | null;
  posicion_procesal: string | null;
  tipo_escrito: string | null;
  titulo: string;
  recomendacion: string | null;
  notas_solicitud: string | null;
  quien_solicita_nombre: string | null;
  quien_solicita_rol: string | null;
  quien_elabora: "zona" | "dil";
  responsable_correo: string | null;
  responsable_nombre: string | null;
  estado: EstadoSolicitud;
  folio_escrito_generado: string | null;
  decision_recurso: string | null;
  decision_notas: string | null;
  fecha_presentacion: string | null;
  validado_por: string | null;
  validado_at: string | null;
  creado_por: string | null;
  created_at: string;
}

export async function listarSolicitudes(filtro: string = ""): Promise<SolicitudEscrito[]> {
  try {
    return await sbSelect<SolicitudEscrito>("solicitud_escrito", `select=*${filtro ? "&" + filtro : ""}&order=created_at.desc`);
  } catch {
    return [];
  }
}

export async function crearSolicitudEscrito(data: Partial<SolicitudEscrito>): Promise<boolean> {
  try {
    // Si quien elabora es el DIL directo, ya nace validada (se salta la cola de zona).
    const estadoInicial: EstadoSolicitud = data.quien_elabora === "dil" ? "validado_dil" : "solicitado";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_escrito`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...data, estado: data.estado ?? estadoInicial }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function actualizarSolicitud(id: string, cambios: Partial<SolicitudEscrito>): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_escrito?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(cambios),
    });
    return res.ok;
  } catch {
    return false;
  }
}

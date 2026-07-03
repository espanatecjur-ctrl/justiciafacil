// ============================================================
//  Solicitudes de pre-dictaminación (Dirección)
// ------------------------------------------------------------
//  Sube documentos de una garantía (Supabase Storage) y crea la
//  solicitud para que URRJ la dictamine. Requiere la tabla
//  `solicitud_predictamen` y el bucket `predictamen-docs`.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface DocRef { nombre: string; url: string }

export interface SolicitudPredictamen {
  id?: string;
  caso_id?: string | null;
  expediente?: string | null;
  cliente?: string | null;
  juzgado?: string | null;
  nota?: string | null;
  documentos?: DocRef[] | null;
  estado?: string | null;
  resultado?: string | null;
  solicitado_por?: string | null;
  created_at?: string | null;
}

export interface CasoOpcion {
  id: string;
  expediente?: string | null;
  cliente_nombre?: string | null;
  juzgado?: string | null;
}

/** Sube un archivo al almacén y devuelve su nombre y URL pública. */
export async function subirDocPredictamen(file: File): Promise<DocRef> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `dir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/predictamen-docs/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`No se pudo subir (${res.status}). ¿Existe el almacén 'predictamen-docs'?`);
  return { url: `${SUPABASE_URL}/storage/v1/object/public/predictamen-docs/${path}`, nombre: file.name };
}

/** Lista de expedientes para el selector de garantía. */
export async function casosParaSelector(): Promise<CasoOpcion[]> {
  try {
    return await sbSelect<CasoOpcion>(
      "caso_juridico",
      "select=id,expediente,cliente_nombre,juzgado&order=expediente.asc&limit=1000",
    );
  } catch {
    return [];
  }
}

export async function crearSolicitudPredictamen(
  d: Omit<SolicitudPredictamen, "id" | "estado" | "created_at">,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...d, estado: "pendiente", created_at: new Date().toISOString() }),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

export async function listarSolicitudesPredictamen(estado?: string): Promise<SolicitudPredictamen[]> {
  try {
    const filtro = estado ? `&estado=eq.${estado}` : "";
    return await sbSelect<SolicitudPredictamen>(
      "solicitud_predictamen",
      `select=*${filtro}&order=created_at.desc`,
    );
  } catch {
    return [];
  }
}

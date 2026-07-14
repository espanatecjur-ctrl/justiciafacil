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
  area?: string | null;          // URRJ / UCP / UFC / UDP — a qué área van los documentos
  tipo_dictamen?: string | null; // Registral / Jurídico — para qué dictamen son
  administradora_codigo?: string | null; // código de la administradora (el nombre real solo lo ve DGE)
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
  unidad?: string | null;
  no_credito?: string | null;
  direccion_garantia?: string | null;
  entidad?: string | null;
  gar_id?: string | null;
  cliente_codigo?: string | null;
  drive_carpeta_id?: string | null;
  drive_carpeta_nombre?: string | null;
}

/** Deriva el área (URRJ/UCP/UCM/UFC/UDP) de una garantía a partir de su unidad. */
export function areaDeGarantia(unidad?: string | null): string {
  const s = (unidad || "").toUpperCase();
  for (const a of ["URRJ", "UCP", "UFC", "UDP", "UCM"]) if (s.includes(a)) return a;
  return "UCM";
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
      "select=id,expediente,cliente_nombre,juzgado,unidad,no_credito,direccion_garantia,entidad,gar_id,cliente_codigo,drive_carpeta_id,drive_carpeta_nombre&order=expediente.asc&limit=1000",
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

/** Refleja una carpeta de Drive en la garantía (la vincula) para que aparezca en su ficha. */
export async function vincularCarpetaAGarantia(
  casoId: string,
  carpetaId: string,
  carpetaNombre: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${casoId}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ drive_carpeta_id: carpetaId, drive_carpeta_nombre: carpetaNombre }),
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

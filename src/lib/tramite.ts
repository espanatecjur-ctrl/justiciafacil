// ============================================================
//  Trámites de gobierno (gestión y seguimiento)
//  Requiere la tabla `tramite` y el bucket `predictamen-docs`.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface Tramite {
  id?: string;
  folio?: string | null;
  tipo?: string | null;
  nombre_tramite?: string | null;
  cliente?: string | null;
  expediente?: string | null;
  responsable?: string | null;
  estado?: string | null;
  portal?: string | null;
  nota?: string | null;
  doc_url?: string | null;
  doc_nombre?: string | null;
  creado_por?: string | null;
  created_at?: string | null;
}

export const ESTADOS_TRAMITE = ["solicitado", "en_proceso", "documentos_pendientes", "completado", "rechazado"] as const;

export const ESTADO_TRAMITE_TONO: Record<string, string> = {
  solicitado: "bg-blue-100 text-blue-900",
  en_proceso: "bg-amber-100 text-amber-900",
  documentos_pendientes: "bg-orange-100 text-orange-900",
  completado: "bg-emerald-100 text-emerald-900",
  rechazado: "bg-red-100 text-red-900",
  archivado: "bg-slate-100 text-slate-800",
};

export function etiquetaEstado(e?: string | null): string {
  const m: Record<string, string> = {
    solicitado: "Solicitado",
    en_proceso: "En proceso",
    documentos_pendientes: "Faltan documentos",
    completado: "Completado",
    rechazado: "Rechazado",
    archivado: "Archivado",
  };
  return m[e || "solicitado"] || (e || "—");
}

/** Sube el documento resultante del trámite y devuelve su URL pública. */
export async function subirDocTramite(file: File): Promise<{ url: string; nombre: string }> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `tramite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/predictamen-docs/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`No se pudo subir (${res.status}).`);
  return { url: `${SUPABASE_URL}/storage/v1/object/public/predictamen-docs/${path}`, nombre: file.name };
}

export async function listarTramites(): Promise<Tramite[]> {
  try {
    return await sbSelect<Tramite>("tramite", "select=*&estado=neq.archivado&order=created_at.desc");
  } catch {
    return [];
  }
}

export async function listarTramitesArchivados(): Promise<Tramite[]> {
  try {
    return await sbSelect<Tramite>("tramite", "select=*&estado=eq.archivado&order=created_at.desc");
  } catch {
    return [];
  }
}

export async function crearTramite(t: Omit<Tramite, "id" | "created_at" | "folio">): Promise<{ ok: boolean; error?: string }> {
  try {
    const folio = `TRA-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tramite`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...t, folio, estado: t.estado || "solicitado" }),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

export async function actualizarTramite(id: string, cambios: Partial<Tramite>): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tramite?id=eq.${id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(cambios),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function eliminarTramite(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tramite?id=eq.${id}`, { method: "DELETE", headers });
    return res.ok;
  } catch {
    return false;
  }
}

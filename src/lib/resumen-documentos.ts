// ============================================================
//  Resumen por documento (uno por solicitud, en caché)
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface ResumenDoc { nombre: string; tipo: string; resumen: string }
export interface ResumenDocumentosCache { clave: string; resumenes: ResumenDoc[]; modelo?: string | null; created_at?: string }

export async function obtenerResumenCacheado(clave: string): Promise<ResumenDocumentosCache | null> {
  if (!clave) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/resumen_documentos_ia?select=*&clave=eq.${encodeURIComponent(clave)}&limit=1`, { headers });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

export async function generarResumenIA(clave: string, documentos: { nombre: string; url: string }[]): Promise<{ ok: boolean; error?: string; cache?: ResumenDocumentosCache }> {
  if (!clave) return { ok: false, error: "Falta el identificador de la solicitud." };
  if (!documentos.length) return { ok: false, error: "No hay documentos para resumir." };
  try {
    const r = await fetch("/.netlify/functions/resumir-documentos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentos }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) return { ok: false, error: (data.error || `Error ${r.status}`) + (data.crudo ? ` — respuesta: ${data.crudo.slice(0, 200)}` : "") };
    const fila: ResumenDocumentosCache = { clave, resumenes: data.resumenes || [], modelo: data.modelo || null };
    await fetch(`${SUPABASE_URL}/rest/v1/resumen_documentos_ia`, {
      method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila),
    });
    return { ok: true, cache: fila };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

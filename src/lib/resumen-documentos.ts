// ============================================================
//  Resumen por documento (uno por solicitud, en caché)
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface ResumenDoc { nombre: string; tipo: string; resumen: string }
export interface DatosGeneralesIA { administradora?: string | null; numero_credito?: string | null; direccion?: string | null; deudor?: string | null; juzgado?: string | null; expediente?: string | null }
export interface ResumenDocumentosCache { clave: string; clave_caso?: string | null; resumenes: ResumenDoc[]; datos_generales?: DatosGeneralesIA | null; modelo?: string | null; created_at?: string }

export async function obtenerResumenCacheado(clave: string): Promise<ResumenDocumentosCache | null> {
  if (!clave) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/resumen_documentos_ia?select=*&clave=eq.${encodeURIComponent(clave)}&limit=1`, { headers });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

/** Busca el resumen por la clave del CASO (crédito/expediente/caso_id) —
 *  para usarlo desde el recorrido (Actor/Demandado) y el PDF, donde no se
 *  conoce el id de la solicitud original. */
export async function obtenerResumenPorClaveCaso(claveCaso: string): Promise<ResumenDocumentosCache | null> {
  if (!claveCaso) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/resumen_documentos_ia?select=*&clave_caso=eq.${encodeURIComponent(claveCaso)}&order=created_at.desc&limit=1`, { headers });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

export async function generarResumenIA(clave: string, documentos: { nombre: string; url: string }[], claveCaso?: string): Promise<{ ok: boolean; error?: string; cache?: ResumenDocumentosCache }> {
  if (!clave) return { ok: false, error: "Falta el identificador de la solicitud." };
  if (!documentos.length) return { ok: false, error: "No hay documentos para resumir." };
  try {
    const r = await fetch("/.netlify/functions/resumir-documentos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentos }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) return { ok: false, error: (data.error || `Error ${r.status}`) + (data.crudo ? ` — respuesta: ${data.crudo.slice(0, 200)}` : "") };
    const fila: ResumenDocumentosCache = {
      clave, clave_caso: claveCaso || null,
      resumenes: data.resumenes || [], datos_generales: data.datos_generales || null,
      modelo: data.modelo || null,
    };
    await fetch(`${SUPABASE_URL}/rest/v1/resumen_documentos_ia`, {
      method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila),
    });
    return { ok: true, cache: fila };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

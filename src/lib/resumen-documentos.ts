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

const TAMANO_TANDA = 1; // de uno en uno — con más, algunos documentos grandes se pasan del tiempo permitido

const esperar = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** ¿Es un error de "se acabó la cuota gratis por ahora" de Google? Si sí,
 *  saca cuántos segundos pide esperar (Google lo manda en el mensaje). */
function segundosDeEspera(mensaje: string): number | null {
  if (!/quota|429|resource_exhausted/i.test(mensaje)) return null;
  const m = mensaje.match(/retry in ([\d.]+)s/i);
  return m ? Math.ceil(parseFloat(m[1])) + 2 : 25;
}

async function llamarResumirDocumentos(documentos: { nombre: string; url: string }[], onProgreso?: (msg: string) => void): Promise<{ ok: boolean; error?: string; resumenes?: ResumenDoc[]; datos_generales?: DatosGeneralesIA | null; modelo?: string }> {
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const r = await fetch("/.netlify/functions/resumir-documentos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentos }),
      });
      const texto = await r.text();
      let data: any;
      try { data = JSON.parse(texto); }
      catch { return { ok: false, error: r.status === 504 || texto.includes("<html") ? "El servidor tardó demasiado en leer los documentos (tiempo agotado). Intenta con menos documentos a la vez, o vuelve a intentar." : `Respuesta inesperada del servidor (${r.status}).` }; }
      if (!r.ok || !data.ok) {
        const mensaje = (data.error || `Error ${r.status}`) + (data.crudo ? ` — respuesta: ${data.crudo.slice(0, 200)}` : "");
        const espera = segundosDeEspera(mensaje);
        if (espera && intento < 4) {
          onProgreso?.(`Google pidió esperar ${espera}s (límite gratis por minuto)…`);
          await esperar(espera * 1000);
          continue;
        }
        return { ok: false, error: mensaje };
      }
      return { ok: true, resumenes: data.resumenes || [], datos_generales: data.datos_generales || null, modelo: data.modelo };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  }
  return { ok: false, error: "No se pudo leer después de varios intentos." };
}

/** Manda los documentos en TANDAS pequeñas (no todos de un jalón) — así cada
 *  llamada siempre cabe dentro del tiempo que da Netlify, sin importar
 *  cuántos documentos traiga la solicitud. Los resultados se juntan en uno solo. */
export async function generarResumenIA(clave: string, documentos: { nombre: string; url: string }[], claveCaso?: string, onProgreso?: (hecho: number, total: number, msg?: string) => void): Promise<{ ok: boolean; error?: string; cache?: ResumenDocumentosCache }> {
  if (!clave) return { ok: false, error: "Falta el identificador de la solicitud." };
  if (!documentos.length) return { ok: false, error: "No hay documentos para resumir." };
  const resumenesJuntos: ResumenDoc[] = [];
  let datosGeneralesJuntos: DatosGeneralesIA | null = null;
  let modelo: string | undefined;
  for (let i = 0; i < documentos.length; i += TAMANO_TANDA) {
    const tanda = documentos.slice(i, i + TAMANO_TANDA);
    onProgreso?.(i, documentos.length, tanda[0]?.nombre);
    const r = await llamarResumirDocumentos(tanda, (msg) => onProgreso?.(i, documentos.length, msg));
    if (!r.ok) return { ok: false, error: r.error + (documentos.length > TAMANO_TANDA ? ` (fallo en el grupo ${Math.floor(i / TAMANO_TANDA) + 1} de ${Math.ceil(documentos.length / TAMANO_TANDA)})` : "") };
    resumenesJuntos.push(...(r.resumenes || []));
    // Se usan los primeros datos generales que salgan con algo (no todas las
    // tandas van a traer administradora/crédito, normalmente solo la que
    // tenga el contrato o carátula).
    if (r.datos_generales && Object.values(r.datos_generales).some((v) => v)) {
      datosGeneralesJuntos = { ...(datosGeneralesJuntos || {}), ...Object.fromEntries(Object.entries(r.datos_generales).filter(([, v]) => v)) };
    }
    modelo = r.modelo || modelo;
  }
  onProgreso?.(documentos.length, documentos.length);
  const fila: ResumenDocumentosCache = {
    clave, clave_caso: claveCaso || null,
    resumenes: resumenesJuntos, datos_generales: datosGeneralesJuntos,
    modelo: modelo || null,
  };
  await guardarResumenEnCache(fila);
  return { ok: true, cache: fila };
}

/** Solo GUARDA en caché (sin llamar a la IA) — para cuando ya se tiene el
 *  resultado y nada más hace falta re-etiquetarlo con la clave definitiva
 *  del caso (ej. cuando se acaba de conocer el número de crédito). */
export async function guardarResumenEnCache(fila: ResumenDocumentosCache): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/resumen_documentos_ia`, {
      method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(fila),
    });
  } catch { /* si falla, se queda solo con la clave temporal — no es grave */ }
}

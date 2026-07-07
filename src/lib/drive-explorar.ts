// ============================================================
// JusticiaFácil · Explorar Drive (cliente)
// Llama a /.netlify/functions/explorar-drive para leer carpetas
// y documentos de Drive (Unidades compartidas) SIN crear nada.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

export const CARPETA_MIME = "application/vnd.google-apps.folder";

export interface ItemDrive {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  modifiedTime?: string | null;
  size?: string | null;
  ruta?: string | null;
}

export interface Unidad {
  id: string;
  name: string;
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const r = await fetch("/.netlify/functions/explorar-drive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return (await r.json()) as T;
}

/** Correo de la cuenta de servicio (para agregarla como Lector en las Unidades). */
export async function correoCuentaServicio(): Promise<string> {
  try {
    const d = await llamar<{ ok: boolean; correo?: string }>({ accion: "cuenta" });
    return d.ok ? (d.correo || "") : "";
  } catch {
    return "";
  }
}

/** Lista las Unidades compartidas que la cuenta de servicio puede ver. */
export async function listarUnidades(): Promise<{ ok: boolean; unidades: Unidad[]; correo?: string; error?: string }> {
  try {
    const d = await llamar<{ ok: boolean; unidades?: Unidad[]; correo?: string; error?: string }>({ accion: "unidades" });
    return { ok: !!d.ok, unidades: d.unidades || [], correo: d.correo, error: d.error };
  } catch (e: any) {
    return { ok: false, unidades: [], error: String(e?.message || e) };
  }
}

/** Lista carpetas y documentos dentro de una carpeta (o de una Unidad compartida). */
export async function listarCarpeta(carpetaId: string): Promise<{ ok: boolean; items: ItemDrive[]; error?: string }> {
  try {
    const d = await llamar<{ ok: boolean; items?: ItemDrive[]; error?: string }>({ accion: "listar", carpetaId });
    return { ok: !!d.ok, items: d.items || [], error: d.error };
  } catch (e: any) {
    return { ok: false, items: [], error: String(e?.message || e) };
  }
}

/** Lista TODOS los documentos bajando por todas las subcarpetas (recursivo). */
export async function listarTodo(carpetaId: string): Promise<{ ok: boolean; items: ItemDrive[]; error?: string }> {
  try {
    const d = await llamar<{ ok: boolean; items?: ItemDrive[]; error?: string }>({ accion: "listar_todo", carpetaId });
    return { ok: !!d.ok, items: d.items || [], error: d.error };
  } catch (e: any) {
    return { ok: false, items: [], error: String(e?.message || e) };
  }
}

/** Resuelve un enlace o ID pegado a un item de Drive (carpeta o archivo). */
export async function resolverEntrada(entrada: string): Promise<{ ok: boolean; item?: ItemDrive; error?: string }> {
  try {
    const d = await llamar<{ ok: boolean; item?: ItemDrive; error?: string }>({ accion: "resolver", entrada });
    return { ok: !!d.ok, item: d.item, error: d.error };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export interface Sugerencia {
  id: string;
  name: string;
  coincide: string;
}

/** Sugiere carpetas cuyo nombre contenga alguno de los textos (expediente, crédito, gar…). */
export async function sugerirCarpetas(textos: string[]): Promise<Sugerencia[]> {
  try {
    const d = await llamar<{ ok: boolean; sugerencias?: Sugerencia[] }>({ accion: "sugerir", textos });
    return d.ok ? (d.sugerencias || []) : [];
  } catch {
    return [];
  }
}

/** Arma los textos de búsqueda a partir de los datos del caso (sin duplicados ni vacíos). */
export function textosDeCaso(caso: { expediente?: string | null; no_credito?: string | null; gar_id?: string | null }): string[] {
  const brutos = [caso.expediente, caso.no_credito, caso.gar_id];
  const set = new Set<string>();
  for (const b of brutos) {
    const t = String(b || "").trim();
    if (t.length >= 3) set.add(t);
  }
  return Array.from(set);
}

/** Sincroniza (copia) los documentos de la carpeta de Drive al almacén del sistema. */
export async function sincronizarCarpeta(casoId: string, carpetaId: string): Promise<{ ok: boolean; copiados?: number; restantes?: number; total?: number; errores?: string[]; error?: string }> {
  try {
    const r = await fetch("/.netlify/functions/sincronizar-drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ casoId, carpetaId }),
    });
    return await r.json();
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export interface ArchivoEncontrado {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
  carpeta?: string;
}

/** Normaliza texto para comparar: minúsculas, sin acentos, sin guiones/espacios/diagonales. */
export function normaliza(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Búsqueda inteligente en Drive: carpetas y archivos que coincidan por nombre. */
export async function buscarEnDrive(texto: string): Promise<{ ok: boolean; carpetas: Unidad[]; archivos: ArchivoEncontrado[]; error?: string }> {
  try {
    const d = await llamar<{ ok: boolean; carpetas?: Unidad[]; archivos?: ArchivoEncontrado[]; error?: string }>({ accion: "buscar", texto });
    return { ok: !!d.ok, carpetas: d.carpetas || [], archivos: d.archivos || [], error: d.error };
  } catch (e: any) {
    return { ok: false, carpetas: [], archivos: [], error: String(e?.message || e) };
  }
}

export interface Copia {
  drive_id: string;
  storage_path: string;
  nombre: string | null;
  mime: string | null;
}

/** Copias ya hechas al almacén del sistema para un expediente (por caso). */
export async function listarCopias(casoId: string): Promise<Record<string, Copia>> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/drive_copia?select=drive_id,storage_path,nombre,mime&caso_id=eq.${encodeURIComponent(casoId)}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const filas: Copia[] = r.ok ? await r.json() : [];
    const mapa: Record<string, Copia> = {};
    for (const f of filas) mapa[f.drive_id] = f;
    return mapa;
  } catch {
    return {};
  }
}

/** Firma (temporalmente) los enlaces de varias copias del almacén. */
export async function firmarCopias(paths: string[]): Promise<Record<string, string>> {
  try {
    const r = await fetch("/.netlify/functions/enlace-copia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    const d = await r.json();
    return d.ok ? (d.urls || {}) : {};
  } catch {
    return {};
  }
}

/** Trae una carpeta suelta a la carpeta de su área (Paso 1: mover + renombrar). */
export async function traerCarpetaAArea(carpetaId: string, area: string, nuevoNombre: string): Promise<{ ok: boolean; carpetaId?: string; nombre?: string; requiereCopia?: boolean; error?: string }> {
  try {
    const r = await fetch("/.netlify/functions/traer-carpeta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carpetaId, area, nuevoNombre }),
    });
    return await r.json();
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export function esCarpeta(it: ItemDrive): boolean {
  return it.mimeType === CARPETA_MIME;
}

/** Enlace embebible (/preview) para cualquier archivo de Drive por su id. */
export function previewDeId(id: string): string {
  return `https://drive.google.com/file/d/${id}/preview`;
}

/** Etiqueta corta del tipo de archivo, para mostrar en la tarjeta. */
export function tipoLegible(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m === CARPETA_MIME) return "Carpeta";
  if (m.includes("pdf")) return "PDF";
  if (m.includes("image")) return "Imagen";
  if (m.includes("wordprocessingml") || m.includes("msword") || m.includes("google-apps.document")) return "Word";
  if (m.includes("spreadsheet") || m.includes("excel")) return "Excel";
  if (m.includes("presentation") || m.includes("powerpoint")) return "Diapositivas";
  if (m.includes("video")) return "Video";
  if (m.includes("text")) return "Texto";
  return "Archivo";
}

// JusticiaFácil · Carpetas físicas — el folio único de cada carpeta real de
// papel, y su relación con el asunto (UCM/UCP/UDP/UFC).
//
// El folio se arma reutilizando el folio que YA existe en el sistema para
// ese asunto (así viaja con el caso cuando pasa de UCP a UCM), más un
// desambiguador corto — porque en la base real hay folios repetidos.
//
//   CARP-{código de sucursal}-{folio del sistema}-{4 chars del id del caso}
//   Ej.  CARP-CUL-00-150-a828

import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// Código corto por sucursal REAL (coincide exacto con el nombre en la tabla `sucursales`).
// Antes esto solo tenía nombres de ciudad ("Culiacán"), que nunca coincidían con el
// nombre real de la sucursal ("Jurídico Culiacán") — las 4 sucursales de Jurídico
// (Culiacán/GDL/Mazatlán/La Paz) caían todas al mismo prefijo genérico "JUR".
const CODIGO_SUCURSAL: Record<string, string> = {
  "Ventas Culiacán": "VCUL",
  "Jurídico Culiacán": "JCUL",
  "Ventas GDL": "VGDL",
  "Jurídico GDL": "JGDL",
  "Ventas Mazatlán": "VMAZ",
  "Jurídico Mazatlán": "JMAZ",
  "Atención al Cliente Mazatlán": "ATC",
  "Ventas La Paz": "VLAP",
  "Jurídico La Paz": "JLAP",
};

export interface CarpetaFisica {
  id: string;
  folio: string;
  sucursal: string;
  unidad: string;
  clienteNombre: string | null;
  direccion: string | null;
  creadoPor: string | null;
  createdAt: string;
  portadaImpresa: boolean;
  portadaImpresaEn: string | null;
  casoJuridicoId: string | null;
  casoUdpId: string | null;
  formalizacionId: string | null;
}

async function sb<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, { headers });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

async function correoActual(): Promise<string | null> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

function fila(f: any): CarpetaFisica {
  return {
    id: f.id,
    folio: f.folio,
    sucursal: f.sucursal,
    unidad: f.unidad,
    clienteNombre: f.cliente_nombre,
    direccion: f.direccion,
    creadoPor: f.creado_por,
    createdAt: f.created_at,
    portadaImpresa: !!f.portada_impresa,
    portadaImpresaEn: f.portada_impresa_en,
    casoJuridicoId: f.caso_juridico_id,
    casoUdpId: f.caso_udp_id,
    formalizacionId: f.formalizacion_id,
  };
}

/** Genera el folio de carpeta a partir del folio ya existente del asunto en el sistema. */
export function generarFolioCarpeta(sucursal: string, folioDelSistema: string | null, casoId: string): string {
  const codigo = CODIGO_SUCURSAL[sucursal] || sucursal.slice(0, 3).toUpperCase();
  const base = (folioDelSistema || "SIN-FOLIO").trim();
  const desambiguador = casoId.replace(/-/g, "").slice(0, 4);
  return `CARP-${codigo}-${base}-${desambiguador}`;
}

/** Ya existe una carpeta para este asunto? (para no crear una segunda sin querer). */
export async function carpetaDeAsunto(asunto: AsuntoUnificado): Promise<CarpetaFisica | null> {
  const campoId = asunto.unidad === "UDP" ? "caso_udp_id" : asunto.unidad === "UFC" ? "formalizacion_id" : "caso_juridico_id";
  const idParaBuscar = asunto.unidad === "UDP" || asunto.unidad === "UFC" ? asunto.id : asunto.casoJuridicoId;
  if (!idParaBuscar) return null;
  const filas = await sb<any>("carpetas_fisicas", `select=*&${campoId}=eq.${idParaBuscar}&limit=1`);
  return filas[0] ? fila(filas[0]) : null;
}

/** Todas las carpetas de una sucursal (para el selector visual). */
export async function listarCarpetasDeSucursal(sucursal: string): Promise<CarpetaFisica[]> {
  const filas = await sb<any>("carpetas_fisicas", `select=*&sucursal=eq.${encodeURIComponent(sucursal)}&order=created_at.desc&limit=100`);
  return filas.map(fila);
}

/** Crea la carpeta física para un asunto — genera el folio solo, no se le pide al usuario. */
export async function crearCarpeta(asunto: AsuntoUnificado, sucursal: string, folioDelSistema: string | null): Promise<CarpetaFisica | null> {
  const folio = generarFolioCarpeta(sucursal, folioDelSistema, asunto.id);
  const creadoPor = await correoActual();

  const cuerpo: Record<string, any> = {
    folio,
    sucursal,
    unidad: asunto.unidad,
    caso_juridico_id: asunto.unidad === "UCM" || asunto.unidad === "UCP" ? asunto.id : (asunto.unidad === "UFC" ? asunto.casoJuridicoId : null),
    caso_udp_id: asunto.unidad === "UDP" ? asunto.id : null,
    formalizacion_id: asunto.unidad === "UFC" ? asunto.id : null,
    cliente_nombre: asunto.cliente,
    direccion: asunto.direccion,
    creado_por: creadoPor,
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/carpetas_fisicas`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) return null;
  const filas = await r.json();
  return filas[0] ? fila(filas[0]) : null;
}

/** Marca que la portada ya se imprimió y se pegó en la carpeta real. */
export async function marcarPortadaImpresa(carpetaId: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/carpetas_fisicas?id=eq.${carpetaId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ portada_impresa: true, portada_impresa_en: new Date().toISOString() }),
  });
  return r.ok;
}

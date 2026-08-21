// ============================================================
// JusticiaFácil · Carpetas físicas
// ------------------------------------------------------------
// Una "carpeta física" es la carpeta REAL de papel que vive en el
// estante de una sucursal. Este archivo maneja todo lo que le pasa:
// crearla, ponerle folio, aperturarla y saber quién la trae.
//
// QUÉ CAMBIÓ RESPECTO A LA VERSIÓN ANTERIOR
// 1. El folio ya NO se arma con el folio del caso (había repetidos y
//    huecos). Ahora la base de datos entrega un folio propio y
//    consecutivo: CF-JCMX-26-0042. Nunca sale vacío, nunca se repite.
// 2. Al crear la carpeta se guardan los tres identificadores del
//    negocio (número de crédito, garantía y folio del contrato) para
//    que salgan impresos en la portada y se puedan buscar.
// 3. La carpeta NO se marca como aperturada si no se descargó antes
//    la portada. Es un candado a propósito.
// 4. Se registra cada movimiento físico (quién la consultó, quién se
//    la llevó, quién la devolvió) — de ahí sale el resguardo real.
// ============================================================

import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { JC_URL, jcHeaders } from "@/lib/juris-clientes";
import { getAuth } from "@/lib/auth";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

/** Qué acción hizo una persona con la carpeta de papel. */
export type AccionCarpeta = "apertura" | "consulta" | "prestamo" | "devolucion";

export interface MovimientoCarpeta {
  id: string;
  accion: AccionCarpeta;
  personaEmail: string | null;
  personaNombre: string | null;
  nota: string | null;
  createdAt: string;
}

export interface CarpetaFisica {
  id: string;
  /** Folio propio y único de la carpeta física. Ej: CF-JCMX-26-0042 */
  folioCf: string | null;
  /** Folio viejo (CARP-...). Se conserva solo para no perder el histórico. */
  folio: string;
  sucursal: string;
  unidad: string;

  // Identificadores del negocio — se imprimen en la portada.
  noCredito: string | null;
  garId: string | null;
  folioContrato: string | null;

  clienteNombre: string | null;
  direccion: string | null;
  creadoPor: string | null;
  createdAt: string;

  // Portada (el PDF con el QR que se pega en el lomo).
  portadaDescargada: boolean;
  portadaDescargadaEn: string | null;
  portadaImpresa: boolean;
  portadaImpresaEn: string | null;

  // Apertura física real.
  abiertaFisicamente: boolean;
  abiertaPor: string | null;
  abiertaEn: string | null;

  // A qué asunto pertenece (solo uno de los tres viene lleno).
  casoJuridicoId: string | null;
  casoUdpId: string | null;
  formalizacionId: string | null;
}

// ------------------------------------------------------------
// Helpers chiquitos
// ------------------------------------------------------------

async function sb<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, { headers });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

/** Correo de quien está usando el sistema en este momento. */
export async function correoActual(): Promise<string | null> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    return data.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Convierte una fila cruda de Supabase al objeto que usa la app. */
function fila(f: any): CarpetaFisica {
  return {
    id: f.id,
    folioCf: f.folio_cf ?? null,
    folio: f.folio,
    sucursal: f.sucursal,
    unidad: f.unidad,
    noCredito: f.no_credito ?? null,
    garId: f.gar_id ?? null,
    folioContrato: f.folio_contrato ?? null,
    clienteNombre: f.cliente_nombre,
    direccion: f.direccion,
    creadoPor: f.creado_por,
    createdAt: f.created_at,
    portadaDescargada: !!f.portada_descargada,
    portadaDescargadaEn: f.portada_descargada_en ?? null,
    portadaImpresa: !!f.portada_impresa,
    portadaImpresaEn: f.portada_impresa_en ?? null,
    abiertaFisicamente: !!f.abierta_fisicamente,
    abiertaPor: f.abierta_por ?? null,
    abiertaEn: f.abierta_en ?? null,
    casoJuridicoId: f.caso_juridico_id,
    casoUdpId: f.caso_udp_id,
    formalizacionId: f.formalizacion_id,
  };
}

// ------------------------------------------------------------
// Folio
// ------------------------------------------------------------

/**
 * Pide a la base de datos el siguiente folio de carpeta física.
 *
 * POR QUÉ SE PIDE A LA BASE Y NO SE ARMA AQUÍ:
 * si dos personas aperturan al mismo tiempo (Milton en CDMX y Francisca
 * en Mazatlán), el navegador no tiene forma de saber en qué número va el
 * otro. La base sí — lleva un contador por sucursal y por año, y lo
 * incrementa de forma atómica. Nunca salen dos folios iguales.
 *
 * Formato: CF-JCMX-26-0042
 *   CF   = carpeta física
 *   JCMX = sucursal
 *   26   = año
 *   0042 = consecutivo (se reinicia cada año)
 */
export async function pedirFolioCarpeta(sucursal: string): Promise<string | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/gen_folio_carpeta`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_sucursal: sucursal }),
  });
  if (!r.ok) return null;
  const folio = await r.json();
  return typeof folio === "string" ? folio : null;
}

// ------------------------------------------------------------
// Identificadores del negocio
// ------------------------------------------------------------

/**
 * Junta los tres identificadores que van impresos en la portada.
 * Los busca primero en JusticiaFácil y, lo que falte, lo completa
 * desde JurisConecta (ahí viven el folio del contrato y muchas
 * garantías que JusticiaFácil todavía no tiene capturadas).
 *
 * Si alguno no existe en ningún lado, regresa null. NO truena ni
 * bloquea: el faltante se muestra después como hoja pendiente
 * dentro del libro.
 */
export async function identificadoresDelCaso(casoJuridicoId: string | null): Promise<{
  noCredito: string | null;
  garId: string | null;
  folioContrato: string | null;
}> {
  const vacio = { noCredito: null, garId: null, folioContrato: null };
  if (!casoJuridicoId) return vacio;

  const casos = await sb<any>(
    "caso_juridico",
    `select=no_credito,gar_id,cliente_jc_id&id=eq.${casoJuridicoId}&limit=1`
  );
  const caso = casos[0];
  if (!caso) return vacio;

  // "SIN NÚMERO DE CRÉDITO" y "COMPRA A TERCEROS" son textos de relleno,
  // no números reales — se tratan como si estuvieran vacíos.
  const RELLENO = ["SIN NÚMERO DE CRÉDITO", "SIN NUMERO DE CREDITO", "COMPRA A TERCEROS"];
  const limpio = (v: any) => {
    const s = String(v ?? "").trim();
    if (!s || RELLENO.includes(s.toUpperCase())) return null;
    return s;
  };

  let noCredito = limpio(caso.no_credito);
  let garId = limpio(caso.gar_id);
  let folioContrato: string | null = null;

  // Completar desde JurisConecta si hay cliente ligado.
  if (caso.cliente_jc_id) {
    try {
      const r = await fetch(
        `${JC_URL}/rest/v1/clientes?select=garantia,folio_contrato&id=eq.${caso.cliente_jc_id}&limit=1`,
        { headers: jcHeaders }
      );
      if (r.ok) {
        const jc = (await r.json())[0];
        if (jc) {
          if (!garId) garId = limpio(jc.garantia);
          folioContrato = limpio(jc.folio_contrato);
        }
      }
    } catch {
      // Si JurisConecta no responde, seguimos con lo que ya tenemos.
    }
  }

  return { noCredito, garId, folioContrato };
}

// ------------------------------------------------------------
// Buscar y listar
// ------------------------------------------------------------

/** ¿Ya existe carpeta para este asunto? Sirve para no crear una segunda sin querer. */
export async function carpetaDeAsunto(asunto: AsuntoUnificado): Promise<CarpetaFisica | null> {
  const campoId =
    asunto.unidad === "UDP" ? "caso_udp_id" :
    asunto.unidad === "UFC" ? "formalizacion_id" :
    "caso_juridico_id";

  const idParaBuscar =
    asunto.unidad === "UDP" || asunto.unidad === "UFC" ? asunto.id : asunto.casoJuridicoId;

  if (!idParaBuscar) return null;
  const filas = await sb<any>("carpetas_fisicas", `select=*&${campoId}=eq.${idParaBuscar}&limit=1`);
  return filas[0] ? fila(filas[0]) : null;
}

/** Busca una carpeta por su folio CF — es lo que usa el QR de la portada. */
export async function carpetaPorFolio(folioCf: string): Promise<CarpetaFisica | null> {
  const filas = await sb<any>(
    "carpetas_fisicas",
    `select=*&folio_cf=eq.${encodeURIComponent(folioCf)}&limit=1`
  );
  return filas[0] ? fila(filas[0]) : null;
}

/** Todas las carpetas de una sucursal (para el estante). */
export async function listarCarpetasDeSucursal(sucursal: string): Promise<CarpetaFisica[]> {
  const filas = await sb<any>(
    "carpetas_fisicas",
    `select=*&sucursal=eq.${encodeURIComponent(sucursal)}&order=folio_cf.desc&limit=200`
  );
  return filas.map(fila);
}

// ------------------------------------------------------------
// Crear
// ------------------------------------------------------------

/**
 * Crea la carpeta física de un asunto.
 * El usuario NO escribe el folio ni los identificadores: todo se saca solo.
 */
export async function crearCarpeta(
  asunto: AsuntoUnificado,
  sucursal: string
): Promise<CarpetaFisica | null> {
  // 1. Antifallo: si ya existe carpeta para este asunto, devolvemos esa.
  //    Evita carpetas duplicadas si alguien pica el botón dos veces.
  const yaExiste = await carpetaDeAsunto(asunto);
  if (yaExiste) return yaExiste;

  // 2. Folio consecutivo desde la base.
  const folioCf = await pedirFolioCarpeta(sucursal);
  if (!folioCf) return null;

  // 3. Identificadores del negocio (lo que haya; los huecos no bloquean).
  const ident = await identificadoresDelCaso(asunto.casoJuridicoId ?? asunto.id);

  const creadoPor = await correoActual();

  const cuerpo: Record<string, any> = {
    folio_cf: folioCf,
    folio: folioCf, // la columna vieja se llena igual para no romper pantallas antiguas
    sucursal,
    unidad: asunto.unidad,
    caso_juridico_id:
      asunto.unidad === "UCM" || asunto.unidad === "UCP" ? asunto.id :
      asunto.unidad === "UFC" ? asunto.casoJuridicoId : null,
    caso_udp_id: asunto.unidad === "UDP" ? asunto.id : null,
    formalizacion_id: asunto.unidad === "UFC" ? asunto.id : null,
    cliente_nombre: asunto.cliente,
    direccion: asunto.direccion,
    no_credito: ident.noCredito,
    gar_id: ident.garId,
    folio_contrato: ident.folioContrato,
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

// ------------------------------------------------------------
// Portada y apertura física
// ------------------------------------------------------------

/**
 * Marca que la portada ya se descargó.
 * La llama la pantalla JUSTO DESPUÉS de que el PDF se generó bien.
 * Sin esto, la carpeta no se puede aperturar.
 */
export async function registrarDescargaPortada(carpetaId: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/carpetas_fisicas?id=eq.${carpetaId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      portada_descargada: true,
      portada_descargada_en: new Date().toISOString(),
    }),
  });
  return r.ok;
}

/** Marca que la portada ya se imprimió y se pegó en la carpeta real. */
export async function marcarPortadaImpresa(carpetaId: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/carpetas_fisicas?id=eq.${carpetaId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      portada_impresa: true,
      portada_impresa_en: new Date().toISOString(),
    }),
  });
  return r.ok;
}

/** Resultado de intentar aperturar — si falla, dice por qué en lenguaje normal. */
export type ResultadoApertura =
  | { ok: true; carpeta: CarpetaFisica }
  | { ok: false; motivo: string };

/**
 * Confirma que la carpeta ya se abrió físicamente de verdad.
 *
 * EL CANDADO: se relee la carpeta desde la base antes de escribir. Si la
 * portada no está descargada, no se apertura. Se relee (en vez de confiar
 * en lo que trae la pantalla) porque la pantalla puede estar desactualizada
 * si alguien más ya movió la carpeta desde otra computadora.
 */
export async function confirmarAperturaFisica(carpetaId: string): Promise<ResultadoApertura> {
  const actuales = await sb<any>("carpetas_fisicas", `select=*&id=eq.${carpetaId}&limit=1`);
  const actual = actuales[0];
  if (!actual) return { ok: false, motivo: "No se encontró la carpeta." };

  if (actual.abierta_fisicamente) {
    return { ok: false, motivo: "Esta carpeta ya estaba aperturada." };
  }
  if (!actual.portada_descargada) {
    return { ok: false, motivo: "Primero descarga la portada — es obligatoria para aperturar." };
  }

  const correo = await correoActual();

  const r = await fetch(`${SUPABASE_URL}/rest/v1/carpetas_fisicas?id=eq.${carpetaId}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      abierta_fisicamente: true,
      abierta_por: correo,
      abierta_en: new Date().toISOString(),
    }),
  });
  if (!r.ok) return { ok: false, motivo: "No se pudo guardar la apertura. Intenta de nuevo." };

  // Queda registrada como el primer movimiento de la carpeta.
  await registrarMovimiento(carpetaId, "apertura", "Apertura física de la carpeta.");

  const filas = await r.json();
  return { ok: true, carpeta: fila(filas[0]) };
}

// ------------------------------------------------------------
// Movimientos — de aquí sale el resguardo real
// ------------------------------------------------------------

/**
 * Guarda un movimiento de la carpeta de papel.
 * Es lo que se dispara cuando alguien escanea el QR del lomo y elige
 * "solo la consulté", "me la llevo" o "la devuelvo".
 */
export async function registrarMovimiento(
  carpetaId: string,
  accion: AccionCarpeta,
  nota?: string
): Promise<boolean> {
  const correo = await correoActual();

  const carpetas = await sb<any>("carpetas_fisicas", `select=sucursal&id=eq.${carpetaId}&limit=1`);

  const r = await fetch(`${SUPABASE_URL}/rest/v1/carpeta_movimiento`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      carpeta_id: carpetaId,
      accion,
      persona_email: correo,
      sucursal: carpetas[0]?.sucursal ?? null,
      nota: nota ?? null,
    }),
  });
  return r.ok;
}

/** Historial de la carpeta, del movimiento más nuevo al más viejo. */
export async function movimientosDeCarpeta(carpetaId: string): Promise<MovimientoCarpeta[]> {
  const filas = await sb<any>(
    "carpeta_movimiento",
    `select=*&carpeta_id=eq.${carpetaId}&order=created_at.desc&limit=50`
  );
  return filas.map((m) => ({
    id: m.id,
    accion: m.accion,
    personaEmail: m.persona_email,
    personaNombre: m.persona_nombre,
    nota: m.nota,
    createdAt: m.created_at,
  }));
}

/**
 * Quién tiene la carpeta AHORITA.
 *
 * Antes esto era una columna que alguien tenía que escribir a mano — y por
 * eso siempre estaba vacía. Ahora se deduce del último movimiento:
 *   - último movimiento = "prestamo"  → la trae esa persona
 *   - cualquier otra cosa             → está en el estante de su sucursal
 */
export async function resguardoActual(carpetaId: string): Promise<{
  enEstante: boolean;
  personaEmail: string | null;
  desde: string | null;
}> {
  const movs = await sb<any>(
    "carpeta_movimiento",
    `select=accion,persona_email,created_at&carpeta_id=eq.${carpetaId}&order=created_at.desc&limit=1`
  );
  const ultimo = movs[0];

  if (ultimo && ultimo.accion === "prestamo") {
    return { enEstante: false, personaEmail: ultimo.persona_email, desde: ultimo.created_at };
  }
  return { enEstante: true, personaEmail: null, desde: ultimo?.created_at ?? null };
}

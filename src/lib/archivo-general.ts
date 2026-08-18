// JusticiaFácil · Archivo General de Documentos — une en una sola búsqueda:
//   - documento_garantia  → todo lo digital, subido desde cualquier ficha
//   - documento_fisico    → inventario físico (Mazatlán y otras sedes), con o sin
//                           copia digital relacionada
//
// Busca por: folio (UCM-2026-0050), GAR-id (GAR-xxxx), número de crédito, expediente,
// dirección de la garantía, nombre del cliente, o nombre del documento — todo a la vez.
// Como folio/GAR-id/crédito/dirección/cliente viven en `caso_juridico` y NO directo en
// documento_garantia, primero se busca ahí y se usa `caso_id` como puente.
//
// También calcula la ubicación real (ciudad/estado) de cada documento, para poder
// filtrar en cascada Estado → Ciudad igual que en el resto del sistema.

import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { detectarUbicacion, type UbicacionJudicial } from "@/lib/ciudad-judicial";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export type FuenteDocumento = "digital" | "fisico";
export type EstadoBaja = "activo" | "baja_solicitada" | "baja_autorizada" | "baja_rechazada";
export type TipoCopia = "original" | "copia_certificada" | "copia_simple" | "digital_nativo";

export const TIPOS_COPIA: { value: TipoCopia; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "copia_certificada", label: "Copia certificada" },
  { value: "copia_simple", label: "Copia simple" },
  { value: "digital_nativo", label: "Digital (nunca tuvo papel)" },
];

export interface DocumentoArchivo {
  id: string;
  fuente: FuenteDocumento;
  nombre: string | null;
  cliente: string | null;
  expediente: string | null;
  folio: string | null;
  gar_id: string | null;
  no_credito: string | null;
  unidad: string | null;

  // digital
  link: string | null;
  drive_id: string | null;
  subido_por: string | null;

  // físico
  registrado_por: string | null;
  tipo_asunto: string | null;
  carpeta_fisica: string | null;

  // compartidos
  resguardo_de: string | null;
  es_fisico: boolean;
  digitalizado: boolean;
  ubicacion: UbicacionJudicial | null;
  tipo_copia: TipoCopia | null;
  copiaPendiente: boolean; // viene de drive_copia sin fila propia todavía en documento_garantia — se formaliza al usarla

  // estado del ciclo de vida (baja documental)
  estado_baja: EstadoBaja;
  baja_motivo: string | null;
  baja_solicitado_por: string | null;
  baja_resuelto_por: string | null;

  caso_juridico_id: string | null;
  created_at: string | null;
}

function esc(v: string) {
  return v.replace(/,/g, " ").trim();
}

async function sb<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, { headers });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

/** Busca en el Archivo General por folio / GAR-id / crédito / expediente / dirección / cliente / nombre del documento. */
export async function buscarArchivoGeneral(termino: string): Promise<DocumentoArchivo[]> {
  const t = esc(termino);
  if (t.length < 2) return [];
  const like = `*${t}*`;

  // 1) Caso base: encuentra los expedientes que coinciden por folio/gar_id/crédito/dirección/cliente.
  const casos = await sb<any>(
    "caso_juridico",
    `select=id,unidad,cliente_nombre,expediente,folio,gar_id,no_credito,direccion_garantia,entidad,juzgado,distrito_judicial&or=(folio.ilike.${like},gar_id.ilike.${like},no_credito.ilike.${like},expediente.ilike.${like},direccion_garantia.ilike.${like},cliente_nombre.ilike.${like})&limit=40`
  );
  const casoPorId = new Map(casos.map((c: any) => [c.id, c]));
  const ubicacionPorCaso = new Map(casos.map((c: any) => [c.id, detectarUbicacion(c)]));
  const casoIds = casos.map((c: any) => c.id);

  // 2) Documentos digitales: por caso_id (de los casos encontrados) o por nombre directo.
  const [porCaso, porNombre] = await Promise.all([
    casoIds.length > 0
      ? sb<any>("documento_garantia", `select=*&caso_id=in.(${casoIds.join(",")})&en_papelera=eq.false&limit=100`)
      : Promise.resolve([]),
    sb<any>("documento_garantia", `select=*&nombre.ilike.${like}&en_papelera=eq.false&limit=40`),
  ]);
  const digitalesMap = new Map<string, any>();
  for (const d of [...porCaso, ...porNombre]) digitalesMap.set(d.id, d);

  // 3) Documentos físicos: por sus propios campos, o por caso_juridico_id (de los casos encontrados).
  const [fisicosDirecto, fisicosPorCaso] = await Promise.all([
    sb<any>(
      "documento_fisico",
      `select=*&or=(cliente_nombre.ilike.${like},expediente.ilike.${like},nombre_documento.ilike.${like},carpeta_fisica.ilike.${like})&en_papelera=eq.false&limit=40`
    ),
    casoIds.length > 0 ? sb<any>("documento_fisico", `select=*&caso_juridico_id=in.(${casoIds.join(",")})&en_papelera=eq.false&limit=40`) : Promise.resolve([]),
  ]);
  const fisicosMap = new Map<string, any>();
  for (const f of [...fisicosDirecto, ...fisicosPorCaso]) fisicosMap.set(f.id, f);

  const resultado: DocumentoArchivo[] = [];

  for (const d of digitalesMap.values()) {
    const caso = d.caso_id ? casoPorId.get(d.caso_id) : null;
    const ubicacionCaso = d.caso_id ? ubicacionPorCaso.get(d.caso_id) : null;
    const ubicacionPropia: UbicacionJudicial | null = d.es_fisico && d.sede ? detectarUbicacion({ distrito_judicial: d.sede }) : null;
    resultado.push({
      id: d.id,
      fuente: "digital",
      nombre: d.nombre,
      cliente: caso?.cliente_nombre ?? null,
      expediente: d.expediente ?? caso?.expediente ?? null,
      folio: caso?.folio ?? null,
      gar_id: caso?.gar_id ?? null,
      no_credito: caso?.no_credito ?? null,
      unidad: caso?.unidad ?? null,
      link: d.link,
      drive_id: d.drive_id,
      subido_por: d.subido_por,
      registrado_por: null,
      tipo_asunto: null,
      carpeta_fisica: d.carpeta_fisica ?? null,
      resguardo_de: d.resguardo_de ?? d.asignado_a ?? null,
      es_fisico: !!d.es_fisico,
      digitalizado: true,
      ubicacion: ubicacionPropia || ubicacionCaso || null,
      tipo_copia: (d.tipo_copia as TipoCopia) ?? null,
      copiaPendiente: false,
      estado_baja: (d.estado_baja as EstadoBaja) || "activo",
      baja_motivo: d.baja_motivo ?? null,
      baja_solicitado_por: d.baja_solicitado_por ?? null,
      baja_resuelto_por: d.baja_resuelto_por ?? null,
      caso_juridico_id: d.caso_id,
      created_at: d.created_at ?? null,
    });
  }

  for (const f of fisicosMap.values()) {
    if (f.digitalizado && f.documento_garantia_id && digitalesMap.has(f.documento_garantia_id)) continue; // ya se muestra como digital
    const caso = f.caso_juridico_id ? casoPorId.get(f.caso_juridico_id) : null;
    const ubicacionCaso = f.caso_juridico_id ? ubicacionPorCaso.get(f.caso_juridico_id) : null;
    const ubicacionPropia = f.ubicacion ? detectarUbicacion({ distrito_judicial: f.ubicacion }) : null;
    resultado.push({
      id: f.id,
      fuente: "fisico",
      nombre: f.nombre_documento,
      cliente: f.cliente_nombre ?? caso?.cliente_nombre ?? null,
      expediente: f.expediente ?? caso?.expediente ?? null,
      folio: caso?.folio ?? null,
      gar_id: caso?.gar_id ?? null,
      no_credito: caso?.no_credito ?? null,
      unidad: f.unidad,
      link: null,
      drive_id: null,
      subido_por: null,
      registrado_por: f.registrado_por,
      tipo_asunto: f.tipo_asunto,
      carpeta_fisica: f.carpeta_fisica,
      resguardo_de: f.resguardo_de,
      es_fisico: true,
      digitalizado: !!f.digitalizado,
      ubicacion: ubicacionPropia || ubicacionCaso || null,
      tipo_copia: (f.tipo_copia as TipoCopia) ?? null,
      copiaPendiente: false,
      estado_baja: (f.estado_baja as EstadoBaja) || "activo",
      baja_motivo: f.baja_motivo ?? null,
      baja_solicitado_por: f.baja_solicitado_por ?? null,
      baja_resuelto_por: f.baja_resuelto_por ?? null,
      caso_juridico_id: f.caso_juridico_id,
      created_at: f.fecha_registro ?? f.created_at ?? null,
    });
  }

  // más reciente primero
  resultado.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return resultado;
}

// ===== Rol del usuario en sesión (mismo patrón que permisos-acciones.ts) =====

import { getAuth } from "@/lib/auth";

const ROLES_APRUEBAN_BAJA = ["DIL", "DGE", "Super_Admin"];

/** Rol del correo en sesión, según `colaboradores`. null si no hay sesión o no está dado de alta. */
export async function rolActual(): Promise<string | null> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) return null;
    const r = await sb<any>("colaboradores", `select=rol&correo=eq.${encodeURIComponent(correo)}`);
    return r?.[0]?.rol ?? null;
  } catch {
    return null;
  }
}

export function puedeAprobarBajas(rol: string | null): boolean {
  return !!rol && ROLES_APRUEBAN_BAJA.includes(rol);
}

async function correoActual(): Promise<string | null> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    return data?.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

const writeHeaders = { ...headers, "Content-Type": "application/json", Prefer: "return=representation" };
const tablaDe = (doc: DocumentoArchivo) => (doc.fuente === "digital" ? "documento_garantia" : "documento_fisico");

/** Todos los documentos de UN solo asunto — digitales, copiados del Drive sin formalizar,
 *  y físicos — para la ficha completa (vista en vivo). No busca por texto: trae todo. */
export async function documentosDeAsunto(asunto: {
  unidad: string;
  id: string;
  casoJuridicoId: string | null;
}): Promise<DocumentoArchivo[]> {
  const { listarCopias, firmarCopias } = await import("@/lib/drive-explorar");
  const resultado: DocumentoArchivo[] = [];

  let caso: any = null;
  let ubicacionCaso: UbicacionJudicial | null = null;
  if (asunto.casoJuridicoId) {
    const c = await sb<any>("caso_juridico", `select=*&id=eq.${asunto.casoJuridicoId}`);
    caso = c[0] ?? null;
    if (caso) ubicacionCaso = detectarUbicacion(caso);
  }

  const driveIdYaVistos = new Set<string>();

  if (asunto.casoJuridicoId) {
    const digitales = await sb<any>("documento_garantia", `select=*&caso_id=eq.${asunto.casoJuridicoId}&en_papelera=eq.false&order=created_at.desc`);
    for (const d of digitales) {
      if (d.drive_id) driveIdYaVistos.add(d.drive_id);
      resultado.push({
        id: d.id, fuente: "digital", nombre: d.nombre, cliente: caso?.cliente_nombre ?? null,
        expediente: d.expediente ?? caso?.expediente ?? null, folio: caso?.folio ?? null, gar_id: caso?.gar_id ?? null,
        no_credito: caso?.no_credito ?? null, unidad: caso?.unidad ?? asunto.unidad, link: d.link, drive_id: d.drive_id,
        subido_por: d.subido_por, registrado_por: null, tipo_asunto: null, carpeta_fisica: d.carpeta_fisica ?? null,
        resguardo_de: d.resguardo_de ?? d.asignado_a ?? null, es_fisico: !!d.es_fisico, digitalizado: true,
        ubicacion: (d.es_fisico && d.sede ? detectarUbicacion({ distrito_judicial: d.sede }) : null) || ubicacionCaso,
        tipo_copia: (d.tipo_copia as TipoCopia) ?? null, copiaPendiente: false,
        estado_baja: (d.estado_baja as EstadoBaja) || "activo", baja_motivo: d.baja_motivo ?? null,
        baja_solicitado_por: d.baja_solicitado_por ?? null, baja_resuelto_por: d.baja_resuelto_por ?? null,
        caso_juridico_id: asunto.casoJuridicoId, created_at: d.created_at ?? null,
      });
    }

    // Copias del Drive que aún no tienen su propio movimiento en documento_garantia.
    const copiasMapa = await listarCopias(asunto.casoJuridicoId);
    const copiasSueltas = Object.values(copiasMapa).filter((cp) => !driveIdYaVistos.has(cp.drive_id));
    const urls = copiasSueltas.length > 0 ? await firmarCopias(copiasSueltas.map((cp) => cp.storage_path)) : {};
    for (const cp of copiasSueltas) {
      resultado.push({
        id: `copia:${cp.drive_id}`, fuente: "digital", nombre: cp.nombre, cliente: caso?.cliente_nombre ?? null,
        expediente: caso?.expediente ?? null, folio: caso?.folio ?? null, gar_id: caso?.gar_id ?? null,
        no_credito: caso?.no_credito ?? null, unidad: caso?.unidad ?? asunto.unidad, link: urls[cp.storage_path] || null,
        drive_id: cp.drive_id, subido_por: null, registrado_por: null, tipo_asunto: null, carpeta_fisica: null,
        resguardo_de: null, es_fisico: false, digitalizado: true, ubicacion: ubicacionCaso,
        tipo_copia: null, copiaPendiente: true,
        estado_baja: "activo", baja_motivo: null, baja_solicitado_por: null, baja_resuelto_por: null,
        caso_juridico_id: asunto.casoJuridicoId, created_at: null,
      });
    }
  }

  // Inventario físico — según a qué tabla base pertenece la unidad.
  const campoId = asunto.unidad === "UDP" ? "caso_udp_id" : asunto.unidad === "UFC" ? "formalizacion_id" : "caso_juridico_id";
  const idParaFisico = asunto.unidad === "UDP" || asunto.unidad === "UFC" ? asunto.id : asunto.casoJuridicoId;
  if (idParaFisico) {
    const fisicos = await sb<any>("documento_fisico", `select=*&${campoId}=eq.${idParaFisico}&en_papelera=eq.false&order=fecha_registro.desc`);
    for (const f of fisicos) {
      if (f.digitalizado && f.documento_garantia_id) continue; // ya se ve como digital arriba
      resultado.push({
        id: f.id, fuente: "fisico", nombre: f.nombre_documento, cliente: f.cliente_nombre ?? caso?.cliente_nombre ?? null,
        expediente: f.expediente ?? caso?.expediente ?? null, folio: caso?.folio ?? null, gar_id: caso?.gar_id ?? null,
        no_credito: caso?.no_credito ?? null, unidad: f.unidad, link: null, drive_id: null, subido_por: null,
        registrado_por: f.registrado_por, tipo_asunto: f.tipo_asunto, carpeta_fisica: f.carpeta_fisica,
        resguardo_de: f.resguardo_de, es_fisico: true, digitalizado: !!f.digitalizado,
        ubicacion: (f.ubicacion ? detectarUbicacion({ distrito_judicial: f.ubicacion }) : null) || ubicacionCaso,
        tipo_copia: (f.tipo_copia as TipoCopia) ?? null, copiaPendiente: false,
        estado_baja: (f.estado_baja as EstadoBaja) || "activo", baja_motivo: f.baja_motivo ?? null,
        baja_solicitado_por: f.baja_solicitado_por ?? null, baja_resuelto_por: f.baja_resuelto_por ?? null,
        caso_juridico_id: f.caso_juridico_id ?? null, created_at: f.fecha_registro ?? null,
      });
    }
  }

  resultado.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return resultado;
}
export async function solicitarBaja(doc: DocumentoArchivo, motivo: string): Promise<boolean> {
  const correo = await correoActual();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tablaDe(doc)}?id=eq.${doc.id}`, {
    method: "PATCH",
    headers: writeHeaders,
    body: JSON.stringify({
      estado_baja: "baja_solicitada",
      baja_motivo: motivo,
      baja_solicitado_por: correo,
      baja_solicitado_en: new Date().toISOString(),
      baja_resuelto_por: null,
      baja_resuelto_en: null,
      baja_motivo_rechazo: null,
    }),
  });
  return r.ok;
}

/** Solo DIL/DGE deberían llamar esto (la pantalla ya oculta el botón a quien no puede). */
export async function resolverBaja(doc: DocumentoArchivo, autorizar: boolean, motivoRechazo?: string): Promise<boolean> {
  const correo = await correoActual();
  const cambios: Record<string, any> = {
    estado_baja: autorizar ? "baja_autorizada" : "activo", // rechazada → vuelve a estar activo y disponible
    baja_resuelto_por: correo,
    baja_resuelto_en: new Date().toISOString(),
    baja_motivo_rechazo: autorizar ? null : (motivoRechazo || "Rechazada sin motivo especificado"),
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tablaDe(doc)}?id=eq.${doc.id}`, { method: "PATCH", headers: writeHeaders, body: JSON.stringify(cambios) });
  if (!r.ok) return false;
  // Si se autorizó, de una vez se manda a papelera (nunca se borra duro).
  if (autorizar) {
    await fetch(`${SUPABASE_URL}/rest/v1/${tablaDe(doc)}?id=eq.${doc.id}`, {
      method: "PATCH",
      headers: writeHeaders,
      body: JSON.stringify({ en_papelera: true, papelera_fecha: new Date().toISOString() }),
    });
  }
  return true;
}

/** Lista las solicitudes de baja pendientes (para el panel que solo ve DIL/DGE). */
export async function listarBajasPendientes(): Promise<DocumentoArchivo[]> {
  const [dg, df] = await Promise.all([
    sb<any>("documento_garantia", `select=*&estado_baja=eq.baja_solicitada&en_papelera=eq.false&order=baja_solicitado_en.desc`),
    sb<any>("documento_fisico", `select=*&estado_baja=eq.baja_solicitada&en_papelera=eq.false&order=baja_solicitado_en.desc`),
  ]);
  const casoIds = [...new Set([...dg.map((d: any) => d.caso_id), ...df.map((d: any) => d.caso_juridico_id)].filter(Boolean))];
  const casos = casoIds.length > 0 ? await sb<any>("caso_juridico", `select=id,cliente_nombre,expediente,folio,gar_id,no_credito&id=in.(${casoIds.join(",")})`) : [];
  const casoPorId = new Map(casos.map((c: any) => [c.id, c]));

  const resultado: DocumentoArchivo[] = [];
  for (const d of dg) {
    const caso = d.caso_id ? casoPorId.get(d.caso_id) : null;
    resultado.push({
      id: d.id, fuente: "digital", nombre: d.nombre, cliente: caso?.cliente_nombre ?? null,
      expediente: d.expediente ?? caso?.expediente ?? null, folio: caso?.folio ?? null, gar_id: caso?.gar_id ?? null,
      no_credito: caso?.no_credito ?? null, unidad: caso?.unidad ?? null, link: d.link, drive_id: d.drive_id,
      subido_por: d.subido_por, registrado_por: null, tipo_asunto: null, carpeta_fisica: d.carpeta_fisica ?? null,
      resguardo_de: d.resguardo_de ?? d.asignado_a ?? null, es_fisico: !!d.es_fisico, digitalizado: true, ubicacion: null,
      tipo_copia: (d.tipo_copia as TipoCopia) ?? null, copiaPendiente: false,
      estado_baja: d.estado_baja, baja_motivo: d.baja_motivo, baja_solicitado_por: d.baja_solicitado_por,
      baja_resuelto_por: d.baja_resuelto_por, caso_juridico_id: d.caso_id, created_at: d.baja_solicitado_en ?? d.created_at,
    });
  }
  for (const f of df) {
    const caso = f.caso_juridico_id ? casoPorId.get(f.caso_juridico_id) : null;
    resultado.push({
      id: f.id, fuente: "fisico", nombre: f.nombre_documento, cliente: f.cliente_nombre ?? caso?.cliente_nombre ?? null,
      expediente: f.expediente ?? caso?.expediente ?? null, folio: caso?.folio ?? null, gar_id: caso?.gar_id ?? null,
      no_credito: caso?.no_credito ?? null, unidad: f.unidad, link: null, drive_id: null, subido_por: null,
      registrado_por: f.registrado_por, tipo_asunto: f.tipo_asunto, carpeta_fisica: f.carpeta_fisica,
      resguardo_de: f.resguardo_de, es_fisico: true, digitalizado: !!f.digitalizado, ubicacion: null,
      tipo_copia: (f.tipo_copia as TipoCopia) ?? null, copiaPendiente: false,
      estado_baja: f.estado_baja, baja_motivo: f.baja_motivo, baja_solicitado_por: f.baja_solicitado_por,
      baja_resuelto_por: f.baja_resuelto_por, caso_juridico_id: f.caso_juridico_id, created_at: f.baja_solicitado_en ?? f.fecha_registro,
    });
  }
  resultado.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return resultado;
}

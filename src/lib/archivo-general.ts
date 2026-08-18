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
      `select=*&or=(cliente_nombre.ilike.${like},expediente.ilike.${like},nombre_documento.ilike.${like},carpeta_fisica.ilike.${like})&limit=40`
    ),
    casoIds.length > 0 ? sb<any>("documento_fisico", `select=*&caso_juridico_id=in.(${casoIds.join(",")})&limit=40`) : Promise.resolve([]),
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

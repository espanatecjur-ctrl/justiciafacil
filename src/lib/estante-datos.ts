// JusticiaFácil · Estante — junta las carpetas físicas con todo lo que necesita
// el distintivo visual: código real de JurisConecta, si está concluido, si tiene
// convenio (RDC), actor/demandado, y si ya se confirmó su apertura física.

import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { JC_URL, jcHeaders } from "@/lib/juris-clientes";
import { detectarUbicacion, type UbicacionJudicial } from "@/lib/ciudad-judicial";
import { calcularDistintivo, type DistintivoVisual, type UnidadAsuntoColor } from "@/lib/estante-colores";
import type { CarpetaFisica } from "@/lib/carpetas-fisicas";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function sb<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, { headers });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}
async function sbJC<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${JC_URL}/rest/v1/${tabla}?${query}`, { headers: jcHeaders });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

// Con 505 carpetas, un solo "id=in.(uuid1,uuid2,...)" arma una URL de ~18,000
// caracteres — muchos servidores la rechazan (o se cuelga sin avisar). Se
// parte en lotes de 80 ids por consulta y se juntan los resultados.
const TAMANO_LOTE = 80;

async function sbEnLotes<T = any>(fuente: "sistema" | "jc", tabla: string, selectYFiltros: string, campoId: string, ids: (string | number)[]): Promise<T[]> {
  if (ids.length === 0) return [];
  const fn = fuente === "sistema" ? sb : sbJC;
  const lotes: (string | number)[][] = [];
  for (let i = 0; i < ids.length; i += TAMANO_LOTE) lotes.push(ids.slice(i, i + TAMANO_LOTE));

  const resultados = await Promise.all(
    lotes.map((lote) => fn<T>(tabla, `${selectYFiltros}&${campoId}=in.(${lote.join(",")})`))
  );
  return resultados.flat();
}

export interface CarpetaConDistintivo {
  carpeta: CarpetaFisica;
  distintivo: DistintivoVisual;
  cliente: string | null;
  direccion: string | null;
  garId: string | null;
  noCredito: string | null;
  expediente: string | null;
  ubicacion: UbicacionJudicial | null;
  unidad: string;
  asuntoId: string; // id del caso_juridico/caso_udp/formalizacion, para navegar a la ficha
}

/** Trae TODAS las carpetas ligadas a caso_juridico (UCM/UCP), con su distintivo ya calculado. */
export async function cargarCarpetasUcmUcp(): Promise<CarpetaConDistintivo[]> {
  try {
    const carpetas = await sb<any>("carpetas_fisicas", `select=*&caso_juridico_id=not.is.null&order=created_at.desc&limit=1000`);
    if (carpetas.length === 0) return [];

  const casoIds = [...new Set(carpetas.map((c) => c.caso_juridico_id))];
  const casos = await sbEnLotes<any>(
    "sistema", "caso_juridico",
    "select=id,unidad,tipo_registro,pasa_a_ucm,cliente_nombre,cliente_jc_id,direccion_garantia,gar_id,no_credito,expediente,entidad,juzgado,distrito_judicial,terminado,actor,demandado",
    "id", casoIds
  );
  const casoPorId = new Map(casos.map((c: any) => [c.id, c]));

  // Códigos reales — vienen de JurisConecta, vía cliente_jc_id.
  const clienteIds = [...new Set(casos.map((c: any) => c.cliente_jc_id).filter(Boolean))];
  const clientes = await sbEnLotes<any>("jc", "clientes", "select=id,codigo", "id", clienteIds);
  const codigoPorCliente = new Map(clientes.map((c: any) => [c.id, c.codigo]));

  // Datos de devolución (RDC) — fecha de cierre real y convenio, también de JurisConecta.
  const clienteIdsRdc = casos.filter((c: any) => codigoPorCliente.get(c.cliente_jc_id) === "RDC").map((c: any) => c.cliente_jc_id);
  const devoluciones = await sbEnLotes<any>("jc", "compensacion_devolucion", "select=cliente_id,fecha_cierre_real,doc_convenio", "cliente_id", clienteIdsRdc);
  const devolucionPorCliente = new Map(devoluciones.map((d: any) => [d.cliente_id, d]));

  const resultado: CarpetaConDistintivo[] = [];
  for (const cp of carpetas) {
    const caso = casoPorId.get(cp.caso_juridico_id);
    if (!caso) continue;
    if (["amparo", "recurso", "exhorto"].includes(caso.tipo_registro || "juicio")) continue; // esas no cuentan como UCM/UCP

    const unidad: UnidadAsuntoColor = String(caso.unidad || "").toUpperCase().includes("UCP") && !caso.pasa_a_ucm ? "UCP" : "UCM";
    const codigo = codigoPorCliente.get(caso.cliente_jc_id) ?? null;
    const dev = devolucionPorCliente.get(caso.cliente_jc_id);

    const distintivo = calcularDistintivo({
      unidad, codigo, tieneCliente: !!caso.cliente_nombre,
      terminado: caso.terminado, fechaCierreReal: dev?.fecha_cierre_real ?? null,
      actor: caso.actor, demandado: caso.demandado,
      tieneConvenio: dev ? !!dev.doc_convenio : null,
      abiertaFisicamente: cp.abierta_fisicamente,
    });

    resultado.push({
      carpeta: {
        id: cp.id, folio: cp.folio, sucursal: cp.sucursal, unidad: cp.unidad,
        clienteNombre: cp.cliente_nombre, direccion: cp.direccion, creadoPor: cp.creado_por,
        createdAt: cp.created_at, portadaImpresa: !!cp.portada_impresa, portadaImpresaEn: cp.portada_impresa_en,
        casoJuridicoId: cp.caso_juridico_id, casoUdpId: cp.caso_udp_id, formalizacionId: cp.formalizacion_id,
      },
      distintivo,
      cliente: caso.cliente_nombre,
      direccion: caso.direccion_garantia,
      garId: caso.gar_id,
      noCredito: caso.no_credito,
      expediente: caso.expediente,
      ubicacion: detectarUbicacion(caso),
      unidad,
      asuntoId: caso.id,
    });
  }
  return resultado;
  } catch (e) {
    console.error("cargarCarpetasUcmUcp falló:", e);
    return [];
  }
}

/**
 * Trae los asuntos de UDP directo de caso_udp — a diferencia de UCM/UCP, aquí NO se
 * asume que existe una carpeta física (esas se abren manualmente por el encargado de
 * resguardo). Si ya existe una carpeta real vinculada, se usa; si no, se muestra un
 * marcador "sin carpeta física" con el mismo distintivo de color/tipo.
 */
export async function cargarCarpetasUdp(): Promise<CarpetaConDistintivo[]> {
  try {
    const casos = await sb<any>("caso_udp", `select=id,tipo,cliente,contraparte,posicion,domicilio,sede,abogado,estatus,created_at&order=created_at.desc&limit=1000`);
    if (casos.length === 0) return [];

    const casoIds = casos.map((c: any) => c.id);
    const carpetasReales = await sbEnLotes<any>("sistema", "carpetas_fisicas", "select=id,folio,sucursal,caso_udp_id,abierta_fisicamente,portada_impresa,portada_impresa_en,creado_por,created_at", "caso_udp_id", casoIds);
    const carpetaPorCasoUdp = new Map(carpetasReales.map((c: any) => [c.caso_udp_id, c]));

    const resultado: CarpetaConDistintivo[] = [];
    for (const caso of casos) {
      const distintivo = calcularDistintivo({
        unidad: "UDP",
        tipoUdp: caso.tipo,
        tieneCliente: !!caso.cliente,
        posicionUdp: caso.posicion,
        abiertaFisicamente: carpetaPorCasoUdp.get(caso.id)?.abierta_fisicamente ?? false,
      });

      const carpetaReal = carpetaPorCasoUdp.get(caso.id);
      const ubicacion = detectarUbicacion({ distrito_judicial: caso.domicilio || caso.sede, juzgado: null, entidad: caso.sede });

      resultado.push({
        carpeta: carpetaReal ? {
          id: carpetaReal.id, folio: carpetaReal.folio, sucursal: carpetaReal.sucursal, unidad: "UDP",
          clienteNombre: caso.cliente, direccion: caso.domicilio, creadoPor: carpetaReal.creado_por,
          createdAt: carpetaReal.created_at, portadaImpresa: !!carpetaReal.portada_impresa, portadaImpresaEn: carpetaReal.portada_impresa_en,
          casoJuridicoId: null, casoUdpId: caso.id, formalizacionId: null,
        } : {
          // sin carpeta física real todavía — objeto "virtual" solo para que se pueda mostrar y hacer clic
          id: caso.id, folio: "Sin carpeta física", sucursal: caso.sede || "Sin sucursal", unidad: "UDP",
          clienteNombre: caso.cliente, direccion: caso.domicilio, creadoPor: null,
          createdAt: caso.created_at, portadaImpresa: false, portadaImpresaEn: null,
          casoJuridicoId: null, casoUdpId: caso.id, formalizacionId: null,
        },
        distintivo,
        cliente: caso.cliente,
        direccion: caso.domicilio,
        garId: null,
        noCredito: null,
        expediente: null,
        ubicacion,
        unidad: "UDP",
        asuntoId: caso.id,
      });
    }
    return resultado;
  } catch (e) {
    console.error("cargarCarpetasUdp falló:", e);
    return [];
  }
}

/** Agrupa los asuntos de UDP por tipo (Penal, Civil, PROFECO…) para su pestaña. */
export function agruparPorTipoUdp(lista: CarpetaConDistintivo[]): Record<string, CarpetaConDistintivo[]> {
  const grupos: Record<string, CarpetaConDistintivo[]> = {};
  for (const item of lista) {
    const etiqueta = item.distintivo.etiqueta || "Sin tipo";
    if (!grupos[etiqueta]) grupos[etiqueta] = [];
    grupos[etiqueta].push(item);
  }
  return grupos;
}

/**
 * Trae los clientes con código RDC de JurisConecta, cruzados con su caso_juridico
 * en JusticiaFácil (si ya existe) — para poder navegar a su ficha. Solo aparecen
 * aquí los que ya tienen ese vínculo; los que aún no se investigaron no tienen
 * a dónde navegar todavía.
 */
export async function cargarCarpetasDevoluciones(): Promise<CarpetaConDistintivo[]> {
  try {
    const clientesRdc = await sbJC<any>("clientes", `select=id,nombre&codigo=eq.RDC&limit=1000`);
    if (clientesRdc.length === 0) return [];
    const idsRdc = clientesRdc.map((c: any) => c.id);

    const devoluciones = await sbEnLotes<any>("jc", "compensacion_devolucion", "select=cliente_id,doc_convenio,fecha_cierre_real,capital,estado", "cliente_id", idsRdc);
    const devPorCliente = new Map(devoluciones.map((d: any) => [String(d.cliente_id), d]));

    const casos = await sbEnLotes<any>("sistema", "caso_juridico", "select=id,cliente_jc_id,cliente_nombre,direccion_garantia,terminado,actor,demandado,entidad,juzgado,distrito_judicial,sucursal", "cliente_jc_id", idsRdc);

    const resultado: CarpetaConDistintivo[] = [];
    for (const caso of casos) {
      const dev = devPorCliente.get(String(caso.cliente_jc_id));
      const distintivo = calcularDistintivo({
        unidad: "UFC", codigo: "RDC", tieneCliente: true,
        terminado: caso.terminado, fechaCierreReal: dev?.fecha_cierre_real ?? null,
        actor: caso.actor, demandado: caso.demandado,
        tieneConvenio: dev ? !!dev.doc_convenio : false,
      });
      resultado.push({
        carpeta: {
          id: caso.id, folio: "Sin carpeta física", sucursal: caso.sucursal || "Sin sucursal", unidad: "UFC",
          clienteNombre: caso.cliente_nombre, direccion: caso.direccion_garantia, creadoPor: null,
          createdAt: new Date().toISOString(), portadaImpresa: false, portadaImpresaEn: null,
          casoJuridicoId: caso.id, casoUdpId: null, formalizacionId: null,
        },
        distintivo,
        cliente: caso.cliente_nombre,
        direccion: caso.direccion_garantia,
        garId: null, noCredito: null, expediente: null,
        ubicacion: detectarUbicacion(caso),
        unidad: "UFC",
        asuntoId: caso.id,
      });
    }
    return resultado;
  } catch (e) {
    console.error("cargarCarpetasDevoluciones falló:", e);
    return [];
  }
}

/** Agrupa las devoluciones por si ya tienen convenio firmado o no (o su estado gris si aplica). */
export function agruparPorConvenio(lista: CarpetaConDistintivo[]): Record<string, CarpetaConDistintivo[]> {
  const grupos: Record<string, CarpetaConDistintivo[]> = {};
  for (const item of lista) {
    const etiqueta = item.distintivo.etiqueta;
    if (!grupos[etiqueta]) grupos[etiqueta] = [];
    grupos[etiqueta].push(item);
  }
  return grupos;
}


export function agruparPorEstado(lista: CarpetaConDistintivo[]): Record<string, CarpetaConDistintivo[]> {
  const grupos: Record<string, CarpetaConDistintivo[]> = {};
  for (const item of lista) {
    const estado = item.ubicacion?.estado || "Sin ubicación detectada";
    if (!grupos[estado]) grupos[estado] = [];
    grupos[estado].push(item);
  }
  return grupos;
}

/** Agrupa por categoría/código (R2, R2C, R3, sin cliente…) — para las pestañas UCM y UCP. */
export function agruparPorCategoria(lista: CarpetaConDistintivo[], unidad: "UCM" | "UCP"): Record<string, CarpetaConDistintivo[]> {
  const grupos: Record<string, CarpetaConDistintivo[]> = {};
  for (const item of lista) {
    if (item.unidad !== unidad) continue;
    const etiqueta = item.distintivo.etiqueta;
    if (!grupos[etiqueta]) grupos[etiqueta] = [];
    grupos[etiqueta].push(item);
  }
  return grupos;
}

/** Confirma que la carpeta ya se abrió físicamente de verdad (no solo en el sistema). */
export async function confirmarAperturaFisica(carpetaId: string, correo: string | null): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/carpetas_fisicas?id=eq.${carpetaId}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ abierta_fisicamente: true, abierta_por: correo, abierta_en: new Date().toISOString() }),
  });
  return r.ok;
}

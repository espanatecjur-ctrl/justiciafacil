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
  const carpetas = await sb<any>("carpetas_fisicas", `select=*&caso_juridico_id=not.is.null&order=created_at.desc&limit=1000`);
  if (carpetas.length === 0) return [];

  const casoIds = [...new Set(carpetas.map((c) => c.caso_juridico_id))];
  const casos = await sb<any>("caso_juridico", `select=id,unidad,tipo_registro,pasa_a_ucm,cliente_nombre,cliente_jc_id,direccion_garantia,gar_id,no_credito,expediente,entidad,juzgado,distrito_judicial,terminado,actor,demandado&id=in.(${casoIds.join(",")})`);
  const casoPorId = new Map(casos.map((c: any) => [c.id, c]));

  // Códigos reales — vienen de JurisConecta, vía cliente_jc_id.
  const clienteIds = [...new Set(casos.map((c: any) => c.cliente_jc_id).filter(Boolean))];
  const clientes = clienteIds.length > 0 ? await sbJC<any>("clientes", `select=id,codigo&id=in.(${clienteIds.join(",")})`) : [];
  const codigoPorCliente = new Map(clientes.map((c: any) => [c.id, c.codigo]));

  // Datos de devolución (RDC) — fecha de cierre real y convenio, también de JurisConecta.
  const clienteIdsRdc = casos.filter((c: any) => codigoPorCliente.get(c.cliente_jc_id) === "RDC").map((c: any) => c.cliente_jc_id);
  const devoluciones = clienteIdsRdc.length > 0
    ? await sbJC<any>("compensacion_devolucion", `select=cliente_id,fecha_cierre_real,doc_convenio&cliente_id=in.(${clienteIdsRdc.join(",")})`)
    : [];
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
}

/** Agrupa una lista de carpetas por Estado, para la pestaña "Por Estado". */
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

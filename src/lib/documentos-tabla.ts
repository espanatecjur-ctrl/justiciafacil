// JusticiaFácil · Tabla estilo Excel de asuntos UCM/UCP, con conteo de documentos
// (digitales y físicos) por asunto. Alimenta la vista rápida de "documentos-excel".

import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { unidadDeCasoJuridico, type UnidadAsunto } from "@/lib/asuntos-busqueda";
import { detectarUbicacion, type UbicacionJudicial } from "@/lib/ciudad-judicial";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export interface AsuntoConDocs {
  id: string;
  unidad: UnidadAsunto;
  cliente: string | null;
  expediente: string | null;
  folio: string | null;
  gar_id: string | null;
  no_credito: string | null;
  direccion: string | null;
  ubicacion: UbicacionJudicial | null;
  numDigitales: number;
  numFisicos: number;
  actualizado: string | null;
}

async function sb<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, { headers });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

/** Trae todos los asuntos de UCM+UCP con su conteo de documentos digitales y físicos. */
export async function listarAsuntosConDocs(): Promise<AsuntoConDocs[]> {
  const [casos, digitales, fisicos] = await Promise.all([
    sb<any>("caso_juridico", `select=id,unidad,tipo_registro,pasa_a_ucm,cliente_nombre,expediente,folio,gar_id,no_credito,direccion_garantia,entidad,juzgado,distrito_judicial,updated_at&archivado=eq.false&order=updated_at.desc&limit=2000`),
    sb<any>("documento_garantia", `select=caso_id&en_papelera=eq.false&limit=20000`),
    sb<any>("documento_fisico", `select=caso_juridico_id&en_papelera=eq.false&limit=20000`),
  ]);

  const conteoDigital = new Map<string, number>();
  for (const d of digitales) if (d.caso_id) conteoDigital.set(d.caso_id, (conteoDigital.get(d.caso_id) || 0) + 1);
  const conteoFisico = new Map<string, number>();
  for (const f of fisicos) if (f.caso_juridico_id) conteoFisico.set(f.caso_juridico_id, (conteoFisico.get(f.caso_juridico_id) || 0) + 1);

  const resultado: AsuntoConDocs[] = [];
  for (const c of casos) {
    const unidad = unidadDeCasoJuridico(c);
    if (!unidad) continue; // solo UCM/UCP — descarta amparo/recurso/exhorto
    resultado.push({
      id: c.id,
      unidad,
      cliente: c.cliente_nombre,
      expediente: c.expediente,
      folio: c.folio,
      gar_id: c.gar_id,
      no_credito: c.no_credito,
      direccion: c.direccion_garantia,
      ubicacion: detectarUbicacion(c),
      numDigitales: conteoDigital.get(c.id) || 0,
      numFisicos: conteoFisico.get(c.id) || 0,
      actualizado: c.updated_at,
    });
  }
  return resultado;
}

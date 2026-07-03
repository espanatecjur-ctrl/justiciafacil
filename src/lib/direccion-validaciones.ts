// ============================================================
//  Dirección · validaciones positivas (dictamen final de UCP)
// ------------------------------------------------------------
//  Trae los dictámenes de UCP con veredicto POSITIVO, con la
//  ficha del expediente y un resumen del porqué pasó.
// ============================================================
import { sbSelect } from "@/lib/supabase";

export interface Validacion {
  id: string;
  caso_id: string | null;
  predictamen_id: string | null;
  expediente: string | null;
  cliente: string | null;
  garantia: string | null;
  resumen: string;         // por qué pasó (bloques del dictamen)
}

function bloque(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const o = v as { veredicto?: string };
  return typeof o.veredicto === "string" ? o.veredicto : null;
}

/** Lista los dictámenes positivos de UCP con su ficha. */
export async function listarValidacionesPositivas(): Promise<Validacion[]> {
  try {
    const dicts = await sbSelect<{ id: string; caso_id: string | null; predictamen_id: string | null; juridico: unknown; registral: unknown; contable: unknown }>(
      "dictamen",
      "select=id,caso_id,predictamen_id,juridico,registral,contable&vigente=eq.true&veredicto=eq.POSITIVO&order=id.desc",
    );
    if (!dicts.length) return [];

    const casos = await sbSelect<{ id: string; expediente: string | null; cliente_nombre: string | null; direccion_garantia: string | null }>(
      "caso_juridico",
      "select=id,expediente,cliente_nombre,direccion_garantia",
    );
    const mapa: Record<string, { expediente: string | null; cliente: string | null; garantia: string | null }> = {};
    for (const c of casos) mapa[c.id] = { expediente: c.expediente, cliente: c.cliente_nombre, garantia: c.direccion_garantia };

    return dicts.map((d) => {
      const partes: string[] = [];
      const j = bloque(d.juridico); if (j) partes.push(`Jurídico: ${j}`);
      const r = bloque(d.registral); if (r) partes.push(`Registral: ${r}`);
      const c = bloque(d.contable); if (c) partes.push(`Contable: ${c}`);
      const info = d.caso_id ? mapa[d.caso_id] : undefined;
      return {
        id: d.id,
        caso_id: d.caso_id,
        predictamen_id: d.predictamen_id,
        expediente: info?.expediente ?? null,
        cliente: info?.cliente ?? null,
        garantia: info?.garantia ?? null,
        resumen: partes.length ? partes.join(" · ") : "Dictamen aprobado en todos sus bloques.",
      };
    });
  } catch {
    return [];
  }
}

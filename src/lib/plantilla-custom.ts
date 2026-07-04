// ============================================================
//  Plantillas creadas desde la app (oficiales)
// ------------------------------------------------------------
//  La usuaria escribe el cuerpo con {{marcadores}}; se detectan
//  solos y se vuelven campos. Requiere la tabla `plantilla_custom`.
// ============================================================
import type { PlantillaContrato, PlantillaCampo } from "./contract-templates";
import type { ContratoTipo } from "./legal-types";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "./supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface FilaCustom { tipo: string; nombre: string; descripcion: string | null; campos: PlantillaCampo[] | null; cuerpo: string | null }

/** Saca los marcadores {{campo}} del cuerpo (ignora bloques {{#…}} y listas). */
export function detectarCampos(cuerpo: string): string[] {
  const set = new Set<string>();
  const re = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo)) !== null) set.add(m[1]);
  return Array.from(set);
}

/** Convierte "nombreCliente" en "Nombre cliente" para la etiqueta. */
export function humanizar(id: string): string {
  const s = id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function aPlantilla(f: FilaCustom): PlantillaContrato {
  return {
    tipo: f.tipo as ContratoTipo,
    nombre: f.nombre || "Plantilla",
    descripcion: f.descripcion || "",
    campos: f.campos || [],
    cuerpo: f.cuerpo || "",
  };
}

export async function listarPlantillasCustom(): Promise<PlantillaContrato[]> {
  try {
    const filas = await sbSelect<FilaCustom>("plantilla_custom", "select=*&order=created_at.desc");
    return filas.map(aPlantilla);
  } catch {
    return [];
  }
}

export async function obtenerPlantillaCustom(tipo: string): Promise<PlantillaContrato | null> {
  try {
    const filas = await sbSelect<FilaCustom>("plantilla_custom", `select=*&tipo=eq.${encodeURIComponent(tipo)}&limit=1`);
    return filas[0] ? aPlantilla(filas[0]) : null;
  } catch {
    return null;
  }
}

export async function crearPlantillaCustom(
  nombre: string, descripcion: string, campos: PlantillaCampo[], cuerpo: string, creadoPor?: string,
): Promise<{ ok: boolean; tipo?: string; error?: string }> {
  const tipo = "cst_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_custom`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ tipo, nombre, descripcion, campos, cuerpo, creado_por: creadoPor ?? null }),
    });
    return { ok: res.ok, tipo, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

export async function eliminarPlantillaCustom(tipo: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_custom?tipo=eq.${encodeURIComponent(tipo)}`, { method: "DELETE", headers });
    return res.ok;
  } catch {
    return false;
  }
}

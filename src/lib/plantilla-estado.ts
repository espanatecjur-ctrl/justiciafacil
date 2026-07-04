// ============================================================
//  Estado de las plantillas de contrato (activa/archivada/papelera)
//  Requiere la tabla `plantilla_estado`.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

/** Devuelve un mapa { tipo: estado } de las plantillas que NO están activas. */
export async function listarEstadosPlantilla(): Promise<Record<string, string>> {
  try {
    const filas = await sbSelect<{ tipo: string; estado: string }>("plantilla_estado", "select=tipo,estado");
    const m: Record<string, string> = {};
    for (const f of filas) if (f.tipo) m[f.tipo] = f.estado || "activa";
    return m;
  } catch {
    return {};
  }
}

/** Fija el estado de una plantilla (upsert por tipo). */
export async function setEstadoPlantilla(tipo: string, estado: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_estado`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ tipo, estado, updated_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

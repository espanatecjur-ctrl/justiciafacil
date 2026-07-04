// ============================================================
//  Paquetes / grupos de plantillas de contrato (por fase)
//  Requiere las tablas `plantilla_grupo` y `plantilla_asignacion`.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface Grupo {
  id: string;
  nombre: string | null;
  fase: string | null;
  descripcion: string | null;
  orden?: number | null;
}

export async function listarGrupos(): Promise<Grupo[]> {
  try {
    return await sbSelect<Grupo>("plantilla_grupo", "select=*&order=orden.asc,created_at.asc");
  } catch {
    return [];
  }
}

export async function crearGrupo(nombre: string, fase: string, descripcion: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_grupo`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ nombre, fase, descripcion }),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

export async function actualizarGrupo(id: string, cambios: Partial<Grupo>): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_grupo?id=eq.${id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(cambios),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function eliminarGrupo(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_grupo?id=eq.${id}`, { method: "DELETE", headers });
    return res.ok;
  } catch {
    return false;
  }
}

/** Mapa { tipoPlantilla: grupo_id }. */
export async function listarAsignaciones(): Promise<Record<string, string>> {
  try {
    const filas = await sbSelect<{ tipo: string; grupo_id: string | null }>("plantilla_asignacion", "select=tipo,grupo_id");
    const m: Record<string, string> = {};
    for (const f of filas) if (f.tipo && f.grupo_id) m[f.tipo] = f.grupo_id;
    return m;
  } catch {
    return {};
  }
}

/** Asigna una plantilla a un paquete (o la saca si grupoId es null). */
export async function asignarPlantillaGrupo(tipo: string, grupoId: string | null): Promise<boolean> {
  try {
    if (grupoId === null) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_asignacion?tipo=eq.${encodeURIComponent(tipo)}`, { method: "DELETE", headers });
      return res.ok;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plantilla_asignacion`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ tipo, grupo_id: grupoId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

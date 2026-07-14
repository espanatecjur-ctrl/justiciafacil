// ============================================================
//  Catálogo de administradoras (código ↔ nombre real)
// ------------------------------------------------------------
//  El código es lo que se muestra en toda la app. El nombre real
//  SOLO se debe pintar en pantalla cuando el rol del usuario es
//  DGE (o Super_Admin) — esa decisión la toma cada componente que
//  use estos datos, comparando rolUsuario, igual que el resto del
//  sistema de permisos (puedeAdmin, puedePrecioPiso, etc.).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface Administradora {
  codigo: string;
  nombre: string;
  activo?: boolean;
}

/** Roles que sí pueden ver el nombre real de la administradora. */
export function puedeVerNombreReal(rolUsuario?: string | null): boolean {
  return ["DGE", "Super_Admin"].includes(rolUsuario || "");
}

export async function listarAdministradoras(): Promise<Administradora[]> {
  try {
    return await sbSelect<Administradora>(
      "administradora_catalogo",
      "select=codigo,nombre,activo&activo=eq.true&order=codigo.asc&limit=1000",
    );
  } catch {
    return [];
  }
}

export async function crearAdministradora(codigo: string, nombre: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/administradora_catalogo`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ codigo: codigo.trim(), nombre: nombre.trim() }),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

/** Carga varias administradoras de un jalón (para pegar el listado que da Paola). */
export async function cargarAdministradorasEnLote(filas: { codigo: string; nombre: string }[]): Promise<{ ok: boolean; error?: string }> {
  if (!filas.length) return { ok: true };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/administradora_catalogo`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal,resolution=merge-duplicates" },
      body: JSON.stringify(filas.map((f) => ({ codigo: f.codigo.trim(), nombre: f.nombre.trim() }))),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

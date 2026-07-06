// ============================================================
// Permisos por módulo (reutilizable)
// ------------------------------------------------------------
// Misma lógica que el menú (app-shell): saca el rol del usuario
// de `colaboradores`, y la lista de módulos que ve de `app_permisos`
// (o el default del rol en roles.ts). Sirve para decidir si se
// muestra el "ojito" que salta a la ficha de otra área.
// Regla anti-bloqueo: sin rol o si algo falla = ve todo (null).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import { ROLES, rolVeTodo, type ModuloClave } from "@/lib/roles";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// null = ve todo (sin restricción). Set = solo esos módulos.
let cache: Set<ModuloClave> | null = null;
let resuelto = false;

export async function cargarModulosVisibles(): Promise<Set<ModuloClave> | null> {
  if (resuelto) return cache;
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) { resuelto = true; cache = null; return null; }

    const [colRes, permRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers }),
    ]);
    const colData = colRes.ok ? await colRes.json() : [];
    const permData = permRes.ok ? await permRes.json() : [];
    const rol = colData?.[0]?.rol ?? null;
    if (!rol) { resuelto = true; cache = null; return null; }

    const def = ROLES.find((r) => r.codigo === rol);
    if (def && rolVeTodo(def.modulos)) { resuelto = true; cache = null; return null; }

    const cfg = permData?.[0]?.config?.modulos ?? {};
    const mods: string[] = cfg[rol] ?? (def && def.modulos !== "todos" ? (def.modulos as string[]) : ["inicio"]);
    const set = new Set<ModuloClave>(mods as ModuloClave[]);
    set.add("inicio");
    resuelto = true; cache = set; return set;
  } catch {
    resuelto = true; cache = null; return null; // no bloquear
  }
}

export function limpiarCacheModulos() { resuelto = false; cache = null; }

/** ¿El usuario puede ver este módulo? null (ve todo) => siempre true. */
export function puedeVerModulo(visibles: Set<ModuloClave> | null, modulo: ModuloClave): boolean {
  if (!visibles) return true;
  return visibles.has(modulo);
}

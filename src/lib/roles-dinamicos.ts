// ============================================================
// Roles y acciones DINÁMICOS
// ------------------------------------------------------------
// Permite AGREGAR roles y acciones desde la app sin tocar el
// código. Reusa la tabla `app_permisos` (fila id=1, campo config):
//   config = {
//     modulos:        { rol: [modulos] },            // asignaciones (ya existía)
//     acciones:       { modulo: { rol: [acciones] } },// asignaciones (ya existía)
//     roles_custom:   [ { codigo, nombre, grupo } ], // NUEVO
//     acciones_custom:{ modulo: [ { clave, label } ] }// NUEVO
//   }
// Los lectores actuales (menú y acciones) YA respetan lo guardado
// por rol, así que un rol nuevo funciona en cuanto le defines sus
// permisos. Este lib solo administra los catálogos combinados.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES, GRUPOS, rolVeTodo, type ModuloClave } from "@/lib/roles";
import { ACCIONES, type ModuloPerm } from "@/lib/permisos-acciones";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface RolCustom { codigo: string; nombre: string; grupo: string; }
export interface AccionCustom { clave: string; label: string; }

export interface ConfigPermisos {
  modulos?: Record<string, ModuloClave[]>;
  acciones?: Record<string, Record<string, string[]>>;
  roles_custom?: RolCustom[];
  acciones_custom?: Record<string, AccionCustom[]>;
  [k: string]: unknown;
}

export interface RolCombinado {
  codigo: string;
  nombre: string;
  grupo: string;
  custom: boolean;
  veTodo: boolean;
}

export interface AccionCombinada {
  clave: string;
  label: string;
  custom: boolean;
}

// Los módulos que tienen acciones (mismos que permisos-acciones).
export const MODULOS_ACCION: { clave: ModuloPerm; label: string }[] = [
  { clave: "ucp", label: "UCP" },
  { clave: "ucm", label: "UCM · Seguimiento" },
  { clave: "udp", label: "UDP · Defensa" },
  { clave: "ufc", label: "UFC · Formalización" },
  { clave: "amparos", label: "Amparos / Recursos / Exhortos" },
  { clave: "contratos", label: "Contratos" },
];

/** Lee el config completo de app_permisos (fila id=1). {} si falla. */
export async function cargarConfig(): Promise<ConfigPermisos> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers });
    if (!r.ok) return {};
    const rows = await r.json();
    return (rows?.[0]?.config as ConfigPermisos) ?? {};
  } catch {
    return {};
  }
}

/** Roles combinados: los fijos + los custom. */
export function rolesCombinados(cfg: ConfigPermisos): RolCombinado[] {
  const base: RolCombinado[] = ROLES.map((r) => ({
    codigo: r.codigo,
    nombre: r.nombre,
    grupo: r.grupo,
    custom: false,
    veTodo: rolVeTodo(r.modulos),
  }));
  const custom: RolCombinado[] = (cfg.roles_custom ?? []).map((r) => ({
    codigo: r.codigo,
    nombre: r.nombre,
    grupo: r.grupo || "Personalizados",
    custom: true,
    veTodo: false,
  }));
  return [...base, ...custom];
}

/** Acciones combinadas de un módulo: las fijas + las custom. */
export function accionesCombinadas(cfg: ConfigPermisos, modulo: ModuloPerm): AccionCombinada[] {
  const base: AccionCombinada[] = (ACCIONES[modulo] ?? []).map((a) => ({ clave: a.clave, label: a.label, custom: false }));
  const custom: AccionCombinada[] = (cfg.acciones_custom?.[modulo] ?? []).map((a) => ({ clave: a.clave, label: a.label, custom: true }));
  return [...base, ...custom];
}

/** Grupos disponibles (los fijos + los que hayan traído los roles custom). */
export function gruposDisponibles(cfg: ConfigPermisos): string[] {
  const set = new Set<string>([...GRUPOS, "Administración", "Personalizados"]);
  for (const r of ROLES) set.add(r.grupo);
  for (const r of cfg.roles_custom ?? []) if (r.grupo) set.add(r.grupo);
  return Array.from(set);
}

export function esRolCustom(cfg: ConfigPermisos, codigo: string): boolean {
  return (cfg.roles_custom ?? []).some((r) => r.codigo === codigo);
}

export function esAccionCustom(cfg: ConfigPermisos, modulo: ModuloPerm, clave: string): boolean {
  return (cfg.acciones_custom?.[modulo] ?? []).some((a) => a.clave === clave);
}

/** Normaliza un texto a un código corto (MAYÚSCULAS con guion bajo). */
export function sugerirCodigo(texto: string): string {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

// ── Lectura-modificación-escritura segura (no pisa otras llaves) ──────────
async function patchConfig(
  mutar: (c: ConfigPermisos) => ConfigPermisos,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const base = await cargarConfig();
    const nuevo = mutar(JSON.parse(JSON.stringify(base)) as ConfigPermisos);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_permisos?id=eq.1`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ config: nuevo, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) return { ok: false, error: `Supabase ${res.status}` };
    const data = await res.json();
    if (!data || data.length === 0) return { ok: false, error: "No existe la fila id=1 de app_permisos. Corre el SQL." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

/** Agrega un rol nuevo. El código debe ser único (no choca con los fijos). */
export async function agregarRol(codigo: string, nombre: string, grupo: string): Promise<{ ok: boolean; error?: string }> {
  const cod = sugerirCodigo(codigo);
  if (!cod) return { ok: false, error: "El código no puede ir vacío." };
  if (ROLES.some((r) => r.codigo === cod)) return { ok: false, error: `El código ${cod} ya existe como rol fijo.` };
  return patchConfig((c) => {
    const lista = c.roles_custom ?? [];
    if (lista.some((r) => r.codigo === cod)) throw new Error(`El código ${cod} ya existe.`);
    c.roles_custom = [...lista, { codigo: cod, nombre: nombre.trim() || cod, grupo: grupo || "Personalizados" }];
    return c;
  });
}

/** Elimina un rol custom (y limpia sus asignaciones). Los fijos no se tocan. */
export async function eliminarRol(codigo: string): Promise<{ ok: boolean; error?: string }> {
  return patchConfig((c) => {
    c.roles_custom = (c.roles_custom ?? []).filter((r) => r.codigo !== codigo);
    if (c.modulos) delete c.modulos[codigo];
    if (c.acciones) for (const m of Object.keys(c.acciones)) delete c.acciones[m][codigo];
    return c;
  });
}

/** Agrega una acción nueva a un módulo. La clave debe ser única en ese módulo. */
export async function agregarAccion(modulo: ModuloPerm, clave: string, label: string): Promise<{ ok: boolean; error?: string }> {
  const cl = clave.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!cl) return { ok: false, error: "La clave no puede ir vacía." };
  if ((ACCIONES[modulo] ?? []).some((a) => a.clave === cl)) return { ok: false, error: `La clave ${cl} ya existe en este módulo.` };
  return patchConfig((c) => {
    c.acciones_custom = c.acciones_custom ?? {};
    const lista = c.acciones_custom[modulo] ?? [];
    if (lista.some((a) => a.clave === cl)) throw new Error(`La clave ${cl} ya existe.`);
    c.acciones_custom[modulo] = [...lista, { clave: cl, label: label.trim() || cl }];
    return c;
  });
}

/** Elimina una acción custom de un módulo (y la quita de las asignaciones). */
export async function eliminarAccion(modulo: ModuloPerm, clave: string): Promise<{ ok: boolean; error?: string }> {
  return patchConfig((c) => {
    if (c.acciones_custom?.[modulo]) c.acciones_custom[modulo] = c.acciones_custom[modulo].filter((a) => a.clave !== clave);
    if (c.acciones?.[modulo]) for (const rol of Object.keys(c.acciones[modulo])) {
      c.acciones[modulo][rol] = (c.acciones[modulo][rol] ?? []).filter((k) => k !== clave);
    }
    return c;
  });
}

/** Guarda las asignaciones de módulos de un rol. */
export async function guardarModulosDeRol(codigo: string, modulos: ModuloClave[]): Promise<{ ok: boolean; error?: string }> {
  return patchConfig((c) => {
    c.modulos = c.modulos ?? {};
    c.modulos[codigo] = modulos;
    return c;
  });
}

/** Guarda las asignaciones de acciones de un rol en un módulo. */
export async function guardarAccionesDeRol(modulo: ModuloPerm, codigo: string, acciones: string[]): Promise<{ ok: boolean; error?: string }> {
  return patchConfig((c) => {
    c.acciones = c.acciones ?? {};
    c.acciones[modulo] = c.acciones[modulo] ?? {};
    c.acciones[modulo][codigo] = acciones;
    return c;
  });
}

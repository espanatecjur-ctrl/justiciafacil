// JusticiaFácil · Permisos por Estado — quién puede ABRIR el contenido de un documento
// (verlo, descargarlo, editarlo, borrarlo, solicitar/resolver su baja), a diferencia de
// solo VER QUE EXISTE en una lista y poder AGREGAR uno nuevo, que siempre está permitido.
//
// Regla: si el asunto es de un Estado distinto al del usuario, puede verlo en listas y
// agregar documentos, pero NO puede abrir/descargar/editar/borrar el contenido.
//
// Exentos de esta restricción — ven y abren TODO sin importar el Estado: DGE, DIL, GAD
// y Super_Admin (cargos que supervisan toda la operación, no una sola plaza).

import { estadoDeCiudad } from "@/lib/ciudad-judicial";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

const ROLES_EXENTOS = ["DGE", "DIL", "GAD", "Super_Admin"];

export function rolExentoDeRestriccionEstado(rol: string | null): boolean {
  return !!rol && ROLES_EXENTOS.includes(rol);
}

export interface InfoUsuarioEstado {
  rol: string | null;
  correo: string | null;
  sede: string | null;   // ciudad del colaborador (ej. "Culiacán")
  estado: string | null; // Estado derivado de esa ciudad (ej. "Sinaloa")
  exento: boolean;       // true = ve y abre todo, sin importar el Estado del asunto
}

const VACIO: InfoUsuarioEstado = { rol: null, correo: null, sede: null, estado: null, exento: false };

let cache: InfoUsuarioEstado | null = null;
let cacheEn = 0;
const CACHE_MS = 60_000;

/** Rol, sede y Estado del usuario en sesión — con caché breve en memoria. */
export async function infoUsuarioEstado(forzar = false): Promise<InfoUsuarioEstado> {
  if (!forzar && cache && Date.now() - cacheEn < CACHE_MS) return cache;
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data.session?.user?.email ?? null;
    if (!correo) { cache = VACIO; cacheEn = Date.now(); return VACIO; }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol,sede&correo=eq.${encodeURIComponent(correo)}`, { headers });
    const filas = r.ok ? await r.json() : [];
    const fila = filas?.[0];
    const rol: string | null = fila?.rol ?? null;
    const sede: string | null = fila?.sede ?? null;
    const estado = sede ? estadoDeCiudad(sede) : null;

    const info: InfoUsuarioEstado = { rol, correo, sede, estado, exento: rolExentoDeRestriccionEstado(rol) };
    cache = info;
    cacheEn = Date.now();
    return info;
  } catch {
    return VACIO;
  }
}

/**
 * ¿Puede abrir el contenido de un asunto/documento de este Estado?
 * (ver, descargar, editar anotación/tipo de copia, solicitar o resolver baja)
 * Siempre se puede: ver que existe en una lista, y agregar un documento nuevo — eso
 * no pasa por esta función.
 */
export function puedeAbrirContenido(usuario: InfoUsuarioEstado, estadoAsunto: string | null): boolean {
  if (usuario.exento) return true;
  if (!usuario.estado || !estadoAsunto) return true; // dato incompleto: no se restringe por un error de captura
  return usuario.estado === estadoAsunto;
}

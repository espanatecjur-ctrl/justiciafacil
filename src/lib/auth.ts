const AUTH_URL = "https://xzvtgjtumvwftulqxiao.supabase.co";
const AUTH_KEY = "sb_publishable_AGnhscb_RlHSwXVtv1Gfow_xN6mxG9A";

export const DOMINIO_PERMITIDO = "diipadesarrollos.com";

export function correoPermitido(email?: string | null) {
  return !!email && email.toLowerCase().endsWith("@" + DOMINIO_PERMITIDO);
}

let _client: any = null;
export async function getAuth() {
  if (_client) return _client;
  const url = "https://esm.sh/@supabase/supabase-js@2";
  const mod: any = await import(/* @vite-ignore */ url);
  _client = mod.createClient(AUTH_URL, AUTH_KEY);
  return _client;
}

// ————————————————————————————————————————————————
//  Identidad del usuario actual (correo + rol de colaboradores).
//  Así se identifica a las personas en validaciones y solicitudes:
//  SIEMPRE por su correo y el rol ligado a ese correo.
// ————————————————————————————————————————————————
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
const _sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

/** Correo del usuario que tiene la sesión abierta (o null). */
export async function correoActual(): Promise<string | null> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    return data?.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Rol ligado a ese correo (según la tabla colaboradores). */
export async function rolActual(): Promise<string> {
  try {
    const correo = await correoActual();
    if (!correo) return "";
    const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers: _sbHeaders });
    const d = r.ok ? await r.json() : [];
    return d?.[0]?.rol || "";
  } catch {
    return "";
  }
}

/** Etiqueta "ROL · correo" del usuario actual (para solicitante/validador). */
export async function usuarioActualEtiqueta(): Promise<string> {
  const correo = await correoActual();
  if (!correo) return "SIN-SESIÓN";
  const rol = await rolActual();
  return rol ? `${rol} · ${correo}` : correo;
}

/** Nombre para mostrar del usuario actual: primero busca en JurisConecta (directorio
 *  canónico de toda la empresa), y si no está, en JusticiaFácil; al final usa el correo. */
export async function nombreActual(): Promise<{ nombre: string; area: string | null; correo: string } | null> {
  const correo = await correoActual();
  if (!correo) return null;
  try {
    const { JC_URL, jcHeaders } = await import("@/lib/juris-clientes");
    const r = await fetch(`${JC_URL}/rest/v1/colaboradores?select=nombre,area&correo=eq.${encodeURIComponent(correo)}&limit=1`, { headers: jcHeaders });
    const d = r.ok ? await r.json() : [];
    if (d?.[0]?.nombre) return { nombre: d[0].nombre, area: d[0].area ?? null, correo };
  } catch { /* sigue con JusticiaFácil */ }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=nombre&correo=eq.${encodeURIComponent(correo)}&limit=1`, { headers: _sbHeaders });
    const d = r.ok ? await r.json() : [];
    if (d?.[0]?.nombre) return { nombre: d[0].nombre, area: null, correo };
  } catch { /* usa el correo como último recurso */ }
  return { nombre: correo.split("@")[0], area: null, correo };
}

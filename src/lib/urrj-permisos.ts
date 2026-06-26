// ============================================================
// URRJ · Permisos por acción (9 acciones)
// Carga el rol del usuario + la config, y dice qué puede hacer.
// Regla anti-bloqueo: DGE/Super_Admin o rol sin configurar = todo.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export const ACCIONES_URRJ = [
  { clave: "elaborar", label: "Elaborar" },
  { clave: "editar", label: "Editar" },
  { clave: "ver", label: "Ver" },
  { clave: "reelaborar", label: "Re-elaborar" },
  { clave: "reasignar", label: "Reasignar" },
  { clave: "papelera", label: "Enviar a papelera" },
  { clave: "terminar", label: "Dar por terminado" },
  { clave: "firmar_elabora", label: "Firmar como Elabora" },
  { clave: "validar", label: "Validar / Firmar" },
] as const;

const TODAS = ACCIONES_URRJ.map((a) => a.clave);
const VEN_TODO = ["DGE", "Super_Admin"];

let cache: { rol: string | null; acciones: string[] } | null = null;

export async function cargarPermisosURRJ(): Promise<{ rol: string | null; acciones: string[] }> {
  if (cache) return cache;
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) { cache = { rol: null, acciones: TODAS }; return cache; }

    const [colRes, cfgRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/urrj_permisos?select=config&id=eq.1`, { headers }),
    ]);
    const col = colRes.ok ? await colRes.json() : [];
    const rol: string | null = col?.[0]?.rol ?? null;
    if (!rol || VEN_TODO.includes(rol)) { cache = { rol, acciones: TODAS }; return cache; }

    const cfg = cfgRes.ok ? await cfgRes.json() : [];
    const config = cfg?.[0]?.config ?? {};
    // si el rol no está en la config, no lo bloqueamos: ve todo hasta que lo configuren
    const acciones: string[] = Array.isArray(config[rol]) ? config[rol] : TODAS;
    cache = { rol, acciones };
    return cache;
  } catch {
    cache = { rol: null, acciones: TODAS };
    return cache;
  }
}

export function limpiarCachePermisos() { cache = null; }

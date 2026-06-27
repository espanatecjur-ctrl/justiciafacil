// ============================================================
// UCP · Permisos por rol (espejo de urrj-permisos)
// ------------------------------------------------------------
// Carga el rol del usuario (de la tabla colaboradores por su
// correo) y dice quién puede firmar cada parte del dictamen
// final y quién puede pasarlo a Etapa B.
// Regla anti-bloqueo: DGE/Super_Admin o rol desconocido = puede.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

const VEN_TODO = ["DGE", "Super_Admin"];

// Cada espacio de firma del dictamen final pertenece a un rol.
export type SlotFirma = "elabora" | "dil" | "ucm" | "dge" | "dgc" | "gad";
export const FIRMA_ROL: Record<SlotFirma, string> = {
  elabora: "UCP",   // el que elabora el dictamen
  dil: "DIL",       // Jurídico
  ucm: "UCM",       // Seguimiento
  dge: "DGE",       // Dirección General
  dgc: "DGC",       // Comercial (rol aún no existe en roles.ts; lo firma DGE por ahora)
  gad: "GAD",       // Administración
};

export interface PermisosUCP { rol: string | null; }

let cache: PermisosUCP | null = null;

export async function cargarPermisosUCP(): Promise<PermisosUCP> {
  if (cache) return cache;
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) { cache = { rol: null }; return cache; }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`,
      { headers },
    );
    const col = res.ok ? await res.json() : [];
    cache = { rol: col?.[0]?.rol ?? null };
    return cache;
  } catch {
    cache = { rol: null };
    return cache;
  }
}

export function limpiarCacheUCP() { cache = null; }

/** ¿Este rol puede firmar este espacio? DGE/Super_Admin firman todo; rol desconocido no se bloquea. */
export function puedeFirmar(slot: SlotFirma, rol: string | null): boolean {
  if (!rol) return true;
  if (VEN_TODO.includes(rol)) return true;
  return rol === FIRMA_ROL[slot];
}

/** ¿Este rol puede pasar el caso a Etapa B (UCM)? */
export function puedePasarEtapaB(rol: string | null): boolean {
  if (!rol) return true;
  if (VEN_TODO.includes(rol)) return true;
  return ["DIL", "UCP"].includes(rol);
}

// JusticiaFácil · Carpeta en Drive (llama a /.netlify/functions/crear-carpeta)
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function quienSolicita(): Promise<string> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) return "SIN-SESION";
    let rol = "";
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers });
      const d = r.ok ? await r.json() : [];
      rol = d?.[0]?.rol || "";
    } catch { /* sin rol */ }
    return rol ? `${rol} · ${correo}` : correo;
  } catch {
    return "SIN-SESION";
  }
}

export function nombreGarantia(caso: { gar_id?: string | null; expediente?: string | null; id?: string }): string {
  const base = (caso.gar_id || caso.expediente || caso.id || "garantia").toString().trim();
  return base.replace(/[\\/]/g, "-");
}

export type ResultadoCarpeta = { ok: boolean; link?: string; carpetaId?: string; error?: string };

export async function crearCarpetaDrive(area: string, caso: CasoJuridico): Promise<ResultadoCarpeta> {
  const solicita = await quienSolicita();
  const garantia = nombreGarantia(caso);
  try {
    const r = await fetch("/.netlify/functions/crear-carpeta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, solicita, garantia }),
    });
    const data = await r.json();
    if (!data.ok) return { ok: false, error: data.error || "No se pudo crear la carpeta." };
    return { ok: true, link: data.link, carpetaId: data.carpetaId };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// ============================================================
//  Campanita · avisos del sistema (tabla `notificacion`)
//  Identidad por CORREO. La app usa su llave pública (como la agenda).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export interface Notificacion {
  id: number;
  para: string;
  texto: string;
  enlace?: string | null;
  leida: boolean;
  created_at?: string | null;
}

/** Crea un aviso para una persona (por su correo). No falla la app si truena. */
export async function crearNotificacion(n: { para: string; texto: string; enlace?: string | null }): Promise<boolean> {
  if (!n.para || !n.texto) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notificacion`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ para: n.para, texto: n.texto, enlace: n.enlace ?? null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Mis avisos (los más recientes primero). */
export async function listarMisNotificaciones(correo: string, limite = 20): Promise<Notificacion[]> {
  if (!correo) return [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/notificacion?select=*&para=eq.${encodeURIComponent(correo)}&order=created_at.desc&limit=${limite}`,
      { headers },
    );
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

/** Marca un aviso como leído. */
export async function marcarLeida(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notificacion?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ leida: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Marca TODOS mis avisos como leídos. */
export async function marcarTodasLeidas(correo: string): Promise<boolean> {
  if (!correo) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/notificacion?para=eq.${encodeURIComponent(correo)}&leida=eq.false`,
      { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ leida: true }) },
    );
    return res.ok;
  } catch {
    return false;
  }
}

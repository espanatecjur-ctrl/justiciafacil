// ============================================================
//  Enviar correo por GMAIL (en nombre del asesor)
// ------------------------------------------------------------
//  Usa el "permiso de Google" (provider_token) que Supabase guarda
//  al entrar. El correo sale desde el propio Gmail del asesor y
//  queda en SUS "Enviados". Registra el envío (tabla envio_correo)
//  y mete un pixel para saber si lo abren.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface EnvioCorreo {
  para: string;
  cc?: string;
  cco?: string;            // copia oculta (escondidos)
  asunto: string;
  mensaje: string;
  folio?: string | null;   // documento enviado (para el rastreo)
  adjuntos?: { nombre: string; tipo: string; base64: string }[]; // Word y PDF
}

export interface EnvioRegistro {
  id?: string;
  token?: string;
  folio?: string | null;
  para?: string | null;
  asunto?: string | null;
  estado?: string | null;      // enviado / abierto
  enviado_at?: string | null;
  abierto_at?: string | null;
}

export async function enviarCorreo(d: EnvioCorreo): Promise<{ ok: boolean; error?: string }> {
  // 1) Permiso de Google del asesor con sesión abierta.
  let token: string | undefined;
  let from = "";
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    token = data.session?.provider_token ?? undefined;
    from = data.session?.user?.email || "";
  } catch { /* nada */ }
  if (!token) {
    return { ok: false, error: "Tu permiso de Google no está disponible (a veces expira). Vuelve a entrar con Google y reintenta." };
  }
  if (!d.para?.trim()) return { ok: false, error: "Falta el destinatario (Para)." };

  // 2) Rastreo: token + registro + pixel.
  const trk = crypto.randomUUID();
  const pixelUrl = `${window.location.origin}/.netlify/functions/pixel?t=${trk}`;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/envio_correo`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        token: trk, folio: d.folio || null, para: d.para,
        cc: d.cc || null, cco: d.cco || null, asunto: d.asunto || null, estado: "enviado",
      }),
    });
  } catch { /* si no se pudo registrar, igual enviamos */ }

  // 3) Enviar por Gmail (función de servidor).
  try {
    const res = await fetch("/.netlify/functions/enviar-correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: token, from, to: d.para, cc: d.cc || "", cco: d.cco || "",
        asunto: d.asunto, cuerpo: d.mensaje, adjuntos: d.adjuntos || [], pixelUrl,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!out.ok) return { ok: false, error: out.error || "No se pudo enviar el correo." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

/** Convierte texto a base64 respetando acentos (UTF-8). */
export function textoABase64(texto: string): string {
  return btoa(unescape(encodeURIComponent(texto)));
}

/** Lista los envíos registrados (para ver enviado/abierto). */
export async function listarEnvios(): Promise<EnvioRegistro[]> {
  try {
    return await sbSelect<EnvioRegistro>("envio_correo", "select=*&order=enviado_at.desc");
  } catch {
    return [];
  }
}

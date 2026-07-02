// ============================================================
//  Enviar correo desde el sistema (llama a la Netlify Function)
// ------------------------------------------------------------
//  El servidor manda el correo con Resend. El adjunto se envía
//  como base64. Requiere RESEND_API_KEY y EMAIL_FROM en Netlify.
// ============================================================
import { sbSelect } from "@/lib/supabase";

export interface EnvioCorreo {
  para: string;
  cc?: string;
  cco?: string;            // copia oculta (escondidos)
  asunto: string;
  mensaje: string;
  folio?: string | null;   // documento enviado (para el rastreo)
  adjuntoNombre?: string;
  adjuntoBase64?: string;  // contenido del adjunto en base64
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
  try {
    const r = await fetch("/.netlify/functions/enviar-correo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: !!data.ok, error: data.error };
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

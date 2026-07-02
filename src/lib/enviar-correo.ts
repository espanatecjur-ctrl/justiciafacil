// ============================================================
//  Enviar correo desde el sistema (llama a la Netlify Function)
// ------------------------------------------------------------
//  El servidor manda el correo con Resend. El adjunto se envía
//  como base64. Requiere RESEND_API_KEY y EMAIL_FROM en Netlify.
// ============================================================
export interface EnvioCorreo {
  para: string;
  cc?: string;
  cco?: string;            // copia oculta (escondidos)
  asunto: string;
  mensaje: string;
  adjuntoNombre?: string;
  adjuntoBase64?: string;  // contenido del adjunto en base64
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

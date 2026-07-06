// ============================================================
// Enviar correo por Gmail (usa el permiso gmail.send que ya pide el login)
// ------------------------------------------------------------
// Toma el access token de Google de la sesión de Supabase (provider_token)
// y manda el correo por la API de Gmail. Si no hay token (o expiró),
// devuelve { ok:false } y el que llama cae al modo prellenado (mailto).
// ============================================================
import { getAuth } from "@/lib/auth";

function mimeSubject(s: string): string {
  // Subject en UTF-8 (encoded-word) para que no se rompan los acentos.
  try {
    return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
  } catch {
    return s;
  }
}

function toBase64Url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function enviarGmail(to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const token = (data?.session as any)?.provider_token as string | undefined;
    if (!token) return { ok: false, error: "Sin permiso de Gmail activo. Vuelve a iniciar sesión para reactivarlo." };

    const raw = [
      `To: ${to}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      `Subject: ${mimeSubject(subject)}`,
      "",
      body,
    ].join("\r\n");

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
    });
    if (!res.ok) return { ok: false, error: `Gmail ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "error" };
  }
}

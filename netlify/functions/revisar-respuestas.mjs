// ============================================================
//  JusticiaFácil · Revisa respuestas en Gmail
// ------------------------------------------------------------
//  Con el permiso de lectura del asesor, busca si el proveedor
//  respondió después de que se le envió la solicitud, y marca el
//  envío como "respondido" en Supabase.
//  Requiere el permiso gmail.readonly (login).
// ============================================================
const SB_URL = process.env.SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const SB_KEY = process.env.SUPABASE_KEY || "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
    }
    const { accessToken, envios } = await req.json();
    if (!accessToken) {
      return new Response(JSON.stringify({ ok: false, error: "Falta el permiso de Google. Vuelve a entrar con Google y reintenta." }), { status: 200 });
    }
    const lista = Array.isArray(envios) ? envios : [];
    const respondidos = [];

    for (const e of lista) {
      if (!e || !e.para || !e.enviado_at || !e.token) continue;
      const correo = (String(e.para).match(/[\w.+-]+@[\w.-]+/) || [String(e.para)])[0];
      const epoch = Math.floor(new Date(e.enviado_at).getTime() / 1000);
      const q = encodeURIComponent(`from:${correo} after:${epoch}`);
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) continue;
      const data = await r.json();
      if (data.messages && data.messages.length) {
        await fetch(`${SB_URL}/rest/v1/envio_correo?token=eq.${encodeURIComponent(e.token)}`, {
          method: "PATCH",
          headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ respondido: true, respondido_at: new Date().toISOString() }),
        });
        respondidos.push(e.token);
      }
    }

    return new Response(JSON.stringify({ ok: true, respondidos }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e && e.message) || "Error al revisar respuestas." }), { status: 200 });
  }
};

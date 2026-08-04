// =====================================================================
//  notificar.mjs — manda una notificación push (Web Push) a un correo.
//  Body: { correo, titulo, cuerpo, url, importante }
//  Vibra más fuerte y se queda fija si `importante` es true
//  (lo maneja el service worker, aquí solo se lo indicamos).
// =====================================================================
import webpush from "web-push";

const SUPABASE_URL = process.env.JF_SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const SUPABASE_KEY = process.env.JF_SUPABASE_KEY || "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

const VAPID_PUBLIC = "BGbC2mWLl7l1-vWYfCVPVPtQDV8JyMgyc-1TG8IgZhy4De6t2l4jpSOu4hPLDr0qhwH9-3ZkeUVX7C_tEicw0Tc";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || "K9dZF9PYAbh6zKjmM9OleN7PHx8W9sqlp3gsf4BOH58";
const VAPID_SUBJECT = "mailto:erikapaola@diipadesarrollos.com";

let vapidListo = false;
try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidListo = true;
} catch {
  vapidListo = false;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Método no permitido" };
  if (!vapidListo) return { statusCode: 200, body: "VAPID no configurado" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "JSON inválido" }; }

  const { correo, titulo, cuerpo, url, importante } = body;
  if (!correo || !titulo) return { statusCode: 400, body: "Faltan datos (correo, titulo)" };

  const rSubs = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subs?select=endpoint,p256dh,auth&correo=eq.${encodeURIComponent(String(correo).toLowerCase().trim())}`,
    { headers },
  );
  const subs = rSubs.ok ? await rSubs.json() : [];

  if (!subs || subs.length === 0) return { statusCode: 200, body: "Sin suscripción para ese correo" };

  const payload = JSON.stringify({
    title: titulo,
    body: cuerpo || "",
    url: url || "/",
    importante: !!importante,
    tag: importante ? "importante-" + Date.now() : "aviso",
  });

  let enviados = 0;
  await Promise.all(subs.map(async (s) => {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      await webpush.sendNotification(sub, payload);
      enviados++;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await fetch(`${SUPABASE_URL}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE", headers }).catch(() => {});
      }
    }
  }));

  return { statusCode: 200, body: `Avisos enviados: ${enviados}` };
}

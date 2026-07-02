// ============================================================
//  JusticiaFácil · Envía un correo REAL (Resend) + rastreo
// ------------------------------------------------------------
//  Manda el correo con adjunto, CC y CCO, registra el envío en
//  Supabase (tabla envio_correo) e inserta un pixel invisible
//  para saber si lo abrieron (como HubSpot).
//
//  Jhon configura en Netlify (Environment):
//    RESEND_API_KEY = API key de Resend
//    EMAIL_FROM     = "DIIPA <notificaciones@diipadesarrollos.com>"
//  (SUPABASE_URL y SUPABASE_KEY son opcionales: ya traen valor por defecto.)
// ============================================================
import crypto from "crypto";

const SB_URL = process.env.SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const SB_KEY = process.env.SUPABASE_KEY || "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
    }

    const { para, cc, cco, asunto, mensaje, adjuntos, folio } = await req.json();

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      return new Response(JSON.stringify({ ok: false, error: "Falta configurar RESEND_API_KEY y EMAIL_FROM en Netlify (Jhon)." }), { status: 500 });
    }
    if (!para) {
      return new Response(JSON.stringify({ ok: false, error: "Falta el destinatario (Para)." }), { status: 400 });
    }

    const listar = (v) => Array.isArray(v) ? v : String(v || "").split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

    // Token y pixel de rastreo (para saber si lo abren).
    const token = crypto.randomUUID();
    const origin = new URL(req.url).origin;
    const pixel = `<img src="${origin}/.netlify/functions/pixel?t=${token}" width="1" height="1" style="display:none" alt="">`;

    const html = `<div style="font-family:Georgia,serif;white-space:pre-wrap">${String(mensaje || "").replace(/</g, "&lt;")}</div>${pixel}`;

    const body = {
      from,
      to: listar(para),
      subject: asunto || "(sin asunto)",
      text: mensaje || "",
      html,
    };
    const ccArr = listar(cc);
    if (ccArr.length) body.cc = ccArr;
    const bccArr = listar(cco);
    if (bccArr.length) body.bcc = bccArr;
    if (Array.isArray(adjuntos) && adjuntos.length) {
      body.attachments = adjuntos
        .filter((a) => a && a.base64 && a.nombre)
        .map((a) => ({ filename: a.nombre, content: a.base64 }));
    }

    // Registra el envío ANTES de mandar (para que el pixel funcione).
    try {
      await fetch(`${SB_URL}/rest/v1/envio_correo`, {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          token, folio: folio || null,
          para: listar(para).join(", "),
          cc: ccArr.join(", "), cco: bccArr.join(", "),
          asunto: asunto || null, estado: "enviado",
        }),
      });
    } catch { /* si falla el registro, igual intentamos enviar */ }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: "Resend rechazó el envío.", detalle: data }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, id: data.id, token }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

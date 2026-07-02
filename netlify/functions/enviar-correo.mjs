// ============================================================
//  JusticiaFácil · Envía un correo REAL con adjunto (Resend)
// ------------------------------------------------------------
//  El asesor arma/revisa el correo en el banner del Editor y al
//  darle "Enviar desde el sistema" se llama esta función.
//
//  Jhon debe configurar en Netlify (Site settings -> Environment):
//    RESEND_API_KEY = (la API key de la cuenta de Resend)
//    EMAIL_FROM     = un correo del dominio verificado,
//                     ej. "DIIPA <notificaciones@diipadesarrollos.com>"
//
//  Sin esas dos variables, la función avisa que falta configurar.
// ============================================================
export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
    }

    const { para, cc, cco, asunto, mensaje, adjuntoNombre, adjuntoBase64 } = await req.json();

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Falta configurar RESEND_API_KEY y EMAIL_FROM en Netlify (Jhon).",
      }), { status: 500 });
    }
    if (!para) {
      return new Response(JSON.stringify({ ok: false, error: "Falta el destinatario (Para)." }), { status: 400 });
    }

    // Convierte "a@x.com, b@y.com" en arreglo.
    const listar = (v) =>
      Array.isArray(v) ? v : String(v || "").split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

    const body = {
      from,
      to: listar(para),
      subject: asunto || "(sin asunto)",
      text: mensaje || "",
      html: `<div style="font-family:Georgia,serif;white-space:pre-wrap">${String(mensaje || "").replace(/</g, "&lt;")}</div>`,
    };
    const ccArr = listar(cc);
    if (ccArr.length) body.cc = ccArr;
    const bccArr = listar(cco); // copia oculta (escondidos)
    if (bccArr.length) body.bcc = bccArr;
    if (adjuntoBase64 && adjuntoNombre) {
      body.attachments = [{ filename: adjuntoNombre, content: adjuntoBase64 }];
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: "Resend rechazó el envío.", detalle: data }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

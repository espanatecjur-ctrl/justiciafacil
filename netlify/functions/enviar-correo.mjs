// ============================================================
//  JusticiaFácil · Envía un correo con la API de GMAIL
// ------------------------------------------------------------
//  Manda el correo EN NOMBRE del asesor que inició sesión, usando
//  su "permiso de Google" (accessToken). Sale desde SU propio
//  Gmail y queda en SUS "Enviados". No usa llaves secretas ni
//  Resend ni verificación de dominio.
//  Soporta adjuntos (Word/PDF), CC, CCO (copia oculta) y un pixel
//  invisible para rastrear la apertura.
// ============================================================
function htmlCuerpo(cuerpo, pixelUrl) {
  const esc = String(cuerpo || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  const pix = pixelUrl ? `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px">` : "";
  return `<!doctype html><html><body style="font-family:Georgia,serif;font-size:14px;color:#1a1a1a;line-height:1.5">${esc}${pix}</body></html>`;
}

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
    }
    const { accessToken, from, to, cc, cco, asunto, cuerpo, adjuntos, pixelUrl } = await req.json();
    if (!accessToken) return new Response(JSON.stringify({ ok: false, error: "Falta el permiso de Google. Vuelve a entrar con Google y reintenta." }), { status: 200 });
    if (!to) return new Response(JSON.stringify({ ok: false, error: "Falta el destinatario (Para)." }), { status: 200 });

    let lista = Array.isArray(adjuntos) ? adjuntos.filter((a) => a && a.base64 && a.nombre) : [];

    const asuntoEnc = "=?UTF-8?B?" + Buffer.from(asunto || "(sin asunto)", "utf-8").toString("base64") + "?=";
    const bodyB64 = Buffer.from(htmlCuerpo(cuerpo, pixelUrl), "utf-8").toString("base64");

    const cabeceras = [
      `From: ${from}`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(cco ? [`Bcc: ${cco}`] : []),
      `Subject: ${asuntoEnc}`,
      "MIME-Version: 1.0",
    ];

    let mime;
    if (lista.length > 0) {
      const limite = "lim_" + Date.now();
      const partes = [
        ...cabeceras,
        `Content-Type: multipart/mixed; boundary="${limite}"`,
        "",
        `--${limite}`,
        `Content-Type: text/html; charset="UTF-8"`,
        "Content-Transfer-Encoding: base64",
        "",
        bodyB64,
      ];
      for (const a of lista) {
        const nombreArch = String(a.nombre || "archivo").replace(/[\r\n"]/g, "_");
        const tipoArch = String(a.tipo || "application/octet-stream").replace(/[\r\n]/g, "");
        partes.push(
          `--${limite}`,
          `Content-Type: ${tipoArch}; name="${nombreArch}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${nombreArch}"`,
          "",
          String(a.base64),
        );
      }
      partes.push(`--${limite}--`);
      mime = partes.join("\r\n");
    } else {
      mime = [
        ...cabeceras,
        `Content-Type: text/html; charset="UTF-8"`,
        "Content-Transfer-Encoding: base64",
        "",
        bodyB64,
      ].join("\r\n");
    }

    const raw = Buffer.from(mime, "utf-8").toString("base64")
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const data = await r.json();
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: data?.error?.message || "Gmail rechazó el envío." }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true, id: data.id }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e && e.message) || "Error en el servidor de correo." }), { status: 200 });
  }
};

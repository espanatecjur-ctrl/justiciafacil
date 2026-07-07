// ============================================================
// JusticiaFácil · "Traer aquí" un documento suelto
// Mueve (si está en la misma unidad) o copia (si está en otra) un
// archivo a la carpeta vinculada del expediente.
//
// POST { archivoId, carpetaDestino }
//   -> { ok, accion: "movido"|"copiado", id, name }
// ============================================================
import crypto from "crypto";

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function obtenerAccessToken(clientEmail, privateKey) {
  const ahora = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  };
  const sinFirma = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claim));
  const firma = crypto.createSign("RSA-SHA256").update(sinFirma).sign(privateKey)
    .toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = sinFirma + "." + firma;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(jwt),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("No se obtuvo access_token de Google: " + JSON.stringify(data));
  return data.access_token;
}

async function metadatos(accessToken, id) {
  const url = "https://www.googleapis.com/drive/v3/files/" + id +
    "?fields=id,name,parents,driveId,mimeType&supportsAllDrives=true";
  const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || ("Drive respondió " + r.status));
  return d;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const { archivoId, carpetaDestino } = await req.json();
    if (!archivoId || !carpetaDestino) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan archivoId o carpetaDestino." }), { status: 400 });
    }
    const credBruto = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!credBruto) {
      return new Response(JSON.stringify({ ok: false, error: "Falta GOOGLE_SERVICE_ACCOUNT en Netlify." }), { status: 500 });
    }
    const cred = JSON.parse(credBruto);
    let privateKey = cred.private_key || "";
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
    const accessToken = await obtenerAccessToken(cred.client_email, privateKey);

    const [archivo, destino] = await Promise.all([
      metadatos(accessToken, String(archivoId).trim()),
      metadatos(accessToken, String(carpetaDestino).trim()),
    ]);
    if (archivo.mimeType === "application/vnd.google-apps.folder") {
      return new Response(JSON.stringify({ ok: false, error: "Eso es una carpeta, no un documento. Usa 'Traer' de carpeta." }), { status: 400 });
    }

    const mismaUnidad = !archivo.driveId || !destino.driveId || archivo.driveId === destino.driveId;

    if (mismaUnidad) {
      // MOVER
      const padreActual = (archivo.parents && archivo.parents[0]) || "";
      const url = "https://www.googleapis.com/drive/v3/files/" + String(archivoId).trim() +
        "?addParents=" + encodeURIComponent(String(carpetaDestino).trim()) +
        (padreActual ? "&removeParents=" + encodeURIComponent(padreActual) : "") +
        "&supportsAllDrives=true&fields=id,name";
      const rm = await fetch(url, { method: "PATCH", headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const dm = await rm.json();
      if (!rm.ok) throw new Error(dm?.error?.message || ("No se pudo mover (" + rm.status + ")."));
      return new Response(JSON.stringify({ ok: true, accion: "movido", id: dm.id, name: dm.name }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    } else {
      // COPIAR (archivos sí se pueden copiar entre unidades en un paso)
      const url = "https://www.googleapis.com/drive/v3/files/" + String(archivoId).trim() +
        "/copy?supportsAllDrives=true&fields=id,name";
      const rc = await fetch(url, {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ parents: [String(carpetaDestino).trim()], name: archivo.name }),
      });
      const dc = await rc.json();
      if (!rc.ok) throw new Error(dc?.error?.message || ("No se pudo copiar (" + rc.status + ")."));
      return new Response(JSON.stringify({ ok: true, accion: "copiado", id: dc.id, name: dc.name }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

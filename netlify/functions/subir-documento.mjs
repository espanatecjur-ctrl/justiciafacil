// JusticiaFácil · Sube un documento a la carpeta de la garantía en Drive
// Reutiliza la MISMA técnica que JurisConecta (multipart a Drive).
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

async function buscarOCrearCarpeta(accessToken, nombre, parentId) {
  const seguro = String(nombre).replace(/'/g, "\\'");
  const q = `name='${seguro}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const rb = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true",
    { headers: { Authorization: "Bearer " + accessToken } }
  );
  const db = await rb.json();
  if (db.files && db.files.length > 0) return db.files[0].id;

  const rc = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ name: nombre, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    }
  );
  const dc = await rc.json();
  return dc.id || parentId;
}

async function carpetaDeRuta(accessToken, raizId, ruta) {
  let parentId = raizId;
  for (const nombre of ruta) {
    if (!nombre) continue;
    parentId = await buscarOCrearCarpeta(accessToken, String(nombre), parentId);
  }
  return parentId;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const { area, solicita, garantia, archivo, nombre, mime, carpetaId } = await req.json();
    if (!archivo || !nombre) {
      return new Response(JSON.stringify({ ok: false, error: "Falta el archivo o el nombre." }), { status: 400 });
    }
    // Si viene carpetaId (carpeta vinculada), subimos ahí directo; si no, se arma la ruta área/rol/garantía.
    const usaVinculada = !!(carpetaId && String(carpetaId).trim());
    if (!usaVinculada && (!area || !garantia)) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos (área o garantía)." }), { status: 400 });
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const credBruto = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!credBruto || (!usaVinculada && !folderId)) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan variables de entorno en Netlify (GOOGLE_DRIVE_FOLDER_ID / GOOGLE_SERVICE_ACCOUNT)" }), { status: 500 });
    }

    const cred = JSON.parse(credBruto);
    let privateKey = cred.private_key || "";
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

    const accessToken = await obtenerAccessToken(cred.client_email, privateKey);

    const ruta = [area, solicita, garantia].filter(Boolean).map(String);
    const parentId = usaVinculada ? String(carpetaId).trim() : await carpetaDeRuta(accessToken, folderId, ruta);

    const limite = "limite_" + Date.now();
    const metadata = { name: nombre, parents: [parentId] };
    const bin = Buffer.from(archivo, "base64");

    const cuerpoInicio =
      "--" + limite + "\r\n" +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) + "\r\n" +
      "--" + limite + "\r\n" +
      "Content-Type: " + (mime || "application/octet-stream") + "\r\n\r\n";
    const cuerpoFin = "\r\n--" + limite + "--";

    const cuerpo = Buffer.concat([
      Buffer.from(cuerpoInicio, "utf8"),
      bin,
      Buffer.from(cuerpoFin, "utf8"),
    ]);

    const resp = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,name",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "multipart/related; boundary=" + limite,
        },
        body: cuerpo,
      }
    );
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ ok: false, error: "Drive rechazó la subida.", detalle: data }), { status: 500 });
    }

    return new Response(JSON.stringify({
      ok: true,
      id: data.id,
      link: data.webViewLink || ("https://drive.google.com/file/d/" + data.id + "/view"),
      nombre: data.name,
      carpetaId: parentId,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

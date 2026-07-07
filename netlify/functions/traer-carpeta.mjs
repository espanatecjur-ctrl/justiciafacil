// ============================================================
// JusticiaFácil · "Traer a mi área" (Paso 1: MOVER)
// Mueve una carpeta suelta a la carpeta de su área dentro de Justiciafacil
// y la renombra (garantía + expediente). Solo funciona si la carpeta ya
// está en la MISMA unidad (Justiciafacil). Si viene de otra Unidad, avisa
// que requiere copia (Paso 2).
//
// POST { carpetaId, area, nuevoNombre }
//   -> { ok, movida, carpetaId, nombre }  |  { ok:false, requiereCopia:true }
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

// Busca (o crea) la carpeta del área dentro de la raíz de Justiciafacil.
async function carpetaDeArea(accessToken, raizId, area) {
  const seguro = String(area).replace(/'/g, "\\'");
  const q = `name='${seguro}' and mimeType='application/vnd.google-apps.folder' and '${raizId}' in parents and trashed=false`;
  const rb = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
    "&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives",
    { headers: { Authorization: "Bearer " + accessToken } });
  const db = await rb.json();
  if (rb.ok && db.files && db.files[0]) return db.files[0].id;
  // crear
  const rc = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ name: String(area), mimeType: "application/vnd.google-apps.folder", parents: [raizId] }),
  });
  const dc = await rc.json();
  if (!rc.ok) throw new Error(dc?.error?.message || "No se pudo crear la carpeta del área.");
  return dc.id;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const { carpetaId, area, nuevoNombre } = await req.json();
    if (!carpetaId || !area) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan carpetaId o área." }), { status: 400 });
    }
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const credBruto = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!folderId || !credBruto) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan variables de entorno (GOOGLE_DRIVE_FOLDER_ID / GOOGLE_SERVICE_ACCOUNT)." }), { status: 500 });
    }
    const cred = JSON.parse(credBruto);
    let privateKey = cred.private_key || "";
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
    const accessToken = await obtenerAccessToken(cred.client_email, privateKey);

    // ¿La carpeta suelta está en la misma unidad que Justiciafacil?
    const [carpeta, raiz] = await Promise.all([
      metadatos(accessToken, String(carpetaId).trim()),
      metadatos(accessToken, folderId),
    ]);
    if (carpeta.mimeType !== "application/vnd.google-apps.folder") {
      return new Response(JSON.stringify({ ok: false, error: "Lo que escogiste no es una carpeta." }), { status: 400 });
    }
    // Si está en otra unidad → no se puede mover, requiere copia (Paso 2)
    if (raiz.driveId && carpeta.driveId && raiz.driveId !== carpeta.driveId) {
      return new Response(JSON.stringify({ ok: false, requiereCopia: true, error: "Esta carpeta está en otra Unidad; se necesita COPIAR (Paso 2)." }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Carpeta del área (crea si no existe) dentro de Justiciafacil
    const areaId = await carpetaDeArea(accessToken, folderId, area);
    const padreActual = (carpeta.parents && carpeta.parents[0]) || "";

    // Mover + renombrar en una sola llamada
    const nombreFinal = String(nuevoNombre || carpeta.name).trim() || carpeta.name;
    const url = "https://www.googleapis.com/drive/v3/files/" + String(carpetaId).trim() +
      "?addParents=" + encodeURIComponent(areaId) +
      (padreActual ? "&removeParents=" + encodeURIComponent(padreActual) : "") +
      "&supportsAllDrives=true&fields=id,name";
    const rm = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ name: nombreFinal }),
    });
    const dm = await rm.json();
    if (!rm.ok) throw new Error(dm?.error?.message || ("No se pudo mover (" + rm.status + ")."));

    return new Response(JSON.stringify({ ok: true, movida: true, carpetaId: dm.id, nombre: dm.name }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

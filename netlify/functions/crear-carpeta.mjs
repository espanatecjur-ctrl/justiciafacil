// ============================================================
// JusticiaFácil · Crea (o reutiliza) la carpeta de una garantía en Drive
// Estructura:  Unidad compartida → Área (UCP/UCM/UDP) → "ROL · correo" → garantía
// Usa la MISMA cuenta de servicio de Google que JurisConecta.
// Variables de entorno en Netlify:
//   GOOGLE_SERVICE_ACCOUNT  = el JSON completo de la credencial
//   GOOGLE_DRIVE_FOLDER_ID  = ID de la unidad compartida (raíz)
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

// Busca una carpeta por nombre dentro de un padre; si no existe, la crea.
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

// Recorre una RUTA (Área → solicita → garantía) creando cada nivel si falta.
async function carpetaDeRuta(accessToken, raizId, ruta) {
  let parentId = raizId;
  for (const nombre of ruta) {
    if (!nombre) continue;
    parentId = await buscarOCrearCarpeta(accessToken, String(nombre), parentId);
  }
  return parentId;
}

// Solo BUSCA una carpeta por nombre dentro de un padre (no la crea). Devuelve id o null.
async function soloBuscarCarpeta(accessToken, nombre, parentId) {
  const seguro = String(nombre).replace(/'/g, "\\'");
  const q = `name='${seguro}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const rb = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true",
    { headers: { Authorization: "Bearer " + accessToken } }
  );
  const db = await rb.json();
  return db.files && db.files.length > 0 ? db.files[0].id : null;
}

// Recorre una ruta SOLO buscando (sin crear). Devuelve id de la última carpeta o null si falta alguna.
async function verificarRuta(accessToken, raizId, ruta) {
  let parentId = raizId;
  for (const nombre of ruta) {
    if (!nombre) continue;
    const id = await soloBuscarCarpeta(accessToken, String(nombre), parentId);
    if (!id) return null;
    parentId = id;
  }
  return parentId;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const { area, solicita, garantia, soloVerificar } = await req.json();
    if (!area || !garantia) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos (área o garantía)" }), { status: 400 });
    }

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const credBruto = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!folderId || !credBruto) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan variables de entorno en Netlify (GOOGLE_DRIVE_FOLDER_ID / GOOGLE_SERVICE_ACCOUNT)" }), { status: 500 });
    }

    const cred = JSON.parse(credBruto);
    let privateKey = cred.private_key || "";
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");

    const accessToken = await obtenerAccessToken(cred.client_email, privateKey);

    // Ruta: Área → "ROL · correo" → garantía. (solicita es opcional)
    const ruta = [area, solicita, garantia].filter(Boolean).map(String);

    // Modo solo verificar: NO crea nada, solo dice si ya existe.
    if (soloVerificar) {
      const id = await verificarRuta(accessToken, folderId, ruta);
      return new Response(JSON.stringify({
        ok: true,
        existe: !!id,
        carpetaId: id || null,
        link: id ? "https://drive.google.com/drive/folders/" + id : null,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const carpetaId = await carpetaDeRuta(accessToken, folderId, ruta);

    return new Response(JSON.stringify({
      ok: true,
      carpetaId,
      link: "https://drive.google.com/drive/folders/" + carpetaId,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
};

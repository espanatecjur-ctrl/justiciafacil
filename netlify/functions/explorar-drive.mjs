// ============================================================
// JusticiaFácil · Explorar Drive (leer, NO crear)
// Sirve para escoger una carpeta / Unidad compartida y ver sus documentos.
// Usa la MISMA cuenta de servicio que crear-carpeta / subir-documento.
//
// Acciones (POST { accion, ... }):
//   { accion: "cuenta" }                 -> { ok, correo }   (correo de la cuenta de servicio)
//   { accion: "unidades" }               -> { ok, unidades: [{id,name}] }
//   { accion: "listar", carpetaId }      -> { ok, items: [...] }
//   { accion: "resolver", entrada }      -> { ok, item: {...} }  (de un enlace o ID pegado)
//
// Variables de entorno en Netlify (ya existen):
//   GOOGLE_SERVICE_ACCOUNT  = JSON completo de la credencial
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
    scope: "https://www.googleapis.com/auth/drive.readonly",
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

// Extrae el ID de Drive de un enlace pegado (carpeta o archivo) o devuelve el texto tal cual si ya es un ID.
function extraerId(entrada) {
  const t = String(entrada || "").trim();
  if (!t) return "";
  const m =
    t.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
    t.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/) ||
    t.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    t.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    t.match(/\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Si no trae "/", probablemente ya es un ID pelón.
  if (!t.includes("/") && !t.includes(" ")) return t;
  return "";
}

const CAMPOS = "files(id,name,mimeType,iconLink,thumbnailLink,webViewLink,modifiedTime,size),nextPageToken";

// Lista todo lo que hay dentro de una carpeta (o de la raíz de una Unidad compartida).
async function listarCarpeta(accessToken, carpetaId) {
  const seguro = String(carpetaId).replace(/'/g, "\\'");
  const q = `'${seguro}' in parents and trashed=false`;
  let items = [];
  let pageToken = "";
  for (let i = 0; i < 6; i++) {
    const url =
      "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&fields=" + encodeURIComponent(CAMPOS) +
      "&orderBy=folder,name" +
      "&pageSize=200" +
      "&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true" +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || ("Drive respondió " + r.status));
    items = items.concat(d.files || []);
    pageToken = d.nextPageToken || "";
    if (!pageToken) break;
  }
  return items;
}

// Lista TODOS los documentos bajando por todas las subcarpetas (recursivo, con topes de seguridad).
async function listarTodoRecursivo(accessToken, raizId) {
  const TOPE_CARPETAS = 400;   // máximo de carpetas a revisar
  const TOPE_NIVELES = 25;     // máximo de profundidad
  const archivos = [];
  const vistas = new Set();
  let revisadas = 0;
  // cola de { id, ruta }
  const cola = [{ id: raizId, ruta: "" }];
  while (cola.length) {
    const actual = cola.shift();
    if (vistas.has(actual.id)) continue;
    vistas.add(actual.id);
    if (revisadas++ > TOPE_CARPETAS) break;
    if (actual.ruta.split("/").length > TOPE_NIVELES) continue;
    const items = await listarCarpeta(accessToken, actual.id);
    for (const it of items) {
      if (it.mimeType === "application/vnd.google-apps.folder") {
        cola.push({ id: it.id, ruta: actual.ruta ? actual.ruta + "/" + it.name : it.name });
      } else {
        archivos.push({ ...it, ruta: actual.ruta || "" });
      }
    }
  }
  return archivos;
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const body = await req.json();
    const accion = body.accion || "";

    const credBruto = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!credBruto) {
      return new Response(JSON.stringify({ ok: false, error: "Falta GOOGLE_SERVICE_ACCOUNT en Netlify." }), { status: 500 });
    }
    const cred = JSON.parse(credBruto);

    // La cuenta de servicio: solo necesita el correo, sin pedir token.
    if (accion === "cuenta") {
      return new Response(JSON.stringify({ ok: true, correo: cred.client_email || "" }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    let privateKey = cred.private_key || "";
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
    const accessToken = await obtenerAccessToken(cred.client_email, privateKey);

    if (accion === "unidades") {
      const url = "https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=drives(id,name)";
      const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || ("Drive respondió " + r.status));
      return new Response(JSON.stringify({ ok: true, unidades: d.drives || [], correo: cred.client_email }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (accion === "listar") {
      const carpetaId = String(body.carpetaId || "").trim();
      if (!carpetaId) return new Response(JSON.stringify({ ok: false, error: "Falta carpetaId." }), { status: 400 });
      const items = await listarCarpeta(accessToken, carpetaId);
      return new Response(JSON.stringify({ ok: true, items }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (accion === "listar_todo") {
      const carpetaId = String(body.carpetaId || "").trim();
      if (!carpetaId) return new Response(JSON.stringify({ ok: false, error: "Falta carpetaId." }), { status: 400 });
      const items = await listarTodoRecursivo(accessToken, carpetaId);
      return new Response(JSON.stringify({ ok: true, items }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (accion === "sugerir") {
      // Busca carpetas cuyo nombre contenga alguno de los textos (expediente, crédito, gar).
      const textos = Array.isArray(body.textos) ? body.textos : [];
      const limpios = textos
        .map((t) => String(t || "").trim())
        .filter((t) => t.length >= 3)
        .slice(0, 6);
      const vistos = new Set();
      const resultados = [];
      for (const t of limpios) {
        const seguro = t.replace(/'/g, "\\'");
        const q = `mimeType='application/vnd.google-apps.folder' and name contains '${seguro}' and trashed=false`;
        const url =
          "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
          "&fields=" + encodeURIComponent("files(id,name)") +
          "&pageSize=20&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true";
        const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
        const d = await r.json();
        if (r.ok && Array.isArray(d.files)) {
          for (const f of d.files) {
            if (!vistos.has(f.id)) { vistos.add(f.id); resultados.push({ id: f.id, name: f.name, coincide: t }); }
          }
        }
      }
      return new Response(JSON.stringify({ ok: true, sugerencias: resultados }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (accion === "buscar") {
      // Búsqueda inteligente: carpetas Y archivos cuyo nombre contenga el texto.
      const texto = String(body.texto || "").trim();
      if (texto.length < 2) return new Response(JSON.stringify({ ok: true, carpetas: [], archivos: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      const seguro = texto.replace(/'/g, "\\'");
      const base = "&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true";

      // 1) carpetas que coinciden
      const qCarp = `mimeType='application/vnd.google-apps.folder' and name contains '${seguro}' and trashed=false`;
      const rCarp = await fetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(qCarp) +
        "&fields=" + encodeURIComponent("files(id,name)") + "&pageSize=30" + base,
        { headers: { Authorization: "Bearer " + accessToken } });
      const dCarp = await rCarp.json();
      const carpetas = (rCarp.ok && Array.isArray(dCarp.files)) ? dCarp.files.map((f) => ({ id: f.id, name: f.name })) : [];

      // 2) archivos que coinciden (no carpetas)
      const qArch = `mimeType!='application/vnd.google-apps.folder' and name contains '${seguro}' and trashed=false`;
      const rArch = await fetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(qArch) +
        "&fields=" + encodeURIComponent("files(id,name,mimeType,webViewLink,parents)") + "&pageSize=25" + base,
        { headers: { Authorization: "Bearer " + accessToken } });
      const dArch = await rArch.json();
      let archivos = (rArch.ok && Array.isArray(dArch.files)) ? dArch.files : [];

      // 3) resolver el nombre de la carpeta contenedora (para decir "en qué carpeta está")
      const padres = new Set();
      archivos.forEach((a) => { if (a.parents && a.parents[0]) padres.add(a.parents[0]); });
      const nombrePadre = {};
      for (const pid of Array.from(padres).slice(0, 25)) {
        try {
          const rp = await fetch("https://www.googleapis.com/drive/v3/files/" + pid + "?fields=name&supportsAllDrives=true",
            { headers: { Authorization: "Bearer " + accessToken } });
          const dp = await rp.json();
          if (rp.ok) nombrePadre[pid] = dp.name || "";
        } catch { /* ignora */ }
      }
      archivos = archivos.map((a) => ({
        id: a.id, name: a.name, mimeType: a.mimeType, webViewLink: a.webViewLink || null,
        carpeta: a.parents && a.parents[0] ? (nombrePadre[a.parents[0]] || "") : "",
      }));

      return new Response(JSON.stringify({ ok: true, carpetas, archivos }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (accion === "resolver") {
      const id = extraerId(body.entrada);
      if (!id) return new Response(JSON.stringify({ ok: false, error: "No reconocí un enlace o ID de Drive." }), { status: 400 });
      const url = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) +
        "?fields=id,name,mimeType,webViewLink&supportsAllDrives=true";
      const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
      const d = await r.json();
      if (!r.ok) {
        const msg = d?.error?.message || ("Drive respondió " + r.status);
        return new Response(JSON.stringify({ ok: false, error: msg + " — ¿ya agregaste la cuenta de servicio como Lector?" }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, item: d }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "Acción no reconocida." }), { status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

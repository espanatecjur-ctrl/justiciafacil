// ============================================================
// JusticiaFácil · Sincronizar Drive → almacén del sistema (Supabase Storage)
// Copia SOLO lo que falta (opción B), por tandas para no pasarse del tiempo.
//
// POST { casoId, carpetaId }  ->  { ok, copiados, saltados, restantes, errores }
//
// Variables de entorno en Netlify:
//   GOOGLE_SERVICE_ACCOUNT   (ya existe)  · lee Drive
//   SUPABASE_SERVICE_KEY     (NUEVA, secreta) · escribe en Storage + tabla
//   SUPABASE_URL             (opcional; si no, usa el del proyecto)
//
// Requiere: bucket privado "expediente-docs" y tabla "drive_copia".
// ============================================================
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const BUCKET = "expediente-docs";
const MAX_POR_TANDA = 8;        // cuántos archivos nuevos copia por llamada
const LIMITE_BYTES = 45 * 1024 * 1024; // 45 MB por archivo (tope de seguridad)

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

// Lista lo que hay DIRECTO dentro de una carpeta (archivos y subcarpetas).
async function listarNivel(accessToken, carpetaId) {
  const seguro = String(carpetaId).replace(/'/g, "\\'");
  const q = `'${seguro}' in parents and trashed=false`;
  const campos = "files(id,name,mimeType,size),nextPageToken";
  let items = [];
  let pageToken = "";
  for (let i = 0; i < 6; i++) {
    const url =
      "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(q) +
      "&fields=" + encodeURIComponent(campos) +
      "&orderBy=name&pageSize=200" +
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

const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_PROFUNDIDAD = 8;   // no bajar más de 8 niveles de subcarpetas
const MAX_ARCHIVOS = 3000;   // tope de seguridad para no tronar el tiempo de la función

// Lista TODOS los archivos de una carpeta, bajando también a sus subcarpetas.
// Cada archivo trae `.rutaSub` = subcarpetas por las que pasó (para organizar la copia).
async function listarArchivos(accessToken, carpetaId, rutaSub = "", profundidad = 0, acumulado = []) {
  if (profundidad > MAX_PROFUNDIDAD || acumulado.length >= MAX_ARCHIVOS) return acumulado;
  const items = await listarNivel(accessToken, carpetaId);
  for (const it of items) {
    if (acumulado.length >= MAX_ARCHIVOS) break;
    if (it.mimeType === FOLDER_MIME) {
      await listarArchivos(accessToken, it.id, rutaSub ? `${rutaSub}/${it.name}` : it.name, profundidad + 1, acumulado);
    } else {
      acumulado.push({ ...it, rutaSub });
    }
  }
  return acumulado;
}

// Convierte los Google nativos (Docs/Sheets/Slides) a PDF; el resto se baja tal cual.
function planDeDescarga(mime) {
  const m = mime || "";
  if (m === "application/vnd.google-apps.document" ||
      m === "application/vnd.google-apps.spreadsheet" ||
      m === "application/vnd.google-apps.presentation" ||
      m === "application/vnd.google-apps.drawing") {
    return { exportar: true, mimeFinal: "application/pdf", sufijo: ".pdf" };
  }
  if (m.startsWith("application/vnd.google-apps")) return null; // formularios, etc.: no se copian
  return { exportar: false, mimeFinal: m || "application/octet-stream", sufijo: "" };
}

async function descargarDeDrive(accessToken, file, plan) {
  const url = plan.exportar
    ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(plan.mimeFinal)}`
    : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + accessToken } });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("descarga " + r.status + " " + t.slice(0, 120));
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return buf;
}

// Limpia un pedazo de ruta para el almacén: sin acentos, sin espacios ni signos raros
// (evita el error "InvalidKey" de Supabase Storage con nombres como "JESÚS", "O.T. 50299", etc.)
function limpiarSegmento(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9 _-]/g, "")                   // quita puntos, comas, etc.
    .trim()
    .replace(/\s+/g, "-")                              // espacios -> guion
    .replace(/-+/g, "-")
    .slice(0, 80) || "sin-dato";
}

async function subirAStorage(serviceKey, path, buf, mime) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(path)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": mime || "application/octet-stream",
      "x-upsert": "true",
    },
    body: buf,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("storage " + r.status + " " + t.slice(0, 120));
  }
}

async function anotarCopia(serviceKey, fila) {
  const url = `${SUPABASE_URL}/rest/v1/drive_copia?on_conflict=caso_id,drive_id`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(fila),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error("tabla " + r.status + " " + t.slice(0, 120));
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const { casoId, carpetaId, area, noCredito, nombreCliente, soloContar } = await req.json();
    if (!casoId || !carpetaId) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan casoId o carpetaId." }), { status: 400 });
    }
    // Carpeta base en el almacén: área/número de crédito/cliente (nueva) si viene; si no, casoId (como antes).
    // Cada pedazo se limpia (sin acentos/espacios/puntos) para que Supabase Storage no rechace la ruta.
    const clienteSlug = (nombreCliente || "").trim() || "Sin cliente";
    const carpetaBase = area
      ? `${limpiarSegmento(area)}/${limpiarSegmento(noCredito || casoId)}/${limpiarSegmento(clienteSlug)}`
      : casoId;

    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "Falta SUPABASE_SERVICE_KEY en Netlify (llave secreta de Supabase)." }), { status: 500 });
    }
    const credBruto = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!credBruto) {
      return new Response(JSON.stringify({ ok: false, error: "Falta GOOGLE_SERVICE_ACCOUNT en Netlify." }), { status: 500 });
    }
    const cred = JSON.parse(credBruto);
    let privateKey = cred.private_key || "";
    if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
    const accessToken = await obtenerAccessToken(cred.client_email, privateKey);

    // 1) ¿Qué ya está copiado? (opción B: saltar lo existente)
    const yaRes = await fetch(
      `${SUPABASE_URL}/rest/v1/drive_copia?select=drive_id&caso_id=eq.${encodeURIComponent(casoId)}`,
      { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } }
    );
    const yaLista = yaRes.ok ? await yaRes.json() : [];
    const yaCopiados = new Set((yaLista || []).map((x) => x.drive_id));

    // 2) Archivos en Drive
    const archivos = await listarArchivos(accessToken, carpetaId);
    const pendientes = archivos.filter((f) => !yaCopiados.has(f.id) && planDeDescarga(f.mimeType));

    // Modo "solo contar": avisa cuántos faltan Y sus nombres, no copia nada (para el panel "Documentos fijos").
    if (soloContar) {
      return new Response(JSON.stringify({
        ok: true,
        total: archivos.length,
        copiados: yaCopiados.size,
        pendientes: pendientes.length,
        pendientesLista: pendientes.slice(0, 300).map((f) => ({
          nombre: (f.rutaSub ? f.rutaSub + " / " : "") + f.name,
          mime: f.mimeType,
          tamano: Number(f.size || 0),
        })),
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    let copiados = 0;
    const errores = [];
    const tanda = pendientes.slice(0, MAX_POR_TANDA);

    for (const f of tanda) {
      try {
        const tam = Number(f.size || 0);
        if (tam && tam > LIMITE_BYTES) { errores.push(`${f.name}: muy grande (${Math.round(tam / 1048576)} MB)`); continue; }
        const plan = planDeDescarga(f.mimeType);
        const buf = await descargarDeDrive(accessToken, f, plan);
        const rutaSubLimpia = f.rutaSub ? f.rutaSub.split("/").map(limpiarSegmento).join("/") : "";
        const path = `${carpetaBase}${rutaSubLimpia ? "/" + rutaSubLimpia : ""}/${f.id}${plan.sufijo}`;
        await subirAStorage(serviceKey, path, buf, plan.mimeFinal);
        await anotarCopia(serviceKey, {
          caso_id: casoId,
          carpeta_id: carpetaId,
          drive_id: f.id,
          nombre: (f.rutaSub ? f.rutaSub + " / " : "") + f.name + plan.sufijo,
          mime: plan.mimeFinal,
          storage_path: path,
          tamano: buf.length,
          actualizado_en: new Date().toISOString(),
        });
        copiados++;
      } catch (e) {
        errores.push(`${f.name}: ${String((e && e.message) || e)}`);
      }
    }

    const restantes = pendientes.length - tanda.length + errores.filter((x) => !x.includes("muy grande")).length;
    return new Response(JSON.stringify({
      ok: true,
      copiados,
      saltados: yaCopiados.size,
      total: archivos.length,
      restantes: Math.max(0, pendientes.length - copiados),
      errores,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

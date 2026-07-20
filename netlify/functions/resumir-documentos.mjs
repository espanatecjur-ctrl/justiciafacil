// ============================================================
// JusticiaFácil · Resumir documentos (uno por uno, en UNA sola
// llamada a Gemini para todos, no una llamada por documento).
// Respuestas cortas a propósito, para gastar lo mínimo.
//
// POST { documentos: [{ nombre, url }] } -> { ok, resumenes: [{ nombre, tipo, resumen }] }
// ============================================================

import crypto from "crypto";

const MODELO = "gemini-2.5-flash"; // 2.5-flash-lite ya no está disponible para llaves nuevas de Google
const MAX_DOCUMENTOS = 6; // bajado de 20 — el frontend manda varias tandas si hay más
const UMBRAL_INLINE = 15 * 1024 * 1024; // hasta este tamaño, se manda directo en el mensaje (más rápido)
const LIMITE_BYTES_DOC = 45 * 1024 * 1024; // más grande que esto ya no se procesa (por tiempo/memoria de la función)

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// Token de acceso de Google (para leer archivos que vienen de una carpeta de
// Drive escogida en "Documentos → pre-dictamen" — esos NO son URLs de
// Supabase, son links de Google Drive y necesitan este otro tipo de llave).
let cacheTokenGoogle = null;
async function obtenerAccessTokenGoogle() {
  if (cacheTokenGoogle && cacheTokenGoogle.exp > Date.now() / 1000 + 60) return cacheTokenGoogle.token;
  const credBruto = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!credBruto) throw new Error("Falta GOOGLE_SERVICE_ACCOUNT en Netlify.");
  const cred = JSON.parse(credBruto);
  let privateKey = cred.private_key || "";
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  const ahora = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = { iss: cred.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: ahora, exp: ahora + 3600 };
  const sinFirma = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claim));
  const firma = crypto.createSign("RSA-SHA256").update(sinFirma).sign(privateKey).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const jwt = sinFirma + "." + firma;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + encodeURIComponent(jwt),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("No se obtuvo access_token de Google: " + JSON.stringify(data));
  cacheTokenGoogle = { token: data.access_token, exp: ahora + 3600 };
  return data.access_token;
}

// Llave de servicio (server-side, la misma que ya usa "Documentos Fijos" para
// leer el almacén privado) — la pública (anon) no alcanza si el bucket no es
// realmente público, por eso se prueban las dos: primero la de servicio.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_ANON_KEY = "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";

async function descargarComoBuffer(url) {
  // ¿Es un link de Google Drive (carpeta escogida en Dirección)? Esos no se
  // leen con la llave de Supabase — necesitan el token de Google y el
  // endpoint real de descarga (el link "/preview" es solo un visor HTML).
  const mDrive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (mDrive) {
    const fileId = mDrive[1];
    const token = await obtenerAccessTokenGoogle();
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`No se pudo descargar de Drive (HTTP ${r.status})`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > LIMITE_BYTES_DOC) throw new Error(`Documento muy grande (>${Math.round(LIMITE_BYTES_DOC / (1024 * 1024))}MB), se omitió.`);
    const mime = r.headers.get("content-type") || "application/pdf";
    return { buffer: buf, mime };
  }
  // Si no, es de Supabase Storage.
  const intentar = async (key) => fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  let r = SUPABASE_SERVICE_KEY ? await intentar(SUPABASE_SERVICE_KEY) : null;
  if (!r || !r.ok) r = await intentar(SUPABASE_ANON_KEY);
  if (!r.ok) throw new Error(`No se pudo descargar (HTTP ${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > LIMITE_BYTES_DOC) throw new Error(`Documento muy grande (>${Math.round(LIMITE_BYTES_DOC / (1024 * 1024))}MB), se omitió.`);
  const mime = r.headers.get("content-type") || "application/pdf";
  return { buffer: buf, mime };
}

// Documentos grandes (>UMBRAL_INLINE) no se mandan en el mensaje directo —
// se suben primero al "File API" de Gemini (soporta hasta 2GB) y solo se
// referencia el archivo ya subido. Documentos chicos siguen yendo directo
// (inline), que es más rápido y no necesita este paso extra.
async function subirArchivoGemini(buffer, mime, nombre, apiKey) {
  const inicio = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buffer.length),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: nombre.slice(0, 100) } }),
  });
  const uploadUrl = inicio.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("No se pudo iniciar la subida del documento a Gemini.");
  const subida = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: buffer,
  });
  const data = await subida.json();
  if (!data?.file?.uri) throw new Error("Gemini no regresó el archivo subido.");
  // Espera a que quede listo (documentos normalmente quedan ACTIVE de inmediato; solo video/audio tardan).
  let archivo = data.file;
  let intentos = 0;
  while (archivo.state === "PROCESSING" && intentos < 10) {
    await new Promise((res) => setTimeout(res, 1000));
    const chk = await fetch(`https://generativelanguage.googleapis.com/v1beta/${archivo.name}?key=${apiKey}`);
    archivo = await chk.json();
    intentos++;
  }
  if (archivo.state !== "ACTIVE") throw new Error("El documento no quedó listo en Gemini a tiempo — intenta de nuevo.");
  return { uri: archivo.uri, mime: archivo.mimeType || mime };
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "Falta GEMINI_API_KEY en Netlify." }), { status: 500 });
  }
  try {
    const { documentos } = await req.json();
    if (!Array.isArray(documentos) || documentos.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No llegó ningún documento." }), { status: 400 });
    }
    const tanda = documentos.slice(0, MAX_DOCUMENTOS);

    const parts = [];
    const nombresEnOrden = [];
    const erroresDescarga = [];
    // Se descargan TODOS al mismo tiempo (no uno por uno) — si no, con varios
    // documentos se pasa del tiempo límite de la función. Se mantiene el
    // ORDEN exacto de "tanda" porque la IA alinea su respuesta por posición.
    const resultados = await Promise.all(tanda.map(async (d) => {
      try {
        const { buffer, mime } = await descargarComoBuffer(d.url);
        if (buffer.length <= UMBRAL_INLINE) {
          return { ok: true, nombre: d.nombre, modo: "inline", base64: buffer.toString("base64"), mime };
        }
        const subido = await subirArchivoGemini(buffer, mime, d.nombre, apiKey);
        return { ok: true, nombre: d.nombre, modo: "file", uri: subido.uri, mime: subido.mime };
      } catch (e) {
        return { ok: false, nombre: d.nombre, error: String((e && e.message) || e) };
      }
    }));
    for (const res of resultados) {
      nombresEnOrden.push(res.nombre); // se incluye igual, para que el índice no se desalinee
      if (res.ok && res.modo === "inline") parts.push({ inline_data: { mime_type: res.mime, data: res.base64 } });
      else if (res.ok && res.modo === "file") parts.push({ file_data: { mime_type: res.mime, file_uri: res.uri } });
      else erroresDescarga.push(`${res.nombre}: ${res.error}`);
    }
    if (parts.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: `No se pudo descargar ningún documento (ej: ${erroresDescarga[0] || "motivo desconocido"}). No se generó nada por adivinar.` }), { status: 400 });
    }

    const instruccion = `Aquí van ${nombresEnOrden.length} documentos de un expediente legal, EN ESTE ORDEN:
${nombresEnOrden.map((n, i) => `${i + 1}. ${n}`).join("\n")}

1) Para CADA documento (en el mismo orden), da un resumen de 1-2 renglones (máximo 30 palabras) de qué es y, sobre todo, QUÉ RESUELVE o QUÉ ORDENA (ej. "resuelve tener por contestada la demanda", "acuerda admitir la promoción", "resuelve declarar la prescripción") — y su tipo (Promoción, Acuerdo, Contrato, Demanda, Auto Judicial, Emplazamiento, Contestación de Demanda, Solicitud, Notificación, Comprobante, Verificación, Dictamen, Sentencia, Otro). Usa "Promoción" cuando el documento es un escrito que una parte presenta pidiendo algo, y "Acuerdo" cuando es la respuesta/resolución del juzgado a esa promoción.

2) Además, busca en TODOS los documentos juntos estos datos generales del caso (si aparecen en más de uno, usa el más completo/confiable):
   - administradora o banco que cede los derechos
   - número de crédito
   - dirección completa del inmueble/garantía
   - nombre del deudor / acreditado
   - juzgado
   - número de expediente

Responde ÚNICAMENTE con un JSON válido (sin texto extra, sin \`\`\`), con esta forma EXACTA:
{
  "resumenes": [ { "nombre": "string — el mismo nombre que te di", "tipo": "string", "resumen": "string, máximo 30 palabras" } ],
  "datos_generales": { "administradora": "string o null", "numero_credito": "string o null", "direccion": "string o null", "deudor": "string o null", "juzgado": "string o null", "expediente": "string o null" }
}
No inventes contenido que no esté en el documento — si no se puede leer, di "No se pudo leer el contenido". Si un dato general no aparece, usa null.`;

    parts.push({ text: instruccion });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 6000, responseMimeType: "application/json" },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || "Error al hablar con Gemini.";
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: resp.status });
    }
    const cand = data?.candidates?.[0];
    const texto = cand?.content?.parts?.map((p) => p.text).join("") || "";
    if (!texto) {
      const razon = cand?.finishReason || "desconocida";
      return new Response(JSON.stringify({ ok: false, error: `La IA no regresó texto (motivo: ${razon}). Prueba con menos documentos.` }), { status: 502 });
    }
    // Extractor tolerante: por si Google agrega ```json o texto alrededor del objeto.
    let salida;
    try { salida = JSON.parse(texto); }
    catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (m) { try { salida = JSON.parse(m[0]); } catch { /* sigue null */ } }
    }
    if (!salida) {
      return new Response(JSON.stringify({ ok: false, error: "La IA no regresó un JSON válido.", crudo: texto.slice(0, 800) }), { status: 502 });
    }

    return new Response(JSON.stringify({
      ok: true,
      resumenes: salida.resumenes || [],
      datos_generales: salida.datos_generales || null,
      modelo: MODELO,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

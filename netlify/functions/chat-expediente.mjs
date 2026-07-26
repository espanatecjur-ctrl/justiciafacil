// ============================================================
// JusticiaFácil · Chat con IA sobre los documentos de UN expediente
// ------------------------------------------------------------
// El modelo SOLO recibe los documentos que el frontend le manda en
// "documentos" (los de ESTE expediente/garantía) — nunca navega ni
// tiene acceso a documentos de otros casos: no se le manda nada más,
// así que no hay forma de que "se salga" del expediente.
//
// POST {
//   clave,                          // mismo id que usas en resumen_documentos_ia (solicitud/caso)
//   documentos: [{ nombre, url }],  // SOLO los de este expediente
//   pregunta: "string",
//   historial: [{ rol: "user"|"model", texto }],   // opcional, turnos previos
//   archivosCache: [{ nombre, uri, mime }],         // opcional — si ya se subieron antes, no se vuelven a bajar/subir
// } -> { ok, respuesta, documentos_citados, archivos, modelo }
//
// Variables de entorno en Netlify: GEMINI_API_KEY (la misma de siempre)
// ============================================================

import crypto from "crypto";

const MODELO = "gemini-2.5-flash";
const UMBRAL_INLINE = 15 * 1024 * 1024;
const LIMITE_BYTES_DOC = 45 * 1024 * 1024;
const MAX_DOCUMENTOS = 20; // si el expediente trae más, solo se cargan los primeros 20 al chat

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

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

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_ANON_KEY = "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";

async function descargarComoBuffer(url) {
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
  const intentar = async (key) => fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  let r = SUPABASE_SERVICE_KEY ? await intentar(SUPABASE_SERVICE_KEY) : null;
  if (!r || !r.ok) r = await intentar(SUPABASE_ANON_KEY);
  if (!r.ok) throw new Error(`No se pudo descargar (HTTP ${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > LIMITE_BYTES_DOC) throw new Error(`Documento muy grande (>${Math.round(LIMITE_BYTES_DOC / (1024 * 1024))}MB), se omitió.`);
  const mime = r.headers.get("content-type") || "application/pdf";
  return { buffer: buf, mime };
}

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
    headers: { "Content-Length": String(buffer.length), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: buffer,
  });
  const data = await subida.json();
  if (!data?.file?.uri) throw new Error("Gemini no regresó el archivo subido.");
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
    const { clave, documentos, pregunta, historial, archivosCache } = await req.json();
    if (!clave) return new Response(JSON.stringify({ ok: false, error: "Falta el identificador del expediente." }), { status: 400 });
    if (!pregunta || !pregunta.trim()) return new Response(JSON.stringify({ ok: false, error: "Falta la pregunta." }), { status: 400 });
    const listaDocs = Array.isArray(documentos) ? documentos.slice(0, MAX_DOCUMENTOS) : [];
    if (listaDocs.length === 0 && (!Array.isArray(archivosCache) || archivosCache.length === 0)) {
      return new Response(JSON.stringify({ ok: false, error: "Este expediente no tiene documentos para consultar." }), { status: 400 });
    }

    // Si el frontend ya trae archivos subidos de un turno anterior (mismo
    // chat, misma sesión), NO se vuelven a bajar ni a subir — se reusa la
    // referencia. Los archivos de Gemini File API viven ~48h.
    let archivosListos = [];
    if (Array.isArray(archivosCache) && archivosCache.length > 0) {
      archivosListos = archivosCache;
    } else {
      const resultados = await Promise.all(listaDocs.map(async (d) => {
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
      archivosListos = resultados.filter((r) => r.ok);
      if (archivosListos.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: `No se pudo leer ningún documento (ej: ${resultados[0]?.error || "motivo desconocido"}).` }), { status: 400 });
      }
    }

    const nombresDisponibles = archivosListos.map((a) => a.nombre).join(", ");
    const instruccionSistema = `Eres el asistente de consulta de UN SOLO expediente de DIIPA (clave interna: ${clave}).
Los ÚNICOS documentos que existen para ti son estos ${archivosListos.length}: ${nombresDisponibles}.
No tienes acceso a ningún otro documento, expediente, garantía o caso de DIIPA — aunque el usuario te pregunte por otro expediente, TÚ NO LO CONOCES.
Reglas:
- Contesta ÚNICAMENTE con base en el contenido de estos documentos.
- Si la respuesta no está en ellos, dilo claramente: "No encuentro esa información en los documentos de este expediente." No inventes fechas, montos ni expedientes.
- Cuando puedas, indica de qué documento sacaste el dato (por su nombre).
- Sé breve y directo, como le hablarías a un abogado que ya conoce el caso — no repitas contexto innecesario.
- Si te preguntan por otro expediente o cliente que no es este, responde que solo puedes consultar los documentos de este expediente.`;

    const partsDocumentos = archivosListos.map((a) =>
      a.modo === "file" ? { file_data: { mime_type: a.mime, file_uri: a.uri } } : { inline_data: { mime_type: a.mime, data: a.base64 } }
    );

    // Primer turno: instrucción + todos los documentos + (si no hay historial) la pregunta.
    const contents = [{ role: "user", parts: [{ text: instruccionSistema }, ...partsDocumentos] }];
    contents.push({ role: "model", parts: [{ text: "Entendido. Ya tengo estos documentos listos. ¿Qué quieres saber del expediente?" }] });

    for (const turno of Array.isArray(historial) ? historial : []) {
      if (!turno?.texto) continue;
      contents.push({ role: turno.rol === "model" ? "model" : "user", parts: [{ text: turno.texto }] });
    }
    contents.push({ role: "user", parts: [{ text: pregunta.trim() }] });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
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
      return new Response(JSON.stringify({ ok: false, error: `La IA no regresó respuesta (motivo: ${razon}).` }), { status: 502 });
    }

    return new Response(JSON.stringify({
      ok: true,
      respuesta: texto.trim(),
      archivos: archivosListos.map((a) => ({ nombre: a.nombre, uri: a.uri, mime: a.mime, modo: a.modo, base64: a.base64 })),
      modelo: MODELO,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

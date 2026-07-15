// ============================================================
// JusticiaFácil · Analizar documentos con IA (Gemini)
// ------------------------------------------------------------
// Lee los documentos de una garantía (PDFs/imágenes) y contesta
// un cuestionario fijo de "estado actual de la carpeta", además
// de identificar el documento principal (nombre, tipo, acto que
// resuelve). Se llama UNA sola vez por garantía+posición — el
// resultado se guarda en analisis_documental_ia y no se vuelve
// a generar salvo que el usuario pida "Regenerar" a propósito.
//
// POST { documentos: [{ nombre, url }], posicion } -> JSON con
// las respuestas.
//
// Variables de entorno en Netlify:
//   GEMINI_API_KEY   (la MISMA que ya usa JurisConecta)
//
// Control de costo: modelo económico, máximo 10 documentos por
// llamada, tope de tamaño por documento, y máximo de tokens de
// salida — para que cada análisis cueste centavos de dólar.
// ============================================================

import crypto from "crypto";

const MODELO = "gemini-2.5-flash";
const MAX_DOCUMENTOS = 6; // bajado de 10 — con más, no cabe en los 10s que da Netlify por defecto
const LIMITE_BYTES_DOC = 15 * 1024 * 1024; // 15 MB por documento

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

// Llave de servicio de Supabase (server-side, la misma que usa "Documentos
// Fijos" para leer el almacén privado) — respaldo: la pública (anon).
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_ANON_KEY = "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";

async function descargarComoBase64(url) {
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
    if (buf.length > LIMITE_BYTES_DOC) throw new Error("Documento muy grande (>15MB), se omitió.");
    const mime = r.headers.get("content-type") || "application/pdf";
    return { base64: buf.toString("base64"), mime };
  }
  // Si no, es de Supabase Storage.
  const intentar = async (key) => fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  let r = SUPABASE_SERVICE_KEY ? await intentar(SUPABASE_SERVICE_KEY) : null;
  if (!r || !r.ok) r = await intentar(SUPABASE_ANON_KEY);
  if (!r.ok) throw new Error(`No se pudo descargar (HTTP ${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > LIMITE_BYTES_DOC) throw new Error("Documento muy grande (>15MB), se omitió.");
  const mime = r.headers.get("content-type") || "application/pdf";
  return { base64: buf.toString("base64"), mime };
}

// Preguntas fijas (por ahora Actor y Demandado comparten el mismo
// cuestionario; cuando Paola dé las preguntas específicas de
// Demandado, se separan en dos bloques distintos aquí).
const ESQUEMA_RESPUESTA = `
Responde ÚNICAMENTE con un JSON válido (nada de texto antes o después, nada de \`\`\`), con esta forma EXACTA:

{
  "documento_principal": {
    "nombre": "string — cómo se llama el documento principal que leíste",
    "tipo": "string — ej. Promoción, Acuerdo, Notificación, Sentencia, Estado de cuenta, Convenio, Otro",
    "acto_que_resuelve": "string — qué resuelve o para qué sirve ese documento"
  },
  "estado_actual": {
    "es_jurisdiccion_voluntaria": "sí" | "no" | "no determinado",
    "expediente_juzgado_jv": "string o null",
    "fecha_presentacion_jv": "string o null",
    "emplazamiento_jv": "string o null",
    "notificacion_inicio_jv": "string o null",
    "ultima_actuacion": { "fecha": "string o null", "que_se_pidio": "string o null", "que_se_resolvio": "string o null" },
    "fecha_ultimo_pago_acreditado": "string o null",
    "demandas": [
      { "expediente_juzgado": "string", "fecha_presentacion": "string o null", "emplazamiento": "string o null", "afecta_recuperacion_credito": "string" }
    ]
  },
  "resoluciones_y_recursos": {
    "sentencia": "string o null — si existe, resume cuál",
    "apelacion": "string o null — si se interpuso, resume",
    "amparo": "string o null — si se promovió, resume"
  },
  "prescripcion": { "esta_prescrita": "sí" | "no" | "no determinado", "motivo": "string" },
  "documentos_solicitados": { "detalle": "string — qué se pidió de la carpeta y qué se resolvió" },
  "convenios": {
    "notificados_firmados_ratificados": "sí" | "no" | "parcial" | "no aplica",
    "estado_cuenta_firma_perito": "sí" | "no" | "no aplica"
  }
}

Si un dato no aparece en los documentos, usa null o "no determinado" — NUNCA inventes fechas, expedientes ni cifras.
`.trim();

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "Falta GEMINI_API_KEY en Netlify (la misma llave de JurisConecta)." }), { status: 500 });
  }
  try {
    const { documentos, posicion } = await req.json();
    if (!Array.isArray(documentos) || documentos.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No llegó ningún documento." }), { status: 400 });
    }
    const tanda = documentos.slice(0, MAX_DOCUMENTOS);

    const parts = [];
    const analizados = [];
    // Se descargan TODOS al mismo tiempo (no uno por uno) — si no, con varios
    // documentos se pasa del tiempo límite de la función y Netlify corta a
    // la mitad (por eso a veces regresaba una página de error en vez de JSON).
    const resultados = await Promise.all(tanda.map(async (d) => {
      try {
        const { base64, mime } = await descargarComoBase64(d.url);
        return { ok: true, d, base64, mime };
      } catch (e) {
        return { ok: false, d, error: String((e && e.message) || e) };
      }
    }));
    for (const res of resultados) {
      if (res.ok) {
        parts.push({ inline_data: { mime_type: res.mime, data: res.base64 } });
        analizados.push({ nombre: res.d.nombre, url: res.d.url });
      } else {
        // documento que no se pudo leer: se omite, pero se avisa en la respuesta
        analizados.push({ nombre: res.d.nombre, url: res.d.url, error: res.error });
      }
    }
    if (parts.length === 0) {
      const primerError = analizados.find((a) => a.error)?.error || "motivo desconocido";
      return new Response(JSON.stringify({ ok: false, error: `No se pudo leer ninguno de los documentos (ej: ${primerError}).` }), { status: 400 });
    }

    parts.push({ text: `Eres un abogado analista de DIIPA. Lee TODOS los documentos adjuntos de este expediente (posición de DIIPA: ${posicion || "no especificada"}) y contesta el cuestionario de "estado actual de la carpeta". ${ESQUEMA_RESPUESTA}` });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 3000, responseMimeType: "application/json" },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || "Error al hablar con Gemini.";
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: resp.status });
    }
    const texto = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    let respuestas;
    try { respuestas = JSON.parse(texto); }
    catch { return new Response(JSON.stringify({ ok: false, error: "La IA no regresó un JSON válido.", crudo: texto.slice(0, 500) }), { status: 502 }); }

    return new Response(JSON.stringify({ ok: true, respuestas, documentos_analizados: analizados, modelo: MODELO }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

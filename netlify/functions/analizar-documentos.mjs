// ============================================================
// JusticiaFácil · Analizar documentos con IA (Gemini) — DE UNO EN UNO
// ------------------------------------------------------------
// Lee UN documento a la vez y COMPLETA el cuestionario de "estado
// actual de la carpeta" con lo que encuentre ahí — nunca borra lo
// que ya se sabía de documentos anteriores, solo agrega o precisa.
// El frontend hace el recorrido documento por documento y va
// guardando el avance, así nunca se pasa del tiempo por función
// aunque el expediente traiga 20+ documentos.
//
// POST { documento: { nombre, url }, respuestasPrevias: objeto|null, posicion }
//   -> { ok, respuestas (actualizadas) }
//
// Variables de entorno en Netlify:
//   GEMINI_API_KEY   (la MISMA que ya usa JurisConecta)
// ============================================================

import crypto from "crypto";

const MODELO = "gemini-2.5-flash";
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
  const intentar = async (key) => fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  let r = SUPABASE_SERVICE_KEY ? await intentar(SUPABASE_SERVICE_KEY) : null;
  if (!r || !r.ok) r = await intentar(SUPABASE_ANON_KEY);
  if (!r.ok) throw new Error(`No se pudo descargar (HTTP ${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > LIMITE_BYTES_DOC) throw new Error("Documento muy grande (>15MB), se omitió.");
  const mime = r.headers.get("content-type") || "application/pdf";
  return { base64: buf.toString("base64"), mime };
}

// Forma fija de las respuestas (para cuando todavía no hay nada acumulado).
const ESQUEMA_RESPUESTA = `
{
  "documento_principal": { "nombre": "string", "tipo": "string — ej. Promoción, Acuerdo, Notificación, Sentencia, Estado de cuenta, Convenio, Otro", "acto_que_resuelve": "string" },
  "estado_actual": {
    "es_jurisdiccion_voluntaria": "sí" | "no" | "no determinado",
    "expediente_juzgado_jv": "string o null",
    "fecha_presentacion_jv": "string o null",
    "emplazamiento_jv": "string o null",
    "notificacion_inicio_jv": "string o null",
    "ultima_actuacion": { "fecha": "string o null", "que_se_pidio": "string o null", "que_se_resolvio": "string o null" },
    "fecha_ultimo_pago_acreditado": "string o null",
    "demandas": [ { "expediente_juzgado": "string", "fecha_presentacion": "string o null", "emplazamiento": "string o null", "afecta_recuperacion_credito": "string" } ]
  },
  "resoluciones_y_recursos": { "sentencia": "string o null", "apelacion": "string o null", "amparo": "string o null" },
  "prescripcion": { "esta_prescrita": "sí" | "no" | "no determinado", "motivo": "string" },
  "documentos_solicitados": { "detalle": "string" },
  "convenios": { "notificados_firmados_ratificados": "sí" | "no" | "parcial" | "no aplica", "estado_cuenta_firma_perito": "sí" | "no" | "no aplica" },
  "registral_rppc": {
    "distrito_registral": "string o null",
    "propiedad": {
      "direccion": "string o null",
      "fecha_inscripcion": "string o null",
      "no_escritura": "string o null",
      "fecha_escritura": "string o null",
      "acto": "string o null — ej. Compraventa, Donación, Adjudicación, Cesión",
      "titular_registral": "string o null",
      "enajenante": "string o null",
      "notario": "string o null",
      "monto_operacion": "string o null",
      "superficie": "string o null",
      "existe_liberacion_gravamen": "sí" | "no" | "no determinado"
    },
    "gravamen": {
      "direccion": "string o null",
      "fecha_inscripcion": "string o null",
      "no_escritura": "string o null",
      "fecha_escritura": "string o null",
      "acto": "string o null — normalmente Hipoteca",
      "acreedor": "string o null",
      "deudor": "string o null",
      "notario": "string o null",
      "monto_operacion": "string o null",
      "equivalente": "string o null — el monto en UDIS o veces salario si el documento lo da así"
    },
    "gravamen_adicional": {
      "aplica": "sí" | "no",
      "direccion": "string o null",
      "fecha_inscripcion": "string o null",
      "no_escritura": "string o null",
      "fecha_escritura": "string o null",
      "acto": "string o null",
      "acreedor": "string o null",
      "deudor": "string o null",
      "notario": "string o null",
      "monto_operacion": "string o null",
      "equivalente": "string o null"
    },
    "otros_gravamenes": [
      { "tipo": "string — ej. Embargo, Servidumbre, Anotación preventiva, Litigio inscrito, Fideicomiso", "acreedor_o_beneficiario": "string o null", "monto": "string o null", "fecha_inscripcion": "string o null", "vigente": "sí" | "no" | "no determinado", "detalle": "string" }
    ],
    "anotaciones_adicionales": "string o null — litigios inscritos, embargos, fideicomisos, anotaciones marginales que no encajen arriba",
    "conclusion": "string o null — conclusión breve del estado registral"
  },
  "datos_juicio_adicionales": {
    "fecha_ultimo_pago": "string (fecha) o null — según el estado de cuenta, el contrato o la demanda: la fecha del último pago hecho por el acreditado/deudor antes de caer en mora",
    "tipo_accion": "hipotecaria" | "personal" | "ejecutiva mercantil" | "otra" | null,
    "esta_emplazado": "sí" | "no" | "no determinado",
    "fecha_emplazamiento": "string (fecha) o null",
    "convenio_ratificado": "sí" | "no" | "no aplica",
    "fecha_convenio": "string (fecha) o null",
    "quien_posee_actualmente": "string o null — quién vive/ocupa el inmueble según los documentos (el deudor, un tercero, DIIPA, nadie/vacío)",
    "inicio_posesion": "string (fecha) o null",
    "hay_demanda_despojo": "sí" | "no" | "no determinado",
    "cargas": {
      "predial_al_corriente": "sí" | "no" | "no determinado",
      "agua_al_corriente": "sí" | "no" | "no determinado",
      "condominio_al_corriente": "sí" | "no" | "no determinado",
      "adeudos_fiscales": "string o null — detalle si el documento lo menciona",
      "adeudos_laborales": "string o null"
    }
  }
}`.trim();

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "Falta GEMINI_API_KEY en Netlify (la misma llave de JurisConecta)." }), { status: 500 });
  }
  try {
    const { documento, respuestasPrevias, posicion } = await req.json();
    if (!documento || !documento.url) {
      return new Response(JSON.stringify({ ok: false, error: "No llegó ningún documento." }), { status: 400 });
    }

    let base64, mime;
    try {
      const d = await descargarComoBase64(documento.url);
      base64 = d.base64; mime = d.mime;
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: `No se pudo leer "${documento.nombre}": ${String((e && e.message) || e)}` }), { status: 400 });
    }

    const instruccion = respuestasPrevias
      ? `Eres un abogado analista de DIIPA (posición de DIIPA: ${posicion || "no especificada"}). Ya tienes este avance del cuestionario de "estado actual de la carpeta", armado con documentos anteriores:

${JSON.stringify(respuestasPrevias)}

Ahora lee ESTE documento nuevo ("${documento.nombre}") y ACTUALIZA el JSON de arriba:
- Si este documento confirma o completa algo que estaba en null/"no determinado", complétalo.
- Si este documento trae una demanda que NO está en la lista "demandas", agrégala (no dupliques las que ya estén).
- Si este documento es una actuación MÁS RECIENTE que la que ya tenías en "ultima_actuacion", reemplázala; si es más vieja, deja la que ya tenías.
- "registral_rppc": esta información suele venir en Certificados de Gravamen, Certificados de Libertad de Gravamen, impresiones o boletas del RPP/RPPC, escrituras inscritas, o el propio contrato de crédito con hipoteca. "propiedad" es el dueño/antecedente del inmueble; "gravamen" es la hipoteca principal (normalmente la del crédito que se está dictaminando); "gravamen_adicional" SOLO se llena si hay un segundo gravamen distinto (ej. Cofinavit, Infonavit, otro acreedor) — si no hay, deja "aplica": "no" y el resto en null. Cualquier otro gravamen, embargo o anotación que no encaje en esas dos secciones va en la lista "otros_gravamenes" (no dupliques los que ya estén, compara por acreedor + tipo + fecha de inscripción).
- "datos_juicio_adicionales": "fecha_ultimo_pago" y "tipo_accion" suelen venir del contrato de crédito o del estado de cuenta; "esta_emplazado"/"fecha_emplazamiento" de las actuaciones o la razón de notificación; "convenio_ratificado" solo si hay un convenio judicial de por medio; "quien_posee_actualmente"/"inicio_posesion" de actas de entrega-posesión o visitas; "cargas" solo si el documento lo menciona explícitamente (si no dice nada, deja "no determinado", no adivines).
- NUNCA borres ni cambies a null algo que ya estaba bien contestado, a menos que este documento lo contradiga claramente.
- "documento_principal" describe SIEMPRE el documento MÁS IMPORTANTE que hayas visto hasta ahora (contrato, sentencia o dictamen suelen ser más relevantes que un acuse o una compulsa) — cámbialo solo si este nuevo documento es más relevante que el que tenías.

Responde ÚNICAMENTE con el JSON COMPLETO actualizado (misma forma, nada de texto ni \`\`\` alrededor):
${ESQUEMA_RESPUESTA}`
      : `Eres un abogado analista de DIIPA (posición de DIIPA: ${posicion || "no especificada"}). Lee este documento ("${documento.nombre}") y arranca el cuestionario de "estado actual de la carpeta" con lo que encuentres — es apenas el primer documento, así que muchos campos quedarán en null o "no determinado" hasta leer los demás, eso está bien.

Responde ÚNICAMENTE con este JSON (nada de texto ni \`\`\` alrededor):
${ESQUEMA_RESPUESTA}

Si un dato no aparece en este documento, usa null o "no determinado" — NUNCA inventes fechas, expedientes ni cifras.`;

    const parts = [{ inline_data: { mime_type: mime, data: base64 } }, { text: instruccion }];

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

    return new Response(JSON.stringify({ ok: true, respuestas, modelo: MODELO }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

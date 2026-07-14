// ============================================================
// JusticiaFácil · Resumir documentos (uno por uno, en UNA sola
// llamada a Gemini para todos, no una llamada por documento).
// Respuestas cortas a propósito, para gastar lo mínimo.
//
// POST { documentos: [{ nombre, url }] } -> { ok, resumenes: [{ nombre, tipo, resumen }] }
// ============================================================

const MODELO = "gemini-2.5-flash-lite"; // el más barato — aquí solo pedimos resúmenes cortos
const MAX_DOCUMENTOS = 20;
const LIMITE_BYTES_DOC = 15 * 1024 * 1024;

async function descargarComoBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > LIMITE_BYTES_DOC) throw new Error("Documento muy grande (>15MB), se omitió.");
  const mime = r.headers.get("content-type") || "application/pdf";
  return { base64: buf.toString("base64"), mime };
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
    for (const d of tanda) {
      try {
        const { base64, mime } = await descargarComoBase64(d.url);
        parts.push({ inline_data: { mime_type: mime, data: base64 } });
        nombresEnOrden.push(d.nombre);
      } catch (e) {
        nombresEnOrden.push(d.nombre); // se incluye igual, para que el índice no se desalinee
      }
    }

    const instruccion = `Aquí van ${nombresEnOrden.length} documentos de un expediente legal, EN ESTE ORDEN:
${nombresEnOrden.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Para CADA documento (en el mismo orden), da un resumen de 1-2 renglones (máximo 30 palabras) de qué es y qué dice — y su tipo (Contrato, Demanda, Acuerdo, Notificación, Emplazamiento, Dictamen, Estado de cuenta, Comprobante, Otro).

Responde ÚNICAMENTE con un JSON válido (sin texto extra, sin \`\`\`), con esta forma EXACTA:
[
  { "nombre": "string — el mismo nombre que te di", "tipo": "string", "resumen": "string, máximo 30 palabras" }
]
No inventes contenido que no esté en el documento — si no se puede leer, di "No se pudo leer el contenido".`;

    parts.push({ text: instruccion });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000, responseMimeType: "application/json" },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || "Error al hablar con Gemini.";
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: resp.status });
    }
    const texto = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    let resumenes;
    try { resumenes = JSON.parse(texto); }
    catch { return new Response(JSON.stringify({ ok: false, error: "La IA no regresó un JSON válido.", crudo: texto.slice(0, 500) }), { status: 502 }); }

    return new Response(JSON.stringify({ ok: true, resumenes, modelo: MODELO }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

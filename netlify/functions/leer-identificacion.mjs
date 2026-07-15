// ============================================================
// JusticiaFácil · Leer identificación (INE / RFC / CURP) con IA
// ------------------------------------------------------------
// Lee uno o varios documentos de identidad (fotos o PDFs) y saca
// los datos de la persona para autollenar un contrato.
//
// POST { documentos: [{ nombre, base64, mime }] } -> { ok, datos }
//
// Variables de entorno en Netlify: GEMINI_API_KEY (la misma de siempre).
// ============================================================

const MODELO = "gemini-2.5-flash";
const MAX_DOCUMENTOS = 6;

const ESQUEMA = `
Responde ÚNICAMENTE con un JSON válido (nada de texto antes/después, nada de \`\`\`), con esta forma EXACTA:
{
  "nombre_completo": "string o null",
  "rfc": "string o null",
  "curp": "string o null",
  "fecha_nacimiento": "string (DD/MM/AAAA) o null",
  "sexo": "H" | "M" | null,
  "domicilio": "string o null — el domicilio completo tal como aparece",
  "clave_elector": "string o null — solo si es INE",
  "vigencia_ine": "string o null — solo si es INE",
  "tipo_documento_detectado": "INE" | "RFC (constancia SAT)" | "CURP" | "Otro"
}
Si un dato no aparece o no se puede leer con certeza, usa null. NUNCA inventes.
`.trim();

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
    const parts = tanda
      .filter((d) => d?.base64 && d?.mime)
      .map((d) => ({ inline_data: { mime_type: d.mime, data: d.base64 } }));
    if (parts.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No se pudo leer ningún documento." }), { status: 400 });
    }
    parts.push({ text: `Estos son documentos de identidad (INE, constancia de RFC y/o CURP) de UNA sola persona. Léelos todos y junta los datos en una sola respuesta (si un dato sale en más de un documento, usa el más completo/claro). ${ESQUEMA}` });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: "application/json" },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const msg = data?.error?.message || "Error al hablar con Gemini.";
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: resp.status });
    }
    const texto = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    let datos;
    try { datos = JSON.parse(texto); }
    catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (m) { try { datos = JSON.parse(m[0]); } catch { /* sigue */ } }
    }
    if (!datos) {
      return new Response(JSON.stringify({ ok: false, error: "La IA no regresó un JSON válido.", crudo: texto.slice(0, 500) }), { status: 502 });
    }
    return new Response(JSON.stringify({ ok: true, datos, modelo: MODELO }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

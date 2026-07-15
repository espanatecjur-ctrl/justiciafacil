// ============================================================
// JusticiaFácil · Leer documento genérico (PDF / Word / imagen) con IA
// ------------------------------------------------------------
// A diferencia de leer-identificacion.mjs (que solo lee INE/RFC/CURP
// con un esquema fijo), esta función recibe LOS CAMPOS de la plantilla
// de contrato que esté abierta en el editor (id + etiqueta de cada uno)
// y le pide a la IA que llene los que encuentre explícitamente en el
// documento subido — sirve para CUALQUIER plantilla del sistema.
//
// POST { documentos: [{ nombre, base64, mime }], campos: [{ id, label,
//        opciones? }] } -> { ok, datos: { [campoId]: valor|null } }
//
// .docx no lo entiende Gemini directamente (a diferencia de PDF/imagen),
// así que aquí se descomprime con jszip y se saca el texto de
// word/document.xml antes de mandarlo como texto plano.
//
// Variables de entorno en Netlify: GEMINI_API_KEY (la misma de siempre).
// ============================================================
import JSZip from "jszip";

const MODELO = "gemini-2.5-flash";
const MAX_DOCUMENTOS = 4;
const MAX_CAMPOS = 60; // límite razonable por llamada

const esDocx = (mime, nombre) =>
  mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
  /\.docx$/i.test(nombre || "");

/** Extrae el texto plano de un .docx (base64) leyendo word/document.xml. */
async function textoDeDocx(base64) {
  const buffer = Buffer.from(base64, "base64");
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file("word/document.xml");
  if (!doc) return "";
  const xml = await doc.async("string");
  // Los saltos de párrafo en el XML son </w:p> — se convierten a salto de
  // línea real para que el texto no salga todo pegado.
  const conSaltos = xml.replace(/<\/w:p>/g, "\n");
  const soloTexto = conSaltos.replace(/<[^>]+>/g, "");
  return soloTexto
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
    const { documentos, campos } = await req.json();
    if (!Array.isArray(documentos) || documentos.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No llegó ningún documento." }), { status: 400 });
    }
    if (!Array.isArray(campos) || campos.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No llegaron los campos de la plantilla." }), { status: 400 });
    }

    const tandaDocs = documentos.slice(0, MAX_DOCUMENTOS);
    const tandaCampos = campos.slice(0, MAX_CAMPOS);

    // Arma las partes que se mandan a Gemini: PDFs/imágenes van tal cual
    // (inline_data), los .docx se descomprimen aquí y van como texto plano.
    const parts = [];
    for (const d of tandaDocs) {
      if (!d?.base64) continue;
      if (esDocx(d.mime, d.nombre)) {
        try {
          const texto = await textoDeDocx(d.base64);
          if (texto) parts.push({ text: `--- Documento "${d.nombre || "documento.docx"}" (Word) ---\n${texto}` });
        } catch {
          // Si el .docx no se pudo descomprimir, se ignora en vez de tronar toda la petición.
        }
      } else if (d.mime) {
        parts.push({ inline_data: { mime_type: d.mime, data: d.base64 } });
      }
    }
    if (parts.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No se pudo leer ningún documento." }), { status: 400 });
    }

    // Esquema dinámico: una llave por cada campo de la plantilla, con su
    // etiqueta como pista y, si es de tipo "select", las opciones válidas.
    const lineasEsquema = tandaCampos
      .map((c) => {
        const opciones = Array.isArray(c.opciones) && c.opciones.length
          ? ` (debe ser EXACTAMENTE una de estas opciones: ${c.opciones.map((o) => `"${o}"`).join(", ")}, o null)`
          : "";
        return `  "${c.id}": "string o null — ${c.label}${opciones}"`;
      })
      .join(",\n");

    parts.push({
      text:
        `Estos son uno o varios documentos (pueden ser actas, contratos ya firmados, listados de datos, identificaciones, etc.). ` +
        `Léelos y, con base ÚNICAMENTE en lo que dicen expresamente, llena el siguiente JSON. ` +
        `Responde SOLO con el JSON, sin texto antes ni después, sin \`\`\`, con esta forma EXACTA:\n{\n${lineasEsquema}\n}\n` +
        `Reglas: (1) si un dato no aparece con certeza en el documento, usa null — NUNCA inventes ni infieras; ` +
        `(2) los montos van solo con números y punto decimal, sin "$" ni comas; ` +
        `(3) las fechas se dejan tal como aparecen en el documento; ` +
        `(4) si un campo de opciones no calza exactamente con ninguna, usa null.`,
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000, responseMimeType: "application/json" },
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

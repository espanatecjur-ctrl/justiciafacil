// ============================================================
// JusticiaFácil · Asistente IA — Consulta general del sistema
// ------------------------------------------------------------
// A diferencia de chat-expediente.mjs (que solo ve los documentos
// de UN caso), esta función puede buscar EN VIVO dentro de la base
// de datos de JusticiaFácil — por nombre de cliente, código,
// número de garantía o expediente — y contestar con datos reales,
// actualizados al momento en que se pregunta.
//
// Cómo se mantiene rápido y barato: en vez de mandarle a Gemini toda
// la base de datos, se usa "function calling" — el modelo decide
// cuándo necesita buscar algo, pide la búsqueda, y solo se le
// regresan los 10 resultados más relevantes de esa búsqueda
// puntual. Nunca ve el resto de la base de datos.
//
// POST { pregunta, historial: [{ rol, texto }] }
// -> { ok, respuesta, busquedas_realizadas }
// ============================================================

const SUPABASE_URL = "https://dquoysougxqknvgooiqg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";
const LLAVE_SB = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODELO = "gemini-2.5-flash";

const HERRAMIENTA = {
  functionDeclarations: [
    {
      name: "buscar_cliente_o_caso",
      description: "Busca clientes o casos jurídicos en JusticiaFácil por nombre del cliente, código de cliente, número de garantía (gar_id) o número de expediente. Regresa hasta 10 resultados con su información general.",
      parameters: {
        type: "OBJECT",
        properties: {
          termino: { type: "STRING", description: "Nombre, código, gar_id o expediente a buscar (búsqueda parcial, no distingue mayúsculas)" },
        },
        required: ["termino"],
      },
    },
  ],
};

async function buscarClienteOCaso(termino) {
  const q = encodeURIComponent(`%${termino}%`);
  const campos = "cliente_nombre,cliente_codigo,gar_id,expediente,unidad,etapa_actual,estatus_general,juzgado,materia";
  const filtro = `or=(cliente_nombre.ilike.${q},cliente_codigo.ilike.${q},gar_id.ilike.${q},expediente.ilike.${q})`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=${campos}&${filtro}&limit=10`, {
    headers: { apikey: LLAVE_SB, Authorization: `Bearer ${LLAVE_SB}` },
  });
  if (!r.ok) return { error: "No se pudo consultar la base de datos." };
  const filas = await r.json();
  return { resultados: filas, total: filas.length };
}

export default async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  if (!GEMINI_API_KEY) return new Response(JSON.stringify({ ok: false, error: "Falta GEMINI_API_KEY en Netlify." }), { status: 500 });

  try {
    const { pregunta, historial } = await req.json();
    if (!pregunta || !pregunta.trim()) return new Response(JSON.stringify({ ok: false, error: "Falta la pregunta." }), { status: 400 });

    const instruccionSistema = `Eres el asistente general de JusticiaFácil (DIIPA). Puedes buscar clientes y casos jurídicos por nombre, código, número de garantía o expediente usando la herramienta buscar_cliente_o_caso — úsala siempre que la pregunta se refiera a un cliente o caso específico. No inventes datos: si la búsqueda no encuentra nada, dilo claramente. No des información de un caso sin haberlo buscado primero. Sé breve y directo.`;

    const contents = [];
    for (const turno of Array.isArray(historial) ? historial : []) {
      if (!turno?.texto) continue;
      contents.push({ role: turno.rol === "model" ? "model" : "user", parts: [{ text: turno.texto }] });
    }
    contents.push({ role: "user", parts: [{ text: pregunta.trim() }] });

    const cuerpoBase = {
      systemInstruction: { parts: [{ text: instruccionSistema }] },
      tools: [HERRAMIENTA],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    let busquedasRealizadas = [];

    // Primera vuelta: el modelo decide si necesita buscar algo.
    let resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({ ...cuerpoBase, contents }),
    });
    let data = await resp.json();
    if (!resp.ok) return new Response(JSON.stringify({ ok: false, error: data?.error?.message || "Error al hablar con Gemini." }), { status: resp.status });

    let candidato = data?.candidates?.[0];
    let parteFuncion = candidato?.content?.parts?.find((p) => p.functionCall);

    // Si pidió buscar, se ejecuta la búsqueda real y se le regresa el resultado (máximo 3 rondas para evitar loops).
    let rondas = 0;
    while (parteFuncion && rondas < 3) {
      rondas++;
      const { name, args } = parteFuncion.functionCall;
      let resultado = { error: "Herramienta desconocida." };
      if (name === "buscar_cliente_o_caso") {
        resultado = await buscarClienteOCaso(args?.termino || "");
        busquedasRealizadas.push(args?.termino || "");
      }
      contents.push({ role: "model", parts: [{ functionCall: parteFuncion.functionCall }] });
      contents.push({ role: "user", parts: [{ functionResponse: { name, response: resultado } }] });

      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({ ...cuerpoBase, contents }),
      });
      data = await resp.json();
      if (!resp.ok) return new Response(JSON.stringify({ ok: false, error: data?.error?.message || "Error al hablar con Gemini." }), { status: resp.status });
      candidato = data?.candidates?.[0];
      parteFuncion = candidato?.content?.parts?.find((p) => p.functionCall);
    }

    const texto = candidato?.content?.parts?.filter((p) => p.text).map((p) => p.text).join("") || "";
    if (!texto) return new Response(JSON.stringify({ ok: false, error: "La IA no regresó respuesta." }), { status: 502 });

    return new Response(JSON.stringify({ ok: true, respuesta: texto.trim(), busquedas_realizadas: busquedasRealizadas }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

// ============================================================
// JusticiaFácil · Puente para aprobar/rechazar prioridad RDC
// ------------------------------------------------------------
// El navegador de GAD/DGE llama a ESTA función (mismo sitio, sin
// problema de CORS ni de exponer secretos). Esta función, del lado
// del servidor, es la única que conoce el secreto compartido y se
// lo manda a JurisConecta para que apruebe. El secreto nunca viaja
// al navegador de nadie.
//
// POST { solicitudId, accion: "aprobar" | "rechazar", aprobadoPor }
//   -> { ok, estado }
//
// Variables de entorno en Netlify (JusticiaFácil):
//   RDC_BRIDGE_SECRET (secreta) — debe ser IDÉNTICA a la que está
//   configurada en el proyecto de Netlify de JurisConecta.
//   JURISCONECTA_URL (opcional) — si no está, usa el dominio de producción.
// ============================================================
const JURISCONECTA_URL = process.env.JURISCONECTA_URL || "https://jurisconecta.netlify.app";
const BRIDGE_SECRET = process.env.RDC_BRIDGE_SECRET || "";

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Método no permitido" };
  if (!BRIDGE_SECRET) return { statusCode: 500, body: "Falta RDC_BRIDGE_SECRET en el servidor de JusticiaFácil." };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "JSON inválido." }; }

  const { solicitudId, accion, aprobadoPor } = body;
  if (!solicitudId || !["aprobar", "rechazar"].includes(accion) || !aprobadoPor) {
    return { statusCode: 400, body: "Faltan datos: solicitudId, accion (aprobar|rechazar), aprobadoPor." };
  }

  try {
    const r = await fetch(`${JURISCONECTA_URL}/.netlify/functions/aprobar-prioridad-rdc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-secret": BRIDGE_SECRET },
      body: JSON.stringify({ solicitudId, accion, aprobadoPor, origen: "justiciafacil" }),
    });
    const texto = await r.text();
    return { statusCode: r.status, body: texto };
  } catch (e) {
    console.error("No se pudo contactar a JurisConecta:", e?.message || e);
    return { statusCode: 502, body: "No se pudo contactar a JurisConecta. Intenta de nuevo." };
  }
}

// ============================================================
// JusticiaFácil · Enlace temporal a las copias del almacén (Supabase Storage)
// Genera URLs firmadas (temporales) para ver/descargar las copias
// del bucket privado "expediente-docs", sin exponer Drive.
//
// POST { paths: ["casoId/driveId", ...], expira?: segundos }
//   -> { ok, urls: { "casoId/driveId": "https://...firmada..." } }
//
// Variables de entorno en Netlify:
//   SUPABASE_SERVICE_KEY (secreta) · firma los enlaces
//   SUPABASE_URL (opcional)
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const BUCKET = "expediente-docs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const { paths, expira } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(JSON.stringify({ ok: true, urls: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "Falta SUPABASE_SERVICE_KEY en Netlify." }), { status: 500 });
    }
    const expiresIn = Math.min(Math.max(Number(expira) || 3600, 60), 24 * 3600);
    const limpios = paths.map((p) => String(p)).filter(Boolean).slice(0, 60);

    // Firma en lote (createSignedUrls)
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn, paths: limpios }),
    });
    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.message) || ("Storage respondió " + r.status);
      return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const urls = {};
    for (const item of data || []) {
      if (item && item.signedURL && !item.error) {
        urls[item.path] = `${SUPABASE_URL}/storage/v1${item.signedURL}`;
      }
    }
    return new Response(JSON.stringify({ ok: true, urls }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

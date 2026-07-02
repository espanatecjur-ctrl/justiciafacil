// ============================================================
//  JusticiaFácil · Pixel de rastreo de correo
// ------------------------------------------------------------
//  Cuando el destinatario abre el correo, su cliente de correo
//  carga esta imagen 1x1 y aquí marcamos el envío como "abierto".
//  Devuelve un GIF transparente de 1x1.
//
//  Nota: Gmail/Apple Mail a veces bloquean o precargan imágenes,
//  así que el "abierto" es indicativo, no 100% exacto (igual que HubSpot).
// ============================================================
const SB_URL = process.env.SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const SB_KEY = process.env.SUPABASE_KEY || "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";

// GIF transparente de 1x1.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export default async (req) => {
  try {
    const token = new URL(req.url).searchParams.get("t");
    if (token) {
      await fetch(`${SB_URL}/rest/v1/envio_correo?token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ estado: "abierto", abierto_at: new Date().toISOString() }),
      });
    }
  } catch { /* nunca fallamos: siempre devolvemos el pixel */ }

  return new Response(GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
};

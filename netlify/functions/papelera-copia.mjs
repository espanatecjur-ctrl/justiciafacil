// ============================================================
// JusticiaFácil · Papelera de la copia fija (NO toca Drive)
// Manda a papelera (recuperable), recupera, o borra definitivo un
// documento ya guardado en el almacén del sistema (Supabase Storage).
//
// POST { accion, casoId, driveId }
//   accion = "a_papelera"  -> papelera = true   (recuperable)
//   accion = "recuperar"   -> papelera = false
//   accion = "borrar"      -> borra el archivo del almacén + la fila
//   -> { ok }  |  { ok:false, error }
//
// Variables de entorno en Netlify:
//   SUPABASE_SERVICE_KEY (secreta) · escribe en Storage + tabla
//   SUPABASE_URL (opcional)
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const BUCKET = "expediente-docs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), { status: 405 });
  }
  try {
    const { accion, casoId, driveId } = await req.json();
    if (!accion || !casoId || !driveId) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan accion, casoId o driveId." }), { status: 400 });
    }
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: "Falta SUPABASE_SERVICE_KEY en Netlify." }), { status: 500 });
    }
    const headers = {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
    };
    const filtro =
      `caso_id=eq.${encodeURIComponent(casoId)}&drive_id=eq.${encodeURIComponent(driveId)}`;

    // --- Mandar a papelera / Recuperar: solo cambia la marca ---
    if (accion === "a_papelera" || accion === "recuperar") {
      const papelera = accion === "a_papelera";
      const r = await fetch(`${SUPABASE_URL}/rest/v1/drive_copia?${filtro}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ papelera, actualizado_en: new Date().toISOString() }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return new Response(JSON.stringify({ ok: false, error: "tabla " + r.status + " " + t.slice(0, 120) }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, papelera }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // --- Borrar definitivo: quita el archivo del almacén y la fila ---
    if (accion === "borrar") {
      // 1) ubica el archivo en el almacén
      const g = await fetch(
        `${SUPABASE_URL}/rest/v1/drive_copia?select=storage_path&${filtro}`,
        { headers }
      );
      const filas = g.ok ? await g.json() : [];
      const path = Array.isArray(filas) && filas[0] ? filas[0].storage_path : null;

      // 2) borra el archivo del bucket (si existe)
      if (path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURI(path)}`, {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
        }).catch(() => {});
      }

      // 3) borra la fila de la tabla
      const d = await fetch(`${SUPABASE_URL}/rest/v1/drive_copia?${filtro}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=minimal" },
      });
      if (!d.ok) {
        const t = await d.text().catch(() => "");
        return new Response(JSON.stringify({ ok: false, error: "tabla " + d.status + " " + t.slice(0, 120) }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, borrado: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "Acción no reconocida." }), { status: 400 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e && e.message) || e) }), { status: 500 });
  }
};

// ============================================================
// JusticiaFácil · ROBOT de boletines · Motor (4A · modo PRUEBA)
// Corre solo todos los días a las 9:00 AM hora de México.
//   Netlify usa UTC -> 9:00 AM México (UTC-6) = 15:00 UTC = "0 15 * * *"
// En esta etapa NO inventa acuerdos: solo registra una "revisión"
// en la tabla robot_log para comprobar que el motor trabaja.
// En la 4B le conectamos la fuente real de Sinaloa.
// ============================================================

const SUPABASE_URL = process.env.JF_SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const SUPABASE_KEY = process.env.JF_SUPABASE_KEY || "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export default async () => {
  const inicio = Date.now();
  try {
    // 1) Leer cuántos expedientes hay que revisar
    const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=expediente&limit=2000`, { headers });
    const casos = r.ok ? await r.json() : [];
    const total = casos.filter((c) => (c.expediente || "").trim()).length;

    // 2) (4B) Aquí irá la consulta real al boletín de Sinaloa por cada expediente.
    //    Por ahora, modo PRUEBA: no se inventan acuerdos.
    const nuevos = 0;

    // 3) Registrar la corrida en la bitácora
    await fetch(`${SUPABASE_URL}/rest/v1/robot_log`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        fuente: "PRUEBA",
        total_expedientes: total,
        nuevos,
        estado: "ok",
        detalle: `Revisión de prueba: ${total} expedientes revisados en ${Date.now() - inicio} ms. Sin fuente conectada todavía.`,
      }),
    });

    return new Response(JSON.stringify({ ok: true, total, nuevos }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await fetch(`${SUPABASE_URL}/rest/v1/robot_log`, {
      method: "POST", headers,
      body: JSON.stringify({ fuente: "PRUEBA", estado: "error", detalle: String(e) }),
    }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
};

// Cron de Netlify (UTC). 9:00 AM México (UTC-6) = 15:00 UTC.
export const config = { schedule: "0 15 * * *" };

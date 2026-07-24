// ============================================================
// Dirección · Bandeja de "Mis validaciones" (todas las pendientes)
// ------------------------------------------------------------
// A diferencia de misValidacionesPendientes() (que filtra por el correo
// de UNA persona, pensado para que cada quien vea lo suyo en Inicio),
// esta función trae TODO lo pendiente sin filtrar por correo — es la
// vista de supervisión que solo ve Dirección (DGE).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface PendienteCadena {
  token: string;
  area: string;             // URRJ | UCP | UCM
  slot: string;              // elabora | dil | ucm | dge | precio ...
  correo_esperado: string;
  created_at: string;
  expediente?: string | null;
  cliente_o_garantia?: string | null;
}

export const SLOT_LABEL: Record<string, string> = {
  elabora: "Elabora",
  dil: "Valida jurídico (DIL)",
  ucm: "UCM",
  dge: "Dirección (DGE)",
  precio: "Cálculo de precio (Contabilidad)",
  gad: "Administrativo (GAD)",
  dgc: "Comercial (DGC)",
};

/** Trae todas las solicitudes de firma/validación abiertas (sin firmar,
 *  sin rechazar), con el expediente/cliente ya resuelto para mostrar en
 *  una lista — junta predictamen (URRJ), dictamen (UCP/UCM) y caso_juridico,
 *  porque muchas solicitudes de URRJ todavía no tienen caso_id. */
export async function listarCadenaFirmasPendientes(): Promise<PendienteCadena[]> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/firma_solicitud?select=token,area,slot,correo_esperado,created_at,caso_id,predictamen_id,dictamen_id&firmado=eq.false&rechazado=eq.false&order=created_at.desc&limit=300`,
      { headers },
    );
    const filas: any[] = r.ok ? await r.json() : [];
    if (!filas.length) return [];

    const predIds = Array.from(new Set(filas.map((f) => f.predictamen_id).filter(Boolean)));
    const dictIds = Array.from(new Set(filas.map((f) => f.dictamen_id).filter(Boolean)));
    const casoIdsDirectos = Array.from(new Set(filas.map((f) => f.caso_id).filter(Boolean)));

    const [predRows, dictRows] = await Promise.all([
      predIds.length
        ? fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,caso_id,expediente,datos&id=in.(${predIds.join(",")})`, { headers }).then((x) => (x.ok ? x.json() : []))
        : Promise.resolve([] as any[]),
      dictIds.length
        ? fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=id,caso_id&id=in.(${dictIds.join(",")})`, { headers }).then((x) => (x.ok ? x.json() : []))
        : Promise.resolve([] as any[]),
    ]);
    const predMap: Record<string, any> = {}; for (const p of predRows) predMap[p.id] = p;
    const dictMap: Record<string, any> = {}; for (const d of dictRows) dictMap[d.id] = d;

    // Junta todos los caso_id que se puedan (directo, o vía predictamen/dictamen) para traer cliente/dirección de una vez.
    const casoIdsTodos = Array.from(new Set([
      ...casoIdsDirectos,
      ...predRows.map((p: any) => p.caso_id).filter(Boolean),
      ...dictRows.map((d: any) => d.caso_id).filter(Boolean),
    ]));
    const casoRows = casoIdsTodos.length
      ? await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,cliente_nombre,direccion_garantia&id=in.(${casoIdsTodos.join(",")})`, { headers }).then((x) => (x.ok ? x.json() : []))
      : [];
    const casoMap: Record<string, any> = {}; for (const c of casoRows) casoMap[c.id] = c;

    return filas.map((f) => {
      const pred = f.predictamen_id ? predMap[f.predictamen_id] : null;
      const dict = f.dictamen_id ? dictMap[f.dictamen_id] : null;
      const casoIdResuelto = f.caso_id || pred?.caso_id || dict?.caso_id || null;
      const caso = casoIdResuelto ? casoMap[casoIdResuelto] : null;
      const expediente = pred?.expediente || caso?.expediente || pred?.datos?.expediente || pred?.datos?.numeroCredito || null;
      const clienteOGarantia = caso?.cliente_nombre || caso?.direccion_garantia || null;
      // Registros viejos de UCP no guardaban "area" — la inferimos por qué id trae.
      const areaResuelta = f.area || (f.dictamen_id ? "UCP" : f.predictamen_id ? "URRJ" : "—");
      return {
        token: f.token, area: areaResuelta, slot: f.slot, correo_esperado: f.correo_esperado, created_at: f.created_at,
        expediente, cliente_o_garantia: clienteOGarantia,
      };
    });
  } catch { return []; }
}

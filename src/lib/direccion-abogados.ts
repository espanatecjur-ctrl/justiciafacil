// ============================================================
//  Dirección · abogados: asignar y semáforo de avance
// ------------------------------------------------------------
//  "Sin avance" = el expediente asignado no tiene acuerdo nuevo
//  en el boletín NI movimiento en el seguimiento en X días.
//  Ámbar a los 7 días, rojo a los 14.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export const AMBAR_DIAS = 7;
export const ROJO_DIAS = 14;

export interface Abogado {
  id: string;
  nombre: string | null;
  rol: string | null;
  foto_url?: string | null;
}

export interface AvanceAbogado {
  abogado_id: string;
  abogado_nombre: string;
  expedientes: number;
  diasSinAvance: number;      // el peor de sus expedientes
  expedientePeor: string;     // cuál está más atorado
  semaforo: "verde" | "ambar" | "rojo";
}

/** Colaboradores activos (para asignar como abogado). */
export async function listarAbogados(): Promise<Abogado[]> {
  try {
    return await sbSelect<Abogado>(
      "colaboradores",
      "select=id,nombre,rol,foto_url&activo=eq.true&order=nombre.asc",
    );
  } catch {
    return [];
  }
}

/** Asigna un abogado a una solicitud y la pasa a 'en_dictamen'. */
export async function asignarAbogado(solicitudId: string, ab: Abogado): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?id=eq.${solicitudId}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        abogado_id: ab.id, abogado_nombre: ab.nombre,
        estado: "en_dictamen", asignado_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function dias(desde: string | null): number {
  if (!desde) return 0;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const d = new Date(desde); d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoy.getTime() - d.getTime()) / 86400000));
}

/** Calcula el semáforo de avance de cada abogado con solicitudes asignadas. */
export async function avancesPorAbogado(): Promise<AvanceAbogado[]> {
  try {
    const asignadas = await sbSelect<{ abogado_id: string | null; abogado_nombre: string | null; expediente: string | null; asignado_at: string | null }>(
      "solicitud_predictamen",
      "select=abogado_id,abogado_nombre,expediente,asignado_at&abogado_id=not.is.null",
    );
    if (!asignadas.length) return [];

    // Última actividad por expediente: boletín (acuerdo) + seguimiento (movimiento).
    const [mov, acu] = await Promise.all([
      sbSelect<{ expediente: string | null; fecha_mov: string | null }>("documento_garantia", "select=expediente,fecha_mov&fecha_mov=not.is.null&order=fecha_mov.desc&limit=3000"),
      sbSelect<{ expediente: string | null; fecha_acuerdo: string | null }>("acuerdo_judicial", "select=expediente,fecha_acuerdo&order=fecha_acuerdo.desc&limit=3000"),
    ]);
    const ultima: Record<string, string> = {};
    const registrar = (exp: string | null, fecha: string | null) => {
      if (!exp || !fecha) return;
      if (!ultima[exp] || fecha > ultima[exp]) ultima[exp] = fecha;
    };
    for (const m of mov) registrar(m.expediente, m.fecha_mov);
    for (const a of acu) registrar(a.expediente, a.fecha_acuerdo);

    // Agrupar por abogado.
    const porAbogado: Record<string, { nombre: string; exps: { exp: string; dias: number }[] }> = {};
    for (const s of asignadas) {
      if (!s.abogado_id) continue;
      const exp = s.expediente || "";
      const base = exp && ultima[exp] ? ultima[exp] : s.asignado_at; // si nunca avanzó, cuenta desde que se asignó
      const d = dias(base);
      (porAbogado[s.abogado_id] ??= { nombre: s.abogado_nombre || "Abogado", exps: [] }).exps.push({ exp, dias: d });
    }

    const out: AvanceAbogado[] = [];
    for (const [id, info] of Object.entries(porAbogado)) {
      let peor = { exp: "", dias: 0 };
      for (const e of info.exps) if (e.dias >= peor.dias) peor = e;
      const semaforo = peor.dias >= ROJO_DIAS ? "rojo" : peor.dias >= AMBAR_DIAS ? "ambar" : "verde";
      out.push({
        abogado_id: id, abogado_nombre: info.nombre,
        expedientes: info.exps.length, diasSinAvance: peor.dias,
        expedientePeor: peor.exp, semaforo,
      });
    }
    // Los más atorados primero.
    out.sort((a, b) => b.diasSinAvance - a.diasSinAvance);
    return out;
  } catch {
    return [];
  }
}

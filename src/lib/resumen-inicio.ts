// ============================================================
//  Resumen del Inicio · datos reales para el tablero del día
// ------------------------------------------------------------
//  "Atrasadas" = la ÚLTIMA actuación de cada expediente cuya
//  fecha próxima ya pasó (y no está en papelera).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export interface Atrasada {
  caso_id: string | null;
  expediente: string | null;
  proxima_actuacion: string | null;
  fecha_proxima: string | null;
  asignado_a: string | null;
  fecha_mov: string | null;
  diasAtraso: number;
}

export interface Cita {
  caso_id: string | null;
  expediente: string | null;
  proxima_actuacion: string | null;
  fecha_proxima: string | null;
  asignado_a: string | null;
}

function hoy0(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Última actuación (con fecha próxima) de cada expediente, sin papelera. */
async function ultimasActuaciones(): Promise<Array<Record<string, unknown>>> {
  try {
    const q =
      "select=caso_id,expediente,proxima_actuacion,fecha_proxima,asignado_a,fecha_mov,en_papelera" +
      "&tipo=eq.actuacion&fecha_proxima=not.is.null&order=fecha_mov.desc";
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?${q}`, { headers });
    const rows: Array<Record<string, unknown>> = r.ok ? await r.json() : [];
    const vistos = new Set<string>();
    const ultimas: Array<Record<string, unknown>> = [];
    for (const d of rows) {
      if (d.en_papelera === true) continue;
      const key = String(d.caso_id || d.expediente || "");
      if (!key || vistos.has(key)) continue;
      vistos.add(key);
      ultimas.push(d);
    }
    return ultimas;
  } catch {
    return [];
  }
}

/** Actuaciones cuya fecha próxima YA pasó (atrasadas). */
export async function listarAtrasadas(): Promise<Atrasada[]> {
  const ultimas = await ultimasActuaciones();
  const hoy = hoy0().getTime();
  const out: Atrasada[] = [];
  for (const d of ultimas) {
    const fp = d.fecha_proxima ? new Date(String(d.fecha_proxima)).setHours(0, 0, 0, 0) : null;
    if (fp !== null && fp < hoy) {
      out.push({
        caso_id: (d.caso_id as string) ?? null,
        expediente: (d.expediente as string) ?? null,
        proxima_actuacion: (d.proxima_actuacion as string) ?? null,
        fecha_proxima: (d.fecha_proxima as string) ?? null,
        asignado_a: (d.asignado_a as string) ?? null,
        fecha_mov: (d.fecha_mov as string) ?? null,
        diasAtraso: Math.floor((hoy - fp) / 86400000),
      });
    }
  }
  out.sort((a, b) => b.diasAtraso - a.diasAtraso);
  return out;
}

/** Próximas actuaciones con fecha de HOY en adelante (agenda / citas). */
export async function listarAgenda(): Promise<Cita[]> {
  const ultimas = await ultimasActuaciones();
  const hoy = hoy0().getTime();
  const out: Cita[] = [];
  for (const d of ultimas) {
    const fp = d.fecha_proxima ? new Date(String(d.fecha_proxima)).setHours(0, 0, 0, 0) : null;
    if (fp !== null && fp >= hoy) {
      out.push({
        caso_id: (d.caso_id as string) ?? null,
        expediente: (d.expediente as string) ?? null,
        proxima_actuacion: (d.proxima_actuacion as string) ?? null,
        fecha_proxima: (d.fecha_proxima as string) ?? null,
        asignado_a: (d.asignado_a as string) ?? null,
      });
    }
  }
  // Las más próximas primero.
  out.sort((a, b) => (a.fecha_proxima || "").localeCompare(b.fecha_proxima || ""));
  return out;
}

/** Cuántos acuerdos del robot entraron HOY. */
export async function contarAcuerdosHoy(): Promise<number> {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=id&fecha_acuerdo=eq.${hoy}`,
      { headers },
    );
    const d: unknown[] = r.ok ? await r.json() : [];
    return d.length;
  } catch {
    return 0;
  }
}

/** Cuenta expedientes por tipo de registro (exhorto / amparo / recurso / juicio). */
export async function contarCasos(tipoRegistro: string): Promise<number> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/caso_juridico?select=id&tipo_registro=eq.${encodeURIComponent(tipoRegistro)}`,
      { headers },
    );
    const d: unknown[] = r.ok ? await r.json() : [];
    return d.length;
  } catch {
    return 0;
  }
}

/** Cuenta expedientes por unidad (URRJ / UCP / UCM / UDP). */
export async function contarPorUnidad(unidad: string): Promise<number> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/caso_juridico?select=id&unidad=eq.${encodeURIComponent(unidad)}`,
      { headers },
    );
    const d: unknown[] = r.ok ? await r.json() : [];
    return d.length;
  } catch {
    return 0;
  }
}

/** Solicitudes de contrato que aún NO se han entregado. */
export async function contarContratosPendientes(): Promise<number> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_contrato?select=estado`, { headers });
    const d: Array<{ estado: string | null }> = r.ok ? await r.json() : [];
    return d.filter((s) => String(s.estado || "").toLowerCase() !== "entregada").length;
  } catch {
    return 0;
  }
}

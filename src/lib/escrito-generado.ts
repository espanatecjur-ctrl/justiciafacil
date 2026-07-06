// ============================================================
//  Escritos generados / guardados
// ------------------------------------------------------------
//  Cada escrito que se genera desde el Editor se guarda aquí con
//  un FOLIO real. Aparece en la pestaña "Generados" y sirve para
//  reusarlo/consultarlo. Requiere la tabla `escrito_generado`.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export const ESTADOS_ESCRITO = ["generado", "archivado", "papelera"] as const;

/** Prefijo del folio según el tipo de escrito. */
export const PREFIJO_FOLIO_ESCRITO: Record<string, string> = {
  demanda_mercantil: "DM",
  demanda_civil: "DC",
  promocion: "PR",
  contestacion: "CN",
};

export interface EscritoGenerado {
  id?: string;
  folio?: string | null;
  tipo?: string | null;
  nombre_documento?: string | null;
  titulo?: string | null;
  nombre_promovente?: string | null;
  posicion?: string | null;
  apoderado?: string | null;
  valores?: Record<string, unknown> | null;
  cuerpo?: string | null;
  cuantia?: number | null;
  estado?: string | null;
  fecha_generado?: string | null;
  fecha_enviado?: string | null;
  created_at?: string | null;
}

/** Calcula el siguiente folio real: DIIPA-<PREFIJO>-<AÑO>-<NNNN>. */
export async function siguienteFolioEscrito(tipo: string): Promise<string> {
  const prefijo = PREFIJO_FOLIO_ESCRITO[tipo] ?? "ESC";
  const anio = new Date().getFullYear();
  const base = `DIIPA-${prefijo}-${anio}-`;
  let max = 0;
  try {
    const filas = await sbSelect<{ folio: string | null }>(
      "escrito_generado",
      `select=folio&tipo=eq.${encodeURIComponent(tipo)}`,
    );
    for (const f of filas) {
      if (f.folio && f.folio.startsWith(base)) {
        const n = parseInt(f.folio.slice(base.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
  } catch {
    // si falla la lectura, empezamos en 1
  }
  return base + String(max + 1).padStart(4, "0");
}

/** Guarda un escrito generado. Devuelve el folio asignado. */
export async function guardarEscrito(
  data: Omit<EscritoGenerado, "id" | "folio" | "created_at">,
): Promise<{ ok: boolean; folio?: string }> {
  try {
    const folio = await siguienteFolioEscrito(data.tipo ?? "");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/escrito_generado`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...data, folio, estado: data.estado ?? "generado" }),
    });
    return { ok: res.ok, folio: res.ok ? folio : undefined };
  } catch {
    return { ok: false };
  }
}

/** Lista los escritos guardados por estado (por defecto, los generados). */
export async function listarEscritos(estado: string = "generado"): Promise<EscritoGenerado[]> {
  try {
    return await sbSelect<EscritoGenerado>(
      "escrito_generado",
      `select=*&estado=eq.${estado}&order=created_at.desc`,
    );
  } catch {
    return [];
  }
}

/** Marca la fecha de envío por correo de un escrito, buscándolo por folio. */
export async function marcarEnviadoEscrito(folio: string, fecha?: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/escrito_generado?folio=eq.${encodeURIComponent(folio)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ fecha_enviado: fecha ?? new Date().toISOString() }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Cambia el estado (generado / archivado / papelera). */
export async function actualizarEstadoEscrito(id: string, estado: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/escrito_generado?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ estado }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

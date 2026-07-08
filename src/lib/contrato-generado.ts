// ============================================================
//  Contratos generados / guardados
// ------------------------------------------------------------
//  Cada documento que se genera desde el Editor se guarda aquí
//  con un FOLIO real. Aparece en la tabla de "Contratos
//  existentes" y sirve para reusar/auto-llenar (Paquete de Cambio).
//  Requiere la tabla `contrato_generado` (ver SQL de esta parte).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export const ESTADOS_CONTRATO = ["generado", "archivado", "papelera"] as const;

/** Prefijo del folio según el tipo de documento. */
export const PREFIJO_FOLIO: Record<string, string> = {
  cesion_adjudicataria: "CES",
  instruccion_notarial_diipa: "INS",
  solicitud_cotizacion_diipa: "SOL",
  oficio_servicios_diipa: "OFI",
  cotizacion_marco_diipa: "COT",
  carta_cambio: "CC",
  contrato_cambio: "CT",
  oficio_notarial: "OF",
  prestacion_servicios: "PS",
  prestacion_diipa: "PSP",
  comision_mercantil: "CM",
  acta_finiquito: "AF",
};

export interface ContratoGenerado {
  id?: string;
  folio?: string | null;
  tipo?: string | null;
  nombre_documento?: string | null;
  titulo?: string | null;
  nombre_cliente?: string | null;
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
export async function siguienteFolio(tipo: string): Promise<string> {
  const prefijo = PREFIJO_FOLIO[tipo] ?? "DOC";
  const anio = new Date().getFullYear();
  const base = `DIIPA-${prefijo}-${anio}-`;
  let max = 0;
  try {
    const filas = await sbSelect<{ folio: string | null }>(
      "contrato_generado",
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

/** Guarda un documento generado. Devuelve el folio asignado. */
export async function guardarContrato(
  data: Omit<ContratoGenerado, "id" | "folio" | "created_at">,
): Promise<{ ok: boolean; folio?: string }> {
  try {
    const folio = await siguienteFolio(data.tipo ?? "");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contrato_generado`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...data, folio, estado: data.estado ?? "generado" }),
    });
    return { ok: res.ok, folio: res.ok ? folio : undefined };
  } catch {
    return { ok: false };
  }
}

/** Lista los contratos guardados por estado (por defecto, los generados). */
export async function listarContratos(estado: string = "generado"): Promise<ContratoGenerado[]> {
  try {
    return await sbSelect<ContratoGenerado>(
      "contrato_generado",
      `select=*&estado=eq.${estado}&order=created_at.desc`,
    );
  } catch {
    return [];
  }
}

/** Lista las cartas de cambio registradas (para auto-llenar el contrato). */
export async function listarCartasCambio(): Promise<ContratoGenerado[]> {
  try {
    return await sbSelect<ContratoGenerado>(
      "contrato_generado",
      `select=*&tipo=eq.carta_cambio&estado=eq.generado&order=created_at.desc`,
    );
  } catch {
    return [];
  }
}

/** Marca la fecha de envío por correo de un documento, buscándolo por folio. */
export async function marcarEnviado(folio: string, fecha?: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/contrato_generado?folio=eq.${encodeURIComponent(folio)}`,
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
export async function actualizarEstadoContrato(id: string, estado: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contrato_generado?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ estado }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

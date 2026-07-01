// ============================================================
// JusticiaFácil · UFC (Formalización y Cierre) — datos
// ------------------------------------------------------------
// Lee/guarda el registro de formalizaciones (tabla 'formalizacion').
// Las cotizaciones las maneja Contabilidad; aquí solo se guarda el enlace.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface Formalizacion {
  id?: string;
  caso_id?: string | null;
  id_interno?: string | null;
  // Bloque 1
  tipo_proceso?: string | null;
  tipo_contrato?: string | null;
  direccion_garantia?: string | null;
  expediente?: string | null;
  juzgado?: string | null;
  distrito_judicial?: string | null;
  tipo_juicio?: string | null;
  via_procesal?: string | null;
  // Bloque 2
  encargado_instruccion?: string | null;
  responsable_instruccion?: string | null;
  doc_instruccion_notarial?: string | null;
  numero_notaria?: string | null;
  nombre_notario?: string | null;
  jurisdiccion_notario?: string | null;
  // Bloque 3
  doc_escritura?: string | null;
  numero_escritura?: string | null;
  fecha_escritura?: string | null;
  libro?: string | null;
  nombre_cedente?: string | null;
  sujeto_derecho_cedente?: string | null;
  nombre_cesionario?: string | null;
  sujeto_derecho_cesionario?: string | null;
  firma_apoderado?: boolean;
  firma_notario?: boolean;
  // Bloque 4
  encargado_minuta?: string | null;
  fecha_solicitud_minuta?: string | null;
  fecha_revision?: string | null;
  enlace_contabilidad?: string | null;
  validacion_contabilidad?: string | null;
  ficha_pago_notaria?: string | null;
  fecha_para_firmar?: string | null;
  fecha_entrega_testimonio?: string | null;
  dias_mora_testimonio?: number | null;
  // Bloque 5
  fecha_ingreso_rpp?: string | null;
  recibo_pago_rpp?: string | null;
  folio_registro?: string | null;
  fecha_entrega_rpp?: string | null;
  dias_mora_rpp?: number | null;
  boleta_inscripcion?: string | null;
  nuevo_clg?: string | null;
  // Bloque 6
  fecha_entrega_dil?: string | null;
  documentacion?: string | null;
  fecha_entrega_ucm?: string | null;
  dias_mora_entrega?: number | null;
  responsable_juridico?: string | null;
  director_juridico?: string | null;
  unidad_pertenece?: string | null;
  encargado_unidad?: string | null;
  estado_tramite?: string | null;
  observaciones?: string | null;
  etapa_a_seguir?: string | null;
  otra_etapa?: string | null;
  en_papelera?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Lista todas las formalizaciones (no en papelera).
export async function listarFormalizaciones(): Promise<Formalizacion[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/formalizacion?select=*&en_papelera=eq.false&order=created_at.desc`, { headers });
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

// Trae una formalización por id.
export async function obtenerFormalizacion(id: string): Promise<Formalizacion | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/formalizacion?select=*&id=eq.${id}&limit=1`, { headers });
    const d = r.ok ? await r.json() : [];
    return d?.[0] || null;
  } catch { return null; }
}

// Crea una formalización nueva. Devuelve la fila creada.
export async function crearFormalizacion(datos: Formalizacion): Promise<Formalizacion | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/formalizacion`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(datos),
    });
    const d = r.ok ? await r.json() : [];
    return d?.[0] || null;
  } catch { return null; }
}

// Guarda cambios de una formalización existente.
export async function actualizarFormalizacion(id: string, datos: Partial<Formalizacion>): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/formalizacion?id=eq.${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ ...datos, updated_at: new Date().toISOString() }),
    });
    return r.ok;
  } catch { return false; }
}

// Manda a papelera.
export async function moverPapeleraFormalizacion(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/formalizacion?id=eq.${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ en_papelera: true, papelera_fecha: new Date().toISOString() }),
    });
    return r.ok;
  } catch { return false; }
}

// Catálogos para los selectores (basados en el registro real).
export const TIPOS_PROCESO = ["Venta", "Cambio de cesión por R3", "Inversión"];
export const TIPOS_CONTRATO = ["Cesión de derechos litigiosos", "Contrato privado", "Cesión de crédito"];
export const ESTADOS_TRAMITE = ["En proceso", "Testimonio entregado", "En registro público", "Entregado a jurídico", "Concluido"];

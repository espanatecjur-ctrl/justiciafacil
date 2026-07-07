// ============================================================
// JusticiaFácil · conexión a Supabase
// Lee datos por la API REST (no necesita instalar librerías).
// La llave pública (sb_publishable...) es segura para el navegador.
// ============================================================

export const SUPABASE_URL = "https://dquoysougxqknvgooiqg.supabase.co";
export const SUPABASE_KEY = "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";

/** Lee filas de una tabla. Ej: sbSelect("caso_juridico", "select=*&order=created_at.asc") */
export async function sbSelect<T = unknown>(
  tabla: string,
  query = "select=*"
): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase respondió ${res.status} — revisa la lectura (RLS) de la tabla.`);
  }
  return (await res.json()) as T[];
}

/** Un caso de la cartera (tabla caso_juridico). */
export interface CasoJuridico {
  id: string;
  estatus_revision: string | null;
  tipo_proceso: string | null;
  gar_id: string | null;
  cliente_codigo: string | null;
  proveedor: string | null;
  no_credito: string | null;
  expediente: string | null;
  expediente_validado?: boolean | null;
  // Carpeta de Drive vinculada a este expediente/garantía
  drive_carpeta_id?: string | null;
  drive_carpeta_nombre?: string | null;
  juzgado: string | null;
  distrito_judicial: string | null;
  entidad: string | null;
  materia: string | null;
  via_procesal: string | null;
  etapa_actual: string | null;
  estatus_general: string | null;
  prioridad: string | null;
  tiene_cliente: string | null;
  cliente_nombre: string | null;
  cliente_id: string | null;
  direccion_garantia: string | null;
  unidad: string | null;
  encargado_unidad: string | null;
  nota_adicional: string | null;
  // Resolución de garantía repetida/duplicada: se decide si se conserva o se elimina, con motivo.
  dup_resolucion?: { estado: "conservar" | "eliminar"; nota: string; fecha: string; por: string } | null;
  cve_distrito?: string | null;
  cve_juzgado?: string | null;
  nombre_juzgado?: string | null;
  actor?: string | null;
  demandado?: string | null;
  // Campos opcionales de registros de amparo / recurso / notaría (usados en la ficha)
  tipo_registro?: string | null;
  quejoso?: string | null;
  acto_reclamado?: string | null;
  tipo_amparo?: string | null;
  autoridad_responsable?: string | null;
  promovente?: string | null;
  tipo_recurso?: string | null;
  fecha_interposicion?: string | null;
  resolucion?: string | null;
  diligencia?: string | null;
  folio?: string | null;
  expediente_origen?: string | null;
  juzgado_origen?: string | null;
  fecha_vence?: string | null;
  archivado?: boolean | null;
}

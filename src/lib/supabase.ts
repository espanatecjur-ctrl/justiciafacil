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
  direccion_garantia: string | null;
  unidad: string | null;
  encargado_unidad: string | null;
  nota_adicional: string | null;
  cve_distrito?: string | null;
  cve_juzgado?: string | null;
  nombre_juzgado?: string | null;
}

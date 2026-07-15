// ============================================================
// JusticiaFácil · Clientes Tlajomulco (tabla PROPIA, sin depender
// de JurisConecta). Cargados desde la Relación de Cobros Tlajomulco
// verificada por Paola. Ver /clientes_tlajomulco_justiciafacil.sql
// para crear la tabla y cargar los datos en el proyecto Supabase de
// JusticiaFácil (dquoysougxqknvgooiqg).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export interface ClienteTlajomulco {
  id: string;
  nombre: string;
  nombre_original: string | null;
  correo: string | null;
  telefono: string | null;
  domicilio: string | null;
  valor_operacion: number | null;
}

const SELECT = "id,nombre,nombre_original,correo,telefono,domicilio,valor_operacion";

/** Busca por nombre, nombre ORIGINAL (antes de un cambio de cliente), correo,
 *  teléfono o domicilio. Solo lectura. */
export async function buscarClientesTlajomulco(texto: string): Promise<ClienteTlajomulco[]> {
  const q = (texto || "").trim();
  if (q.length < 2) return [];
  const enc = encodeURIComponent(`%${q}%`);
  const filtro = `or=(nombre.ilike.${enc},nombre_original.ilike.${enc},correo.ilike.${enc},telefono.ilike.${enc},domicilio.ilike.${enc})`;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clientes_tlajomulco?select=${SELECT}&${filtro}&limit=25`, { headers });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

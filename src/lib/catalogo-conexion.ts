// ============================================================
// Conexión para el futuro módulo de Comercial: "Checklist de
// publicación" + "Publicación en Catálogo" (pasos 4a/5/6 del
// flujo de garantía a catálogo). Ese módulo todavía NO está
// construido — esto solo deja LISTA la función que va a necesitar
// para leer, en un solo lugar, todo lo que ya calculó URRJ/DIL/UCM/
// Contabilidad/DGE para una garantía, sin tener que repetir esa
// lógica ni volver a consultar las tablas una por una.
//
// Cuando se construya el módulo de Comercial, solo necesita:
//   import { datosParaCatalogo } from "@/lib/catalogo-conexion";
//   const info = await datosParaCatalogo(claveOExpediente);
// y de ahí arma su propio checklist de 6 requisitos + la vista
// de catálogo, sin tocar nada de URRJ.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { calcularPrecio, type PrecioURRJ } from "@/components/bloque-precio-urrj";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export interface DatosParaCatalogo {
  expediente: string | null;
  numeroCredito: string | null;
  direccion: string | null;
  cliente: string | null;
  dictamenJuridico: string | null;      // dictamen_final del predictamen (Sí pasa / No pasa)
  cadenaCompleta: boolean;               // etapa_firma === "completo"
  dictamenRegistral: string | null;      // resultado del dictamen_registral
  precio: PrecioURRJ | null;
  precioFinal: number | null;
  listoParaCatalogo: boolean;            // jurídico positivo + registral positivo + cadena completa + precio capturado
}

/** Junta todo lo que ya existe de una garantía (por expediente o número de
 *  crédito) para que el futuro módulo de Comercial no tenga que ir tabla
 *  por tabla. Es de solo lectura — no escribe nada. */
export async function datosParaCatalogo(claveExpedienteOCredito: string): Promise<DatosParaCatalogo | null> {
  const clave = (claveExpedienteOCredito || "").trim();
  if (!clave) return null;
  try {
    const [predRes, regRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=expediente,posicion,dictamen_final,etapa_firma,datos&expediente=eq.${encodeURIComponent(clave)}&vigente=eq.true&order=created_at.desc&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=expediente,acreditado,resultado&expediente=eq.${encodeURIComponent(clave)}&en_papelera=eq.false&order=created_at.desc&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ]);
    const pred = predRes?.[0] || null;
    const reg = regRes?.[0] || null;
    if (!pred && !reg) return null;

    const precio: PrecioURRJ | null = pred?.datos?.precio || null;
    const precioFinal = precio?.precioPiso ? calcularPrecio(precio).precioFinal : null;
    const dictamenJuridico = pred?.dictamen_final || null;
    const dictamenRegistral = reg?.resultado || null;
    const cadenaCompleta = (pred?.etapa_firma || "elabora") === "completo";

    const positivo = (v: string | null) => !!v && ["positivo", "sí pasa", "si pasa"].includes(v.toLowerCase());

    return {
      expediente: pred?.expediente || reg?.expediente || clave,
      numeroCredito: pred?.datos?.numeroCredito || null,
      direccion: pred?.datos?.ubicacion || null,
      cliente: pred?.datos?.deudor || reg?.acreditado || null,
      dictamenJuridico, cadenaCompleta, dictamenRegistral,
      precio, precioFinal,
      listoParaCatalogo: positivo(dictamenJuridico) && positivo(dictamenRegistral) && cadenaCompleta && !!precioFinal,
    };
  } catch {
    return null;
  }
}

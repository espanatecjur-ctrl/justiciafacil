// JusticiaFácil · Buscador de Asuntos — unifica en una sola búsqueda los "asuntos"
// que hoy viven repartidos en 3 tablas distintas:
//   - caso_juridico  → UCM y UCP (juicios civiles/mercantiles/hipotecarios)
//   - caso_udp       → UDP (denuncias penales, quejas PROFECO, convenios)
//   - formalizacion  → UFC (cesión de derechos, escrituración)
//
// Busca por: número de crédito, número de expediente, dirección de la garantía
// o nombre del cliente — en cualquiera de las 3 tablas a la vez.
//
// Para UFC: la tabla `formalizacion` no tiene su propio "no_credito" — ese dato
// vive en `caso_juridico.no_credito` a través de `formalizacion.caso_id`. Por eso,
// además de buscar directo en formalizacion, se hace una segunda pasada: si el
// término coincide con un crédito/expediente de caso_juridico, se traen también
// las formalizaciones que cuelgan de ese caso_id — así una misma búsqueda conecta
// el juicio (UCM/UCP) con su formalización (UFC).

import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export type UnidadAsunto = "UCM" | "UCP" | "UDP" | "UFC";

export interface AsuntoUnificado {
  id: string;                 // id de la fila original (caso_juridico.id / caso_udp.id / formalizacion.id)
  unidad: UnidadAsunto;
  cliente: string | null;
  expediente: string | null;
  no_credito: string | null;
  direccion: string | null;
  detalle: string | null;     // dato adicional útil según la unidad (etapa, tipo, estado_tramite…)
  casoJuridicoId: string | null; // si aplica: para cruzar con documento_garantia (documentos fijos)
}

function esc(v: string) {
  // PostgREST usa "*" como comodín en ilike y las comas separan condiciones dentro de or=(...)
  return v.replace(/,/g, " ").trim();
}

async function sb<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, { headers });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

// Detecta si un registro de caso_juridico es "de UCM" o "de UCP" (misma lógica que usan
// las pantallas ucm.tsx / ucp.tsx), y descarta amparos/recursos/exhortos (tienen su propia pantalla).
function unidadDeCasoJuridico(c: { unidad?: string | null; tipo_registro?: string | null; pasa_a_ucm?: boolean | null }): UnidadAsunto | null {
  if (["amparo", "recurso", "exhorto"].includes(c.tipo_registro || "juicio")) return null;
  const u = (c.unidad || "").toUpperCase();
  if (u.includes("UCP") && !c.pasa_a_ucm) return "UCP";
  return "UCM";
}

/** Busca un asunto por crédito / expediente / dirección / cliente en las 3 tablas a la vez. */
export async function buscarAsuntos(termino: string): Promise<AsuntoUnificado[]> {
  const t = esc(termino);
  if (t.length < 2) return [];
  const like = `*${t}*`;

  const [cj, udp, fmz] = await Promise.all([
    sb<any>(
      "caso_juridico",
      `select=id,unidad,tipo_registro,pasa_a_ucm,cliente_nombre,expediente,no_credito,direccion_garantia,etapa_actual&or=(no_credito.ilike.${like},expediente.ilike.${like},direccion_garantia.ilike.${like},cliente_nombre.ilike.${like})&limit=25`
    ),
    sb<any>(
      "caso_udp",
      `select=id,tipo,folio,no_credito,domicilio,cliente,expediente,estatus&or=(no_credito.ilike.${like},expediente.ilike.${like},domicilio.ilike.${like},cliente.ilike.${like},folio.ilike.${like})&limit=25`
    ),
    sb<any>(
      "formalizacion",
      `select=id,caso_id,id_interno,nombre_cesionario,expediente,direccion_garantia,estado_tramite&or=(id_interno.ilike.${like},expediente.ilike.${like},direccion_garantia.ilike.${like},nombre_cesionario.ilike.${like})&limit=25`
    ),
  ]);

  const resultados: AsuntoUnificado[] = [];

  for (const c of cj) {
    const unidad = unidadDeCasoJuridico(c);
    if (!unidad) continue;
    resultados.push({
      id: c.id,
      unidad,
      cliente: c.cliente_nombre,
      expediente: c.expediente,
      no_credito: c.no_credito,
      direccion: c.direccion_garantia,
      detalle: c.etapa_actual,
      casoJuridicoId: c.id,
    });
  }

  for (const d of udp) {
    resultados.push({
      id: d.id,
      unidad: "UDP",
      cliente: d.cliente,
      expediente: d.expediente || d.folio,
      no_credito: d.no_credito,
      direccion: d.domicilio,
      detalle: [d.tipo, d.estatus].filter(Boolean).join(" · ") || null,
      casoJuridicoId: null,
    });
  }

  for (const f of fmz) {
    resultados.push({
      id: f.id,
      unidad: "UFC",
      cliente: f.nombre_cesionario,
      expediente: f.expediente || f.id_interno,
      no_credito: null, // se resuelve abajo, vía caso_id, si aplica
      direccion: f.direccion_garantia,
      detalle: f.estado_tramite,
      casoJuridicoId: f.caso_id || null,
    });
  }

  // Conecta UFC con su crédito real (vive en caso_juridico, no en formalizacion) y
  // trae también las formalizaciones que cuelguen de un caso_juridico ya encontrado
  // — así una búsqueda por crédito conecta el juicio con su formalización.
  const casoIdsAResolver = new Set<string>();
  for (const r of resultados) if (r.unidad === "UFC" && r.casoJuridicoId) casoIdsAResolver.add(r.casoJuridicoId);
  for (const r of resultados) if (r.unidad === "UCM" || r.unidad === "UCP") casoIdsAResolver.add(r.id);

  if (casoIdsAResolver.size > 0) {
    const ids = [...casoIdsAResolver].join(",");
    const [creditos, formalizacionesRelacionadas] = await Promise.all([
      sb<any>("caso_juridico", `select=id,no_credito&id=in.(${ids})`),
      sb<any>("formalizacion", `select=id,caso_id,id_interno,nombre_cesionario,expediente,direccion_garantia,estado_tramite&caso_id=in.(${ids})`),
    ]);
    const creditoPorCaso = new Map(creditos.map((c: any) => [c.id, c.no_credito]));
    for (const r of resultados) {
      if (r.unidad === "UFC" && r.casoJuridicoId && !r.no_credito) {
        r.no_credito = creditoPorCaso.get(r.casoJuridicoId) || null;
      }
    }
    for (const f of formalizacionesRelacionadas) {
      if (resultados.some((r) => r.unidad === "UFC" && r.id === f.id)) continue; // ya estaba
      resultados.push({
        id: f.id,
        unidad: "UFC",
        cliente: f.nombre_cesionario,
        expediente: f.expediente || f.id_interno,
        no_credito: creditoPorCaso.get(f.caso_id) || null,
        direccion: f.direccion_garantia,
        detalle: f.estado_tramite,
        casoJuridicoId: f.caso_id || null,
      });
    }
  }

  return resultados;
}

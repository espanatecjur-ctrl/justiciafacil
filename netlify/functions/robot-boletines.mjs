// ============================================================
// JusticiaFácil · ROBOT de boletines · Motor (4B · real)
// Corre solo todos los días a las 9:00 AM hora de México.
//   Netlify usa UTC -> 9:00 AM México (UTC-6) = 15:00 UTC = "0 15 * * *"
//
// Qué hace ahora (antes solo contaba expedientes, no buscaba nada):
//  1) Trae los expedientes activos (caso_juridico, no archivados).
//  2) Para cada uno, intenta ADIVINAR a qué juzgado del catálogo
//     corresponde su campo "juzgado" (texto libre, mal escrito casi
//     siempre) — Sinaloa contra boletin_juzgado, Jalisco contra el
//     catálogo en vivo del robot, BCS contra la lista fija de salas.
//  3) Si lo encuentra, le pregunta al ROBOT de Google Cloud (el mismo
//     que ya usa la búsqueda manual) si hay acuerdos nuevos.
//  4) Los guarda en acuerdo_judicial (con un candado anti-duplicados
//     por hash, prefijo "auto:" para no chocar con búsquedas manuales).
//  5) Deja en robot_log el detalle: cuántos encontró, cuántos NO pudo
//     ni intentar porque su juzgado no se pudo identificar (para que
//     Dirección sepa a cuáles hay que corregirles el juzgado a mano).
//
// LÍMITE CONOCIDO: el emparejamiento de juzgado es por texto
// (normalizado, sin acentos/mayúsculas) — si el campo "juzgado" del
// expediente está muy distinto al nombre oficial del catálogo, no lo
// va a encontrar y va a quedar listado en "sin_match" del log, no se
// inventa nada ni falla en silencio.
// ============================================================

const SUPABASE_URL = process.env.JF_SUPABASE_URL || "https://dquoysougxqknvgooiqg.supabase.co";
const SUPABASE_KEY = process.env.JF_SUPABASE_KEY || "sb_publishable__rEHm2hdrMkQfaBrRqqtOw_akusY-Em";
const ROBOT = "https://robot-boletin-699470444450.us-central1.run.app";
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// Tope de expedientes por corrida — deliberadamente chico: cada llamada al
// robot de Google puede tardar unos segundos, y las funciones de Netlify
// se matan solas si se pasan de tiempo (eso es justo lo que pasó antes:
// error 502 por intentar 56+ expedientes de un jalón). Con un lote chico
// y girando el punto de inicio cada día (PRESUPUESTO_MS más abajo), en
// unos días se cubren todos sin que ninguna corrida se pase de tiempo.
const TOPE_POR_CORRIDA = 12;
// Presupuesto de tiempo total por corrida (además del tope de expedientes,
// por si algún caso se tarda más de lo normal). Se corta antes de que
// Netlify mate la función sola.
const PRESUPUESTO_MS = 8000;

const norm = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
  .replace(/["'`]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const BCS_ORGANOS = [
  "Juzgado Primero de Primera Instancia en el Ramo Civil",
  "Juzgado Segundo de Primera Instancia en el Ramo Civil",
  "Juzgado Primero de Primera Instancia en el Ramo Mercantil",
  "Juzgado Segundo de Primera Instancia en el Ramo Mercantil",
  "Juzgado Tercero de Primera Instancia en el Ramo Mercantil",
  "Juzgado Primero de Primera Instancia en el Ramo Familiar",
  "Juzgado Segundo de Primera Instancia en el Ramo Familiar",
  "Juzgado Tercero de Primera Instancia en el Ramo Familiar",
  "Juzgado Cuarto de Primera Instancia en el Ramo Familiar",
  "Primera Sala Unitaria en Materia Civil",
  "Segunda Sala Unitaria en Materia Civil",
  "Tercera Sala Unitaria Civil y de Justicia Administrativa (Materia Civil)",
];

async function fetchConTope(url, ms, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

async function cargarCatalogos() {
  const [bj, zm, fo] = await Promise.all([
    fetchConTope(`${SUPABASE_URL}/rest/v1/boletin_juzgado?select=nombre_distrito,nombre_juzgado`, 4000, { headers }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetchConTope(`${ROBOT}/jal-judges`, 4000).then((r) => r.json()).catch(() => ({ juzgados: [] })),
    fetchConTope(`${ROBOT}/jalf-judges`, 4000).then((r) => r.json()).catch(() => ({ juzgados: [] })),
  ]);
  const jalisco = [
    ...(zm.juzgados || []).map((j) => ({ code: j.code, name: (j.name || "").trim(), foraneo: false })),
    ...(fo.juzgados || []).map((j) => ({ code: j.code, name: (j.name || "").trim(), foraneo: true })),
  ];
  return { sinaloa: bj, jalisco };
}

// Intenta identificar a qué juzgado del catálogo corresponde el texto
// libre capturado en el expediente. Devuelve null si no hay coincidencia
// razonable (no adivina a fuerza).
function identificarJuzgado(textoJuzgado, entidadTexto, catalogos) {
  const nJuz = norm(textoJuzgado);
  const nEnt = norm(entidadTexto);
  if (!nJuz) return null;

  // ¿Suena a Jalisco? (entidad o el propio texto del juzgado lo delatan —
  // "partido judicial" es terminología que solo usa Jalisco en este catálogo,
  // y varios casos capturan la ciudad en vez de "Jalisco" literal).
  const SENAL_JALISCO = /jalisco|guadalajara|zapopan|tlaquepaque|tonala|tlajomulco|partido judicial/;
  if (SENAL_JALISCO.test(nEnt) || SENAL_JALISCO.test(nJuz)) {
    let mejor = null;
    for (const j of catalogos.jalisco) {
      const nj = norm(j.name);
      if (nj && (nJuz.includes(nj) || nj.includes(nJuz))) { mejor = j; break; }
    }
    if (mejor) return { estado: "jalisco", endpoint: mejor.foraneo ? "jalf-leer" : "jal-leer", judged: mejor.code };
    return null;
  }
  // ¿Suena a La Paz / BCS?
  if (nEnt.includes("paz") || nEnt.includes("bcs") || nEnt.includes("baja california sur") || nJuz.includes("la paz")) {
    const mejor = BCS_ORGANOS.find((o) => { const no = norm(o); return nJuz.includes(no) || no.includes(nJuz); });
    if (mejor) return { estado: "bcs", org: mejor };
    return null;
  }
  // Si no, se asume Sinaloa (es el estado con más casos y catálogo más completo).
  // IMPORTANTE: primero se filtra por distrito (a partir de "entidad") y
  // SOLO DESPUÉS se busca el juzgado dentro de ese distrito — si se busca
  // en todo el catálogo junto, nombres cortos como "Juzgado Segundo Civil"
  // hacen match cruzado con el distrito equivocado (ej. un caso de
  // Mazatlán terminaba emparejado con un juzgado de Ahome). Sin distrito
  // identificado, mejor no adivinar nada.
  const distritosCandidatos = [...new Set(catalogos.sinaloa.map((b) => b.nombre_distrito))]
    .filter((d) => { const nd = norm(d); return nEnt.includes(nd) || nd.includes(nEnt); });
  if (distritosCandidatos.length === 0) return null;
  const enDistrito = catalogos.sinaloa.filter((b) => distritosCandidatos.includes(b.nombre_distrito));
  for (const b of enDistrito) {
    const nb = norm(b.nombre_juzgado.split(",")[0]); // solo el nombre del juzgado, sin ", Ciudad"
    if (nb && (nJuz.includes(nb) || nb.includes(nJuz))) {
      return { estado: "sinaloa", distrito: b.nombre_distrito, juzgado: (b.nombre_juzgado || "").split(",")[0] };
    }
  }
  return null;
}

async function buscarAcuerdos(expediente, match) {
  let url = "";
  if (match.estado === "sinaloa") {
    url = `${ROBOT}/probar?exp=${encodeURIComponent(expediente)}&distrito=${encodeURIComponent(match.distrito)}&juzgado=${encodeURIComponent(match.juzgado)}`;
  } else if (match.estado === "bcs") {
    url = `${ROBOT}/bcs-buscar?exp=${encodeURIComponent(expediente)}&juzgado=${encodeURIComponent(match.org)}`;
  } else {
    url = `${ROBOT}/${match.endpoint}?exp=${encodeURIComponent(expediente)}&judged=${encodeURIComponent(match.judged)}`;
  }
  const ctrl = new AbortController();
  const tope = setTimeout(() => ctrl.abort("timeout"), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return { ok: false };
    const data = await r.json();
    return { ok: true, acuerdos: data.acuerdos || [] };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(tope);
  }
}

function entidadLabel(match) {
  if (match.estado === "jalisco") return "Jalisco";
  if (match.estado === "bcs") return "Baja California Sur";
  return "Sinaloa";
}
function juzgadoLabel(match) {
  if (match.estado === "sinaloa") return match.juzgado;
  if (match.estado === "bcs") return `${match.org}, La Paz`;
  return match.judged; // Jalisco: se guarda el code, ya validado contra el catálogo
}

export default async () => {
  const inicio = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,entidad,juzgado&archivado=eq.false&limit=2000&order=id.asc`, { headers });
    const todos = r.ok ? await r.json() : [];
    const conJuzgado = todos.filter((c) => (c.expediente || "").trim() && (c.juzgado || "").trim());
    // Rotación diaria: cada día se arranca más adelante en la lista (y da la
    // vuelta al llegar al final) — así, en varios días, se cubren TODOS los
    // expedientes, no siempre los mismos primeros del lote.
    const diaDelAno = Math.floor(Date.now() / 86400000);
    const inicioLote = conJuzgado.length ? (diaDelAno * TOPE_POR_CORRIDA) % conJuzgado.length : 0;
    const casos = conJuzgado.length
      ? Array.from({ length: Math.min(TOPE_POR_CORRIDA, conJuzgado.length) }, (_, i) => conJuzgado[(inicioLote + i) % conJuzgado.length])
      : [];
    const catalogos = await cargarCatalogos();

    let nuevos = 0, revisados = 0, conError = 0, cortadoPorTiempo = false;
    const sinMatch = [];

    for (const c of casos) {
      if (Date.now() - inicio > PRESUPUESTO_MS) { cortadoPorTiempo = true; break; }
      const match = identificarJuzgado(c.juzgado, c.entidad, catalogos);
      if (!match) { sinMatch.push(`${c.expediente} (${c.juzgado})`); continue; }
      revisados++;
      const res = await buscarAcuerdos(c.expediente, match);
      if (!res.ok) { conError++; continue; }
      if (!res.acuerdos.length) continue;

      const ent = entidadLabel(match); const juz = juzgadoLabel(match);
      const filas = res.acuerdos.map((a) => {
        const fecha = a.fecha ? String(a.fecha).slice(0, 10) : new Date().toISOString().slice(0, 10);
        const hash = `auto:${ent}|${juz}|${a.expediente || c.expediente}|${fecha}|${a.acuerdo || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
        return {
          entidad: ent, juzgado: juz, expediente: a.expediente || c.expediente, fecha_acuerdo: fecha,
          tipo_acuerdo: a.etapa || null, texto: a.acuerdo || null, fuente: "robot", origen: "robot_diario",
          caso_id: c.id, hash_acuerdo: hash,
        };
      });
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial`, {
        method: "POST", headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(filas),
      });
      if (ins.ok) { const creados = await ins.json().catch(() => []); nuevos += Array.isArray(creados) ? creados.length : 0; }
    }

    const procesados = revisados + sinMatch.length + conError;
    const detalle = `Lote de hoy: ${procesados}/${casos.length} de este turno (empezando en la posición ${inicioLote} de ${conJuzgado.length} expedientes totales con juzgado) · ${revisados} identificados y revisados · ${sinMatch.length} sin poder identificar el juzgado · ${conError} con error de conexión · ${nuevos} actuación(es) nueva(s) guardada(s)${cortadoPorTiempo ? " · CORTADO por tiempo, se sigue mañana" : ""}. Tardó ${Math.round((Date.now() - inicio) / 1000)}s.`
      + (sinMatch.length ? `\nSin identificar (revisar el campo "Juzgado" de estos expedientes): ${sinMatch.slice(0, 20).join(" · ")}${sinMatch.length > 20 ? "…" : ""}` : "");

    await fetch(`${SUPABASE_URL}/rest/v1/robot_log`, {
      method: "POST", headers,
      body: JSON.stringify({ fuente: "robot", total_expedientes: conJuzgado.length, nuevos, estado: "ok", detalle }),
    });

    return new Response(JSON.stringify({ ok: true, totalConJuzgado: conJuzgado.length, esteLote: casos.length, revisados, sinMatch: sinMatch.length, conError, nuevos, cortadoPorTiempo }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    await fetch(`${SUPABASE_URL}/rest/v1/robot_log`, {
      method: "POST", headers,
      body: JSON.stringify({ fuente: "robot", estado: "error", detalle: String(e) }),
    }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
};

// Cron de Netlify (UTC). 9:00 AM México (UTC-6) = 15:00 UTC.
export const config = { schedule: "0 15 * * *" };

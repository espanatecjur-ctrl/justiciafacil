// ============================================================
// JusticiaFácil · Libro de la carpeta física
// ------------------------------------------------------------
// QUÉ HACE ESTE ARCHIVO
// Arma el "libro": la lista ordenada de hojas que debe tener una
// carpeta, apartado por apartado, marcando cuáles ya están y cuáles
// faltan.
//
// LA IDEA IMPORTANTE — NO SE VUELVE A CAPTURAR NADA
// Los documentos ya existen regados en dos lugares del sistema:
//   · documento_garantia  → los documentos fijos (los de Drive)
//   · documento_fisico    → los papeles registrados en el archivo
// Este archivo NO pide que se vuelvan a subir. Los lee, adivina a qué
// hoja del libro pertenece cada uno, y los acomoda solo. La persona
// nada más confirma o corrige.
//
// LOS ESPACIOS DEL LIBRO VIVEN EN LA BASE, NO AQUÍ
// La tabla `carpeta_apartado` tiene los 20 espacios fijos. Si mañana
// quieres agregar un documento obligatorio, se agrega una fila ahí y
// el libro lo muestra solo — sin tocar este código.
// ============================================================

import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function sb<T = any>(tabla: string, query: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, { headers });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

/** Un espacio fijo del libro, tal como viene del catálogo. */
export interface EspacioLibro {
  apartadoNum: number;
  apartadoNombre: string;
  subseccionClave: string;
  subseccionNombre: string;
  obligatorio: boolean;
  condicional: boolean; // "solo si aplica" — no cuenta como faltante grave
  nota: string | null;
  orden: number;
}

/** Una hoja que SÍ está en la carpeta. */
export interface HojaLibro {
  id: string;
  origen: "digital" | "fisico";
  nombre: string;
  link: string | null;
  analisis: string | null;
  fecha: string | null;
  /** true si el sistema lo acomodó solo y nadie lo ha confirmado todavía. */
  sugerido: boolean;
}

/** Un espacio del libro ya resuelto: con sus hojas, o vacío. */
export interface RenglonLibro {
  espacio: EspacioLibro;
  hojas: HojaLibro[];
  pendiente: boolean;
}

export interface ApartadoLibro {
  num: number;
  nombre: string;
  renglones: RenglonLibro[];
}

export interface Libro {
  apartados: ApartadoLibro[];
  totalEspacios: number;
  totalCompletos: number;
  faltantesObligatorios: string[]; // nombres de lo que falta y sí es obligatorio
}

// ------------------------------------------------------------
// Catálogo
// ------------------------------------------------------------

let cacheCatalogo: EspacioLibro[] | null = null;

/** Lee los espacios fijos del libro. Se guarda en memoria para no pedirlo cada rato. */
export async function catalogoDelLibro(): Promise<EspacioLibro[]> {
  if (cacheCatalogo) return cacheCatalogo;
  const filas = await sb<any>("carpeta_apartado", `select=*&activo=eq.true&order=orden.asc`);
  cacheCatalogo = filas.map((f) => ({
    apartadoNum: f.apartado_num,
    apartadoNombre: f.apartado_nombre,
    subseccionClave: f.subseccion_clave,
    subseccionNombre: f.subseccion_nombre,
    obligatorio: f.obligatorio,
    condicional: f.condicional,
    nota: f.nota,
    orden: f.orden,
  }));
  return cacheCatalogo;
}

// ------------------------------------------------------------
// El clasificador — el corazón del auto-acomodo
// ------------------------------------------------------------

/**
 * Reglas para adivinar a qué hoja del libro pertenece un documento.
 *
 * CÓMO FUNCIONA: para cada espacio del libro hay una lista de palabras.
 * Se revisa el `tipo` del documento y su nombre; si aparece alguna de esas
 * palabras, se acomoda ahí. Gana la primera regla que coincida, por eso el
 * orden importa: las más específicas van arriba.
 *
 * POR QUÉ HACE FALTA: el campo `tipo` de la base está escrito a mano y
 * tiene más de 30 variantes ("dictamen_juridico", "Dictamen", "dictamen",
 * "clg_vigente", "clg_antiguo"...). En vez de limpiarlas una por una, se
 * reconocen todas.
 */
const REGLAS: Array<{ clave: string; palabras: string[] }> = [
  // Apartado 3 · cesiones — van primero porque la palabra "cesion" también
  // aparece en escrituras; si esta regla fuera más abajo, se la tragarían.
  { clave: "cesion_cliente", palabras: ["cesion a favor del cliente", "cesion cliente", "cesion a nombre del cliente"] },
  { clave: "cesion_diipa", palabras: ["cesion", "broker"] },
  { clave: "escritura_originacion", palabras: ["originacion", "testimonio", "escritura", "documento base", "sustitucion de deudor", "apertura de credito"] },

  // Apartado 5 · entrega de la propiedad
  { clave: "acta_desalojo", palabras: ["desalojo", "lanzamiento", "desocupacion", "toma de posesion"] },
  { clave: "acta_recepcion", palabras: ["entrega recepcion", "recepcion de propiedad", "finiquito", "dacion"] },
  { clave: "foto_entrega", palabras: ["foto", "imagen de la casa"] },

  // Apartado 2 · dictámenes
  { clave: "avaluo", palabras: ["avaluo"] },
  { clave: "dictamen_registral", palabras: ["registral", "rppc", "rppyc", "catastral", "rpp "] },
  { clave: "dictamen_juridico", palabras: ["dictamen", "predictamen", "informe juridico"] },
  { clave: "clg", palabras: ["clg", "gravamen"] },

  // Apartado 1 · documentos del cliente
  { clave: "carta_propuesta", palabras: ["propuesta", "apartado", "aceptacion", "carta de intencion"] },
  { clave: "contrato_ps", palabras: ["contrato", "compraventa", "convenio"] },
  // OJO: "ine" va entre espacios a propósito. Como pedazo suelto se metía
  // dentro de "inexistencia", "linea", "define" y clasificaba mal.
  { clave: "ine", palabras: [" ine ", "identificacion", "credencial", "generales de cliente"] },
  { clave: "rfc", palabras: ["rfc", "situacion fiscal"] },
  // "predial" se quitó de aquí: los documentos que decían predial eran
  // "estado de adeudo predial", que es financiero. Se movió a pagos.
  { clave: "comprobante_domicilio", palabras: ["comprobante de domicilio", "recibo de luz", "recibo de agua"] },
  { clave: "acta_curp", palabras: ["acta de nacimiento", "curp"] },
  { clave: "aml", palabras: ["pld", "lavado"] },
  { clave: "kyc", palabras: ["kyc"] },
  { clave: "comprobantes_pago", palabras: ["pago", "abono", "deposito", "transferencia", "estado de cuenta", "adeudo", "certificacion contable"] },

  // Apartado 4 · documentos del juicio
  { clave: "demanda", palabras: ["demanda", "anexo", "escrito inicial"] },
  // OJO: aquí va "auto admisorio" completo, NO "auto" solo. Como pedazo
  // suelto se metía dentro de "autorizacion" y "autorizados".
  { clave: "acuerdos", palabras: ["acuerdo", "actuacion", "boletin", "sentencia", "auto admisorio", "auto de admision", "resolucion", "emplazamiento", "apelacion", "amparo", "edicto", "exhorto", "audiencia", "remate", "adjudicacion", "ejecucion", "diligencia"] },
  { clave: "escritos", palabras: ["escrito", "promocion", "instruccion notarial", "oficio", "apersonamiento", "estrategia", "jurisdiccion voluntaria", " jv ", "medio preparatorio", "copia certificada"] },
];

/** Quita acentos y pasa a minúsculas, para que "Dictamen Jurídico" y "dictamen juridico" sean lo mismo. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decide en qué espacio del libro va un documento.
 * Si no reconoce nada, lo manda a "otro" (apartado 6) — nunca se pierde.
 */
export function clasificarDocumento(tipo: string | null, nombre: string | null): string {
  // Se envuelve en espacios para que las reglas que piden palabra completa
  // (" ine ", " jv ") también encuentren la palabra al inicio o al final.
  const texto = ` ${normalizar(`${tipo ?? ""} ${nombre ?? ""}`)} `;
  if (!texto.trim()) return "otro";

  for (const regla of REGLAS) {
    // Se compara contra la palabra tal cual está escrita en REGLAS, SIN pasarla
    // por normalizar(): esa función recorta los espacios de las orillas y las
    // reglas que piden palabra completa (" ine ", " jv ") perderían el efecto.
    // Por eso las palabras de REGLAS ya se escriben en minúscula y sin acentos.
    if (regla.palabras.some((p) => texto.includes(p))) {
      return regla.clave;
    }
  }
  return "otro";
}

// ------------------------------------------------------------
// Armar el libro
// ------------------------------------------------------------

/**
 * Arma el libro completo de una carpeta.
 *
 * @param carpetaId  id de la carpeta física
 * @param casoJuridicoId  id del caso — se usa para jalar los documentos
 *                        fijos que todavía no están ligados a la carpeta
 */
export async function armarLibro(
  carpetaId: string,
  casoJuridicoId: string | null
): Promise<Libro> {
  const catalogo = await catalogoDelLibro();

  // 1. Traer lo que ya existe, de los dos lados.
  //    - Ligado a la carpeta (ya acomodado antes)
  //    - Ligado solo al caso (todavía suelto: esto es lo que se auto-acomoda)
  const filtroGarantia = casoJuridicoId
    ? `or=(carpeta_id.eq.${carpetaId},caso_id.eq.${casoJuridicoId})`
    : `carpeta_id=eq.${carpetaId}`;

  const [digitales, fisicos] = await Promise.all([
    sb<any>(
      "documento_garantia",
      `select=id,nombre,tipo,link,apartado,subseccion,analisis,created_at&${filtroGarantia}&en_papelera=eq.false&order=created_at.asc`
    ),
    sb<any>(
      "documento_fisico",
      `select=id,nombre_documento,tipo_asunto,descripcion,apartado,subseccion,analisis,fecha_registro&carpeta_id=eq.${carpetaId}&en_papelera=eq.false&order=fecha_registro.asc`
    ),
  ]);

  // 2. Acomodar cada documento en su espacio.
  //    Si ya tiene `subseccion` guardada, se respeta (alguien ya lo corrigió
  //    a mano y su decisión gana). Si no, se adivina y se marca como sugerido.
  const porEspacio = new Map<string, HojaLibro[]>();

  const meter = (clave: string, hoja: HojaLibro) => {
    if (!porEspacio.has(clave)) porEspacio.set(clave, []);
    porEspacio.get(clave)!.push(hoja);
  };

  for (const d of digitales) {
    const yaClasificado = !!d.subseccion;
    const clave = d.subseccion || clasificarDocumento(d.tipo, d.nombre);
    meter(clave, {
      id: d.id,
      origen: "digital",
      nombre: d.nombre || "Sin nombre",
      link: d.link || null,
      analisis: d.analisis || null,
      fecha: d.created_at,
      sugerido: !yaClasificado,
    });
  }

  for (const f of fisicos) {
    const yaClasificado = !!f.subseccion;
    const clave = f.subseccion || clasificarDocumento(f.tipo_asunto, f.nombre_documento);
    meter(clave, {
      id: f.id,
      origen: "fisico",
      nombre: f.nombre_documento || "Sin nombre",
      link: null,
      analisis: f.analisis || f.descripcion || null,
      fecha: f.fecha_registro,
      sugerido: !yaClasificado,
    });
  }

  // 3. Recorrer el catálogo en orden y armar los apartados.
  const apartados: ApartadoLibro[] = [];
  const faltantes: string[] = [];
  let completos = 0;

  for (const espacio of catalogo) {
    const hojas = porEspacio.get(espacio.subseccionClave) ?? [];
    const pendiente = hojas.length === 0;

    // El apartado 6 ("otros") no cuenta como pendiente: es de nombre libre.
    if (!pendiente) completos++;
    if (pendiente && espacio.obligatorio && !espacio.condicional) {
      faltantes.push(espacio.subseccionNombre);
    }

    let apartado = apartados.find((a) => a.num === espacio.apartadoNum);
    if (!apartado) {
      apartado = { num: espacio.apartadoNum, nombre: espacio.apartadoNombre, renglones: [] };
      apartados.push(apartado);
    }
    apartado.renglones.push({ espacio, hojas, pendiente });
  }

  // 4. Lo que no cupo en ningún espacio conocido va al apartado 6.
  const sueltos = porEspacio.get("otro") ?? [];
  const apartadoOtros = apartados.find((a) => a.num === 6);
  if (apartadoOtros && sueltos.length > 0) {
    apartadoOtros.renglones[0].hojas = sueltos;
    apartadoOtros.renglones[0].pendiente = false;
  }

  return {
    apartados,
    totalEspacios: catalogo.length,
    totalCompletos: completos,
    faltantesObligatorios: faltantes,
  };
}

// ------------------------------------------------------------
// Confirmar y corregir
// ------------------------------------------------------------

/**
 * Guarda en firme dónde va un documento.
 * Se usa cuando la persona confirma una sugerencia o la corrige a otro espacio.
 * A partir de aquí ya no se vuelve a adivinar: la decisión queda escrita.
 */
export async function fijarEspacio(
  hoja: HojaLibro,
  carpetaId: string,
  subseccionClave: string
): Promise<boolean> {
  const catalogo = await catalogoDelLibro();
  const espacio = catalogo.find((e) => e.subseccionClave === subseccionClave);
  if (!espacio) return false;

  const tabla = hoja.origen === "digital" ? "documento_garantia" : "documento_fisico";

  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${hoja.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      apartado: espacio.apartadoNum,
      subseccion: subseccionClave,
      carpeta_id: carpetaId, // de paso queda ligado a la carpeta
    }),
  });
  return r.ok;
}

/** Guarda el análisis escrito de una hoja (sobre todo para el apartado 6). */
export async function guardarAnalisis(hoja: HojaLibro, texto: string): Promise<boolean> {
  const tabla = hoja.origen === "digital" ? "documento_garantia" : "documento_fisico";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${hoja.id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ analisis: texto || null }),
  });
  return r.ok;
}

/**
 * Acomoda de un jalón todos los documentos sugeridos de una carpeta.
 * Es el botón "aceptar todo" — para no confirmar de uno en uno.
 */
export async function aceptarSugerencias(libro: Libro, carpetaId: string): Promise<number> {
  let guardados = 0;
  for (const apartado of libro.apartados) {
    for (const renglon of apartado.renglones) {
      for (const hoja of renglon.hojas) {
        if (!hoja.sugerido) continue;
        const ok = await fijarEspacio(hoja, carpetaId, renglon.espacio.subseccionClave);
        if (ok) guardados++;
      }
    }
  }
  return guardados;
}

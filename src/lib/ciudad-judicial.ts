// JusticiaFácil · Normaliza la ciudad/estado real de un expediente a partir de
// distrito_judicial / juzgado (catálogo cerrado, controlado por el selector) y,
// si esos vienen vacíos, del campo `entidad` — que puede traer dato viejo tipo
// "CULIACAN"/"MAZATLAN" (ciudad directa, texto libre) o dato nuevo tipo "Sinaloa"
// (solo Estado, viene del selector nuevo).
//
// Esto NO depende de dónde esté registrada la empresa/administradora — depende
// de dónde está el juzgado real, que es lo que le importa a quien da seguimiento
// procesal en esa plaza.

export interface UbicacionJudicial {
  ciudad: string | null; // forma canónica, ej. "Mazatlán". null si solo se conoce el Estado.
  estado: string; // ej. "Sinaloa"
}

// Los 18 distritos judiciales de Sinaloa (mismo catálogo que boletin_juzgado).
const DISTRITOS_SINALOA = [
  "Ahome", "Angostura", "Badiraguato", "Concordia", "Cosalá", "Culiacán",
  "Choix", "Elota", "Escuinapa", "El Fuerte", "Guasave", "Mazatlán",
  "Mocorito", "Rosario", "Salvador Alvarado", "San Ignacio", "Sinaloa", "Navolato",
];

// Ciudades/distritos fuera de Sinaloa donde DIIPA ya tiene expedientes.
const OTRAS_CIUDADES: Record<string, string> = {
  "La Paz": "Baja California Sur",
  "Los Cabos": "Baja California Sur",
  "Guadalajara": "Jalisco",
  "Tlajomulco de Zúñiga": "Jalisco",
  "Tlajomulco": "Jalisco",
  "Zapopan": "Jalisco",
  "Ciudad de México": "CDMX",
  "Monterrey": "Nuevo León",
};

// Quita acentos, pasa a mayúsculas y normaliza espacios/guiones bajos.
function limpiar(txt: string): string {
  return txt
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toUpperCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Diccionario CIUDAD_LIMPIA -> {ciudad canónica, estado}
const MAPA: Record<string, UbicacionJudicial> = {};
for (const d of DISTRITOS_SINALOA) MAPA[limpiar(d)] = { ciudad: d, estado: "Sinaloa" };
for (const [ciudad, estado] of Object.entries(OTRAS_CIUDADES)) MAPA[limpiar(ciudad)] = { ciudad, estado };

// Alias de texto que no coinciden letra por letra con el nombre oficial de una ciudad,
// pero deben resolver a la misma ciudad del MAPA.
const ALIAS_CIUDAD: Record<string, string> = {
  "MEXICO": "CIUDAD DE MEXICO",
  "DF": "CIUDAD DE MEXICO",
  "D F": "CIUDAD DE MEXICO",
  "CDMX": "CIUDAD DE MEXICO",
  "BCS": "LA PAZ",
};

// Casos donde `entidad` trae el nombre del ESTADO directo, sin ciudad puntual
// (ej. "JALISCO", "BAJA CALIFORNIA SUR", o los valores nuevos "Sinaloa"/"BCS"/"Jalisco"/"CDMX"
// que vienen del selector del alta de expedientes). Aquí ciudad queda en null.
const ESTADOS_DIRECTOS: Record<string, string> = {
  "SINALOA": "Sinaloa",
  "JALISCO": "Jalisco",
  "BCS": "Baja California Sur",
  "BAJA CALIFORNIA SUR": "Baja California Sur",
  "NUEVO LEON": "Nuevo León",
  "CIUDAD DE MEXICO": "CDMX",
  "CDMX": "CDMX",
};

/** Estado al que pertenece una ciudad ya conocida (para armar el filtro en cascada). */
export function estadoDeCiudad(ciudad: string): string | null {
  const u = MAPA[limpiar(ciudad)];
  return u ? u.estado : null;
}

/** Todas las ciudades conocidas de un Estado (para llenar el segundo <select> en cascada). */
export function ciudadesDeEstado(estado: string): string[] {
  const vistos = new Set<string>();
  return Object.values(MAPA)
    .filter((u) => u.estado === estado && u.ciudad)
    .map((u) => u.ciudad as string)
    .filter((c) => (vistos.has(c) ? false : (vistos.add(c), true)))
    .sort();
}

/** Lista de Estados disponibles en el catálogo, para el primer <select>. */
export function estadosDisponibles(): string[] {
  const deCiudades = Object.values(MAPA).map((u) => u.estado);
  const deEstadosDirectos = Object.values(ESTADOS_DIRECTOS);
  return Array.from(new Set([...deCiudades, ...deEstadosDirectos])).sort();
}

// Busca el nombre de una ciudad conocida dentro de un texto libre (ej. el nombre del juzgado).
// Ordena por longitud descendente para que "El Fuerte" no se confunda con coincidencias parciales cortas.
function buscarCiudadEnTexto(texto: string): UbicacionJudicial | null {
  if (!texto) return null;
  const limpio = limpiar(texto);
  const nombres = Object.keys(MAPA).sort((a, b) => b.length - a.length);
  for (const n of nombres) {
    if (n.length >= 4 && limpio.includes(n)) return MAPA[n];
  }
  return null;
}

/**
 * Detecta la ciudad/estado real de un expediente. Orden de prioridad:
 * 1) `distrito_judicial` — es el campo más confiable: en el alta de expedientes ya se
 *    elige de un catálogo cerrado (los 18 distritos de Sinaloa), no se escribe libre.
 * 2) `juzgado` / `nombre_juzgado` — mismo catálogo cerrado, por si distrito_judicial vino vacío.
 * 3) `entidad` — puede ser un valor de CIUDAD (dato viejo: "CULIACAN", "MAZATLAN", "LA PAZ"...)
 *    o un valor de ESTADO (dato nuevo, del selector: "Sinaloa", "Jalisco", "BCS", "CDMX").
 *    Se revisa AL FINAL porque "Sinaloa" como Estado no debe confundirse con el distrito
 *    judicial que casualmente también se llama "Sinaloa".
 */
export function detectarUbicacion(caso: {
  entidad?: string | null;
  juzgado?: string | null;
  distrito_judicial?: string | null;
}): UbicacionJudicial | null {
  const porDistrito = buscarCiudadEnTexto(caso.distrito_judicial || "");
  if (porDistrito) return porDistrito;

  const porJuzgado = buscarCiudadEnTexto(caso.juzgado || "");
  if (porJuzgado) return porJuzgado;

  const candidatoEntidad = (caso.entidad || "").trim();
  if (candidatoEntidad) {
    const limpio = limpiar(candidatoEntidad);
    const conAlias = ALIAS_CIUDAD[limpio] ? limpiar(ALIAS_CIUDAD[limpio]) : limpio;
    if (MAPA[conAlias]) return MAPA[conAlias]; // valor viejo tipo "CULIACAN" (ciudad directa)
    if (ESTADOS_DIRECTOS[limpio]) return { ciudad: null, estado: ESTADOS_DIRECTOS[limpio] }; // valor nuevo tipo "Sinaloa" (solo estado)
  }

  return null;
}

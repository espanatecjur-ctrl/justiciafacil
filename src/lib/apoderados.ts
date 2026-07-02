// ============================================================================
//  APODERADOS — Lista de personas facultadas para firmar a nombre de la empresa
// ----------------------------------------------------------------------------
//  Fase 1 del módulo de Contratos (Paquete de Cambio).
//
//  Aquí viven los apoderados. Cada uno guarda sus datos personales + los datos
//  de la ESCRITURA de su poder notarial. Cuando en el editor se escoge un
//  apoderado, todos estos datos se copian automáticamente al contrato usando
//  las "llaves" (keys) que están más abajo en APODERADO_KEYS.
//
//  Por ahora la lista trae 2 apoderados DE PRUEBA. Poder agregarlos/editarlos
//  desde una pantalla (guardando en Supabase) es la Fase 5.
// ============================================================================

export interface Apoderado {
  id: string;
  /** Nombre completo, tal como debe aparecer al firmar. */
  nombre: string;
  /** Cómo firma: "Apoderado Legal", "Representante Legal", etc. */
  cargo: string;
  /** Empresa que representa. Por ahora siempre DIIPA; en Fase 3 se suman las otras. */
  empresa: string;
  /** Tipo de poder que ostenta. */
  tipoPoder: string;

  // --- Datos de la ESCRITURA del poder (para acreditar la personalidad) ---
  escrituraNumero: string;
  volumen?: string;
  libro?: string;
  /** Fecha del poder, en texto: "12 de marzo de 2026". */
  fechaPoder: string;
  /** Notario ante quien se otorgó el poder. */
  notario: string;
  numeroNotaria: string;
  estadoNotaria: string;

  // --- Datos fiscales (opcionales) ---
  rfc?: string;
  curp?: string;

  /** Si está activo aparece en el selector. */
  activo?: boolean;
}

export const EMPRESA_DIIPA = "Desarrollos Inteligentes de Inmuebles y Propiedades Accesibles, S.A. de C.V. (Inmuebles Accesibles)";

// ----------------------------------------------------------------------------
//  Lista de apoderados (2 de prueba)
//  NOTA: los números de escritura del poder son de ejemplo — Paola los corrige.
// ----------------------------------------------------------------------------
export const apoderadosSeed: Apoderado[] = [
  {
    id: "apo-001",
    nombre: "Lic. Juan Carlos Camacho Ibarra",
    cargo: "Apoderado Legal",
    empresa: EMPRESA_DIIPA,
    tipoPoder: "general para pleitos y cobranzas, actos de administración y actos de dominio",
    escrituraNumero: "0000",
    volumen: "—",
    libro: "—",
    fechaPoder: "00 de mes de 2026",
    notario: "Lic. Eduardo Antonio Rocha Pacheco",
    numeroNotaria: "234",
    estadoNotaria: "Sinaloa",
    rfc: "",
    activo: true,
  },
  {
    id: "apo-002",
    nombre: "Clara Elizabeth Rivera Vega",
    cargo: "Representante Legal",
    empresa: EMPRESA_DIIPA,
    tipoPoder: "general para pleitos y cobranzas y actos de administración",
    escrituraNumero: "0000",
    volumen: "—",
    libro: "—",
    fechaPoder: "00 de mes de 2026",
    notario: "Lic. Eduardo Antonio Rocha Pacheco",
    numeroNotaria: "234",
    estadoNotaria: "Sinaloa",
    rfc: "",
    activo: true,
  },
];

// ----------------------------------------------------------------------------
//  Llaves que los machotes (Carta / Contrato) usarán como {{apoderadoNombre}},
//  {{apoderadoEscritura}}, etc. Se centralizan aquí para no equivocarse.
// ----------------------------------------------------------------------------
export const APODERADO_KEYS = {
  nombre: "apoderadoNombre",
  cargo: "apoderadoCargo",
  empresa: "apoderadoEmpresa",
  tipoPoder: "apoderadoTipoPoder",
  escritura: "apoderadoEscritura",
  volumen: "apoderadoVolumen",
  libro: "apoderadoLibro",
  fechaPoder: "apoderadoFechaPoder",
  notario: "apoderadoNotario",
  numNotaria: "apoderadoNumNotaria",
  estadoNotaria: "apoderadoEstadoNotaria",
  rfc: "apoderadoRfc",
} as const;

/**
 * Toma un apoderado y devuelve las llaves/valores listos para inyectarse en el
 * objeto `valores` del editor. Así, al escoger un apoderado, el contrato se
 * auto-llena.
 */
export function valoresApoderado(a: Apoderado): Record<string, string> {
  return {
    [APODERADO_KEYS.nombre]: a.nombre,
    [APODERADO_KEYS.cargo]: a.cargo,
    [APODERADO_KEYS.empresa]: a.empresa,
    [APODERADO_KEYS.tipoPoder]: a.tipoPoder,
    [APODERADO_KEYS.escritura]: a.escrituraNumero,
    [APODERADO_KEYS.volumen]: a.volumen ?? "",
    [APODERADO_KEYS.libro]: a.libro ?? "",
    [APODERADO_KEYS.fechaPoder]: a.fechaPoder,
    [APODERADO_KEYS.notario]: a.notario,
    [APODERADO_KEYS.numNotaria]: a.numeroNotaria,
    [APODERADO_KEYS.estadoNotaria]: a.estadoNotaria,
    [APODERADO_KEYS.rfc]: a.rfc ?? "",
  };
}

export function getApoderado(id: string, lista: Apoderado[] = apoderadosSeed) {
  return lista.find((a) => a.id === id);
}

// ----------------------------------------------------------------------------
//  Conexión a Supabase (tabla `apoderado`)
//  La tabla se crea con el SQL de la Fase 5. Mientras no haya filas, el editor
//  usa la lista de prueba (apoderadosSeed) como respaldo.
// ----------------------------------------------------------------------------
import { sbSelect } from "./supabase";

/** Fila tal como viene de Supabase (nombres con guion_bajo). */
export interface ApoderadoRow {
  id: string;
  nombre: string;
  cargo: string | null;
  empresa: string | null;
  tipo_poder: string | null;
  escritura_numero: string | null;
  volumen: string | null;
  libro: string | null;
  fecha_poder: string | null;
  notario: string | null;
  numero_notaria: string | null;
  estado_notaria: string | null;
  rfc: string | null;
  curp: string | null;
  activo: boolean | null;
}

/** Convierte una fila de Supabase al formato que usa la app. */
export function filaAApoderado(r: ApoderadoRow): Apoderado {
  return {
    id: r.id,
    nombre: r.nombre,
    cargo: r.cargo ?? "",
    empresa: r.empresa ?? EMPRESA_DIIPA,
    tipoPoder: r.tipo_poder ?? "",
    escrituraNumero: r.escritura_numero ?? "",
    volumen: r.volumen ?? "",
    libro: r.libro ?? "",
    fechaPoder: r.fecha_poder ?? "",
    notario: r.notario ?? "",
    numeroNotaria: r.numero_notaria ?? "",
    estadoNotaria: r.estado_notaria ?? "",
    rfc: r.rfc ?? "",
    curp: r.curp ?? "",
    activo: r.activo ?? true,
  };
}

/**
 * Trae los apoderados desde Supabase. Si la tabla está vacía o falla la
 * lectura, devuelve la lista de prueba para que el editor no se quede sin nada.
 */
export async function cargarApoderados(): Promise<Apoderado[]> {
  try {
    const filas = await sbSelect<ApoderadoRow>("apoderado", "select=*&order=nombre.asc");
    if (!filas.length) return apoderadosSeed;
    return filas.map(filaAApoderado);
  } catch {
    return apoderadosSeed;
  }
}

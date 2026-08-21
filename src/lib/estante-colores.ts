// JusticiaFácil · Estante de carpetas — la lógica central de colores y
// distintivos visuales. Un solo lugar que decide cómo se ve cada carpeta,
// para que todas las pestañas del estante (por Estado, por módulo, etc.)
// se vean consistentes sin repetir la lógica en cada pantalla.

export type UnidadAsuntoColor = "UCM" | "UCP" | "UDP" | "UFC";
export type GrisEstado = "sin_cliente" | "concluido" | "por_destruir" | null;
export type Posicion = "actor" | "demandado" | null;

export interface DistintivoVisual {
  colorFondo: string;
  colorTexto: string;
  franjaRoja: boolean;   // R1 (UCP) y R2C (UCM) — códigos delicados
  icono: string;         // clave de ícono, se mapea a Tabler/lucide en el componente
  grisEstado: GrisEstado;
  posicion: Posicion;
  etiqueta: string;      // texto corto para la carpeta: "R2", "Penal", "Concluido"…
  soloDigital: boolean;  // true = existe en el sistema pero nadie ha confirmado que se abrió la carpeta física de verdad
}

// ===== Paleta — coincide con los colores que ya usan las unidades en el resto del sistema =====
const PALETA = {
  UCM: { fondo: "#0F6E56", texto: "#E1F5EE" },
  UCP: { fondo: "#185FA5", texto: "#E6F1FB" },
  UDP: { fondo: "#993C1D", texto: "#FAECE7" },
  UFC: { fondo: "#854F0B", texto: "#FAEEDA" },
  GRIS_SIN_CLIENTE: { fondo: "#5F5E5A", texto: "#F1EFE8" },
  GRIS_CONCLUIDO: { fondo: "#888780", texto: "#2C2C2A" },
  GRIS_DESTRUCCION: { fondo: "#444441", texto: "#D3D1C7" },
};

// Códigos delicados/urgentes — llevan franja roja encima de su color de unidad.
const CODIGOS_DELICADOS = ["R1", "R2C"];

// Código → unidad (para saber de qué color pintar, sin importar en qué tabla viva el caso).
const CODIGO_A_UNIDAD: Record<string, UnidadAsuntoColor> = {
  R2: "UCM", R2C: "UCM", R3: "UCM",
  R1: "UCP", R1V: "UCP", RV: "UCP",
  RDC: "UFC",
};

// Tipo de asunto en UDP → ícono (todas rojas, el ícono distingue el tipo).
const ICONO_TIPO_UDP: Record<string, string> = {
  DENUNCIA_PENAL: "gavel",
  CONVENIO_PENAL: "gavel",
  civil: "file-text",
  QUEJA_PROFECO: "shield-check",
  CONDUSEF: "building-bank",
  mercantil: "briefcase",
  laboral: "users",
};

const ANIOS_PARA_DESTRUCCION = 5;

export interface DatosParaDistintivo {
  unidad: UnidadAsuntoColor;
  codigo?: string | null;         // R1, R2, R2C, R3, RV, R1V, RDC — viene de JurisConecta
  tipoUdp?: string | null;        // solo aplica si unidad === "UDP"
  tieneCliente: boolean;
  terminado?: boolean | null;     // caso_juridico.terminado
  fechaCierreReal?: string | null; // compensacion_devolucion.fecha_cierre_real
  actor?: string | null;
  demandado?: string | null;
  posicionUdp?: string | null;    // caso_udp.posicion ya viene directo como actor/demandado
  tieneConvenio?: boolean | null; // solo aplica a RDC
  abiertaFisicamente?: boolean;   // ¿ya se confirmó que la carpeta se abrió de verdad en papel?
}

function esDiipa(nombre: string | null | undefined): boolean {
  return !!nombre && nombre.toUpperCase().includes("DIIPA");
}

export function calcularDistintivo(d: DatosParaDistintivo): DistintivoVisual {
  // 1) Sin cliente — garantía disponible, sin dueño asignado todavía.
  if (!d.tieneCliente) {
    return { colorFondo: PALETA.GRIS_SIN_CLIENTE.fondo, colorTexto: PALETA.GRIS_SIN_CLIENTE.texto, franjaRoja: false, icono: "help", grisEstado: "sin_cliente", posicion: null, etiqueta: "Sin cliente", soloDigital: false };
  }

  // 2) Concluido — revisa si ya toca destrucción física (5 años desde el cierre real).
  if (d.terminado) {
    let esDestruccion = false;
    if (d.fechaCierreReal) {
      const limite = new Date(d.fechaCierreReal);
      limite.setFullYear(limite.getFullYear() + ANIOS_PARA_DESTRUCCION);
      esDestruccion = new Date() >= limite;
    }
    return esDestruccion
      ? { colorFondo: PALETA.GRIS_DESTRUCCION.fondo, colorTexto: PALETA.GRIS_DESTRUCCION.texto, franjaRoja: false, icono: "clock-hour-4", grisEstado: "por_destruir", posicion: null, etiqueta: "Destruir · 5 años", soloDigital: false }
      : { colorFondo: PALETA.GRIS_CONCLUIDO.fondo, colorTexto: PALETA.GRIS_CONCLUIDO.texto, franjaRoja: false, icono: "check", grisEstado: "concluido", posicion: null, etiqueta: "Concluido", soloDigital: false };
  }

  // 3) Posición (actor/demandado) — UDP ya trae su propio campo; el resto se infiere de nombres.
  const posicion: Posicion = d.posicionUdp === "actor" || d.posicionUdp === "demandado"
    ? (d.posicionUdp as Posicion)
    : esDiipa(d.actor) ? "actor" : esDiipa(d.demandado) ? "demandado" : null;

  const soloDigital = !d.abiertaFisicamente;

  // 4) UDP — todas rojas, ícono según el tipo.
  if (d.unidad === "UDP") {
    const icono = (d.tipoUdp && ICONO_TIPO_UDP[d.tipoUdp]) || "alert-triangle";
    const etiquetaTipo: Record<string, string> = {
      DENUNCIA_PENAL: "Penal", CONVENIO_PENAL: "Penal (convenio)", civil: "Civil",
      QUEJA_PROFECO: "PROFECO", CONDUSEF: "CONDUSEF", mercantil: "Mercantil", laboral: "Laboral",
    };
    return { colorFondo: PALETA.UDP.fondo, colorTexto: PALETA.UDP.texto, franjaRoja: false, icono, grisEstado: null, posicion, etiqueta: (d.tipoUdp && etiquetaTipo[d.tipoUdp]) || "UDP", soloDigital };
  }

  // 5) RDC (devolución, vive en UFC) — separado por si tiene convenio o no.
  if (d.codigo === "RDC" || d.unidad === "UFC") {
    return {
      colorFondo: PALETA.UFC.fondo, colorTexto: PALETA.UFC.texto, franjaRoja: false,
      icono: d.tieneConvenio ? "file-check" : "file-x", grisEstado: null, posicion,
      etiqueta: d.tieneConvenio ? "RDC · con convenio" : "RDC · sin convenio", soloDigital,
    };
  }

  // 6) UCM / UCP por código — franja roja si es delicado (R1 o R2C).
  const unidadDeCodigo = (d.codigo && CODIGO_A_UNIDAD[d.codigo]) || d.unidad;
  const paletaUnidad = PALETA[unidadDeCodigo] || PALETA.UCM;
  const franjaRoja = !!d.codigo && CODIGOS_DELICADOS.includes(d.codigo);

  return {
    colorFondo: paletaUnidad.fondo, colorTexto: paletaUnidad.texto, franjaRoja,
    icono: "qrcode", grisEstado: null, posicion, etiqueta: d.codigo || unidadDeCodigo, soloDigital,
  };
}

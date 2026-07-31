// ============================================================
//  Recomendaciones jurídicas por etapa procesal
// ------------------------------------------------------------
//  Guía de referencia general (Código de Comercio / CPC estatal /
//  Ley de Amparo) para orientar qué tipo de escrito conviene
//  preparar según en qué etapa va el juicio. NO es un dictamen ni
//  sustituye el criterio del abogado — siempre se marca para
//  validación del DIL antes de presentarse.
// ============================================================

export interface RecomendacionEtapa {
  /** Palabras clave para hacer match con el texto libre de la etapa. */
  match: string[];
  tituloCorto: string;
  recomendacion: string;
  tipoEscritoSugerido: string;
  baseLegal: string;
  accionesGenerales: string[];
}

export const RECOMENDACIONES_ETAPA: RecomendacionEtapa[] = [
  {
    match: ["admisión", "admision", "emplazamiento"],
    tituloCorto: "Admisión y emplazamiento",
    recomendacion:
      "Verificar que el emplazamiento se haya practicado correctamente (persona, domicilio, entrega de cédula y anexos). Si el plazo para contestar ya venció sin promoción de la contraria, promover acuse de rebeldía.",
    tipoEscritoSugerido: "promocion",
    baseLegal:
      "Código de Comercio arts. 1069, 1075-1079 (juicio mercantil) o CPC estatal aplicable, capítulo de emplazamiento y notificaciones.",
    accionesGenerales: ["Leer el expediente completo", "Confirmar domicilio de emplazamiento en autos"],
  },
  {
    match: ["personalidad", "excepci", "apelaci"],
    tituloCorto: "Excepciones y apelación",
    recomendacion:
      "Si se opuso excepción de falta de personalidad u otra dilatoria, preparar la promoción que subsane o combata la excepción dentro del plazo legal. Si se resolvió en contra, evaluar de inmediato la apelación en efecto devolutivo para no perder el término.",
    tipoEscritoSugerido: "promocion",
    baseLegal:
      "Código de Comercio arts. 1122-1131 (excepciones y recursos) o CPC estatal correlativo; plazo de apelación normalmente de 5-9 días hábiles según la vía.",
    accionesGenerales: ["Leer el expediente completo", "Revisar poder/personalidad del apoderado contrario"],
  },
  {
    match: ["prueba", "alegat", "audiencia"],
    tituloCorto: "Pruebas y alegatos",
    recomendacion:
      "Confirmar que todas las pruebas ofrecidas quedaron debidamente admitidas y desahogadas (documental, confesional, pericial). Si falta desahogar alguna, promover para fijar fecha. Al cierre de instrucción, preparar alegatos.",
    tipoEscritoSugerido: "promocion",
    baseLegal: "Código de Comercio arts. 1198-1251 (pruebas) o CPC estatal correlativo.",
    accionesGenerales: ["Leer el expediente completo", "Verificar que el dictamen pericial (si aplica) esté agregado en autos"],
  },
  {
    match: ["caduc"],
    tituloCorto: "Caducidad de la instancia",
    recomendacion:
      "Si el juzgado decretó caducidad, revisar si la resolución quedó firme (venció el plazo de apelación) o si se impugnó. Si quedó firme, valorar promover una NUEVA demanda si el derecho no ha prescrito (revisar plazo de prescripción de la acción hipotecaria/cambiaria aplicable). Si no quedó firme o hay causa de subsanación, promover la reposición del procedimiento.",
    tipoEscritoSugerido: "promocion",
    baseLegal:
      "Código de Comercio arts. 1076-1077 (caducidad de la instancia mercantil) o CPC estatal correlativo; revisar también plazo de prescripción de la acción (Código Civil / Código de Comercio según el título de crédito o garantía).",
    accionesGenerales: [
      "Leer el expediente completo (autos posteriores a la caducidad)",
      "Visitar RPPC para verificar si la garantía sigue inscrita y libre de otros gravámenes",
      "Confirmar con el juzgado (oficialía de partes) si hay recurso pendiente de resolver",
    ],
  },
  {
    match: ["formaliza", "escritur", "venta", "cesión", "cesion"],
    tituloCorto: "Formalización / escrituración",
    recomendacion:
      "Confirmar vigencia de la instrucción notarial y que el precio esté totalmente cubierto antes de firmar. Si el juicio no ha concluido, la escritura debe dejar constancia expresa de que la posesión y la situación jurídica del inmueble están sujetas al resultado del juicio.",
    tipoEscritoSugerido: "promocion",
    baseLegal: "Código Civil estatal (compraventa y cesión de derechos) y Ley del Notariado estatal aplicable.",
    accionesGenerales: ["Visitar RPPC para confirmar folio real y inscripción vigente", "Confirmar con Contabilidad que los pagos pendientes del cliente ya se liquidaron"],
  },
  {
    match: ["recomendaci", "siguiente paso", "cierre"],
    tituloCorto: "Definición de siguiente paso / cierre",
    recomendacion:
      "Con base en el estatus procesal confirmado, decidir entre: (a) continuar impulsando el juicio, (b) reponer el procedimiento si hubo caducidad no firme, o (c) cerrar el expediente y ofrecer cambio de garantía al cliente (R3) si la vía judicial ya no es viable. Documentar la decisión con su fundamento.",
    tipoEscritoSugerido: "promocion",
    baseLegal: "Depende del resultado de la etapa de caducidad/apelación — validar con el DIL antes de decidir.",
    accionesGenerales: ["Leer el expediente completo", "Preparar resumen ejecutivo para Mesa Directiva si se recomienda cierre"],
  },
];

const FALLBACK: RecomendacionEtapa = {
  match: [],
  tituloCorto: "Etapa general",
  recomendacion: "Revisar el expediente y el boletín más reciente para definir si conviene una promoción de impulso procesal.",
  tipoEscritoSugerido: "promocion",
  baseLegal: "Código de Comercio / CPC estatal aplicable según la vía del juicio.",
  accionesGenerales: ["Leer el expediente completo", "Visitar RPPC si la garantía es un inmueble"],
};

/** Busca la recomendación cuyo `match` aparezca dentro del texto de la etapa (insensible a mayúsculas/acentos simples). */
export function recomendacionParaEtapa(etapa: string | null | undefined): RecomendacionEtapa {
  if (!etapa) return FALLBACK;
  const norm = etapa.toLowerCase();
  return RECOMENDACIONES_ETAPA.find((r) => r.match.some((m) => norm.includes(m))) ?? FALLBACK;
}

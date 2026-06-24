import type { ContratoTipo } from "./legal-types";

export interface PlantillaCampo {
  id: string;
  label: string;
  tipo: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  opciones?: string[];
  requerido?: boolean;
  dependeDe?: { campo: string; valor: string | boolean };
  ayuda?: string;
}

export interface PlantillaContrato {
  tipo: ContratoTipo;
  nombre: string;
  descripcion: string;
  campos: PlantillaCampo[];
  /** Cuerpo con placeholders {{campo}}. */
  cuerpo: string;
}

const campoFirma: PlantillaCampo[] = [
  { id: "lugarFirma", label: "Lugar de firma", tipo: "text", requerido: true },
  { id: "fechaFirma", label: "Fecha de firma", tipo: "date", requerido: true },
];

const campoPartesBase: PlantillaCampo[] = [
  { id: "nombreParteA", label: "Nombre Parte A (Prestadora / Vendedora / Arrendadora)", tipo: "text", requerido: true },
  { id: "rfcParteA", label: "RFC Parte A", tipo: "text" },
  { id: "domicilioParteA", label: "Domicilio Parte A", tipo: "textarea" },
  { id: "apoderadoA", label: "Compareció por apoderado", tipo: "checkbox" },
  { id: "nombreApoderadoA", label: "Nombre del apoderado A", tipo: "text", dependeDe: { campo: "apoderadoA", valor: true } },
  { id: "instrumentoApoderadoA", label: "Instrumento notarial del poder A (No., Notario, Plaza)", tipo: "text", dependeDe: { campo: "apoderadoA", valor: true } },

  { id: "nombreParteB", label: "Nombre Parte B (Cliente / Compradora / Arrendataria)", tipo: "text", requerido: true },
  { id: "rfcParteB", label: "RFC / CURP Parte B", tipo: "text" },
  { id: "domicilioParteB", label: "Domicilio Parte B", tipo: "textarea" },
  { id: "estadoCivilB", label: "Estado civil Parte B", tipo: "select", opciones: ["soltero(a)", "casado(a)", "divorciado(a)", "viudo(a)"] },
  { id: "regimenMatrimonial", label: "Régimen matrimonial", tipo: "select", opciones: ["sociedad conyugal", "separación de bienes"], dependeDe: { campo: "estadoCivilB", valor: "casado(a)" } },
  { id: "nombreConyuge", label: "Nombre del cónyuge", tipo: "text", dependeDe: { campo: "estadoCivilB", valor: "casado(a)" } },
  { id: "consentimientoConyugal", label: "Cuenta con consentimiento conyugal por escrito", tipo: "checkbox", dependeDe: { campo: "estadoCivilB", valor: "casado(a)" } },
];

const campoGarantia: PlantillaCampo[] = [
  { id: "tieneGarantia", label: "Se otorga garantía", tipo: "checkbox" },
  { id: "tipoGarantia", label: "Tipo de garantía", tipo: "select", opciones: ["fianza", "prenda", "hipoteca", "aval", "depósito en garantía"], dependeDe: { campo: "tieneGarantia", valor: true } },
  { id: "montoGarantia", label: "Monto de la garantía (MXN)", tipo: "number", dependeDe: { campo: "tieneGarantia", valor: true } },
  { id: "nombreGarante", label: "Nombre del garante / fiador", tipo: "text", dependeDe: { campo: "tieneGarantia", valor: true } },
];

export const plantillas: PlantillaContrato[] = [
  {
    tipo: "prestacion_servicios",
    nombre: "Prestación de Servicios Profesionales",
    descripcion: "Contrato base para servicios jurídicos, contables o de consultoría — uso interno del despacho.",
    campos: [
      ...campoPartesBase,
      { id: "objeto", label: "Objeto del servicio (descripción detallada)", tipo: "textarea", requerido: true },
      { id: "honorarios", label: "Honorarios totales (MXN)", tipo: "number", requerido: true },
      { id: "formaPago", label: "Forma de pago", tipo: "select", opciones: ["pago único", "mensualidades", "por etapas", "éxito + iguala"] },
      { id: "vigenciaMeses", label: "Vigencia (meses)", tipo: "number", requerido: true },
      { id: "exclusividad", label: "Cláusula de exclusividad", tipo: "checkbox" },
      { id: "confidencialidad", label: "Cláusula de confidencialidad", tipo: "checkbox" },
      ...campoGarantia,
      ...campoFirma,
    ],
    cuerpo:
      "CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES que celebran por una parte {{nombreParteA}} (la \"PRESTADORA\"), y por la otra {{nombreParteB}} (el \"CLIENTE\"), al tenor de las siguientes:\n\nDECLARACIONES\nI. La PRESTADORA declara ser persona con capacidad legal{{#apoderadoA}} representada por {{nombreApoderadoA}} en términos del instrumento {{instrumentoApoderadoA}}{{/apoderadoA}}, con RFC {{rfcParteA}} y domicilio en {{domicilioParteA}}.\nII. El CLIENTE declara con RFC/CURP {{rfcParteB}} y domicilio en {{domicilioParteB}}; estado civil {{estadoCivilB}}{{#esCasado}} bajo el régimen de {{regimenMatrimonial}}, casado(a) con {{nombreConyuge}}{{/esCasado}}.\n\nCLÁUSULAS\nPRIMERA. OBJETO. La PRESTADORA se obliga a {{objeto}}.\nSEGUNDA. HONORARIOS. El CLIENTE pagará la cantidad de $ {{honorarios}} MXN, en la modalidad: {{formaPago}}.\nTERCERA. VIGENCIA. {{vigenciaMeses}} meses contados a partir de la firma.\n{{#exclusividad}}CUARTA. EXCLUSIVIDAD. Durante la vigencia, la PRESTADORA prestará servicios análogos en exclusiva al CLIENTE.\n{{/exclusividad}}{{#confidencialidad}}QUINTA. CONFIDENCIALIDAD. Las partes guardarán secreto profesional sobre la información intercambiada.\n{{/confidencialidad}}{{#tieneGarantia}}SEXTA. GARANTÍA. {{nombreGarante}} otorga {{tipoGarantia}} por la cantidad de $ {{montoGarantia}} MXN.\n{{/tieneGarantia}}\nLeído el presente en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "compraventa",
    nombre: "Compraventa",
    descripcion: "Compraventa civil de bien mueble o inmueble.",
    campos: [
      ...campoPartesBase,
      { id: "bien", label: "Descripción del bien", tipo: "textarea", requerido: true },
      { id: "esInmueble", label: "¿Es bien inmueble?", tipo: "checkbox" },
      { id: "folioReal", label: "Folio real / Registro Público", tipo: "text", dependeDe: { campo: "esInmueble", valor: true } },
      { id: "precio", label: "Precio total (MXN)", tipo: "number", requerido: true },
      { id: "formaPago", label: "Forma de pago", tipo: "select", opciones: ["contado", "parcialidades", "crédito hipotecario", "permuta"] },
      ...campoGarantia,
      ...campoFirma,
    ],
    cuerpo:
      "CONTRATO DE COMPRAVENTA entre {{nombreParteA}} (\"VENDEDOR\") y {{nombreParteB}} (\"COMPRADOR\").\n\nDECLARACIONES\nEl VENDEDOR es legítimo propietario de: {{bien}}{{#esInmueble}}, inscrito bajo folio real {{folioReal}}{{/esInmueble}}.\nEl COMPRADOR{{#esCasado}}, casado(a) bajo {{regimenMatrimonial}} con {{nombreConyuge}}{{#consentimientoConyugal}} cuenta con consentimiento conyugal{{/consentimientoConyugal}}{{/esCasado}}, manifiesta su voluntad de adquirir.\n\nCLÁUSULAS\nPRIMERA. OBJETO. Compraventa del bien descrito.\nSEGUNDA. PRECIO. $ {{precio}} MXN, pagaderos: {{formaPago}}.\n{{#tieneGarantia}}TERCERA. GARANTÍA. {{nombreGarante}} otorga {{tipoGarantia}} por $ {{montoGarantia}}.\n{{/tieneGarantia}}\nLeído y firmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "arrendamiento",
    nombre: "Arrendamiento",
    descripcion: "Arrendamiento de inmueble (uso habitacional o comercial).",
    campos: [
      ...campoPartesBase,
      { id: "inmueble", label: "Dirección y características del inmueble", tipo: "textarea", requerido: true },
      { id: "uso", label: "Uso", tipo: "select", opciones: ["habitacional", "comercial", "mixto"] },
      { id: "renta", label: "Renta mensual (MXN)", tipo: "number", requerido: true },
      { id: "vigenciaMeses", label: "Vigencia (meses)", tipo: "number", requerido: true },
      { id: "deposito", label: "Depósito en garantía (meses de renta)", tipo: "number" },
      ...campoGarantia,
      ...campoFirma,
    ],
    cuerpo:
      "CONTRATO DE ARRENDAMIENTO entre {{nombreParteA}} (\"ARRENDADOR\") y {{nombreParteB}} (\"ARRENDATARIO\").\n\nPRIMERA. OBJETO. Arrendamiento del inmueble: {{inmueble}}, para uso {{uso}}.\nSEGUNDA. RENTA. $ {{renta}} MXN mensuales.\nTERCERA. VIGENCIA. {{vigenciaMeses}} meses.\nCUARTA. DEPÓSITO. {{deposito}} mes(es) de renta en garantía.\n{{#tieneGarantia}}QUINTA. FIADOR. {{nombreGarante}} otorga {{tipoGarantia}} por $ {{montoGarantia}}.\n{{/tieneGarantia}}\nFirmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "mutuo",
    nombre: "Mutuo con Interés",
    descripcion: "Préstamo civil/mercantil con o sin garantía.",
    campos: [
      ...campoPartesBase,
      { id: "monto", label: "Monto del mutuo (MXN)", tipo: "number", requerido: true },
      { id: "tasa", label: "Tasa de interés anual (%)", tipo: "number" },
      { id: "plazoMeses", label: "Plazo (meses)", tipo: "number", requerido: true },
      ...campoGarantia,
      ...campoFirma,
    ],
    cuerpo:
      "CONTRATO DE MUTUO entre {{nombreParteA}} (\"MUTUANTE\") y {{nombreParteB}} (\"MUTUATARIO\").\n\nPRIMERA. El MUTUANTE entrega $ {{monto}} MXN.\nSEGUNDA. Interés ordinario {{tasa}}% anual, pagadero mensualmente.\nTERCERA. Plazo {{plazoMeses}} meses.\n{{#tieneGarantia}}CUARTA. GARANTÍA. {{nombreGarante}} otorga {{tipoGarantia}} por $ {{montoGarantia}}.\n{{/tieneGarantia}}\nFirmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "comodato",
    nombre: "Comodato",
    descripcion: "Préstamo gratuito de uso.",
    campos: [
      ...campoPartesBase,
      { id: "bien", label: "Bien dado en comodato", tipo: "textarea", requerido: true },
      { id: "plazoMeses", label: "Plazo (meses)", tipo: "number", requerido: true },
      ...campoFirma,
    ],
    cuerpo: "CONTRATO DE COMODATO entre {{nombreParteA}} (\"COMODANTE\") y {{nombreParteB}} (\"COMODATARIO\").\n\nPRIMERA. El COMODANTE entrega gratuitamente {{bien}}.\nSEGUNDA. Plazo {{plazoMeses}} meses.\nFirmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "poder_notarial",
    nombre: "Poder (formato base, requiere protocolización)",
    descripcion: "Borrador para protocolizar ante Notario Público.",
    campos: [
      { id: "nombreParteA", label: "Otorgante (Poderdante)", tipo: "text", requerido: true },
      { id: "rfcParteA", label: "RFC / CURP otorgante", tipo: "text" },
      { id: "nombreParteB", label: "Apoderado", tipo: "text", requerido: true },
      { id: "tipoPoder", label: "Tipo de poder", tipo: "select", opciones: ["general para pleitos y cobranzas", "general para actos de administración", "general para actos de dominio", "especial"], requerido: true },
      { id: "facultadesEspeciales", label: "Facultades especiales adicionales", tipo: "textarea", dependeDe: { campo: "tipoPoder", valor: "especial" } },
      ...campoFirma,
    ],
    cuerpo:
      "PODER {{tipoPoder}} que otorga {{nombreParteA}} a favor de {{nombreParteB}}, con las facultades del artículo 2554 del Código Civil aplicable.{{#facultadesEspeciales}}\n\nFacultades especiales: {{facultadesEspeciales}}.{{/facultadesEspeciales}}\n\nFirmado en {{lugarFirma}}, a {{fechaFirma}}. Pendiente de protocolización notarial.",
  },
  {
    tipo: "transaccion",
    nombre: "Transacción (convenio fuera de juicio)",
    descripcion: "Convenio para evitar o terminar litigio.",
    campos: [
      ...campoPartesBase,
      { id: "controversia", label: "Descripción de la controversia", tipo: "textarea", requerido: true },
      { id: "concesionesA", label: "Concesiones de A", tipo: "textarea" },
      { id: "concesionesB", label: "Concesiones de B", tipo: "textarea" },
      { id: "monto", label: "Monto de la transacción (MXN)", tipo: "number" },
      ...campoFirma,
    ],
    cuerpo:
      "CONVENIO DE TRANSACCIÓN entre {{nombreParteA}} y {{nombreParteB}}.\n\nANTECEDENTES. Existe la siguiente controversia: {{controversia}}.\nPRIMERA. Concesiones de la Parte A: {{concesionesA}}.\nSEGUNDA. Concesiones de la Parte B: {{concesionesB}}.\nTERCERA. La Parte A pagará $ {{monto}} MXN, dando por terminada la controversia con cosa juzgada.\nFirmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "donacion",
    nombre: "Donación",
    descripcion: "Donación entre vivos.",
    campos: [
      ...campoPartesBase,
      { id: "bien", label: "Bien donado", tipo: "textarea", requerido: true },
      { id: "valor", label: "Valor estimado (MXN)", tipo: "number" },
      ...campoFirma,
    ],
    cuerpo: "DONACIÓN que otorga {{nombreParteA}} a favor de {{nombreParteB}}: {{bien}}. Valor estimado $ {{valor}} MXN.\nFirmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "confidencialidad",
    nombre: "Convenio de Confidencialidad (NDA)",
    descripcion: "NDA mutuo o unilateral.",
    campos: [
      ...campoPartesBase,
      { id: "esMutuo", label: "¿NDA mutuo?", tipo: "checkbox" },
      { id: "objeto", label: "Información protegida", tipo: "textarea", requerido: true },
      { id: "vigenciaMeses", label: "Vigencia (meses)", tipo: "number", requerido: true },
      { id: "pena", label: "Pena convencional (MXN)", tipo: "number" },
      ...campoFirma,
    ],
    cuerpo:
      "CONVENIO DE CONFIDENCIALIDAD {{#esMutuo}}MUTUO {{/esMutuo}}entre {{nombreParteA}} y {{nombreParteB}}.\n\nPRIMERA. OBJETO. Información protegida: {{objeto}}.\nSEGUNDA. VIGENCIA. {{vigenciaMeses}} meses.\nTERCERA. PENA. El incumplimiento generará pena convencional por $ {{pena}} MXN.\nFirmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
  {
    tipo: "laboral",
    nombre: "Contrato Individual de Trabajo",
    descripcion: "Contrato individual conforme a la LFT.",
    campos: [
      ...campoPartesBase,
      { id: "puesto", label: "Puesto", tipo: "text", requerido: true },
      { id: "salario", label: "Salario diario integrado (MXN)", tipo: "number", requerido: true },
      { id: "jornada", label: "Jornada", tipo: "select", opciones: ["diurna", "nocturna", "mixta"] },
      { id: "duracion", label: "Duración", tipo: "select", opciones: ["tiempo indeterminado", "tiempo determinado", "obra determinada", "capacitación inicial"] },
      ...campoFirma,
    ],
    cuerpo: "CONTRATO INDIVIDUAL DE TRABAJO entre {{nombreParteA}} (\"PATRÓN\") y {{nombreParteB}} (\"TRABAJADOR\").\n\nPRIMERA. PUESTO. {{puesto}}.\nSEGUNDA. SALARIO. $ {{salario}} MXN diarios integrados.\nTERCERA. JORNADA {{jornada}}.\nCUARTA. DURACIÓN: {{duracion}}.\nFirmado en {{lugarFirma}}, a {{fechaFirma}}.",
  },
];

export function getPlantilla(tipo: ContratoTipo) {
  return plantillas.find((p) => p.tipo === tipo);
}

/** Renderiza el cuerpo del contrato con valores y secciones condicionales. */
export function renderContrato(plantilla: PlantillaContrato, valores: Record<string, unknown>) {
  let texto = plantilla.cuerpo;

  // helper: es casado
  const esCasado = valores.estadoCivilB === "casado(a)";

  // Bloques condicionales {{#campo}}...{{/campo}}
  texto = texto.replace(/\{\{#([a-zA-Z]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, block) => {
    if (key === "esCasado") return esCasado ? block : "";
    const v = valores[key];
    if (v === true) return block;
    if (typeof v === "string" && v.length > 0) return block;
    if (typeof v === "number" && v > 0) return block;
    return "";
  });

  // Reemplazo simple {{campo}}
  texto = texto.replace(/\{\{([a-zA-Z]+)\}\}/g, (_m, key) => {
    const v = valores[key];
    if (v === undefined || v === null || v === "") return `____${key}____`;
    return String(v);
  });

  return texto;
}

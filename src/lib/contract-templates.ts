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

// ============================================================================
//  PAQUETE DE CAMBIO — Documento 1: Carta de Intención de Cambio
//  Los datos del apoderado (apoderadoNombre / apoderadoCargo) se auto-llenan
//  desde el Selector de Apoderado en el editor.
// ============================================================================
const cartaCambioCampos: PlantillaCampo[] = [
  { id: "folioCarta", label: "Folio de la presente Carta", tipo: "text", requerido: true, ayuda: "Ej. 003" },
  { id: "fechaEmision", label: "Fecha de emisión", tipo: "text", requerido: true, ayuda: "Ej. 17 DE JUNIO DE 2026" },
  { id: "nombreCliente", label: "Cliente Cesionario (nombre completo)", tipo: "text", requerido: true },
  { id: "folioContratoAnterior", label: "Folio del contrato anterior", tipo: "text", requerido: true, ayuda: "Ej. 00-75D" },
  { id: "fechaContratoAnterior", label: "Fecha del contrato anterior", tipo: "text", ayuda: "Ej. 08 DE AGOSTO DE 2022" },
  { id: "garantiaCambio", label: "Garantía objeto del cambio (dirección completa)", tipo: "textarea", requerido: true },
  { id: "valorOperacion", label: "Valor estimado de la nueva operación (MXN)", tipo: "text", requerido: true, ayuda: "Ej. 2,000,000.00" },
];

const cartaCambioCuerpo = `CARTA DE INTENCIÓN DE CAMBIO
Prestación de Servicios Profesionales para Procedimiento de Garantía Hipotecaria

Folio de la presente Carta: {{folioCarta}}
Fecha de emisión: {{fechaEmision}}
Cliente Cesionario: {{nombreCliente}}
Prestador de Servicios: INMUEBLES ACCESIBLES — DIIPA, S.A. DE C.V.
Folio del contrato anterior: {{folioContratoAnterior}}
Fecha contrato anterior: {{fechaContratoAnterior}}
Garantía objeto del cambio: {{garantiaCambio}}
Valor estimado nueva operación: $ {{valorOperacion}}

I. OBJETO DE LA CARTA
Por medio de la presente, el Prestador de Servicios manifiesta formalmente la intención de llevar a cabo el cambio de procedimiento relacionado con una garantía hipotecaria, a solicitud expresa del Cliente Cesionario, conforme a los compromisos establecidos en reuniones previas y al régimen de sustitución de prestación previsto en la Cláusula Quinta y Decimosexta del contrato original.
Este procedimiento contempla la prestación de servicios profesionales especializados para la revisión jurídica, regularización, desalojo, escrituración y protocolización de la nueva garantía objeto de garantía propuesta en sustitución de la garantía original.

II. ALCANCE DE LA PRESTACIÓN PROFESIONAL DEL CAMBIO
La presente intención incluye los siguientes servicios respecto de la nueva garantía propuesta:
• Revisión jurídica integral del expediente y antecedentes de la nueva garantía hipotecaria.
• Gestión para compra, regularización y desalojo, conforme a dictámenes emitidos por URRJ, UCP y DIL.
• Coordinación de servicios profesionales externos para escrituración, protocolización y regularización ante el Registro Público de la Propiedad.
• Elaboración de dictámenes legales y registrales, incluyendo el Dictamen Legal Final por parte de DIL.
• Seguimiento documental y operativo hasta la formalización del nuevo contrato de prestación de servicios y enteramiento contable-fiscal.
• Coordinación con abogados externos y directores para emisión de firmas validatorias positivas previas a la firma del nuevo contrato.

III. CONDICIONES DE PROCEDIMIENTO
• El Cliente Cesionario deberá firmar la presente carta como constancia de su aceptación del procedimiento de cambio y compromiso de espera de los dictámenes correspondientes.
• Ningún pago definitivo ni firma del nuevo contrato de prestación de servicios se realizará hasta que se emitan los dictámenes jurídicos, registrales y contables que validen la legalidad y viabilidad del cambio de garantía.
• En caso de dictámenes positivos, se procederá a la firma del nuevo Contrato de Prestación de Servicios Profesionales y/o Inversión, con sus propios términos económicos, plazos y obligaciones.
• La carta propuesta de la empresa proveedora deberá estar anexada al expediente, junto con los dictámenes emitidos por URRJ y UCP.
• La Dirección Institucional Legal (DIL) tendrá 5 (cinco) días hábiles para revisar los dictámenes y consolidarlos como Dictamen Legal Final por parte de DIL.
• El Cliente Cesionario firmará esta carta una vez que manifieste interés real y esté dispuesto a esperar la resolución jurídica y registral.

IV. CLÁUSULA DE RESCISIÓN AUTOMÁTICA DEL CONTRATO ANTERIOR
Al firmar la presente Carta de Intención de Cambio, las partes reconocen y aceptan expresamente que el contrato anterior de prestación de servicios profesionales sobre la garantía hipotecaria original (folio {{folioContratoAnterior}}) queda rescindido de pleno derecho a partir de la firma de la presente, sin necesidad de declaración judicial.
Esta rescisión se realiza al amparo del Artículo 1796 del Código Civil Federal, que reconoce la libertad de las partes para modificar o terminar bilateralmente sus contratos por mutuo consentimiento.
Los efectos de esta rescisión son:
a) Cese inmediato de las obligaciones operativas del Prestador respecto de la garantía original.
b) Cese inmediato de las obligaciones de pago del Cliente respecto del contrato original (salvo lo dispuesto en la Cláusula V de la presente).
c) Inicio formal del proceso de evaluación del cambio de prestación.
d) Liberación del Prestador de los plazos y compromisos de gestión del contrato anterior.

V. MODELO ECONÓMICO DEL CAMBIO — TRES ESCENARIOS
La presente Carta de Intención de Cambio establece un régimen económico condicional que depende del resultado de los dictámenes técnicos (URRJ, UCP y DIL) y de la decisión final del Cliente sobre la firma del nuevo Contrato de Prestación de Servicios. Se contemplan tres escenarios excluyentes:

ESCENARIO 1 · DICTÁMENES POSITIVOS + CLIENTE FIRMA EL NUEVO CONTRATO
Si los dictámenes técnicos resultan positivos y el Cliente Cesionario decide firmar el nuevo Contrato de Prestación de Servicios sobre de la nueva garantía propuesta:
• El monto pagado en el contrato original se aplica íntegramente como crédito al nuevo contrato, dentro de la etapa correspondiente al Apartado y/o Etapa A.
• El proceso continúa con normalidad conforme al nuevo instrumento y sus propios términos económicos, plazos y obligaciones.
• No se aplican penalizaciones, devengamientos ni retenciones derivadas de la presente Carta, pues la operación se ha reencauzado con éxito.

ESCENARIO 2 · DICTÁMENES NEGATIVOS SOBRE LA NUEVA GARANTÍA
Si CUALQUIERA de los dictámenes técnicos (URRJ, UCP, DIL) resulta negativo sobre la nueva garantía propuesta y por consecuencia no procede la firma del nuevo Contrato:
• El contrato anterior queda rescindido conforme a la Cláusula IV de la presente Carta, sin necesidad de declaración judicial.
• El Prestador devuelve al Cliente el 100% (cien por ciento) del monto pagado en el contrato anterior, sin deducción ni penalización alguna en su contra.
• Adicionalmente, el Prestador reconoce y paga al Cliente Cesionario una compensación equivalente al 5% (cinco por ciento) sobre el monto pagado, por penalización contractual del contrato anterior. Este 5% es a favor del Cliente.
• Esta compensación se rige por lo dispuesto en el contrato original respecto de la cláusula de rescisión con compensación al Cliente (normalmente el 5%, o el porcentaje que dicho contrato establezca a favor del Cliente en caso de imposibilidad del Prestador de cumplir).
• NO se activa devengamiento profesional por trabajo de evaluación del cambio, en virtud de que el resultado técnico impidió avanzar a la fase de contratación. El Prestador asume internamente los costos operativos de la evaluación.

ESCENARIO 3 · DICTÁMENES POSITIVOS + CLIENTE NO FIRMA EL NUEVO CONTRATO
Si los dictámenes técnicos resultan positivos en su totalidad, pero el Cliente Cesionario decide, por su libre voluntad, no firmar el nuevo Contrato de Prestación de Servicios (o no realizar el segundo pago requerido para su formalización):
• Se activa el devengamiento profesional del 35% (treinta y cinco por ciento) sobre el valor original de la operación, en concepto de honorarios profesionales por el trabajo efectivamente realizado durante la evaluación del cambio.
• Este 35% se descuenta del monto original que el Cliente tiene pagado en el contrato anterior, quedando dicho monto en poder del Prestador como pago por los servicios prestados.
• El excedente, si lo hubiere (cuando el Cliente haya pagado más del 35% del valor original), se devuelve al Cliente si el Cliente manifiesta su decisión de no firmar.
• Si el Cliente ha pagado exactamente el 35% o menos, el monto queda íntegramente devengado y no hay devolución ni saldo pendiente.

JUSTIFICACIÓN DEL DEVENGAMIENTO
El devengamiento del 35% en este escenario no es una penalización arbitraria, sino el reconocimiento del trabajo profesional efectivamente realizado, incluyendo:
• Análisis jurídico y registral del nuevo expediente propuesto.
• Emisión de dictámenes POSITIVOS por URRJ, UCP y DIL.
• Coordinación de servicios externos (abogados, peritos, valuadores, gestores).
• Tiempo operativo invertido por las unidades técnicas institucionales.
• Visitas físicas a la nueva garantía y trámites ante autoridades registrales.
• Estudio de mercado, viabilidad y elaboración de la propuesta comercial.
FUNDAMENTO LEGAL: Artículos 2606 y 2611 del Código Civil Federal, y Tesis Aislada 1a. CCXLVI/2013 de la Primera Sala de la Suprema Corte de Justicia de la Nación, que reconocen que los honorarios profesionales se devengan en proporción al trabajo efectivamente realizado, con independencia del resultado final o de la decisión del cliente de continuar o no con el proyecto.

VII. REQUISITOS PARA LA FIRMA DEL NUEVO CONTRATO
Para que se proceda a la firma del nuevo Contrato de Prestación de Servicios Profesionales y/o Inversión derivado del cambio, deberán cumplirse íntegramente los siguientes requisitos:
a) Dictamen Jurídico POSITIVO emitido por URRJ respecto de la nueva garantía propuesta.
b) Dictamen Registral POSITIVO con Certificado de Libertad de Gravamen vigente de la nueva garantía.
c) Validación POSITIVA registral y jurídica, cuentas de pago y carta propuesta.
d) Firmas positivas de los abogados externos coordinados por DIL.
e) Firmas positivas de los directores responsables del proceso de cambio.
f) Dictamen Legal Final consolidado y emitido por DIL.
Si CUALQUIERA de los dictámenes o validaciones anteriores resulta NEGATIVO, no se procederá a la firma del nuevo contrato y se aplicará el régimen de la Cláusula VIII (Consecuencias por falta de firma del nuevo contrato).

VIII. CONSECUENCIAS DE NO FIRMAR EL NUEVO CONTRATO
Las consecuencias de que no se llegue a firmar el nuevo Contrato de Prestación de Servicios se rigen exclusivamente por la Cláusula V (Modelo Económico del Cambio) de la presente Carta:
• Si el motivo es el resultado NEGATIVO de los dictámenes técnicos, aplica el Escenario 2 de la Cláusula V, con devolución del 100% del monto pagado más 5% de compensación adicional a favor del Cliente.
• Si el motivo es la decisión voluntaria del Cliente de no firmar (habiendo dictámenes positivos), aplica el Escenario 3 de la Cláusula V, con devengamiento profesional del 35%.

DERECHO A SEGUNDA PROPUESTA (SOLO EN ESCENARIO 2)
Únicamente cuando aplique el Escenario 2 (dictámenes negativos), el Cliente conserva el derecho a solicitar una NUEVA propuesta de cambio (segunda alternativa) sobre una garantía distinta, sin necesidad de firmar una nueva Carta de Intención ni realizar pagos adicionales por evaluación, dentro de los 60 (sesenta) días naturales siguientes al dictamen negativo.
Si tras la segunda propuesta tampoco resultan viables las alternativas ofrecidas, se consuma la aplicación del Escenario 2 y se procede con la devolución del remanente al Cliente conforme a lo previsto en el contrato original.

IX. CLÁUSULA DE SUSPENSIÓN Y AJUSTE CONTRACTUAL
Al admitir y firmar esta Carta de Intención de Cambio, el Cliente acepta que:
• Los tiempos, obligaciones y efectos del contrato anterior de prestación de servicios profesionales sobre garantía hipotecaria litigiosa y/o adjudicataria quedan rescindidos conforme a la Cláusula IV, sin perjuicio de lo ya devengado conforme a la Cláusula V.
• En caso de que el cambio proceda y se firme el nuevo contrato, todo el procedimiento se ajustará al nuevo contrato de cambio, conforme a los dictámenes jurídicos, registrales y fiscales emitidos por las áreas competentes.
• El nuevo contrato reflejará las condiciones actualizadas del procedimiento legal de la nueva garantía, incluyendo plazos, honorarios, responsabilidades y entregables.
• El Cliente reconoce que el nuevo contrato es económicamente independiente del contrato anterior, con sus propios pagos por etapas (Apartado, Etapa A, Etapa B, Remodelación opcional, A la Entrega y 3% de honorarios de formalización).

X. DOCUMENTACIÓN ANEXA
Forman parte integrante de la presente Carta de Intención de Cambio:
• Copia de la propuesta de cambio emitida por el Prestador con la descripción de la nueva garantía propuesta.
• Expediente jurídico en revisión por URRJ y DIL.
• Carta de intención debidamente firmada por el Cliente.
• Identificación oficial del Cliente y comprobante de domicilio.
• Copia del contrato anterior folio {{folioContratoAnterior}}.

XI. FUNDAMENTO LEGAL
La presente Carta de Intención de Cambio se fundamenta en las siguientes disposiciones legales:
• Art. 1796 CCF — Libertad de las partes para modificar o terminar bilateralmente sus contratos por mutuo consentimiento.
• Art. 1832 CCF — Libertad contractual en los acuerdos privados entre las partes.
• Art. 1949 CCF — Suspensión de obligaciones por mutuo acuerdo.
• Art. 2606 CCF — Honorarios profesionales devengados son exigibles aunque el cliente desista del servicio.
• Art. 2611 CCF — El profesional que cumple su servicio tiene derecho al cobro proporcional.
• Tesis 1a. CCXLVI/2013 SCJN — Los honorarios se devengan en proporción al trabajo efectivamente realizado, independientemente del resultado.

XIII. ACEPTACIÓN Y FIRMAS
Sin otro particular, las partes manifiestan su confirmación y firma de la presente Carta de Intención de Cambio, la cual formaliza el inicio del procedimiento bajo los términos aquí establecidos.
Las partes declaran haber leído íntegramente el contenido de la presente Carta, comprender sus alcances y firmar por su libre voluntad, sin que medie dolo, error o vicio del consentimiento.
Atentamente.


_________________________________
CLIENTE CESIONARIO
{{nombreCliente}}
Fecha: {{fechaEmision}}


_________________________________
REPRESENTANTE LEGAL
{{apoderadoNombre}}
{{apoderadoCargo}} — DIIPA, S.A. de C.V. (Inmuebles Accesibles)
Fecha: {{fechaEmision}}`;

export const plantillas: PlantillaContrato[] = [
  {
    tipo: "carta_cambio",
    nombre: "Carta de Intención de Cambio (Paquete de Cambio · 1)",
    descripcion: "Primer documento del Paquete de Cambio. Se firma antes de los dictámenes; rescinde el contrato anterior y fija los 3 escenarios económicos.",
    campos: cartaCambioCampos,
    cuerpo: cartaCambioCuerpo,
  },
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

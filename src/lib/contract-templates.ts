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

// ============================================================================
//  PAQUETE DE CAMBIO — Documento 2: Contrato de Cambio de Garantía
//  Los datos del apoderado (apoderadoNombre, apoderadoEscritura, etc.) se
//  auto-llenan desde el Selector de Apoderado en el editor.
// ============================================================================
const contratoCambioCampos: PlantillaCampo[] = [
  { id: "nombreCliente", label: "Nombre completo del Cliente", tipo: "text", requerido: true },
  { id: "curpCliente", label: "CURP del Cliente", tipo: "text" },
  { id: "rfcCliente", label: "RFC del Cliente", tipo: "text" },
  { id: "domicilioCliente", label: "Domicilio del Cliente", tipo: "textarea" },
  { id: "garantiaAnterior", label: "Garantía anterior (dirección completa)", tipo: "textarea", requerido: true },
  { id: "valorGarantiaAnterior", label: "Valor de referencia de la garantía anterior (MXN)", tipo: "text", ayuda: "Ej. 1,500,000.00" },
  { id: "garantiaNueva", label: "Nueva garantía (dirección completa)", tipo: "textarea", requerido: true },
  { id: "folioContratoAnterior", label: "Folio o fecha del contrato anterior", tipo: "text", requerido: true, ayuda: "Ej. 00-75D" },
  { id: "valorOperacion", label: "Valor de referencia de la nueva operación (MXN)", tipo: "text", requerido: true, ayuda: "Ej. 2,000,000.00" },
  { id: "ciudadFirma", label: "Ciudad de firma", tipo: "text", requerido: true },
  { id: "estadoFirma", label: "Estado de firma", tipo: "text", requerido: true },
  { id: "fechaFirma", label: "Fecha de firma", tipo: "text", requerido: true, ayuda: "Ej. 17 de junio de 2026" },
  { id: "montoRecibo", label: "RECIBO · Monto recibido de Etapa A (MXN)", tipo: "text", ayuda: "Ej. 700,000.00" },
  { id: "montoReciboLetra", label: "RECIBO · Cantidad con letra", tipo: "text", ayuda: "Ej. SETECIENTOS MIL" },
  { id: "formaPagoRecibo", label: "RECIBO · Forma de pago", tipo: "select", opciones: ["transferencia", "efectivo"] },
  { id: "porcentajeEtapaA", label: "RECIBO · Porcentaje de Etapa A pagado (%)", tipo: "text", ayuda: "Ej. 35" },
];

const contratoCambioCuerpo = `DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V.
(conocida comercialmente como "Inmuebles Accesibles" — una sola y misma sociedad)

CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES E INTERMEDIACIÓN PARA LA REGULARIZACIÓN Y ENTREGA DE GARANTÍAS CON CONTINGENCIA
MODALIDAD DE CAMBIO O SUSTITUCIÓN DE GARANTÍA
(Cesión de derechos de crédito, litigiosos y adjudicatarios — operación de carácter estrictamente civil)

Convenido por una parte por Desarrollos Inteligentes de Inmuebles y Propiedades Accesibles, S.A. de C.V., conocida comercialmente como "Inmuebles Accesibles" (siendo ambas denominaciones una sola y misma persona moral), representada legalmente por el (la) C. {{apoderadoNombre}}, a quien en lo sucesivo se le denominará el "Prestador de Servicios"; y por la otra parte, el (la) C. {{nombreCliente}}, a quien en lo sucesivo se le denominará el "Cliente". Ambas partes se sujetan al tenor de las siguientes declaraciones y cláusulas. Los términos con mayúscula inicial empleados en este instrumento se definen en el GLOSARIO que obra al final del presente contrato y que forma parte integrante del mismo.

DECLARACIONES

I. Declara el "Prestador de Servicios":
Que es una sociedad mercantil mexicana debidamente constituida conforme a las leyes de la República Mexicana, según consta en la Escritura Pública número 1,809, de fecha 20 de abril de 2022, otorgada ante la fe del Notario Público número 256 de Mazatlán, Sinaloa, Lic. Luis Manuel Bouciéguez Velarde, e inscrita en el Registro Público de la Propiedad y del Comercio bajo el Folio Mercantil Electrónico N-2022029617 con fecha del 27 de abril de 2022.
Que cuenta con el Registro Federal de Contribuyentes (RFC): DII2204206J5, con domicilio en Mazatlán, Sinaloa, y plazas de operación en los Estados de Sinaloa y Jalisco.
Que su apoderado, el (la) C. {{apoderadoNombre}}, acredita su personalidad y facultades mediante la Escritura Pública número {{apoderadoEscritura}}, Volumen {{apoderadoVolumen}}, Libro {{apoderadoLibro}}, de fecha {{apoderadoFechaPoder}}, otorgada ante la fe del {{apoderadoNotario}}, titular de la Notaría Pública número {{apoderadoNumNotaria}} en el Estado de {{apoderadoEstadoNotaria}}, facultades que no le han sido modificadas ni revocadas a la fecha.
Que los derechos litigiosos y adjudicatarios objeto de su mediación provienen de carteras legítimas administradas por instituciones bancarias, financieras, fiduciarias y crediticias institucionalmente verificables (tales como BBVA, Banorte, HSBC, Scotiabank, Sociedad Hipotecaria Federal, Metrofinanciera, Pendulum, Zendere, Adamantine, Tertius, entre otras), por lo que la procedencia de la garantía es institucional, legítima y verificable.
Que opera bajo un esquema estrictamente civil de recuperación de activos y regularización de garantías con contingencia, por lo que las garantías objeto de su servicio se encuentran en proceso de regularización jurídica, situación que el Cliente reconoce y acepta plenamente.

II. Declara el "Cliente":
Ser persona física de nacionalidad mexicana, identificada con CURP: {{curpCliente}}, RFC: {{rfcCliente}}, con domicilio en: {{domicilioCliente}}.
Que previamente contrató los servicios del Prestador respecto de una garantía con contingencia (la "garantía anterior"), ubicada en {{garantiaAnterior}}, con un valor de referencia de $ {{valorGarantiaAnterior}} M.N.
Que, habiendo sido informado de manera clara, completa y suficiente sobre los dictámenes técnicos y jurídicos correspondientes, manifiesta su libre voluntad de sustituir la garantía anterior por una nueva garantía con contingencia, en los términos del presente contrato.
Que dispone de la capacidad económica y jurídica para obligarse en los términos de este instrumento y que conoce la situación legal y procesal de la nueva garantía objeto del servicio.

III. Declaran ambas partes:
Que se reconocen recíprocamente la personalidad y facultades con que comparecen, las cuales no les han sido modificadas, limitadas ni revocadas a la fecha.
Que el presente acto se celebra de buena fe, libre de dolo, error, mala fe, lesión o cualquier otro vicio del consentimiento.
Que la operación es de naturaleza estrictamente civil —prestación de servicios profesionales y cesión de derechos— y no constituye relación de consumo de un producto, compraventa de inmueble, ni operación financiera, de inversión o de captación de recursos.

CLÁUSULAS

PRIMERA. Objeto del contrato. El objeto del presente contrato es, por una parte, la terminación de mutuo acuerdo del contrato anterior y, por otra, la formalización del cambio o sustitución de garantía. El Prestador se obliga a prestar servicios profesionales de mediación, asesoría, gestión jurídica, registral y representación para la regularización y, en su caso, entrega de la nueva garantía con contingencia ubicada en {{garantiaNueva}}. El Cliente acepta recibir la garantía en las condiciones físicas, jurídicas y materiales en que actualmente se encuentra. El Prestador no vende inmuebles ni garantiza un resultado o un plazo fijo: su obligación es de medios diligentes.

SEGUNDA. Naturaleza contingente y no dominio pleno. El Cliente reconoce y acepta que: (a) la nueva garantía NO se encuentra en dominio pleno del Prestador ni del Cliente al momento de la firma; (b) proviene de un proceso judicial o registral con contingencias legales en curso; (c) el dominio pleno se adquirirá únicamente cuando el Prestador concluya la regularización jurídica, judicial y registral y proceda a la entrega formal conforme a este contrato; (d) durante el proceso, el bien se mantendrá en titularidad instrumental del Prestador (Arts. 2546 a 2552 del Código Civil Federal y su correlativo estatal); y (e) el compromiso del Prestador es de medios diligentes, asumiendo el Cliente, con consentimiento informado, el riesgo procesal inherente a la operación.

TERCERA. Imposibilidad jurídica sobreviniente y causas ajenas. El Cliente reconoce que si la institución tenedora de la garantía (banco, administradora o propietario) realiza movimientos posteriores al pago que impidan su adquisición, o si por cualquier otra causa ajena al Prestador el área jurídica determina, mediante dictamen, que la recuperación no es jurídicamente posible, ello NO constituye mala fe ni dolo del Prestador, sino una imposibilidad jurídica sobrevenida. En tal supuesto procederá, según la etapa, el cambio de garantía o la devolución compensada conforme a la Cláusula Décima Novena.

CUARTA. Terminación del contrato anterior por mutuo consentimiento. Con la firma de este instrumento, el contrato celebrado originalmente con folio {{folioContratoAnterior}} queda terminado de pleno derecho, sin necesidad de declaración judicial, al amparo del artículo 1796 del Código Civil Federal y su correlativo estatal. Son efectos: (a) el cese de las obligaciones operativas del Prestador respecto de la garantía anterior; (b) el cese de las obligaciones de pago del Cliente respecto del contrato anterior, salvo lo dispuesto en la Cláusula Quinta; (c) la liberación del Prestador de los plazos del contrato anterior; y (d) el inicio formal del servicio sobre la nueva garantía.

QUINTA. Tratamiento del recurso del contrato anterior (abono condicionado). El Prestador reconoce el pago realizado por el Cliente en el contrato anterior y lo aplica como abono a la presente operación de cambio, siempre que el Cliente cumpla con las obligaciones del nuevo contrato. Este abono está condicionado a dicho cumplimiento: si el Cliente incumple o desiste, el abono queda sin efecto, el pago anterior se entenderá íntegramente devengado por los servicios prestados sobre la garantía anterior (artículo 2606 del Código Civil Federal y Tesis Aislada 1a. CCXLVI/2013 de la Primera Sala de la S.C.J.N.), y el Cliente quedará además obligado a cubrir los servicios devengados de la presente operación. En tal supuesto, el Cliente adeuda los servicios de ambas garantías —la anterior y la nueva—, sin derecho a acreditar el pago anterior. El monto del abono queda sujeto a validación de Contabilidad para que el valor, el abono y el saldo cuadren correctamente.

SEXTA. Naturaleza del recurso aportado y administración. El Cliente reconoce que el Prestador opera bajo un esquema de recuperación de activos, y que los recursos que aporta ingresan al Prestador como contraprestación y costo de la operación —no como depósito, inversión ni recurso en garantía—, por lo que el Prestador los aplica y administra como propios para la ejecución del servicio. No obstante, el Prestador conserva el compromiso de cubrir, con cargo a la operación, los adeudos de agua y predial estrictamente necesarios para poder escriturar, correspondientes al periodo en que mantuvo la posesión del inmueble.

SÉPTIMA. Valor de la operación y estructura de pagos por fases. El valor de referencia de la nueva operación es de $ {{valorOperacion}} M.N. (sujeto a confirmación de Contabilidad). El Cliente cubrirá la contraprestación por fases, cuyos porcentajes dependen del estado procesal real de la garantía al contratar:
Apartado: $10,000.00 M.N., no reembolsable; reserva la operación y se abona al momento del exhorto de desalojo.
Etapa A (primer pago): por auditoría y dictaminación; se considera devengada desde su pago, por destinarse a investigación, dictámenes, logística foránea y honorarios de abogados, según el desglose de la Cláusula Octava.
Etapa B (segundo pago): se cubre dentro de los 15 días hábiles siguientes a la entrega del dictamen positivo; comprende la compra de la cesión, adeudos y ejecución judicial hasta el exhorto de desalojo. Requiere cotización previa por escrito (pre-cobro).
Remodelación (opcional, 5%): únicamente si el Cliente la elige por escrito; de no elegirla, recibe la garantía en sus condiciones actuales (Cláusula Décima Séptima).
Entrega: a la toma de posesión física y legal; antes de la entrega, todo lo pactado debe estar liquidado.
Honorarios de intermediación notarial: conforme a la Cláusula Décima, por cada acto (cesión y escrituración).

OCTAVA. Alcance del servicio profesional (Fase A y Fase B). El Cliente reconoce que la contraprestación cubre los servicios profesionales y gastos operativos efectivamente prestados que se detallan a continuación, los cuales se devengan en proporción al trabajo realizado:
I. Análisis jurídico y auditoría de campo: estudio de crédito, visitas a juzgados, estudio personalizado del expediente, elaboración de dictámenes de viabilidad, estudio de mercado, y servicios de abogados y asesoría personalizada.
II. Gestión registral y administrativa: trámites ante el RPPC, solicitud del Certificado de Libertad de Gravamen (CLG), antecedentes registrales y folios.
III. Logística foránea y traslados: cuando la garantía no se ubica en Mazatlán, boletos de avión, viáticos y traslados del personal jurídico para la revisión física de expedientes y bienes.
IV. Intermediación y ejecución judicial hasta la entrega: gestión de compra de la cesión con bancos, administradoras o propietarios; apersonamientos, edictos y seguimiento del juicio hasta el exhorto de desalojo; intermediación notarial; y habilitación del bien.
Para transparencia del destino del recurso, las partes reconocen el siguiente desglose enunciativo:
• Análisis jurídico y auditoría de campo — Estudio de crédito, visitas a juzgados, estudio del expediente, dictámenes de viabilidad, estudio de mercado. Para determinar si la garantía es viable y no exponer al Cliente a un activo con riesgo. Se gasta en honorarios de abogados, peritos y dictaminadores.
• Gestión registral — RPPC, CLG, antecedentes, folios. Para confirmar la situación registral y la libertad de gravamen. Se gasta en derechos y trámites ante RPPC y gestores.
• Logística foránea — Vuelos, viáticos y traslados del personal jurídico cuando la garantía está fuera de Mazatlán. Porque el expediente y el bien deben revisarse físicamente donde se ubican. Se gasta en boletos, viáticos, hospedaje y traslados.
• Intermediación y ejecución judicial — Compra de la cesión con banco/administradora, apersonamientos, edictos, seguimiento hasta el exhorto, intermediación notarial. Para comprar los derechos y llevar el juicio hasta la recuperación y entrega. Se gasta en el pago de la cesión al banco/administradora, costas, edictos y honorarios procesales.
• Habilitación / remodelación — Trabajos para entregar el bien en uso inmediato. Para entregar el bien habitable conforme a lo pactado. Se gasta en materiales y mano de obra de la habilitación.

NOVENA. Honorarios devengados. Las partes reconocen que los honorarios profesionales se devengan en proporción al trabajo efectivamente realizado, con independencia del resultado final del procedimiento (artículo 2606 del Código Civil Federal y Tesis Aislada 1a. CCXLVI/2013). El cobro de los servicios efectivamente prestados no constituye dolo, daño ni penalización abusiva, sino la contraprestación del servicio profesional.

DÉCIMA. Honorarios de intermediación notarial (3% por acto). La cesión y la escrituración son dos actos distintos, cada uno con su propio honorario del 3% sobre el valor de la operación, que no se duplican entre sí:
3% por la cesión: exigible cuando la cesión va dirigida a favor de DIIPA, es decir, desde que la administradora, banco o propietario gira la instrucción para formalizar la cesión al Prestador. Dicho dominio de cesión queda comprometido a entregarse al Cliente a partir de la sentencia firme en adelante.
3% por la escrituración: exigible al emitirse el exhorto de desalojo, momento en que, por instrucción de intermediación, el Prestador envía el asunto a la notaría designada. El Cliente cubrirá: (a) exactamente la cotización de la notaría —honorarios notariales, impuestos y derechos registrales—, sin que el Prestador agregue margen alguno sobre dicha cotización; y (b) el 3% de honorarios de intermediación del Prestador.
El Prestador no cubre impuestos ni derechos registrales (son por cuenta exclusiva del Cliente); únicamente cubre los adeudos de agua y predial estrictamente necesarios para poder escriturar, correspondientes al periodo en que mantuvo la posesión del inmueble.
El Cliente reconoce expresamente que los tiempos de formalización, gestión documental, respuesta, calificación e inscripción, tanto de la Notaría Pública designada como de las autoridades administrativas, registrales o catastrales (ADM), son ajenos al control y responsabilidad del Prestador. En consecuencia, cualquier demora, retraso o plazo excedido derivado de la carga de trabajo, criterios o procesos internos de dichas terceras partes no constituye incumplimiento por parte del Prestador ni genera responsabilidad alguna a su cargo, por lo que tales tiempos no son computables como plazos contractuales del presente servicio.

DÉCIMA PRIMERA. Cotizaciones, requerimientos de pago y plazos perentorios. Los pre-cobros, cobros y cotizaciones se notifican al Cliente por correo electrónico; los plazos de pago corren a partir de dicha notificación. Emitido el exhorto de desalojo, el Cliente cuenta con 8 (ocho) días hábiles para liquidar el saldo de la operación y 15 (quince) días hábiles para cubrir lo relativo a la notaría y escrituración. El incumplimiento de estos plazos faculta al Prestador para tener por perdida la garantía a cargo del Cliente, o para exigir honorarios adicionales destinados a restituir o reactivar el caso. Estos plazos buscan que el asunto no se atrase ni se pierda la garantía; no constituyen penalización abusiva, sino la condición operativa para sostener la reserva ante la institución.

DÉCIMA SEGUNDA. Documentación, prevención de lavado y datos personales. El Cliente entrega o ratifica la entrega de su identificación oficial, documentos fiscales y formatos de identificación del cliente y prevención de operaciones con recursos de procedencia ilícita, conforme a la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita. El Prestador podrá solicitar por escrito documentos adicionales, que el Cliente entregará dentro de los 5 días hábiles siguientes. El tratamiento de datos personales se rige por el aviso de privacidad del Prestador, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.

DÉCIMA TERCERA. Plazos de ejecución y gestión judicial. El cómputo de los plazos para la resolución y entrega iniciará a partir de la firma de la cesión de derechos ante notario público. El plazo estimativo de gestión es de 48 semanas hábiles, aplicable a la fase de estudios y a las compras relacionadas. El Cliente reconoce que los tiempos procesales, desahogos y plazos de desalojo dependen de las cargas de los juzgados y autoridades, por lo que constituyen una guía estimativa y no una fecha fija garantizada, en congruencia con el compromiso de medios.

DÉCIMA CUARTA. Titularidad instrumental, mandato y reserva de dominio. Cualquier cesión, adjudicación, escritura o resolución que derive del procedimiento podrá emitirse formalmente a nombre del Prestador, quien actuará exclusivamente como mandatario, gestor o titular formal por cuenta y en interés del Cliente (Arts. 2546 a 2552 del Código Civil Federal y su correlativo estatal). Dicha titularidad es estrictamente instrumental y no implica adquisición de dominio propio a favor del Prestador. La transmisión definitiva quedará sujeta a la conclusión del procedimiento (sentencia firme, adjudicación que cause estado, exhorto cumplido y formalización) y a que el Cliente haya cumplido íntegramente sus obligaciones de pago. Cuando la garantía se entregue antes de la liquidación total, se hará bajo reserva de dominio a favor del Prestador hasta la liquidación; entretanto, el Cliente no adquiere dominio pleno y el procedimiento no avanza a la escritura definitiva.

DÉCIMA QUINTA. Reversión de la cesión por impago (mala fe y dolo del Cliente). Cuando la cesión ya se haya formalizado o comprometido a favor del Cliente y este, estando emitido el exhorto de desalojo o requerido el saldo por correo o cotización, no cubra el saldo pendiente (el 5% o el saldo que corresponda) dentro de los plazos pactados, el Cliente deberá restituir a DIIPA la cesión, revirtiendo el dominio ante notario público; la omisión de revertir se considerará mala fe y dolo. En tal supuesto: (a) el Cliente pierde la totalidad de lo pagado, que queda en propiedad de DIIPA como compensación por daños y perjuicios; (b) queda obligado a cubrir los honorarios devengados y la penalización pactada; y (c) se generará un interés moratorio civil del 5% anual sobre el saldo insoluto hasta su pago. Tenga o no el Cliente la cesión, en caso de incumplimiento o de solicitud formal de devolución, queda obligado a restituir la garantía; las obligaciones del Prestador respecto de la garantía cesan de pleno derecho, subsistiendo únicamente sus derechos, y la garantía queda libre y disponible para que el Prestador la recupere. El Prestador conserva todas las acciones legales para recuperar la cesión, la propiedad y el dinero faltante.

DÉCIMA SEXTA. Exclusividad. El Cliente otorga exclusividad al Prestador para las gestiones, trámites y negociaciones de la operación, y se obliga a no contratar terceros ni realizar gestiones por su cuenta que interfieran o dupliquen las del Prestador. El Cliente podrá designar abogado propio para el juicio bajo su exclusiva responsabilidad, sin que ello lo exima de cubrir los honorarios pactados por la gestión, preparación, acompañamiento y seguimiento del Prestador.

DÉCIMA SÉPTIMA. Habilitación y remodelación opcional. Únicamente si el caso avanza con dictámenes positivos y se logra la desocupación legal y material, el Prestador entregará el bien en condiciones de uso inmediato. La habilitación y, en su caso, la remodelación opcional (5%, elegida por escrito) comprenden:
Aplicación de pintura general en muros y plafones.
Puertas de acceso e interiores en correcto funcionamiento, sin daños.
Cambio de chapas de todas las puertas de acceso, con entrega de llaves nuevas y operables.
Accesorios básicos funcionales de baño y cocina (llaves de paso, manerales y regaderas).
Tazas de baño operables y libres de filtraciones.
Limpieza y sanitización profunda; entrega libre de basura y escombros.
Esta obligación NO incluye reparaciones estructurales mayores ni vicios ocultos preexistentes, por no ser el Prestador fabricante del bien y haberse pactado un precio inferior al valor comercial. Sin la remodelación elegida por escrito, el Cliente recibe la garantía en sus condiciones actuales.

DÉCIMA OCTAVA. Adeudos y servicios. Cuando el Prestador obtenga la posesión legal del inmueble, se obliga a entregarlo libre de adeudos de servicios públicos esenciales (energía eléctrica y predial) correspondientes exclusivamente al periodo en que mantuvo dicha posesión. No asume adeudos anteriores a la fecha en que obtuvo la posesión legal.

DÉCIMA NOVENA. Penalizaciones, devolución compensada y escala de recuperación. Las partes pactan las siguientes consecuencias civiles, ordenadas según la etapa de la operación:
Cancelación del Cliente antes de la emisión de dictámenes: devolución de su aportación neta, con penalización del 10% sobre lo pagado a la fecha. El apartado de $10,000.00 no es reembolsable.
Desistimiento del Cliente con dictamen positivo: se retiene el 35% del valor de la operación por honorarios legales devengados, gastos administrativos y de gestión ante juzgados, RPPC y demás autoridades.
Desistimiento o incumplimiento grave del Prestador: penalización a su cargo del 5% sobre los montos efectivamente aportados, a favor del Cliente, restituyendo el capital remanente en un plazo no mayor a 20 días hábiles.
Cliente que ya cubrió la Etapa B (segundo pago) e inició el proceso judicial: debe esperar la conclusión del procedimiento. Si en esa etapa desiste o solicita formalmente la devolución, dicha solicitud se entiende como desistimiento: los honorarios devengados y las cantidades entregadas quedan en propiedad de DIIPA, la garantía permanece con DIIPA y el contrato se revoca por el solo hecho de la solicitud formal de devolución.
Pérdida de la garantía en el juicio: habiéndose realizado el trabajo profesional, la única vía para que el Cliente recupere su capital será mediante un cambio de garantía (sustitución), SIN que proceda devolución, por encontrarse los servicios devengados.
Impago del Cliente que derive en la pérdida de la garantía: las sumas entregadas quedan a favor del Prestador como compensación por daños y perjuicios, sin que proceda devolución.
Devolución compensada (solo cuando el Prestador no puede entregar por dictamen negativo o causa ajena, en etapas tempranas): restitución del capital conforme al calendario pactado (hasta 36 meses), más una compensación civil del 5% anual simple por la demora. Esta compensación es estrictamente civil, por la espera, y no constituye interés financiero, rendimiento ni producto de inversión.

VIGÉSIMA. Confidencialidad y no difamación. Toda la documentación, estrategias, dictámenes y datos compartidos tienen carácter confidencial de forma indefinida; el Cliente se obliga a no divulgarlos ni usarlos para fines ajenos a este contrato. Asimismo, siempre que el Prestador cumpla en tiempo y forma, el Cliente se abstendrá de realizar manifestaciones públicas o publicaciones que dañen la reputación o el prestigio comercial del Prestador. El incumplimiento generará responsabilidad civil por daño moral y perjuicios económicos.

VIGÉSIMA PRIMERA. Fallecimiento del Cliente. En caso de fallecimiento del Cliente, los derechos y obligaciones de este contrato se transmiten a sus sucesores o herederos legítimos conforme a la legislación aplicable, salvo manifestación expresa en contrario.

VIGÉSIMA SEGUNDA. Rescisión. Serán causales de rescisión el incumplimiento de cualquiera de las obligaciones de las partes, en especial el incumplimiento en los pagos y plazos. Rescindido el contrato por causa imputable al Cliente, este quedará obligado, antes de cualquier liberación, a cubrir: los honorarios y servicios ya devengados; las cesiones ya realizadas; los trámites y gastos notariales ya erogados por su cuenta; y los intereses o recargos adicionales generados por su falta de pago. El Prestador no será responsable por vicios ocultos del inmueble recuperado, al no ser su fabricante y haberse pactado un precio inferior al valor comercial.

VIGÉSIMA TERCERA. Naturaleza jurídica, ley aplicable y jurisdicción. El presente contrato es de carácter estrictamente civil y privado. Para su interpretación, cumplimiento, exigibilidad y ejecución, las partes se someten al Código Civil del Estado en que se ubica la garantía objeto del servicio y a la competencia de los tribunales del lugar donde dicha garantía se ubique, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.

VIGÉSIMA CUARTA. Prescripción. Los plazos de prescripción relativos a responsabilidad civil, vicios ocultos y evicción se regirán por las disposiciones del Código Civil del Estado donde se ubica la garantía y demás normativa aplicable.

VIGÉSIMA QUINTA. Domicilios y notificaciones. Mientras las partes no notifiquen por escrito un cambio de domicilio, todos los avisos, notificaciones y diligencias que se realicen en los domicilios declarados surtirán plenamente sus efectos legales.

VIGÉSIMA SEXTA. Aceptación y firma. Enteradas las partes de la naturaleza jurídica, alcances, derechos y obligaciones de este instrumento, y no existiendo vicio alguno del consentimiento, manifiestan su total conformidad y lo firman por duplicado en la ciudad de {{ciudadFirma}}, {{estadoFirma}}, el día {{fechaFirma}}. Las partes declaran haber leído íntegramente su contenido, comprender sus alcances y firmarlo por su libre voluntad.


______________________________________________________________
C. {{apoderadoNombre}}
Apoderado Legal — DIIPA, S.A. de C.V. (Inmuebles Accesibles)


______________________________________________________________
C. {{nombreCliente}}
Cliente


================================================================
RECIBO DE PAGO DE HONORARIOS Y GESTIÓN

BUENO POR: $ {{montoRecibo}} M.N. ({{montoReciboLetra}} PESOS 00/100 M.N.)
CONCEPTO: Recibí del (de la) C. {{nombreCliente}} (el "Cliente"), la cantidad arriba mencionada en {{formaPagoRecibo}}, correspondiente al pago de la Etapa A (primer pago) equivalente al {{porcentajeEtapaA}}% del valor total de la operación, conforme a las Cláusulas Séptima y Octava del Contrato de Prestación de Servicios Profesionales e Intermediación — Modalidad de Cambio de Garantía.
GARANTÍA: {{garantiaNueva}}.
DESTINO DEL PAGO: Honorarios por dictaminación, auditoría legal, gastos de logística foránea e investigación registral.
ESTATUS DEL PAGO: Las partes reconocen esta cantidad como devengada desde este momento por los servicios profesionales efectivamente prestados para el inicio de la operación (artículo 2606 del Código Civil Federal y Tesis 1a. CCXLVI/2013).
LUGAR Y FECHA: {{ciudadFirma}}, {{estadoFirma}}, a {{fechaFirma}}.


______________________________________________________________
C. {{apoderadoNombre}}
Prestador de Servicios — DIIPA (Inmuebles Accesibles)


______________________________________________________________
C. {{nombreCliente}}
Cliente`;

export const plantillas: PlantillaContrato[] = [
  {
    tipo: "carta_cambio",
    nombre: "Carta de Intención de Cambio (Paquete de Cambio · 1)",
    descripcion: "Primer documento del Paquete de Cambio. Se firma antes de los dictámenes; rescinde el contrato anterior y fija los 3 escenarios económicos.",
    campos: cartaCambioCampos,
    cuerpo: cartaCambioCuerpo,
  },
  {
    tipo: "contrato_cambio",
    nombre: "Contrato de Cambio de Garantía (Paquete de Cambio · 2)",
    descripcion: "Segundo documento del Paquete de Cambio. Contrato definitivo de prestación de servicios e intermediación — modalidad de cambio o sustitución de garantía. Incluye recibo de pago de Etapa A.",
    campos: contratoCambioCampos,
    cuerpo: contratoCambioCuerpo,
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

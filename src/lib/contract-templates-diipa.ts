// ============================================================================
//  Plantillas DIIPA — machotes institucionales
//  --------------------------------------------------------------------------
//  Tres documentos que se suman al arreglo `plantillas` de contract-templates.
//  Los datos del apoderado ({{apoderadoNombre}}, {{apoderadoEscritura}}, etc.)
//  se auto-llenan desde el Selector de Apoderado del Editor de Contratos.
//  El Acta usa el helper esModA / esModB / esModC de renderContrato para
//  imprimir SOLO la modalidad de cierre elegida.
// ============================================================================
import type { PlantillaCampo, PlantillaContrato } from "./contract-templates";
import { clienteContactoCampos, clienteEstadoCivilCampos, clienteApoderadoCampos, testigosCampo, beneficiariosCampos, vinculosCampos } from "./contract-campos-cliente";

// ----------------------------------------------------------------------------
//  1 · CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES (DIIPA — contrato de origen)
// ----------------------------------------------------------------------------
const prestacionDiipaCampos: PlantillaCampo[] = [
  { id: "nombreCliente", label: "Nombre completo del Cliente", tipo: "text", requerido: true },
  { id: "curpCliente", label: "CURP del Cliente", tipo: "text" },
  { id: "rfcCliente", label: "RFC del Cliente", tipo: "text" },
  { id: "domicilioCliente", label: "Domicilio del Cliente", tipo: "textarea" },
  ...clienteContactoCampos,
  ...clienteEstadoCivilCampos,
  ...clienteApoderadoCampos,
  { id: "direccionGarantia", label: "Garantía objeto del servicio (dirección completa)", tipo: "textarea", requerido: true, ayuda: "Se repite en varias cláusulas; se captura una sola vez." },
  { id: "valorOperacion", label: "Valor de referencia de la operación (MXN)", tipo: "text", requerido: true, ayuda: "Ej. 2,000,000.00 · sujeto a validación de Contabilidad" },
  { id: "ciudadFirma", label: "Ciudad de firma", tipo: "text", requerido: true },
  { id: "estadoFirma", label: "Estado de firma", tipo: "text", requerido: true },
  { id: "fechaFirma", label: "Fecha de firma", tipo: "text", requerido: true, ayuda: "Ej. 17 de junio de 2026" },
  { id: "montoRecibo", label: "RECIBO · Monto recibido de Etapa A (MXN)", tipo: "text", ayuda: "Ej. 700,000.00" },
  { id: "montoReciboLetra", label: "RECIBO · Cantidad con letra", tipo: "text", ayuda: "Ej. SETECIENTOS MIL" },
  { id: "formaPagoRecibo", label: "RECIBO · Forma de pago", tipo: "select", opciones: ["transferencia", "efectivo"] },
  { id: "porcentajeEtapaA", label: "RECIBO · Porcentaje de Etapa A pagado (%)", tipo: "text", ayuda: "Ej. 35" },
  ...testigosCampo,
  ...beneficiariosCampos,
  ...vinculosCampos,
];

const prestacionDiipaCuerpo = `DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V.
(conocida comercialmente como "Inmuebles Accesibles" — una sola y misma sociedad)

CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES E INTERMEDIACIÓN PARA LA REGULARIZACIÓN Y ENTREGA DE GARANTÍAS CON CONTINGENCIA
(Cesión de derechos de crédito, litigiosos y adjudicatarios — operación de carácter estrictamente civil)

Convenido por una parte por Desarrollos Inteligentes de Inmuebles y Propiedades Accesibles, S.A. de C.V., conocida comercialmente como "Inmuebles Accesibles" (siendo ambas denominaciones una sola y misma persona moral), representada legalmente por el (la) C. {{apoderadoNombre}}, a quien en lo sucesivo se le denominará el "Prestador de Servicios"; y por la otra parte, el (la) C. {{nombreCliente}}{{#clienteComparecePorApoderado}}, representado(a) en este acto por su apoderado el (la) C. {{nombreApoderadoCliente}}, según consta en {{poderApoderadoCliente}}{{/clienteComparecePorApoderado}}, a quien en lo sucesivo se le denominará el "Cliente". Ambas partes se sujetan al tenor de las siguientes declaraciones y cláusulas. Los términos con mayúscula inicial se definen en el GLOSARIO que obra al final del presente contrato y forma parte integrante del mismo.

DECLARACIONES

I. Declara el "Prestador de Servicios":
- Que es una sociedad mercantil mexicana debidamente constituida conforme a las leyes de la República Mexicana, según consta en la Escritura Pública número 1,809, de fecha 20 de abril de 2022, otorgada ante la fe del Notario Público número 256 de Mazatlán, Sinaloa, Lic. Luis Manuel Bouciéguez Velarde, e inscrita en el Registro Público de la Propiedad y del Comercio bajo el Folio Mercantil Electrónico N-2022029617 con fecha del 27 de abril de 2022.
- Que cuenta con el Registro Federal de Contribuyentes (RFC): DII2204206J5, con domicilio en Mazatlán, Sinaloa, y plazas de operación en los Estados de Sinaloa y Jalisco.
- Que su apoderado, el (la) C. {{apoderadoNombre}}, acredita su personalidad y facultades mediante la Escritura Pública número {{apoderadoEscritura}}, Volumen {{apoderadoVolumen}}, Libro {{apoderadoLibro}}, de fecha {{apoderadoFechaPoder}}, otorgada ante la fe del {{apoderadoNotario}}, titular de la Notaría Pública número {{apoderadoNumNotaria}} en el Estado de {{apoderadoEstadoNotaria}}, facultades que no le han sido modificadas ni revocadas a la fecha.
- Que los derechos litigiosos y adjudicatarios objeto de su mediación provienen de carteras legítimas administradas por instituciones bancarias, financieras, fiduciarias y crediticias institucionalmente verificables (tales como BBVA, Banorte, HSBC, Scotiabank, Sociedad Hipotecaria Federal, Metrofinanciera, Pendulum, Zendere, Adamantine, Tertius, entre otras), por lo que la procedencia de la garantía es institucional, legítima y verificable.
- Que opera bajo un esquema estrictamente civil de recuperación de activos y regularización de garantías con contingencia, situación que el Cliente reconoce y acepta plenamente.

II. Declara el "Cliente":
- Ser persona física de nacionalidad mexicana, identificada con CURP: {{curpCliente}}, RFC: {{rfcCliente}}, con domicilio en: {{domicilioCliente}}, teléfono {{telefonoCliente}} y correo electrónico {{correoCliente}}.
- Que su estado civil es {{estadoCivilCliente}}{{#esCasadoCliente}}, bajo el régimen de {{regimenCliente}}, casado(a) con {{conyugeCliente}}{{#consentimientoConyugalCliente}}, manifestando contar con el consentimiento conyugal por escrito para este acto{{/consentimientoConyugalCliente}}{{/esCasadoCliente}}.
- Que ha sido informado de manera clara, completa y suficiente sobre la naturaleza, alcances y riesgos del servicio, y que conoce la situación legal y procesal de la garantía con contingencia objeto del presente contrato, ubicada en {{direccionGarantia}}.
- Que manifiesta su libre voluntad de contratar los servicios profesionales del Prestador respecto de dicha garantía, y que dispone de la capacidad económica y jurídica para obligarse en los términos de este instrumento.

III. Declaran ambas partes:
- Que se reconocen recíprocamente la personalidad y facultades con que comparecen, las cuales no les han sido modificadas, limitadas ni revocadas a la fecha.
- Que el presente acto se celebra de buena fe, libre de dolo, error, mala fe, lesión o cualquier otro vicio del consentimiento.
- Que la operación es de naturaleza estrictamente civil —prestación de servicios profesionales y cesión de derechos— y no constituye relación de consumo de un producto, compraventa de inmueble, ni operación financiera, de inversión o de captación de recursos.

CLÁUSULAS

PRIMERA. Objeto del contrato. El Prestador se obliga a prestar servicios profesionales de mediación, asesoría, gestión jurídica, registral y representación para la regularización y, en su caso, entrega de la garantía con contingencia ubicada en {{direccionGarantia}}. El Cliente acepta recibir la garantía en las condiciones físicas, jurídicas y materiales en que actualmente se encuentra. El Prestador no vende inmuebles ni garantiza un resultado o un plazo fijo: su obligación es de medios diligentes.

SEGUNDA. Naturaleza contingente y no dominio pleno. El Cliente reconoce y acepta que: (a) la garantía NO se encuentra en dominio pleno del Prestador ni del Cliente al momento de la firma; (b) proviene de un proceso judicial o registral con contingencias legales en curso; (c) el dominio pleno se adquirirá únicamente cuando el Prestador concluya la regularización jurídica, judicial y registral y proceda a la entrega formal; (d) durante el proceso, el bien se mantendrá en titularidad instrumental del Prestador (Arts. 2546 a 2552 del Código Civil Federal y su correlativo estatal); y (e) el compromiso del Prestador es de medios diligentes, asumiendo el Cliente, con consentimiento informado, el riesgo procesal inherente a la operación.

TERCERA. Imposibilidad jurídica sobreviniente y causas ajenas. Si la institución tenedora de la garantía (banco, administradora o propietario) realiza movimientos posteriores al pago que impidan su adquisición, o si por cualquier otra causa ajena al Prestador el área jurídica determina, mediante dictamen, que la recuperación no es jurídicamente posible, ello NO constituye mala fe ni dolo del Prestador, sino una imposibilidad jurídica sobrevenida. En tal supuesto procederá la garantía recíproca de la Cláusula Décima Séptima (cambio o, en su caso, devolución compensada).

CUARTA. Naturaleza del recurso aportado y administración. El Cliente reconoce que el Prestador opera bajo un esquema de recuperación de activos, y que los recursos que aporta ingresan al Prestador como contraprestación y costo de la operación —no como depósito, inversión ni recurso en garantía—, por lo que el Prestador los aplica y administra como propios para la ejecución del servicio. No obstante, el Prestador conserva el compromiso de cubrir, con cargo a la operación, los adeudos de agua y predial estrictamente necesarios para poder escriturar, correspondientes al periodo en que mantuvo la posesión del inmueble.

QUINTA. Valor de la operación y estructura de pagos por fases. El valor de referencia de la operación es de $ {{valorOperacion}} M.N. (sujeto a confirmación de Contabilidad). El Cliente cubrirá la contraprestación por fases, cuyos porcentajes dependen del estado procesal real de la garantía al contratar:
- Apartado: $10,000.00 M.N., no reembolsable; reserva la operación y se abona al momento del exhorto de desalojo.
- Etapa A (primer pago): por auditoría y dictaminación; se considera devengada desde su pago, por destinarse a investigación, dictámenes, logística foránea y honorarios de abogados, según el desglose de la Cláusula Sexta.
- Etapa B (segundo pago): se cubre dentro de los 15 días hábiles siguientes a la entrega del dictamen positivo; comprende la compra de la cesión, adeudos y ejecución judicial hasta el exhorto de desalojo. Requiere cotización previa por escrito (pre-cobro).
- Remodelación (opcional, 5%): únicamente si el Cliente la elige por escrito; de no elegirla, recibe la garantía en sus condiciones actuales (Cláusula Décima Quinta).
- Entrega: a la toma de posesión física y legal; antes de la entrega, todo lo pactado debe estar liquidado.
- Honorarios de intermediación: conforme a la Cláusula Octava (3% total, dividido por acto).
Las cantidades exactas de cada fase se detallan en el Anexo A (Tabla de Pagos) y quedan sujetas a validación de Contabilidad.

SEXTA. Alcance del servicio profesional (Fase A y Fase B). El Cliente reconoce que la contraprestación cubre los servicios profesionales y gastos operativos efectivamente prestados que se detallan a continuación, los cuales se devengan en proporción al trabajo realizado:
- I. Análisis jurídico y auditoría de campo: estudio de crédito, visitas a juzgados, estudio del expediente, dictámenes de viabilidad, estudio de mercado, y servicios de abogados.
- II. Gestión registral y administrativa: trámites ante el RPPC, Certificado de Libertad de Gravamen (CLG), antecedentes y folios.
- III. Logística foránea y traslados: boletos, viáticos y traslados del personal jurídico cuando la garantía no se ubica en Mazatlán.
- IV. Intermediación y ejecución judicial hasta la entrega: compra de la cesión, apersonamientos, edictos y seguimiento hasta el exhorto; intermediación notarial; y habilitación del bien.
Para transparencia del destino del recurso, las partes reconocen el siguiente desglose enunciativo:
· Análisis jurídico y auditoría de campo — estudio de crédito, visitas a juzgados, estudio del expediente, dictámenes y estudio de mercado. Se gasta para determinar si la garantía es viable y no exponer al Cliente a un activo con riesgo: honorarios de abogados, peritos y dictaminadores.
· Gestión registral — RPPC, CLG, antecedentes, folios. Para confirmar la situación registral y la libertad de gravamen: derechos y trámites ante RPPC, gestores.
· Logística foránea — vuelos, viáticos y traslados del personal jurídico fuera de Mazatlán, porque el expediente y el bien deben revisarse físicamente donde se ubican: boletos, viáticos, hospedaje, traslados.
· Intermediación y ejecución judicial — compra de la cesión, apersonamientos, edictos, seguimiento hasta el exhorto, intermediación notarial. Para comprar los derechos y llevar el juicio hasta la recuperación y entrega: pago de la cesión al banco/administradora, costas, edictos, honorarios procesales.
· Habilitación / remodelación — trabajos para entregar el bien en uso inmediato: materiales y mano de obra.

SÉPTIMA. Honorarios devengados. Los honorarios profesionales se devengan en proporción al trabajo efectivamente realizado, con independencia del resultado final del procedimiento (artículo 2606 del Código Civil Federal y Tesis Aislada 1a. CCXLVI/2013 de la Primera Sala de la S.C.J.N.). El cobro de los servicios efectivamente prestados no constituye dolo, daño ni penalización abusiva, sino la contraprestación del servicio profesional.

OCTAVA. Honorarios de intermediación (3% total, dividido por acto) y gastos a cargo del Cliente. El honorario de intermediación del Prestador es del 3% sobre el valor de la operación en total, que se devenga y cobra en dos momentos distintos, sin que la suma exceda dicho 3%. Este honorario es el único concepto que el Prestador cobra por este rubro y tiene naturaleza de honorario civil de intermediación —no de honorario notarial—, por no ser el Prestador fedatario público:
- 1.5% por la cesión: exigible cuando la cesión va dirigida a favor de DIIPA, es decir, desde que la administradora, banco o propietario gira la instrucción para formalizar la cesión al Prestador. Dicho dominio de cesión queda comprometido a entregarse al Cliente a partir de la sentencia firme en adelante.
- 1.5% por la escrituración: exigible al emitirse el exhorto de desalojo, momento en que, por instrucción de intermediación, el Prestador envía el asunto a la notaría designada.
Gastos a cargo exclusivo del Cliente (no incluidos en el 3% y sin margen alguno del Prestador): los honorarios del notario conforme al arancel notarial aplicable; las copias certificadas; los derechos de inscripción en el Registro Público de la Propiedad y del Comercio; los avalúos; y cualquier otro gasto necesario para escriturar. Asimismo, son a cargo del Cliente los impuestos que correspondan, en particular el Impuesto Sobre Adquisición de Inmuebles (ISAI) y, en su caso, el Impuesto Sobre la Renta (ISR). El Prestador no agrega margen alguno sobre la cotización de la notaría ni sobre dichos gastos; estos se trasladan al Cliente exactamente a su costo o los cubre el Cliente de forma directa.

NOVENA. Cotizaciones, requerimientos de pago y plazos perentorios. Los pre-cobros, cobros y cotizaciones se notifican al Cliente por correo electrónico; los plazos de pago corren a partir de dicha notificación. Emitido el exhorto de desalojo, el Cliente cuenta con 8 (ocho) días hábiles para liquidar el saldo de la operación y 15 (quince) días hábiles para cubrir lo relativo a la notaría y escrituración. El incumplimiento de estos plazos faculta al Prestador para tener por perdida la garantía a cargo del Cliente, o para exigir honorarios adicionales destinados a restituir o reactivar el caso. Estos plazos buscan que el asunto no se atrase ni se pierda la garantía; no constituyen penalización abusiva, sino la condición operativa para sostener la reserva ante la institución.

DÉCIMA. Documentación, prevención de lavado y datos personales. El Cliente entrega su identificación oficial, documentos fiscales y formatos de identificación del cliente y prevención de operaciones con recursos de procedencia ilícita, conforme a la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita. El Prestador podrá solicitar por escrito documentos adicionales, que el Cliente entregará dentro de los 5 días hábiles siguientes. El tratamiento de datos personales se rige por el aviso de privacidad del Prestador, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.

DÉCIMA PRIMERA. Plazos de ejecución y gestión judicial. El cómputo de los plazos para la resolución y entrega iniciará a partir de la firma de la cesión de derechos ante notario público. El plazo estimativo de gestión es de 48 semanas hábiles, aplicable a la fase de estudios y a las compras relacionadas. El Cliente reconoce que los tiempos procesales, desahogos y plazos de desalojo dependen de las cargas de los juzgados y autoridades, por lo que constituyen una guía estimativa y no una fecha fija garantizada, en congruencia con el compromiso de medios.

DÉCIMA SEGUNDA. Titularidad instrumental, mandato y reserva de dominio. Cualquier cesión, adjudicación, escritura o resolución que derive del procedimiento podrá emitirse formalmente a nombre del Prestador, quien actuará exclusivamente como mandatario, gestor o titular formal por cuenta y en interés del Cliente (Arts. 2546 a 2552 del Código Civil Federal y su correlativo estatal). Dicha titularidad es estrictamente instrumental y no implica adquisición de dominio propio a favor del Prestador. La transmisión definitiva quedará sujeta a la conclusión del procedimiento (sentencia firme, adjudicación que cause estado, exhorto cumplido y formalización) y a que el Cliente haya cumplido íntegramente sus obligaciones de pago. Cuando la garantía se entregue antes de la liquidación total, se hará bajo reserva de dominio a favor del Prestador hasta la liquidación; entretanto, el Cliente no adquiere dominio pleno y el procedimiento no avanza a la escritura definitiva.

DÉCIMA TERCERA. Reversión de la cesión por impago (mala fe y dolo del Cliente). Cuando la cesión ya se haya formalizado o comprometido a favor del Cliente y este, estando emitido el exhorto de desalojo o requerido el saldo por correo o cotización, no cubra el saldo pendiente dentro de los plazos pactados, el Cliente deberá restituir a DIIPA la cesión, revirtiendo el dominio ante notario público; la omisión de revertir se considerará mala fe y dolo. En tal supuesto: (a) el Cliente pierde la totalidad de lo pagado, que queda en propiedad de DIIPA como compensación por daños y perjuicios; (b) queda obligado a cubrir los honorarios devengados y la penalización pactada; y (c) se generará un interés moratorio civil del 5% anual sobre el saldo insoluto hasta su pago. Tenga o no el Cliente la cesión, en caso de incumplimiento o de solicitud formal de devolución queda obligado a restituir la garantía; las obligaciones del Prestador respecto de la garantía cesan de pleno derecho, subsistiendo únicamente sus derechos, y la garantía queda libre y disponible para que el Prestador la recupere. El Prestador conserva todas las acciones legales para recuperar la cesión, la propiedad y el dinero faltante.

DÉCIMA CUARTA. Exclusividad. El Cliente otorga exclusividad al Prestador para las gestiones, trámites y negociaciones de la operación, y se obliga a no contratar terceros ni realizar gestiones por su cuenta que interfieran o dupliquen las del Prestador. El Cliente podrá designar abogado propio para el juicio bajo su exclusiva responsabilidad, sin que ello lo exima de cubrir los honorarios pactados por la gestión, preparación, acompañamiento y seguimiento del Prestador.

DÉCIMA QUINTA. Habilitación y remodelación opcional. Únicamente si el caso avanza con dictámenes positivos y se logra la desocupación legal y material, el Prestador entregará el bien en condiciones de uso inmediato. La habilitación y, en su caso, la remodelación opcional (5%, elegida por escrito) comprenden:
- Aplicación de pintura general en muros y plafones.
- Puertas de acceso e interiores en correcto funcionamiento, sin daños.
- Cambio de chapas de todas las puertas de acceso, con entrega de llaves nuevas y operables.
- Accesorios básicos funcionales de baño y cocina (llaves de paso, manerales y regaderas).
- Tazas de baño operables y libres de filtraciones.
- Limpieza y sanitización profunda; entrega libre de basura y escombros.
Esta obligación NO incluye reparaciones estructurales mayores ni vicios ocultos preexistentes, por no ser el Prestador fabricante del bien y haberse pactado un precio inferior al valor comercial. Sin la remodelación elegida por escrito, el Cliente recibe la garantía en sus condiciones actuales.

DÉCIMA SEXTA. Adeudos y servicios. Cuando el Prestador obtenga la posesión legal del inmueble, se obliga a entregarlo libre de adeudos de servicios públicos esenciales (agua, energía eléctrica y predial) correspondientes exclusivamente al periodo en que mantuvo dicha posesión. No asume adeudos anteriores a la fecha en que obtuvo la posesión legal.

DÉCIMA SÉPTIMA. Garantía recíproca y sustitución. Si el dictamen resulta negativo o la garantía es declarada inviable por causas no imputables al Cliente, se aplicará la siguiente política de garantía recíproca al Cliente cumplidor: (a) el Prestador OFRECERÁ un cambio de garantía equivalente en zona y condiciones, sin nuevos honorarios de estudio; (b) si el Cliente ACEPTA, continúa con la nueva garantía mediante el contrato de cambio correspondiente; (c) si el Cliente NO ACEPTA siendo equivalente la oferta, se aplicará una penalización del 10% y se devolverá el 90% restante; y (d) si el Prestador NO logra ofrecer un equivalente, el Cliente tendrá derecho a la devolución compensada de su capital conforme a la Cláusula Décima Octava.

DÉCIMA OCTAVA. Penalizaciones, devolución compensada y escala de recuperación. Las partes pactan las siguientes consecuencias civiles, ordenadas según la etapa de la operación:
- Cancelación del Cliente antes de la emisión de dictámenes: devolución de su aportación neta, con penalización del 10% sobre lo pagado a la fecha. El apartado de $10,000.00 no es reembolsable.
- Desistimiento del Cliente con dictamen positivo: se retiene el 35% del valor de la operación por honorarios legales devengados, gastos administrativos y de gestión ante juzgados, RPPC y demás autoridades.
- Desistimiento o incumplimiento grave del Prestador: penalización a su cargo del 5% sobre los montos efectivamente aportados, a favor del Cliente, restituyendo el capital remanente en un plazo no mayor a 20 días hábiles.
- Cliente que ya cubrió la Etapa B (segundo pago) e inició el proceso judicial: debe esperar la conclusión del procedimiento. Si en esa etapa desiste o solicita formalmente la devolución, dicha solicitud se entiende como desistimiento: los honorarios devengados y las cantidades entregadas quedan en propiedad de DIIPA, la garantía permanece con DIIPA y el contrato se revoca por el solo hecho de la solicitud formal de devolución.
- Pérdida de la garantía en el juicio: habiéndose realizado el trabajo profesional, la única vía para que el Cliente recupere su capital será mediante un cambio de garantía (sustitución), SIN que proceda devolución, por encontrarse los servicios devengados.
- Impago del Cliente que derive en la pérdida de la garantía: las sumas entregadas quedan a favor del Prestador como compensación por daños y perjuicios, sin que proceda devolución.
- Devolución compensada (solo cuando el Prestador no puede entregar por dictamen negativo o causa ajena y no se logra un cambio equivalente): restitución del capital conforme al calendario pactado (hasta 36 meses), más una compensación civil del 5% anual simple por la demora. Esta compensación es estrictamente civil, por la espera, y no constituye interés financiero, rendimiento ni producto de inversión.

DÉCIMA NOVENA. Confidencialidad y no difamación. Toda la documentación, estrategias, dictámenes y datos compartidos tienen carácter confidencial de forma indefinida; el Cliente se obliga a no divulgarlos ni usarlos para fines ajenos a este contrato. Asimismo, siempre que el Prestador cumpla en tiempo y forma, el Cliente se abstendrá de realizar manifestaciones públicas o publicaciones que dañen la reputación o el prestigio comercial del Prestador. El incumplimiento generará responsabilidad civil por daño moral y perjuicios económicos.

VIGÉSIMA. Fallecimiento del Cliente. En caso de fallecimiento del Cliente, los derechos y obligaciones de este contrato se transmiten a sus sucesores o herederos legítimos conforme a la legislación aplicable, salvo manifestación expresa en contrario.

VIGÉSIMA PRIMERA. Rescisión. Serán causales de rescisión el incumplimiento de cualquiera de las obligaciones de las partes, en especial el incumplimiento en los pagos y plazos. Rescindido el contrato por causa imputable al Cliente, este quedará obligado, antes de cualquier liberación, a cubrir: los honorarios y servicios ya devengados; las cesiones ya realizadas; los trámites y gastos notariales ya erogados por su cuenta; y los intereses o recargos adicionales generados por su falta de pago. El Prestador no será responsable por vicios ocultos del inmueble recuperado, al no ser su fabricante y haberse pactado un precio inferior al valor comercial.

VIGÉSIMA SEGUNDA. Naturaleza jurídica, ley aplicable y jurisdicción. El presente contrato es de carácter estrictamente civil y privado. Para su interpretación, cumplimiento, exigibilidad y ejecución, las partes se someten al Código Civil del Estado en que se ubica la garantía objeto del servicio y a la competencia de los tribunales del lugar donde dicha garantía se ubique, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.

VIGÉSIMA TERCERA. Prescripción. Los plazos de prescripción relativos a responsabilidad civil, vicios ocultos y evicción se regirán por las disposiciones del Código Civil del Estado donde se ubica la garantía y demás normativa aplicable.

VIGÉSIMA CUARTA. Domicilios y notificaciones. Mientras las partes no notifiquen por escrito un cambio de domicilio, todos los avisos, notificaciones y diligencias que se realicen en los domicilios declarados surtirán plenamente sus efectos legales.

VIGÉSIMA QUINTA. Aceptación y firma. Enteradas las partes de la naturaleza jurídica, alcances, derechos y obligaciones de este instrumento, y no existiendo vicio alguno del consentimiento, manifiestan su total conformidad y lo firman por duplicado en la ciudad de {{ciudadFirma}}, {{estadoFirma}}, el {{fechaFirma}}. Las partes declaran haber leído íntegramente su contenido, comprender sus alcances y firmarlo por su libre voluntad.

{{#hayGarantiasVinculadas}}
GARANTÍAS VINCULADAS A ESTE CONTRATO
{{#each garantiasVinculadas}}{{item.n}}. Exp. {{item.expediente}} · {{item.direccion}} · Área: {{item.area}}
{{/each garantiasVinculadas}}{{/hayGarantiasVinculadas}}
{{#hayClientesVinculados}}
CLIENTES VINCULADOS A ESTE CONTRATO
{{#each clientesVinculados}}{{item.n}}. {{item.nombre}} · Folio: {{item.folio}}
{{/each clientesVinculados}}{{/hayClientesVinculados}}
{{#hayBeneficiarios}}
BENEFICIARIOS DESIGNADOS
{{#each beneficiarios}}{{item.n}}. {{item.nombre}} — Parentesco/relación: {{item.parentesco}} — Tel. {{item.telefono}} — Participación: {{item.participacion}}%
{{/each beneficiarios}}
{{clausulaParticipacion}}
{{/hayBeneficiarios}}

_______________________________          _______________________________
C. {{apoderadoNombre}}                    C. {{nombreCliente}}
{{apoderadoCargo}} — DIIPA, S.A. de C.V.  Cliente
(Inmuebles Accesibles)
{{#hayTestigos}}
Testigos:
{{#each testigos}}{{item.n}}. ______________________  {{item.nombre}}   {{item.identificacion}}
{{/each testigos}}{{/hayTestigos}}


GLOSARIO

Para la correcta interpretación de este contrato, las partes entienden por:

Garantía con contingencia. Bien inmueble afecto a un crédito, juicio, gravamen, adjudicación o situación legal pendiente, respecto del cual el Prestador presta su servicio de regularización y entrega. No se encuentra en dominio pleno al firmarse este contrato.

Servicio. Gestiones de mediación, asesoría, gestión jurídica, registral y representación para regularizar y, en su caso, entregar la garantía; se cobra por fases. El Prestador NO vende inmuebles ni transmite dominio por la sola firma.

Dictamen. Opinión jurídica y registral de viabilidad de la garantía; puede ser positivo o negativo. Nada avanza sin pre-dictamen positivo.

Fase A y Fase B. La Fase A comprende auditoría, dictaminación y gestiones iniciales; la Fase B comprende la compra de la cesión, la ejecución judicial y el seguimiento hasta el exhorto de desalojo.

Cesión de derechos. Acto por el que se transmiten al Cliente los derechos litigiosos o adjudicatarios, una vez cumplidas las condiciones pactadas.

Titularidad instrumental. Carácter con el que el Prestador conserva la cesión o adjudicación por cuenta y en interés del Cliente, como mandatario, sin adquirir dominio propio (Arts. 2546 a 2552 CCF).

Garantía recíproca. Compromiso del Prestador de ofrecer un cambio equivalente si la garantía resulta inviable por causa no imputable al Cliente.

Devolución compensada. Restitución del capital aportado más una compensación civil por la espera, cuando proceda. No es interés financiero, rendimiento ni producto de inversión.

Compromiso de medios. Obligación del Prestador de actuar con diligencia conforme a los tiempos legales; no es obligación de resultado ni de plazo fijo garantizado.


RECIBO DE PAGO DE HONORARIOS Y GESTIÓN

BUENO POR: $ {{montoRecibo}} M.N. ({{montoReciboLetra}} PESOS 00/100 M.N.)

CONCEPTO: Recibí del (de la) C. {{nombreCliente}} (el "Cliente"), la cantidad arriba mencionada en {{formaPagoRecibo}}, correspondiente al pago de la Etapa A (primer pago) equivalente al {{porcentajeEtapaA}}% del valor total de la operación, conforme a las Cláusulas Quinta y Sexta del presente Contrato de Prestación de Servicios Profesionales e Intermediación.

GARANTÍA: {{direccionGarantia}}.

DESTINO DEL PAGO: Honorarios por dictaminación, auditoría legal, gastos de logística foránea e investigación registral.

ESTATUS DEL PAGO: Las partes reconocen esta cantidad como devengada desde este momento por los servicios profesionales efectivamente prestados para el inicio de la operación (artículo 2606 del Código Civil Federal y Tesis 1a. CCXLVI/2013).

LUGAR Y FECHA: {{ciudadFirma}}, {{estadoFirma}}, a {{fechaFirma}}.


_______________________________          _______________________________
C. {{apoderadoNombre}}                    C. {{nombreCliente}}
Prestador de Servicios — DIIPA            Cliente
(Inmuebles Accesibles)`;

// ----------------------------------------------------------------------------
//  2 · CONTRATO DE COMISIÓN MERCANTIL (vendedor externo / comisionista)
// ----------------------------------------------------------------------------
const comisionCampos: PlantillaCampo[] = [
  { id: "nombreComisionista", label: 'Nombre completo de "El Comisionista"', tipo: "text", requerido: true },
  { id: "domicilioComisionista", label: 'Domicilio de "El Comisionista"', tipo: "textarea", requerido: true },
  { id: "rfcComisionista", label: 'RFC / CURP de "El Comisionista"', tipo: "text", ayuda: "Clave del RFC del comisionista" },
  { id: "vigenciaDuracion", label: "Duración de la vigencia", tipo: "text", requerido: true, ayuda: "Ej. Tres meses" },
  { id: "fechaInicio", label: "Fecha de inicio de la vigencia", tipo: "text", requerido: true, ayuda: "Ej. 22 de junio de 2026" },
  { id: "fechaFin", label: "Fecha de término de la vigencia", tipo: "text", requerido: true, ayuda: "Ej. 22 de septiembre de 2026" },
  { id: "comisionPrimerPago", label: "Comisión al primer pago (35%) — %", tipo: "text", requerido: true, ayuda: "Usualmente 2" },
  { id: "comisionConclusion", label: "Comisión al concluir la operación — %", tipo: "text", requerido: true, ayuda: "Usualmente 1" },
  { id: "comisionCambioCesion", label: "Comisión por cada cambio de cesión — %", tipo: "text", requerido: true, ayuda: "Usualmente 2" },
  { id: "ciudadFirma", label: "Ciudad de firma", tipo: "text", requerido: true, ayuda: "Ej. La Paz, Baja California Sur" },
  { id: "fechaFirmaTexto", label: "Fecha de firma (con letra)", tipo: "text", requerido: true, ayuda: "Ej. jueves veinticinco de julio de dos mil veintiséis" },
  { id: "jurisdiccion", label: "Tribunales competentes (jurisdicción)", tipo: "text", requerido: true, ayuda: "Ej. Culiacán, Sinaloa" },
];

const comisionCuerpo = `DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES S.A. DE C.V.

CONTRATO DE COMISIÓN MERCANTIL

Contrato de Comisión Mercantil que celebran por una parte {{nombreComisionista}}, a quien en lo sucesivo y para efectos del presente contrato se le denominará "El Comisionista", y, por otra parte la empresa denominada Desarrollos Inteligentes de Inmuebles y Propiedades Accesibles, Sociedad Anónima de Capital Variable, conocida comercialmente como "Inmuebles Accesibles" a quien en lo sucesivo y para efectos del presente contrato se le denominará "La Comitente", representada por {{apoderadoNombre}}, en su carácter de {{apoderadoCargo}}, al tenor de las siguientes declaraciones, definiciones y cláusulas:

DECLARACIONES:

1. Declara "El Comisionista" por su propio derecho, lo siguiente:
a. Ser una persona física, de nacionalidad mexicana, con capacidad legal para obligarse en los términos del presente contrato.
b. Que tiene la experiencia, los conocimientos profesionales, la capacidad y los recursos técnicos y humanos necesarios para llevar a cabo los objetivos que se persiguen con el presente contrato, toda vez que se desempeña como intermediario libre en la renta y compra venta de bienes inmuebles, mencionando de manera enunciativa más no limitativa viviendas, terrenos, locales, lotes y áreas comerciales, siendo esta su actividad comercial principal.
c. Que tiene establecido su domicilio en {{domicilioComisionista}}.
d. Que se encuentra debidamente inscrito en el Registro Federal de Contribuyentes con la clave {{rfcComisionista}}, misma que señala para todos los fines y efectos legales que produzca este contrato.

2. Declara "La Comitente" a través de su representante legal, lo siguiente:
Que es una Sociedad Anónima de Capital Variable constituida conforme a las leyes de la República Mexicana, cuyo representante acredita su personalidad con escritura pública número {{apoderadoEscritura}}, Volumen {{apoderadoVolumen}}, Libro {{apoderadoLibro}}, de fecha {{apoderadoFechaPoder}}, otorgada ante la fe del {{apoderadoNotario}}, titular de la Notaría número {{apoderadoNumNotaria}}, con sede en el Estado de {{apoderadoEstadoNotaria}}.
Que su representante cuenta con todas las facultades suficientes y necesarias para obligarla en los términos de este contrato, y que dichas facultades no les han sido revocadas o modificadas.
Que tiene establecido su domicilio en Avenida Santa Rosa 15A, colonia Linco Velarde, Mazatlán, Sinaloa.
Que se encuentra debidamente inscrita en el Registro Federal de Contribuyentes bajo la clave RFC DII2204206J5, misma que señala para todos los fines y efectos legales que produzca este contrato.
Que es su voluntad contratar a "El Comisionista" para que realice la promoción y venta de los bienes inmuebles que ésta comercializa.

Atentas las anteriores declaraciones, las partes están de acuerdo en otorgar las siguientes:

CLÁUSULAS

PRIMERA. Los términos utilizados en el presente contrato tendrán los significados atribuidos a ellos, tanto en el apartado de declaraciones como en las presentes cláusulas, mismos que serán los siguientes:
"Bienes Inmuebles": son todas las viviendas, terrenos, locales, lotes y áreas comerciales que se encuentran ubicados en las diferentes ciudades de la República Mexicana propiedad de "La Comitente".
"Cierre Efectivo": Se compone de un expediente integrado del Comprador.
"El Comprador": Significará aquella persona que adquiere de contado y/o cuenta con crédito Hipotecario autorizado para adquirir un bien inmueble y/o prestación de servicios en mediación de compraventa de los que comercializa "La Comitente".
"Expediente Integrado": Significará toda la documentación e información completa correspondiente al Comprador.

SEGUNDA. OBJETO Y MATERIA. Ambas partes celebran el presente contrato bajo los términos de la legislación mercantil aplicable para el efecto de que "El Comisionista", con recursos propios y servicio de personal calificado para la promoción y cierre de venta de los bienes inmuebles y/o prestación de servicios en mediación de compraventa que comercializa "La Comitente", provea los servicios de comisión mercantil, estudio y prospectación de mercado para la promoción y venta de los bienes inmuebles y/o prestación de servicios en mediación de compraventa propiedad de "La Comitente", bajo cuenta y riesgo de "El Comisionista".
Para este efecto, "El Comisionista" realizará cierres efectivos del "Comprador" a partir de la integración de los expedientes de compraventa de contrato y/o crédito y, cuando proceda, la gestión de dicho crédito ante las personas morales que otorguen créditos hipotecarios y/o las instituciones financieras que "El Comisionista" determine para la autorización de Créditos Hipotecarios a cuenta de terceros, el cual constituirá un proceso encaminado a la adquisición de las viviendas que comercializa "La Comitente".

TERCERA. OBLIGACIONES DE "EL COMISIONISTA". Se obliga a prestar sus servicios, por su cuenta, pero sin representación de "La Comitente", bajo los más estrictos principios de ética profesional, honestidad y confidencialidad, de acuerdo con la responsabilidad que las normas mercantiles que rigen este contrato le indican y, de acuerdo con los lineamientos que se establecen a continuación:
1. Contactar a los prospectos adquirientes de los bienes inmuebles y/o prestación de servicios en mediación de compraventa propiedad de "La Comitente" para gestionar la venta de los mismos y recabar de ellos, como requisito indispensable, toda la documentación correspondiente, generando un expediente integrado por cada prospecto que se reporte como "Comprador" a "La Comitente".
2. "El Comisionista" conviene en que ninguna operación, oferta o contrato propuesto a sus clientes por ella o por sus representantes, obligará a "La Comitente", mientras dicha operación no sea sancionada por "La Comitente", pactándose expresamente que "La Comitente" se reserva el derecho de aceptar o rechazar las operaciones, ofertas o contratos en cuestión, siempre y cuando "El Comisionista" no respete las condiciones de promoción establecidas por "La Comitente".
3. Entrevistar a las personas que se muestren interesadas en la adquisición de los mencionados bienes inmuebles y/o prestación de servicios en mediación de compraventa, indicándoles las características de los mismos, así como los derechos, beneficios y obligaciones derivados de la compraventa correspondiente y las condiciones requeridas para venta aprobadas por "La Comitente".
4. Cubrir todos los gastos que fueren ocasionados por la realización de la comisión mercantil para la gestión de los bienes inmuebles y/o prestación de servicios en mediación de compraventa a través de las diversas formas de adquisición existentes, incluyendo la modalidad de créditos hipotecarios, siempre y cuando dichos créditos hipotecarios hayan sido gestionados por "El Comisionista".
5. Respetar y hacer que las personas que contrate para la prestación de los servicios objeto de este contrato respeten y acaten todos los lineamientos que le sean notificados por "La Comitente", incluyendo, enunciativa más no limitativamente, procedimientos, instrucciones, formatos y documentos que a efecto proporcione "La Comitente". El acato de dichos procedimientos, instrucciones, formatos y documentos es obligatorio para "El Comisionista", previa notificación fehaciente por parte de "La Comitente".
6. En caso de que "El Comisionista" formule programas de promoción de la comisión mercantil objeto del presente contrato, estos deberán ser notificados y aprobados por "La Comitente".
7. En lo no previsto y prescrito expresamente en este contrato, "El Comisionista" consultará a "La Comitente", siempre que se lo permita la naturaleza del negocio. Si no fuera posible la consulta o "El Comisionista" estuviera autorizado para obrar a su arbitrio, lo hará de acuerdo con normas de ética profesional y buena fe.
8. "El Comisionista" dará aviso oportuno a "La Comitente" de todos los hechos o circunstancias que puedan determinar o modificar el encargo, así mismo deberá hacerlo sin demora en la ejecución de su encargo.
9. "La Comitente" se obliga ante "El Comisionista" a respetar todo trámite que tenga fecha anterior a la fecha de aviso de cambio de precios y planes de venta de acuerdo con lo estipulado en el numeral cuatro (4) de la cláusula tercera del presente contrato, siempre y cuando exista un acuse de recibido de los expedientes o pedidos, entendiéndose por pedidos todos aquellos expedientes ya debidamente terminados y autorizados por "El Comisionista" y que estén en proceso.
10. A cumplir con todas las demás obligaciones que se deriven del presente contrato, del Código de Comercio, del Código Civil Federal y de su similar para la entidad correspondiente, o de cualquier otra disposición legal que resulte aplicable.
En el ejercicio de su encargo "El Comisionista" no queda facultada como representante o mandataria de "La Comitente". En consecuencia, "El Comisionista" no tiene facultades para celebrar ningún tipo de contrato en representación y cuenta de "La Comitente", toda vez que dichos contratos solo pueden celebrarse directamente por el apoderado de ésta última o por quien dicho apoderado designe para hacerlo.

CUARTA. VIGENCIA. La duración del presente contrato será de {{vigenciaDuracion}} y empezará a surtir efectos el día {{fechaInicio}}; por lo que el mismo concluye el día {{fechaFin}}, sin necesidad de previo aviso o notificación alguna.
Asimismo, las partes acuerdan que el presente contrato podrá darse por terminado en cualquier momento por cualquiera de las siguientes causales:
a) Unilateralmente, en caso de que cualquiera de las partes no cubriesen las expectativas pactadas y generadas por el presente contrato.
b) Cuando cualquiera de las partes incumpla con cualquier cláusula de las contenidas en el presente contrato y siempre que dicha falta no sea subsanada inmediatamente a satisfacción de la otra parte.
c) Por mutuo acuerdo. Independientemente de la causal de terminación, las partes se obligan a dar aviso por escrito a la otra parte, con una anticipación mínima de 5 (cinco) días naturales anteriores a la fecha en que alguna parte considere dar por terminado el presente contrato, sin que sea necesario ningún tipo de declaración judicial que así lo determine al efecto.
Durante este periodo se realizarán los ajustes económicos respectivos y, en su caso, se efectuará el pago que una parte adeude a la otra con motivo y/o derivada de este contrato. Dicho pago se realizará en un plazo no mayor a treinta (30) días naturales contados a partir de la fecha de solicitud de pago contra la entrega del recibo o documento legal correspondiente. Dicho documento deberá reunir todos los requisitos fiscales.
Al término del presente contrato, "El Comisionista" devolverá a "La Comitente" o a las personas que ésta designe, toda documentación y material que para el desarrollo de sus actividades se le hubiesen proporcionado y se obliga a no divulgar o utilizar para beneficio propio, durante dos años posteriores a la terminación de este contrato, cualquier informe o documento que se le hubiese proporcionado o haya obtenido durante el ejercicio de comisión.

QUINTA. PAGO DE LA CONTRAPRESTACIÓN POR SERVICIOS. Las partes acuerdan que las comisiones a favor de "El Comisionista" se generarán y pagarán de manera independiente, conforme al avance del procedimiento de comercialización del bien inmueble, en los siguientes términos:
A) Cuando "La Comitente" reciba el primer pago correspondiente al 35% (treinta y cinco por ciento) del precio de venta del bien inmueble, pagará a "El Comisionista" una comisión equivalente al {{comisionPrimerPago}}% (por ciento), más el Impuesto al Valor Agregado (IVA), en caso de ser aplicable.
B) Una vez que "La Comitente" reciba el pago correspondiente al resto del precio de venta del bien inmueble y la operación quede debidamente concluida, pagará a "El Comisionista" una comisión equivalente al {{comisionConclusion}}% (por ciento), más el Impuesto al Valor Agregado (IVA), en caso de ser aplicable.
C) En caso de que durante el procedimiento de comercialización se formalice un cambio de cesión de derechos relacionado con la operación, "La Comitente" pagará a "El Comisionista" una comisión equivalente al {{comisionCambioCesion}}% (por ciento) por cada cambio de cesión que se formalice y respecto del cual "La Comitente" haya recibido el pago correspondiente.

SEXTA. IMPUESTOS. Toda carga fiscal que se genere por virtud de la celebración, ejecución y cumplimiento del presente contrato, será responsabilidad de cada una de las partes, según lo determinen las propias disposiciones fiscales aplicables. En consecuencia, en ningún momento alguna de las partes y/o sus subsidiarias responderán de los impuestos que correspondan a la otra, de acuerdo a la legislación aplicable.

SÉPTIMA. CONFIDENCIALIDAD. "El Comisionista" acepta que la información que reciba de "La Comitente", para la realización de las actividades objeto de este contrato, es de carácter confidencial, por lo que queda obligada a no proporcionar dicha información a persona alguna a excepción de las personas contratadas para la ejecución de los servicios que constituyen el objeto de este contrato, quienes deberán recibir únicamente la información necesaria para promover la venta de los bienes inmuebles y/o prestación de servicios en mediación de compraventa que "La Comitente" comercializa. Asimismo, "La Comitente" acepta que la información que reciba de "El Comisionista", para la realización de las actividades objeto de este contrato, es de carácter confidencial, por lo que queda obligada a no proporcionar dicha información sobre los clientes a Institución, empresa o persona alguna.

OCTAVA. SUPERVISIÓN DE LOS SERVICIOS. La ejecución de los servicios materia del presente contrato se encontrará en todo momento bajo la supervisión y se sujetará al visto bueno por parte de "La Comitente". Cualquier medida adoptada por "El Comisionista" que implique irregularidades o que no cumpla con los lineamientos de operación de "La Comitente" deberá ser corregida o atendida en forma inmediata, llevando a cabo las correcciones o ajustes necesarios previa notificación formal por parte de "La Comitente" a "El Comisionista".

NOVENA. DEL CUERPO DE VENTAS. En virtud de que "El Comisionista" es una persona física, todas y cada una de las obligaciones y responsabilidades laborales del personal de "El Comisionista" o de las personas físicas y morales que ésta contrate para administrar y coordinar a los promotores de ventas serán de su responsabilidad, en el caso de tener comisionistas externos.
De conformidad con lo anterior, "El Comisionista" será responsable de toda clase de reclamaciones de tipo laboral, ya sean de carácter individual o colectivo, que por cualquier concepto formule el personal de ventas que contrate, ya sea por su conducto o por medio de personas físicas o morales.
"El Comisionista", por lo que respecta al personal que llegare a contratar bajo su riesgo y subordinación, será responsable de cumplir fielmente todas las obligaciones laborales que por Ley le corresponden. Entre ellas se encuentran, enunciativa más no limitativamente, aquellas de naturaleza fiscal, civil y mercantil, incluyendo las cuotas obrero-patronales, pago de cuotas y aportaciones, retenciones de impuestos, que se deriven de su relación con sus trabajadores.
Serán por propia cuenta y a cargo de "El Comisionista" los salarios, riesgos profesionales, obligaciones laborales, cuotas al INFONAVIT, retenciones de impuestos sobre la renta, pago de cuotas al IMSS y demás obligaciones que se deriven por el personal o trabajadores que se utilicen en el desempeño de la comisión, personal que estará bajo su dirección y dependencia, no existiendo relación alguna con "La Comitente".
En consecuencia, "El Comisionista" se obliga a dejar a salvo a "La Comitente" de cualquier reclamación que surja del personal que aquella contrate o emplee en virtud de este contrato, obligándose a reembolsarle a la comitente todos los gastos y cantidades que en su caso se llegaran a otorgar por los conceptos antes mencionados.

DÉCIMA. NATURALEZA DEL CONTRATO. Ambas partes manifiestan que el presente contrato es de naturaleza mercantil y que se sujetan en todo lo no previsto en sus cláusulas a las disposiciones vigentes en la materia y en caso de controversia, deberá ser resuelto por los Jueces y Tribunales competentes en tal materia renunciando al fuero que por su domicilio u otra razón pudiera corresponderles en el presente y en el futuro.

DÉCIMA PRIMERA. DOMICILIOS. Ambas partes señalan como domicilio convencional para recibir las comunicaciones que deban hacerse las partes en relación con el presente Contrato las que a continuación se indican:
"LA COMITENTE": Desarrollos Inteligentes de Inmuebles y Propiedades Accesibles, Sociedad Anónima de Capital Variable, conocida comercialmente como "Inmuebles Accesibles". Dirección de correspondencia: Avenida Santa Rosa 15A, colonia Linco Velarde, Mazatlán, Sinaloa.
"EL COMISIONISTA": {{nombreComisionista}}. Dirección de correspondencia: {{domicilioComisionista}}.

DÉCIMA SEGUNDA. LEGISLACIÓN APLICABLE. Para la interpretación, cumplimiento y ejecución de este Contrato las partes se someten a la jurisdicción y Leyes aplicables a los tribunales competentes de {{jurisdiccion}}, renunciando las partes a cualquier otra jurisdicción o fuero que pudiere corresponderles en virtud de sus domicilios actuales o futuros o por cualquier otra causa.

Leído que fue por las partes el presente Contrato de Comisión Mercantil se firma por duplicado en {{ciudadFirma}}, el día {{fechaFirmaTexto}}.


_______________________________          _______________________________
{{apoderadoNombre}}                        {{nombreComisionista}}
Desarrollos Inteligentes de Inmuebles     "El Comisionista"
y Propiedades Accesibles, S.A. de C.V.
"La Comitente"`;

// ----------------------------------------------------------------------------
//  3 · ACTA DE ENTREGA-RECEPCIÓN Y FINIQUITO DEL SERVICIO
// ----------------------------------------------------------------------------
const actaFiniquitoCampos: PlantillaCampo[] = [
  { id: "folioGarantia", label: "Folio de la garantía", tipo: "text", requerido: true, ayuda: "Ej. GAR-0123" },
  { id: "nombreCliente", label: "Nombre completo del Cliente", tipo: "text", requerido: true },
  ...clienteContactoCampos,
  ...clienteApoderadoCampos,
  { id: "contratoOrigen", label: "Contrato de origen", tipo: "select", opciones: ["Prestación de Servicios", "Cambio de Garantía"], requerido: true },
  { id: "fechaContratoOrigen", label: "Fecha del contrato de origen", tipo: "text", ayuda: "Ej. 08 de agosto de 2025" },
  { id: "direccionGarantia", label: "Garantía (dirección completa)", tipo: "textarea", requerido: true },
  { id: "valorOperacion", label: "Valor de la operación (MXN)", tipo: "text", requerido: true, ayuda: "Ej. 2,000,000.00" },
  { id: "ciudadActa", label: "Ciudad del acta", tipo: "text", requerido: true },
  { id: "estadoActa", label: "Estado del acta", tipo: "text", requerido: true },
  { id: "fechaActa", label: "Fecha del acta", tipo: "text", requerido: true, ayuda: "Ej. 17 de junio de 2026" },
  {
    id: "modalidadCierre",
    label: "Modalidad de cierre",
    tipo: "select",
    opciones: ["A — Posesión + Cesión de Derechos", "B — Posesión + Escritura", "C — Posesión Únicamente"],
    requerido: true,
    ayuda: "El acta imprime SOLO la modalidad que elijas.",
  },
  { id: "habilitacionBasica", label: "Se realizó la habilitación básica", tipo: "checkbox" },
  { id: "remodelacionOpcional", label: "Se realizó la remodelación opcional (contratada por escrito)", tipo: "checkbox" },
  ...testigosCampo,
  ...beneficiariosCampos,
  ...vinculosCampos,
];

const actaFiniquitoCuerpo = `DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V.
(conocida comercialmente como "Inmuebles Accesibles" — una sola y misma sociedad)

ACTA DE ENTREGA-RECEPCIÓN Y FINIQUITO DEL SERVICIO
Reconocimiento de conclusión del servicio, liquidación total y honorarios devengados

DATOS DEL EXPEDIENTE
Folio de la garantía: {{folioGarantia}}
Cliente: {{nombreCliente}}
Contrato de origen: {{contratoOrigen}}, de fecha {{fechaContratoOrigen}}
Garantía (inmueble): {{direccionGarantia}}
Valor de la operación: $ {{valorOperacion}} M.N.
Lugar y fecha del acta: {{ciudadActa}}, {{estadoActa}}, a {{fechaActa}}

En el lugar y fecha señalados, comparecen por una parte Desarrollos Inteligentes de Inmuebles y Propiedades Accesibles, S.A. de C.V. ("Inmuebles Accesibles"), representada por su apoderado el (la) C. {{apoderadoNombre}} (el "Prestador"); y por la otra, el (la) C. {{nombreCliente}}{{#clienteComparecePorApoderado}}, representado(a) por su apoderado el (la) C. {{nombreApoderadoCliente}} ({{poderApoderadoCliente}}){{/clienteComparecePorApoderado}} (el "Cliente"), con teléfono {{telefonoCliente}} y correo {{correoCliente}}, con el objeto de hacer constar la entrega-recepción y el finiquito del servicio prestado respecto de la garantía señalada, al tenor de las siguientes cláusulas:

CLÁUSULAS

PRIMERA. Objeto del acta. Hacer constar la conclusión del servicio profesional prestado por el Prestador respecto de la garantía identificada en el recuadro de datos, la entrega-recepción correspondiente, la liquidación total de la contraprestación y el finiquito entre las partes.

SEGUNDA. Liquidación total (100%). El Cliente reconoce que, como condición para la entrega, ha cubierto el 100% (cien por ciento) de la contraprestación pactada por el servicio, incluidas todas las fases y los honorarios. En consecuencia, declara que a la fecha NO existe saldo, adeudo ni cantidad alguna pendiente a favor del Prestador por concepto de la operación. (Los gastos de escrituración, impuestos y derechos que correspondan al Cliente se rigen por la Cláusula Cuarta.)

TERCERA. Reconocimiento de honorarios devengados. El Cliente reconoce y acepta que la totalidad de los honorarios profesionales y gastos operativos quedaron íntegramente DEVENGADOS por los servicios efectivamente prestados (artículo 2606 del Código Civil Federal y Tesis Aislada 1a. CCXLVI/2013 de la Primera Sala de la S.C.J.N.), y que ninguna cantidad pagada es reembolsable ni reclamable. Manifiesta su plena conformidad con el servicio recibido.

CUARTA. Modalidad de cierre. Las partes hacen constar la modalidad de entrega conforme a lo siguiente:
{{#esModA}}MODALIDAD A) POSESIÓN + CESIÓN DE DERECHOS. El Cliente recibe la posesión física y legal del inmueble y la cesión de derechos a su favor, y RECONOCE que debe continuar y concluir por su cuenta el protocolo de escrituración: cubrir los honorarios del notario (arancel), impuestos (ISAI y, en su caso, ISR), derechos de inscripción en el RPPC, copias certificadas y avalúos; así como el 1.5% de honorarios de intermediación del Prestador correspondiente a la escrituración cuando ésta se realice. El Prestador acompañará la intermediación notarial en los términos del contrato.{{/esModA}}{{#esModB}}MODALIDAD B) POSESIÓN + ESCRITURA. El inmueble se entrega con la escrituración ya formalizada e inscrita a favor del Cliente. Se hace constar el cierre total de la operación, sin trámites de escrituración pendientes. Los impuestos, derechos y gastos notariales fueron cubiertos por el Cliente conforme al contrato.{{/esModB}}{{#esModC}}MODALIDAD C) POSESIÓN ÚNICAMENTE. El Cliente recibe la posesión física y legal del inmueble. Cualquier trámite posterior de cesión o escrituración se sujetará a lo pactado en el contrato de origen y a los gastos e impuestos a cargo del Cliente.{{/esModC}}

QUINTA. Estado del inmueble y habilitación. El Cliente recibe el inmueble a su entera satisfacción, en las condiciones físicas y materiales en que se encuentra.{{#habilitacionBasica}} Se realizó la habilitación básica (cambio de chapas con llaves nuevas, funcionamiento de puertas, accesorios y tazas de baño operables, limpieza y sanitización).{{/habilitacionBasica}}{{#remodelacionOpcional}} Se realizó la remodelación opcional contratada por escrito.{{/remodelacionOpcional}} El Prestador no responde por vicios ocultos ni defectos estructurales preexistentes, por no ser fabricante del bien y haberse pactado un precio inferior al valor comercial.

SEXTA. Adeudos de servicios. El inmueble se entrega libre de adeudos de agua, energía eléctrica y predial correspondientes al periodo en que el Prestador mantuvo la posesión legal. El Cliente será responsable de los consumos y obligaciones a partir de la fecha de la presente entrega.

SÉPTIMA. Finiquito y no reclamaciones. Con la firma de la presente acta, las partes se otorgan el más amplio finiquito que en derecho proceda respecto de las obligaciones derivadas del contrato de origen. El Cliente manifiesta que no se reserva acción, derecho ni reclamación alguna, presente o futura, en contra del Prestador por concepto del servicio prestado, la contraprestación pagada o la entrega realizada, salvo las obligaciones que por su naturaleza subsisten conforme a la Cláusula Octava.

OCTAVA. Obligaciones que subsisten. No obstante el finiquito, subsisten: (a) las obligaciones de confidencialidad y no difamación pactadas en el contrato de origen, de carácter indefinido; y (b) en el supuesto de la modalidad A, la obligación del Cliente de continuar y concluir el protocolo de escrituración y de cubrir los gastos, impuestos y honorarios de intermediación que correspondan a dicho acto.

NOVENA. Conformidad. Leída la presente acta y enteradas las partes de su contenido y alcances, la firman de conformidad por duplicado, sin que medie dolo, error, violencia ni vicio alguno del consentimiento.

{{#hayGarantiasVinculadas}}
GARANTÍAS VINCULADAS A ESTE CONTRATO
{{#each garantiasVinculadas}}{{item.n}}. Exp. {{item.expediente}} · {{item.direccion}} · Área: {{item.area}}
{{/each garantiasVinculadas}}{{/hayGarantiasVinculadas}}
{{#hayClientesVinculados}}
CLIENTES VINCULADOS A ESTE CONTRATO
{{#each clientesVinculados}}{{item.n}}. {{item.nombre}} · Folio: {{item.folio}}
{{/each clientesVinculados}}{{/hayClientesVinculados}}
{{#hayBeneficiarios}}
BENEFICIARIOS DESIGNADOS
{{#each beneficiarios}}{{item.n}}. {{item.nombre}} — Parentesco/relación: {{item.parentesco}} — Tel. {{item.telefono}} — Participación: {{item.participacion}}%
{{/each beneficiarios}}
{{clausulaParticipacion}}
{{/hayBeneficiarios}}

_______________________________          _______________________________
C. {{apoderadoNombre}}                    C. {{nombreCliente}}
Por el Prestador — DIIPA                  Cliente
(Inmuebles Accesibles)

Testigos{{#hayTestigos}} designados:
{{#each testigos}}{{item.n}}. {{item.nombre}}   {{item.identificacion}}
{{/each testigos}}{{/hayTestigos}}

_______________________________          _______________________________
Testigo                                   Testigo`;

// ----------------------------------------------------------------------------
//  Export: se suma al arreglo `plantillas` de contract-templates.ts
// ----------------------------------------------------------------------------

// ---- Cesión onerosa de derechos adjudicatarios (acta destacada · Jalisco) ----
const cesionAdjudicatariaCampos: PlantillaCampo[] = [
  ...clienteApoderadoCampos,
  { id: "folioReal", label: "Folio real (registral) del inmueble", tipo: "text", ayuda: "Ej. 2174963" },
  { id: "manzana", label: "Manzana", tipo: "text", requerido: true },
  { id: "lote", label: "Lote", tipo: "text", requerido: true },
  { id: "nombreCesionario", label: "Nombre completo del cesionario (comprador)", tipo: "text", requerido: true },
  { id: "nacionalidad", label: "Nacionalidad", tipo: "text", ayuda: "Ej. Mexicana" },
  { id: "rfc", label: "RFC del cesionario", tipo: "text" },
  { id: "curp", label: "CURP del cesionario", tipo: "text" },
  { id: "domicilioCesionario", label: "Domicilio del cesionario", tipo: "textarea" },
  { id: "estadoCivil", label: "Estado civil", tipo: "text", ayuda: "Ej. Casado(a) / Soltero(a)" },
  { id: "precio", label: "Precio de la cesión (MXN)", tipo: "text", requerido: true, ayuda: "Ej. 235,000.00" },
  { id: "precioLetra", label: "Precio con letra", tipo: "text", ayuda: "Ej. DOSCIENTOS TREINTA Y CINCO MIL" },
  { id: "formaPago", label: "Forma de pago", tipo: "textarea", ayuda: "Ej. apartado, primer pago 35% y saldo conforme al convenio" },
  { id: "domicilioCedente", label: "Domicilio de EL CEDENTE (DIIPA)", tipo: "textarea", ayuda: "Agustín Yáñez 2583, Col. Arcos Vallarta, Guadalajara, Jalisco" },
  { id: "actaNumero", label: "Acta número (lo asigna la notaría)", tipo: "text" },
  { id: "volumen", label: "Volumen (notaría)", tipo: "text" },
  { id: "folioNotarial", label: "Folio (notaría)", tipo: "text" },
  { id: "dia", label: "Día de firma", tipo: "text" },
  { id: "mes", label: "Mes de firma", tipo: "text" },
  { id: "anio", label: "Año de firma", tipo: "text" },
];

const cesionAdjudicatariaCuerpo = `ACTA DESTACADA — CONTRATO DE CESIÓN ONEROSA DE DERECHOS ADJUDICATARIOS

Y DERECHOS DERIVADOS DE LA EJECUCIÓN DE SENTENCIA

Fraccionamiento Residencial San Antonio · Tlajomulco de Zúñiga, Jalisco · Manzana {{manzana}}, Lote {{lote}} · Folio real {{folioReal}}

ACTA NÚMERO {{actaNumero}}.— VOLUMEN {{volumen}}, FOLIO {{folioNotarial}}.

En el Municipio de Tlajomulco de Zúñiga, Estado de Jalisco, Estados Unidos Mexicanos, siendo el día {{dia}} del mes de {{mes}} del año {{anio}}, ante mí, Licenciado(a) «____», Notario(a) Público(a) número «____» del Estado de Jalisco, con adscripción y ejercicio en este Municipio, procedo mediante la presente acta a hacer constar EL CONTRATO DE CESIÓN ONEROSA DE DERECHOS ADJUDICATARIOS Y DERECHOS DERIVADOS DE LA EJECUCIÓN DE SENTENCIA, que celebran: de una parte, DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE, representada en este acto por ERIKA PAOLA ESPAÑA MÉNDEZ, en su carácter de Administradora Única y Apoderada Legal —o en su caso por MILTON CASTRO CERVANTES, en su carácter de Apoderado General para Pleitos y Cobranzas, facultado para suscribir las cesiones conforme a la escritura pública número 2,388 otorgada ante el Licenciado Eduardo Antonio Rocha Pacheco, Notario Público número 234 de Culiacán, Sinaloa—, a quien en lo sucesivo se le denominará “EL CEDENTE”; y de la otra parte, «____», por su propio derecho, a quien en lo sucesivo se le denominará “EL CESIONARIO”; al tenor de los siguientes ANTECEDENTES, DECLARACIONES y CLÁUSULAS:

A N T E C E D E N T E S

PRIMERO. DEL CRÉDITO Y GARANTÍA ORIGINAL.— Con fecha 6 de octubre de 2006, mediante la escritura pública número 48,466 (cuarenta y ocho mil cuatrocientos sesenta y seis), otorgada ante el Notario Público número 64 (sesenta y cuatro) de Guadalajara, Jalisco, la sociedad METROFINANCIERA, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE, otorgó un crédito simple con garantía fiduciaria a favor de GRUPO CONSTRUCTOR FEDAL, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE. Dicho gravamen quedó inscrito bajo el folio real 2174963 y afectó el patrimonio fideicomitido del Fraccionamiento Residencial San Antonio, en Tlajomulco de Zúñiga, Jalisco.

SEGUNDO. DE LA CADENA DE CESIONES CORPORATIVAS.— El 31 de julio de 2007, METROFINANCIERA cedió los derechos del crédito a BANCO INVEX, SOCIEDAD ANÓNIMA, para integrarlos al Fideicomiso número 650 (seiscientos cincuenta). El 21 de marzo de 2012, BANCO INVEX transmitió la totalidad de dichos derechos a PROYECTOS ADAMFUND, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE. El 17 de febrero de 2014 se formalizó la fusión de PROYECTOS ADAMFUND (como fusionada) con PROYECTOS ADAMANTINE, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE, SOCIEDAD FINANCIERA DE OBJETO MÚLTIPLE, ENTIDAD REGULADA (como fusionante), subrogándose esta última en todos los derechos y activos derivados del crédito original.

TERCERO. DEL JUICIO ORDINARIO MERCANTIL Y LA ADJUDICACIÓN.— Ante el incumplimiento de las obligaciones garantizadas, PROYECTOS ADAMANTINE promovió juicio ordinario mercantil bajo el expediente 1393/2017, del índice del Juzgado Octavo de Jurisdicción Concurrente del Primer Distrito Judicial en Monterrey, Nuevo León. El 27 de febrero de 2024 se dictó la resolución por la que se adjudicaron, por remate judicial, diversos lotes a favor de la parte actora, misma que causó ejecutoria el 13 de mayo de 2024 al no haber sido recurrida por las partes. En razón de que la parte demandada no cumplió voluntariamente con la prevención respectiva, el juzgado ordenó el otorgamiento de la escritura de propiedad en rebeldía de la demandada a favor del adjudicatario, girándose oficio para su protocolización.

CUARTO. DE LA CESIÓN A FAVOR DE «EL CEDENTE» (DIIPA).— Con fecha 13 de febrero de 2025, PROYECTOS ADAMANTINE, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE, formalizó ante el Licenciado Iván Alfonso López Fierro, Notario Público número 293 de Culiacán, Sinaloa, la escritura número 854 (ochocientos cincuenta y cuatro), mediante la cual cedió de manera onerosa los derechos de crédito, litigiosos y, fundamentalmente, los derechos adjudicatarios derivados del expediente 1393/2017, a favor de DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE.

QUINTO. DEL RECONOCIMIENTO JUDICIAL, EL EXHORTO Y LA POSESIÓN.— El 31 de marzo de 2025, el Juez Octavo de lo Concurrente en Monterrey, Nuevo León, sancionó legalmente la cesión de derechos a favor de «EL CEDENTE». Para la ejecución en el lugar de ubicación de los inmuebles se libró el exhorto número 82/2026, turnado al Juzgado Primero de lo Civil de Tlajomulco de Zúñiga, Jalisco, en el que a la fecha se tiene reconocido al Apoderado General para Pleitos y Cobranzas de «EL CEDENTE», se desecharon los incidentes de nulidad promovidos por la contraparte y se resolvió lo relativo a los honorarios del perito valuador, etapa que antecede al señalamiento de la fecha de desalojo. El juzgado ordenó la entrega material y jurídica de los inmuebles a favor del cesionario, con el apercibimiento del uso de la fuerza pública para garantizar la toma de posesión.

SEXTO. DE LOS GRAVÁMENES.— Los inmuebles reportan un gravamen vigente por fideicomiso e hipoteca a favor de METROFINANCIERA. La resolución judicial de adjudicación en rebeldía ordena la entrega material y jurídica, lo que faculta la escrituración forzosa y la consecuente liberación y cancelación de dicho gravamen en el historial registral del inmueble, conforme a la ejecutoria dictada en el expediente 1393/2017.

D E C L A R A C I O N E S

I. Declara “EL CEDENTE”, por conducto de su representante, el (la) C. {{apoderadoNombre}}:

a) Que es una sociedad legalmente constituida conforme a las leyes mexicanas, según consta en la escritura pública número 1,809 (mil ochocientos nueve), volumen II (segundo), libro 4 (cuatro), de fecha 20 de abril de 2022, otorgada ante la fe del Licenciado Luis Manuel Bouciéguez Velarde, Notario Público número 256 con ejercicio y residencia en Mazatlán, Sinaloa, e inscrita bajo el folio mercantil electrónico N-2022029617, en el Registro Público de Comercio de Mazatlán, Sinaloa; con Registro Federal de Contribuyentes DII2204206J5 y domicilio en la Ciudad de Mazatlán, Sinaloa, con oficina en Calle Agustín Yáñez 2583, Colonia Arcos Vallarta, Guadalajara, Jalisco.

b) Que su representante cuenta con las facultades suficientes para la celebración del presente acto, mismas que a la fecha no le han sido revocadas ni modificadas en forma alguna.

c) Que es legítimo titular de los derechos adjudicatarios y derechos derivados de la ejecución de sentencia dictada en el expediente 1393/2017, respecto del inmueble objeto de este instrumento, según el tracto relacionado en los Antecedentes que preceden, y que es su voluntad cederlos de manera onerosa a favor de “EL CESIONARIO”.

II. Declara “EL CESIONARIO”:

a) Llamarse {{nombreCesionario}}, de nacionalidad {{nacionalidad}}, con Registro Federal de Contribuyentes {{rfc}}, Clave Única de Registro de Población {{curp}}, con domicilio en {{domicilioCesionario}}; manifestando su estado civil como {{estadoCivil}}. (Datos a asentar por la notaría conforme a las identificaciones exhibidas.)

b) Que conoce la situación jurídica, administrativa y registral del inmueble objeto de esta cesión, incluido el gravamen relacionado en el Antecedente SEXTO, así como los alcances de la adjudicación en rebeldía, y que es su voluntad adquirir los derechos materia de este instrumento.

c) Que los recursos con los que cubre el precio de esta cesión provienen de fuente lícita; que el presente acto se celebra con el carácter de acto ocasional; y que “EL CESIONARIO” es el único titular y beneficiario del negocio jurídico contenido en este instrumento, sin que exista tercero alguno que sea dueño o beneficiario del mismo, de conformidad con la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita.

C L A U S U L A S

PRIMERA. OBJETO.— “EL CEDENTE” cede de manera onerosa a “EL CESIONARIO”, quien adquiere, la totalidad de los derechos adjudicatarios y derechos derivados de la ejecución de sentencia dictada en el expediente 1393/2017, respecto del inmueble identificado como Lote «____» de la Manzana “«____»” del Fraccionamiento Residencial San Antonio, en Tlajomulco de Zúñiga, Jalisco, con folio real «____», superficie de «____» m2 y las medidas y colindancias del anexo respectivo.

SEGUNDA. PRECIO Y FORMA DE PAGO.— El precio de la presente cesión es la cantidad de $ {{precio}} ({{precioLetra}} pesos 00/100 M.N.), que “EL CESIONARIO” cubre a “EL CEDENTE” en la forma siguiente: {{formaPago}}. “EL CEDENTE” otorgará el recibo correspondiente.

TERCERA. TÍTULO Y TRACTO.— El derecho que se cede deriva del tracto relacionado en los Antecedentes, cuya última transmisión a favor de “EL CEDENTE” consta en la escritura número 854 otorgada el 13 de febrero de 2025 ante el Notario Público número 293 de Culiacán, Sinaloa, y fue sancionada judicialmente el 31 de marzo de 2025.

CUARTA. ENTREGA, POSESIÓN Y RECONOCIMIENTO JUDICIAL.— “EL CESIONARIO” se subroga en los derechos de posesión y entrega material y jurídica del inmueble, reconocidos y ordenados por el juzgado en los términos de la ejecutoria del expediente 1393/2017 y del exhorto 82/2026, incluido el apercibimiento de uso de la fuerza pública. “EL CESIONARIO” se obliga a hacer del conocimiento del juez de la causa la presente cesión y a realizar las gestiones necesarias para que se le reconozca en su carácter de cesionario y, en su caso, se ordene la escrituración forzosa a su favor, por su cuenta y bajo su responsabilidad.

QUINTA. GRAVÁMENES Y LIBERACIÓN DE HIPOTECA.— Las partes reconocen que el inmueble reporta el gravamen relacionado en el Antecedente SEXTO a favor de METROFINANCIERA. En virtud de la adjudicación en rebeldía y de la escrituración forzosa ordenada judicialmente, “EL CESIONARIO” queda facultado para gestionar y obtener la cancelación y liberación de dicho gravamen ante el Registro Público de la Propiedad, conforme a la resolución del expediente 1393/2017.

SEXTA. IMPUESTOS Y DERECHOS.— El Impuesto sobre Transmisiones Patrimoniales (traslación de dominio), los derechos de inscripción registral y demás contribuciones y gastos que genere la protocolización serán por cuenta exclusiva de “EL CESIONARIO”. La notaría podrá abstenerse de expedir testimonio en tanto no se acredite su entero, conforme a la Ley del Notariado del Estado de Jalisco.

SÉPTIMA. CESIÓN SIN RESPONSABILIDAD Y ADQUISICIÓN EN EL ESTADO ACTUAL.— “EL CESIONARIO” declara y reconoce que, con anterioridad a la firma del presente instrumento, revisó por sus propios medios la totalidad de la información y documentación jurídica, registral, administrativa y física relativa a los derechos y al inmueble objeto de esta cesión, incluidos el expediente 1393/2017, el exhorto 82/2026 y la situación registral del inmueble; que adquiere los derechos en el estado físico, jurídico y registral en que se encuentran, con el gravamen relacionado en el Antecedente SEXTO; y que, en consecuencia, la presente cesión se realiza sin responsabilidad alguna para “EL CEDENTE” con posterioridad a la venta, liberándolo “EL CESIONARIO” de cualquier reclamación, saneamiento o evicción. “EL CEDENTE” responde únicamente de la legitimidad de la titularidad cedida, en términos del artículo 2,043 del Código Civil Federal y sus correlativos del Código Civil del Estado de Jalisco. Asimismo, “EL CESIONARIO” renuncia expresamente al saneamiento por evicción y por vicios ocultos respecto de los derechos y del inmueble objeto de esta cesión, en términos de los artículos 2,119, 2,123 y 2,162 del Código Civil Federal y sus correlativos del Código Civil del Estado de Jalisco, liberando a “EL CEDENTE” de toda responsabilidad por dichos conceptos.

OCTAVA. DOMICILIOS.— “EL CEDENTE” señala como domicilio {{domicilioCedente}} y “EL CESIONARIO” el señalado en sus declaraciones.

NOVENA. JURISDICCIÓN.— Las partes se someten a las leyes aplicables y a la jurisdicción de los tribunales competentes del Municipio de Tlajomulco de Zúñiga o del Primer Partido Judicial del Estado de Jalisco, renunciando a cualquier otro fuero.

CIERRE

Yo, el(la) Notario(a), doy fe de que lo relacionado concuerda con los documentos que tuve a la vista y que se agregarán al Apéndice de esta acta bajo el número «____». Previa lectura y explicación del valor y consecuencias legales de su contenido, los comparecientes manifestaron su conformidad y firman ante mí. DOY FE.

_____________________________

EL(LA) NOTARIO(A) PÚBLICO(A)  ·  Firma y sello de autorizar

NOTA — Machote de apoyo para revisión por notario y abogado. Los espacios «____» los completa la notaría (datos de la notaría, número de acta, volumen/folio y fecha) y las partes (generales del cesionario, precio y forma de pago). Plaza fija: Tlajomulco de Zúñiga, Jalisco. Fundamento: Ley del Notariado del Estado de Jalisco y Código Civil del Estado de Jalisco.`;

export const plantillasDiipa: PlantillaContrato[] = [
  {
    tipo: "cesion_adjudicataria",
    nombre: "Cesión de derechos adjudicatarios (acta destacada · Jalisco)",
    descripcion: "Acta destacada de cesión onerosa de derechos adjudicatarios y derechos derivados de la ejecución de sentencia, conforme al derecho de Jalisco. Autollenable con los datos del cliente/comprador. Machote de apoyo para revisión de notario y abogado.",
    campos: cesionAdjudicatariaCampos,
    cuerpo: cesionAdjudicatariaCuerpo,
  },

  {
    tipo: "prestacion_diipa",
    nombre: "Prestación de Servicios Profesionales (DIIPA · Garantía con Contingencia)",
    descripcion: "Contrato de origen del cliente DIIPA: prestación de servicios profesionales e intermediación para la regularización y entrega de garantías con contingencia. Incluye glosario y recibo de Etapa A. Apoderado auto-llenado.",
    campos: prestacionDiipaCampos,
    cuerpo: prestacionDiipaCuerpo,
  },
  {
    tipo: "comision_mercantil",
    nombre: "Contrato de Comisión Mercantil (comisionista / vendedor externo)",
    descripcion: "Contrato mercantil con un comisionista externo para la promoción y venta de bienes inmuebles de DIIPA. Comisiones por avance (primer pago, conclusión y cambio de cesión). Apoderado auto-llenado.",
    campos: comisionCampos,
    cuerpo: comisionCuerpo,
  },
  {
    tipo: "acta_finiquito",
    nombre: "Acta de Entrega-Recepción y Finiquito del Servicio",
    descripcion: "Cierre del expediente: conclusión del servicio, liquidación total (100%) y finiquito. Imprime solo la modalidad de cierre elegida (A/B/C). Apoderado auto-llenado.",
    campos: actaFiniquitoCampos,
    cuerpo: actaFiniquitoCuerpo,
  },
];

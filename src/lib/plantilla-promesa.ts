import type { PlantillaContrato, PlantillaCampo } from "./contract-templates";

const campos: PlantillaCampo[] = [
  // — Compradora —
  { id: "nombreCompradora", label: "Nombre completo de LA PROMITENTE COMPRADORA", tipo: "text", requerido: true },
  { id: "curpCompradora", label: "CURP / RFC de LA COMPRADORA", tipo: "text" },
  { id: "domicilioCompradora", label: "Domicilio de LA COMPRADORA", tipo: "textarea" },

  // — Vendedora (DIIPA) —
  { id: "nombreApoderado", label: "Apoderado(a) de LA VENDEDORA que firma", tipo: "text", requerido: true, ayuda: "Ej. Erika Paola España Méndez" },

  // — Reestructura de carta de apartado —
  { id: "reestructuraApartado", label: "¿Reestructura una carta de apartado?", tipo: "checkbox" },
  { id: "fechaApartado", label: "Fecha de la carta de apartado", tipo: "text", dependeDe: { campo: "reestructuraApartado", valor: true }, ayuda: "Ej. 29 de agosto de 2025" },

  // — Proceso —
  { id: "numeroJuicio", label: "Número de juicio", tipo: "text", requerido: true, ayuda: "Ej. 1393/2017" },
  { id: "juzgadoOrigen", label: "Juzgado de origen (adjudicación)", tipo: "textarea", requerido: true },
  { id: "numeroExhorto", label: "Número de exhorto", tipo: "text", ayuda: "Ej. 82/2026" },
  { id: "juzgadoExhorto", label: "Juzgado del exhorto (ejecución/desalojo)", tipo: "text" },
  { id: "fraccionamiento", label: "Ubicación / fraccionamiento de las garantías", tipo: "text", ayuda: "Ej. Fracc. Residencial San Antonio, C.P. 45650, Tlajomulco" },
  { id: "estadoProcesal", label: "Estado procesal actual", tipo: "textarea" },

  // — Garantías (lista) —
  {
    id: "garantias", label: "Garantías de la operación", tipo: "lista", ayuda: "Agrega cada garantía (descripción y valor).",
    subcampos: [
      { id: "descripcion", label: "Descripción / ubicación", tipo: "text" },
      { id: "valor", label: "Valor (MXN)", tipo: "text" },
    ],
  },

  // — Operación y pagos —
  { id: "valorOperacion", label: "Valor total de la operación (MXN)", tipo: "text", requerido: true, ayuda: "Ej. 2,400,000.00" },
  {
    id: "pagos", label: "Calendario de pagos", tipo: "lista", ayuda: "Agrega cada etapa (concepto, importe y momento).",
    subcampos: [
      { id: "concepto", label: "Concepto / etapa", tipo: "text" },
      { id: "monto", label: "Importe (MXN)", tipo: "text" },
      { id: "fecha", label: "Momento de pago", tipo: "text" },
    ],
  },

  { id: "lugarFirma", label: "Lugar de firma", tipo: "text", requerido: true },
  { id: "fechaFirma", label: "Fecha de firma", tipo: "date", requerido: true },
];

const cuerpo = `CONTRATO DE PRESTACIÓN DE SERVICIOS Y PROMESA DE COMPRAVENTA SOBRE GARANTÍAS HIPOTECARIAS

En la ciudad de {{lugarFirma}}, comparecen a la celebración del presente contrato: por una parte, DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V., por conducto de su apoderado(a) legal el (la) C. {{nombreApoderado}}, a quien se denominará «LA PROMITENTE VENDEDORA»; y por la otra, {{nombreCompradora}}, a quien se denominará «LA PROMITENTE COMPRADORA», al tenor de las siguientes declaraciones, estipulaciones y cláusulas:

DECLARACIONES

I. Declara LA PROMITENTE VENDEDORA, por conducto de su apoderado(a) legal:
a) Ser una sociedad mercantil legalmente constituida conforme a las leyes mexicanas, mediante escritura pública número 1,809, Volumen II, Libro 4, de fecha 20 de abril de 2022, otorgada ante la fe del Licenciado Luis Manuel Boucieguez Velarde, Notario Público número 256 de Mazatlán, Sinaloa, e inscrita en el Registro Público de Comercio de Mazatlán bajo el Folio Mercantil Electrónico N-2022029617.
b) Que su Registro Federal de Contribuyentes es DII2204206J5 y su domicilio social se encuentra en la Ciudad de Mazatlán, Sinaloa.
c) Que su apoderado(a) legal cuenta con las facultades suficientes y vigentes para obligarla en los términos del presente contrato.
d) Que conforme a su objeto social se dedica, entre otras actividades, a la adquisición y recuperación de bienes, derechos litigiosos y adjudicatarios, cartera vencida, garantías hipotecarias y bienes provenientes de remates y adjudicaciones judiciales.
e) Que es titular de los derechos litigiosos y adjudicatarios derivados del Juicio número {{numeroJuicio}}{{#numeroExhorto}} y del exhorto número {{numeroExhorto}} que de él emana{{/numeroExhorto}}, respecto de las garantías hipotecarias que se identifican en las Estipulaciones.
f) Que dentro de dicho procedimiento se encuentra reconocido su Apoderado General para Pleitos y Cobranzas, facultado para suscribir las cesiones a favor de LA PROMITENTE COMPRADORA.
g) Que la presente operación es real y se sustenta en actuaciones judiciales auténticas, sin que medie dolo, simulación ni mala fe de su parte.

II. Declara LA PROMITENTE COMPRADORA, bajo protesta de decir verdad:
a) Ser persona física de nacionalidad mexicana, mayor de edad, con plena capacidad jurídica para obligarse, con CURP/RFC {{curpCompradora}} y domicilio en {{domicilioCompradora}}.
b) Que conoce y comprende el estado procesal del juicio y del exhorto de los que derivan los derechos objeto de la operación, y que su perfeccionamiento depende del avance judicial y notarial, ajeno a la voluntad de LA PROMITENTE VENDEDORA.
{{#reestructuraApartado}}c) Que es su voluntad reestructurar la carta de apartado de fecha {{fechaApartado}} y obligarse en los términos del presente instrumento.{{/reestructuraApartado}}

III. Declaran AMBAS PARTES:
{{#reestructuraApartado}}a) Que el presente contrato deja sin efectos, sustituye y reestructura en su totalidad la carta de apartado de fecha {{fechaApartado}} celebrada respecto de la misma operación, reconociéndose y aplicándose los pagos ya realizados a la fecha.{{/reestructuraApartado}}
b) Que en su celebración no media error, dolo, violencia, lesión ni mala fe, reconociéndose recíprocamente la personalidad con que comparecen.

ESTIPULACIONES (FORMA DE PAGO)
La operación comprende las siguientes garantías hipotecarias{{#fraccionamiento}}, ubicadas en {{fraccionamiento}}{{/fraccionamiento}}:
{{#each garantias}}{{item.n}}. {{item.descripcion}} — $ {{item.valor}} MXN
{{/each garantias}}
El valor de la operación es de $ {{valorOperacion}} MXN. El calendario de pagos es el siguiente; el apartado se entiende como garantía de intención ya cubierta:
{{#each pagos}}{{item.n}}. {{item.concepto}} — $ {{item.monto}} MXN — {{item.fecha}}
{{/each pagos}}

CLÁUSULAS

PRIMERA. Objeto, identificación del expediente y estado actual. El presente contrato tiene un doble objeto:
a) Prestación de servicios. LA PROMITENTE VENDEDORA prestará a LA PROMITENTE COMPRADORA los servicios de gestión legal y notarial necesarios para regularizar las garantías hipotecarias identificadas en las Estipulaciones.
b) Promesa de compraventa. Agotado el procedimiento judicial y notarial y regularizadas las garantías, LA PROMITENTE VENDEDORA se obliga a celebrar con LA PROMITENTE COMPRADORA la compraventa —mediante la cesión y escrituración correspondiente— de dichas garantías, formalizándolas a su favor.
Identificación del expediente:
• Juicio: número {{numeroJuicio}}, radicado ante {{juzgadoOrigen}}.
{{#numeroExhorto}}• Exhorto: número {{numeroExhorto}}, turnado a {{juzgadoExhorto}}, para la ejecución y toma de posesión material y jurídica.{{/numeroExhorto}}
• Apoderado: el Juzgado reconoció el carácter de Apoderado General para Pleitos y Cobranzas de LA PROMITENTE VENDEDORA, facultado para suscribir las cesiones.
{{#estadoProcesal}}• Actuación actual: {{estadoProcesal}}.{{/estadoProcesal}}

SEGUNDA. Naturaleza del contrato. Las partes reconocen que esta operación versa sobre garantías hipotecarias derivadas de un procedimiento judicial, y que el presente es un contrato de prestación de servicios y de promesa de compraventa, que se rige por el Código Civil del Estado de Jalisco, el Código Civil Federal de aplicación supletoria y el Código de Comercio. El presente contrato no es traslativo de dominio ni perfecciona por sí mismo la compraventa; la propiedad se transmitirá únicamente mediante la escritura definitiva, una vez concluido el procedimiento judicial y regularizadas las garantías. En tanto ello no ocurra, LA PROMITENTE COMPRADORA no adquiere derecho real alguno.

TERCERA. Forma de pago. LA PROMITENTE COMPRADORA cubrirá el valor de la operación conforme al calendario de la sección de Estipulaciones, mediante depósito o transferencia a la cuenta que LA PROMITENTE VENDEDORA indique.

CUARTA. Procedimiento de la cesión y de la gestión notarial. El perfeccionamiento se desarrollará conforme al siguiente procedimiento, cuyos plazos son aproximados por depender del Juzgado y de las notarías:
1. A la firma de este contrato y cubierto el 35% de la operación, LA PROMITENTE VENDEDORA registra el pago y gira la instrucción notarial a la notaría que LA PROMITENTE COMPRADORA elija.
2. La notaría emite la cotización; en un plazo aproximado de ocho (8) días posteriores, LA PROMITENTE COMPRADORA liquida con anticipación el primer acto de cesión.
3. Liquidado lo anterior, el Apoderado General para Pleitos y Cobranzas suscribe las cesiones en firma conjunta (en masa), en un plazo aproximado de quince (15) días.
4. El apoderado presenta las minutas y escritos ante el Juzgado y realiza el apersonamiento de LA PROMITENTE COMPRADORA.
5. Cuando el Juzgado ordene la escrituración, LA PROMITENTE VENDEDORA comunica la liquidación correspondiente, más el porcentaje restante de honorarios y la totalidad de impuestos y derechos (Cláusula Sexta).
6. LA PROMITENTE COMPRADORA cubre el saldo cuando menos quince (15) días naturales antes de la fecha de desalojo (Cláusula Séptima).
7. El Juzgado señala la fecha de desalojo; la diligencia se ejecuta con la presencia de LA PROMITENTE COMPRADORA o persona de su confianza, quien recibe la posesión y las llaves.
8. Las partes comparecen ante la notaría para el otorgamiento de la escritura o cesión final, momento en que LA PROMITENTE COMPRADORA cubre el finiquito notarial.

QUINTA. Honorarios devengados. Pagos no reembolsables. LA PROMITENTE COMPRADORA reconoce que las cantidades entregadas se encuentran devengadas por concepto de la prestación de servicios de gestión de LA PROMITENTE VENDEDORA, conforme al artículo 2606 del Código Civil Federal, por lo que no podrá solicitar su devolución sino hasta la entrega de las garantías y hasta que el asunto procesal se encuentre resuelto.

SEXTA. Impuestos, derechos y gastos a cargo de LA PROMITENTE COMPRADORA. Serán por su cuenta, y deberán cubrirse antes de la firma respectiva, de manera enunciativa: el ISAI, los derechos registrales, los honorarios y gastos notariales, y los demás impuestos federales y estatales aplicables.

SÉPTIMA. Saldo previo al desalojo. El saldo deberá quedar íntegramente cubierto a más tardar quince (15) días naturales antes de la fecha de desalojo señalada por el Juzgado, como condición para recibir la posesión y las llaves.

OCTAVA. Entrega de posesión y estado de las garantías. Ejecutado el desalojo, LA PROMITENTE VENDEDORA entregará la posesión material y jurídica de las garantías en el estado físico en que se encuentren (cuerpo cierto), libres de ocupantes y de adeudos anteriores de agua, energía eléctrica y predial, que corren a cargo de LA PROMITENTE VENDEDORA hasta la fecha de entrega; a partir de ésta, corren por cuenta de LA PROMITENTE COMPRADORA.

NOVENA. Beneficios y acompañamiento para LA PROMITENTE COMPRADORA: la regularización de las garantías a su favor libres de contingencia; la entrega libre de ocupantes y de adeudos; y el acompañamiento de LA PROMITENTE VENDEDORA durante todo el proceso judicial y notarial.

DÉCIMA. Plazos sujetos a la autoridad judicial y notarial. Las fechas de firma, escrituración, desalojo y entrega son determinadas por el Juzgado y las notarías; el tiempo que tomen no es imputable a LA PROMITENTE VENDEDORA ni constituye incumplimiento de su parte.

DÉCIMA PRIMERA. Vigencia. El presente contrato surtirá efectos hasta la total conclusión del procedimiento judicial —al alcanzar la calidad de cosa juzgada— y su completa ejecución. Durante ese periodo, LA PROMITENTE COMPRADORA conserva los derechos derivados de la operación, sujeta al cumplimiento de sus pagos.

DÉCIMA SEGUNDA. Rescisión por falta de pago. El incumplimiento de cualquiera de los pagos en los plazos pactados será causa de rescisión inmediata, sin necesidad de declaración judicial previa ni requerimiento. En tal caso:
a) Las cantidades entregadas quedarán a favor de LA PROMITENTE VENDEDORA en concepto de pena convencional, que comprende daños y perjuicios (art. 1840 CCF), sin devolución ni reclamación adicional.
b) Las garantías y derechos quedarán liberados a favor de LA PROMITENTE VENDEDORA —aun cuando LA PROMITENTE COMPRADORA se hubiere apersonado ante el Juzgado— sin declaración judicial adicional.
c) No obstante, LA PROMITENTE VENDEDORA podrá, a su discreción, permitir la restitución del contrato si LA PROMITENTE COMPRADORA cubre las cantidades vencidas más una pena convencional del 15% del valor de la operación, que se incrementa por cada mes de demora.

DÉCIMA TERCERA. Protección de LA PROMITENTE COMPRADORA. Si la operación se frustra por causa imputable exclusivamente a LA PROMITENTE VENDEDORA, ésta devolverá íntegramente las cantidades entregadas, más una pena convencional del 10% a favor de LA PROMITENTE COMPRADORA, y una compensación civil por espera del 5% anual sobre las cantidades a devolver, que se incrementa por cada anualidad hasta su pago total.

DÉCIMA CUARTA. Buena fe y reserva de acciones. El simple incumplimiento de pago tiene naturaleza civil. Únicamente ante dolo real y comprobado (falsedad, simulación o engaño) de cualquiera de las partes, la afectada se reserva las acciones civiles y, en su caso, penales que correspondan.

DÉCIMA QUINTA. Caso fortuito o fuerza mayor. Ninguna parte será responsable por retraso o incumplimiento derivado de caso fortuito, fuerza mayor o determinaciones judiciales o notariales ajenas a su voluntad; los plazos se prorrogarán por el tiempo del impedimento.

DÉCIMA SEXTA. Cambio de titular. Si LA PROMITENTE COMPRADORA desea cambiar al titular de alguna garantía, deberá solicitarlo por escrito y cubrir únicamente el costo del cambio de contrato y de la carta de apartado, sin afectar el avance del procedimiento.

DÉCIMA SÉPTIMA. Confidencialidad y datos personales. Las partes guardarán confidencialidad. LA PROMITENTE VENDEDORA tratará los datos personales de LA PROMITENTE COMPRADORA únicamente para los fines del presente contrato, conforme a la LFPDPPP.

DÉCIMA OCTAVA. Domicilios y notificaciones. Las partes señalan como domicilios los asentados en el presente. Cualquier cambio se notificará por escrito con cinco (5) días de anticipación.

DÉCIMA NOVENA. Legislación aplicable y jurisdicción. Se rige por el Código Civil del Estado de Jalisco, el Código Civil Federal supletorio y el Código de Comercio. Las partes se someten a la jurisdicción de los tribunales competentes de {{lugarFirma}}, renunciando a cualquier otro fuero.

VIGÉSIMA. Acuerdo total. Este contrato contiene la totalidad de los acuerdos entre las partes y deja sin efecto cualquier convenio previo sobre la misma materia. Cualquier modificación deberá constar por escrito y firmada por ambas partes.

Leído que fue el presente contrato y enteradas las partes de su contenido, valor y alcance legal, lo firman de conformidad por duplicado en {{lugarFirma}}, a {{fechaFirma}}.


____________________________              ____________________________
   LA PROMITENTE VENDEDORA                 LA PROMITENTE COMPRADORA
     {{nombreApoderado}}                       {{nombreCompradora}}
 (DIIPA, S.A. de C.V.)`;

export const prestacionPromesa: PlantillaContrato = {
  tipo: "prestacion_promesa",
  nombre: "Prestación de Servicios + Promesa de Compraventa (garantías)",
  descripcion: "Prestación de servicios y promesa de compraventa sobre garantías hipotecarias, con lista de garantías y calendario de pagos.",
  campos,
  cuerpo,
};

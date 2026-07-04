import type { PlantillaContrato, PlantillaCampo } from "./contract-templates";

// Campos que cambian según la operación / la cesionaria.
const campos: PlantillaCampo[] = [
  // — Cesionaria —
  { id: "nombreCesionaria", label: "Nombre completo de LA CESIONARIA", tipo: "text", requerido: true },
  { id: "rfcCesionaria", label: "RFC / CURP de LA CESIONARIA", tipo: "text" },
  { id: "domicilioCesionaria", label: "Domicilio de LA CESIONARIA", tipo: "textarea" },
  { id: "identificacionCesionaria", label: "Identificación de LA CESIONARIA (INE/pasaporte y folio)", tipo: "text" },
  { id: "estadoCivilCesionaria", label: "Estado civil de LA CESIONARIA", tipo: "select", opciones: ["soltero(a)", "casado(a)", "divorciado(a)", "viudo(a)"] },
  { id: "cesionariaPorApoderado", label: "¿LA CESIONARIA comparece por apoderado?", tipo: "checkbox" },
  { id: "nombreApoderadoCesionaria", label: "Nombre del apoderado de LA CESIONARIA", tipo: "text", dependeDe: { campo: "cesionariaPorApoderado", valor: true } },
  { id: "poderApoderadoCesionaria", label: "Instrumento del poder (No., Notario, Plaza)", tipo: "text", dependeDe: { campo: "cesionariaPorApoderado", valor: true } },

  // — Cedente (DIIPA) —
  { id: "nombreApoderado", label: "Apoderado(a) de LA CEDENTE que firma", tipo: "text", requerido: true, ayuda: "Apoderado General para Pleitos y Cobranzas" },
  { id: "rfcCedente", label: "RFC de LA CEDENTE (DIIPA)", tipo: "text" },
  { id: "domicilioFiscalCedente", label: "Domicilio fiscal de LA CEDENTE", tipo: "textarea" },

  // — Reestructura del contrato anterior —
  { id: "esReestructura", label: "¿Reestructura un contrato anterior?", tipo: "checkbox" },
  { id: "folioContratoAnterior", label: "Folio del contrato anterior", tipo: "text", dependeDe: { campo: "esReestructura", valor: true } },
  { id: "fechaContratoAnterior", label: "Fecha del contrato anterior", tipo: "text", dependeDe: { campo: "esReestructura", valor: true } },

  // — Expediente / proceso —
  { id: "numeroJuicio", label: "Número de juicio", tipo: "text", requerido: true, ayuda: "Ej. 1393/2017" },
  { id: "juzgadoOrigen", label: "Juzgado de origen (donde se obtuvo la adjudicación)", tipo: "textarea", requerido: true, ayuda: "Ej. Juzgado Octavo de Jurisdicción Concurrente… Nuevo León" },
  { id: "numeroExhorto", label: "Número de exhorto", tipo: "text", ayuda: "Ej. 82/2026" },
  { id: "juzgadoExhorto", label: "Juzgado del exhorto (ejecución / desalojo)", tipo: "text", ayuda: "Ej. Juzgado Primero de lo Civil de Tlajomulco" },
  { id: "ubicacionGarantia", label: "Ubicación / identificación (si es una sola garantía)", tipo: "textarea", ayuda: "Opcional si usas la lista de abajo" },
  {
    id: "garantias", label: "Garantía(s) de la operación", tipo: "lista", ayuda: "Agrega una o varias garantías (descripción y valor).",
    subcampos: [
      { id: "descripcion", label: "Descripción / ubicación", tipo: "text" },
      { id: "valor", label: "Valor (MXN)", tipo: "text" },
    ],
  },
  { id: "estadoProcesal", label: "Estado procesal actual", tipo: "textarea", ayuda: "Ej. aceptados los honorarios del perito valuador…" },

  // — Operación y pagos —
  { id: "valorOperacion", label: "Valor de la operación (MXN)", tipo: "text", requerido: true, ayuda: "Ej. 2,000,000.00" },
  {
    id: "pagos", label: "Calendario de pagos", tipo: "lista", ayuda: "Agrega cada pago (concepto, monto y fecha).",
    subcampos: [
      { id: "concepto", label: "Concepto", tipo: "text" },
      { id: "monto", label: "Monto (MXN)", tipo: "text" },
      { id: "fecha", label: "Fecha / condición", tipo: "text" },
    ],
  },

  { id: "lugarFirma", label: "Lugar de firma", tipo: "text", requerido: true },
  { id: "fechaFirma", label: "Fecha de firma", tipo: "date", requerido: true },
];

const cuerpo = `CONTRATO DE {{#esReestructura}}REESTRUCTURACIÓN DE {{/esReestructura}}CESIÓN DE DERECHOS LITIGIOSOS Y ADJUDICATARIOS SOBRE GARANTÍA HIPOTECARIA

En la ciudad de {{lugarFirma}}, comparecen a la celebración del presente contrato: por una parte, DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V., por conducto de su apoderado(a) legal el (la) C. {{nombreApoderado}}, a quien se denominará «LA CEDENTE»; y por la otra, {{nombreCesionaria}}{{#cesionariaPorApoderado}}, representada en este acto por su apoderado(a) el (la) C. {{nombreApoderadoCesionaria}}, según consta en {{poderApoderadoCesionaria}}{{/cesionariaPorApoderado}}, a quien se denominará «LA CESIONARIA», al tenor de las siguientes declaraciones, estipulaciones y cláusulas:

DECLARACIONES

I. Declara LA CEDENTE, por conducto de su apoderado(a) legal:
a) Ser una sociedad mercantil legalmente constituida conforme a las leyes mexicanas, mediante escritura pública número 1,809, Volumen II, Libro 4, de fecha 20 de abril de 2022, otorgada ante la fe del Licenciado Luis Manuel Boucieguez Velarde, Notario Público número 256 de Mazatlán, Sinaloa, e inscrita en el Registro Público de Comercio de Mazatlán bajo el Folio Mercantil Electrónico N-2022029617.
b) Que su domicilio social se encuentra en la Ciudad de Mazatlán, Sinaloa; su Registro Federal de Contribuyentes es {{rfcCedente}} y su domicilio fiscal el ubicado en {{domicilioFiscalCedente}}.
c) Que su apoderado(a) legal cuenta con las facultades suficientes y vigentes para obligarla en los términos del presente contrato.
d) Que conforme a su objeto social se dedica, entre otras actividades, a la adquisición y recuperación de bienes, derechos litigiosos y adjudicatarios, cartera vencida, garantías hipotecarias y bienes provenientes de remates y adjudicaciones judiciales.
e) Que es titular de los derechos litigiosos y adjudicatarios derivados del Juicio número {{numeroJuicio}}{{#numeroExhorto}} y del exhorto número {{numeroExhorto}} que de él emana{{/numeroExhorto}}, respecto de la garantía hipotecaria que se identifica al calce.
f) Que dentro de dicho procedimiento se encuentra reconocido su Apoderado General para Pleitos y Cobranzas, facultado para suscribir las cesiones a favor de LA CESIONARIA.
g) Que la presente operación es real y se sustenta en actuaciones judiciales auténticas, sin que medie dolo, simulación ni mala fe de su parte.

II. Declara LA CESIONARIA, bajo protesta de decir verdad:
a) Ser persona con plena capacidad jurídica para obligarse. Sus generales: identificación {{identificacionCesionaria}}, RFC/CURP {{rfcCesionaria}}, estado civil {{estadoCivilCesionaria}}, con domicilio en {{domicilioCesionaria}}.
b) Que conoce y comprende el estado procesal del juicio y del exhorto de los que derivan los derechos objeto de la cesión, y que su perfeccionamiento depende del avance judicial y notarial, ajeno a la voluntad de LA CEDENTE.
{{#esReestructura}}c) Que es su voluntad reestructurar el contrato anterior (folio {{folioContratoAnterior}}, de fecha {{fechaContratoAnterior}}) y obligarse en los términos del presente instrumento.{{/esReestructura}}

III. Declaran AMBAS PARTES:
{{#esReestructura}}a) Que el presente contrato deja sin efectos, sustituye y reestructura en su totalidad el contrato anterior celebrado respecto de la misma operación, reconociéndose y aplicándose los pagos ya realizados a la fecha.{{/esReestructura}}
b) Que en su celebración no media error, dolo, violencia, lesión ni mala fe, reconociéndose recíprocamente la personalidad con que comparecen.

ESTIPULACIONES (FORMA DE PAGO)
{{#ubicacionGarantia}}Garantía objeto de la operación: {{ubicacionGarantia}}.
{{/ubicacionGarantia}}{{#each garantias}}{{item.n}}. {{item.descripcion}} — $ {{item.valor}} MXN
{{/each garantias}}El valor de la operación es de $ {{valorOperacion}} MXN. El calendario de pagos es el siguiente; el apartado se entiende como garantía de intención ya cubierta:
{{#each pagos}}{{item.n}}. {{item.concepto}} — $ {{item.monto}} MXN — {{item.fecha}}
{{/each pagos}}

CLÁUSULAS

PRIMERA. LA CEDENTE cede a LA CESIONARIA los derechos litigiosos y adjudicatarios de que es titular respecto de la garantía hipotecaria identificada al calce, y se obliga a realizar las gestiones necesarias para que, agotado el procedimiento judicial y notarial correspondiente, dicha garantía quede formalizada a favor de LA CESIONARIA.
Identificación del expediente y estado actual:
• Juicio: número {{numeroJuicio}}, radicado ante {{juzgadoOrigen}}.
{{#numeroExhorto}}• Exhorto: número {{numeroExhorto}}, turnado a {{juzgadoExhorto}}, para la ejecución y la toma de posesión material y jurídica.{{/numeroExhorto}}
• Garantía(s): {{#ubicacionGarantia}}{{ubicacionGarantia}}. {{/ubicacionGarantia}}{{#each garantias}}{{item.descripcion}} ($ {{item.valor}}); {{/each garantias}}
• Apoderado: el Juzgado reconoció el carácter de Apoderado General para Pleitos y Cobranzas de LA CEDENTE, facultado para suscribir las cesiones.
{{#estadoProcesal}}• Actuación actual: {{estadoProcesal}}.{{/estadoProcesal}}

SEGUNDA. Las partes reconocen que esta operación versa sobre garantías hipotecarias y derechos litigiosos y adjudicatarios, y no sobre la transmisión directa de una propiedad. Se rige por el Código Civil del Estado de Jalisco, el Código Civil Federal de aplicación supletoria y el Código de Comercio. El presente contrato no es traslativo de dominio, no acredita por sí mismo la titularidad de la garantía ni perfecciona la cesión de manera definitiva, lo cual queda sujeto a la conclusión del procedimiento judicial; en tanto ello no ocurra, LA CESIONARIA no adquiere derecho real alguno.

TERCERA. LA CESIONARIA cubrirá el valor de la operación conforme al calendario de la sección de Estipulaciones, en las fechas y montos ahí señalados, mediante depósito o transferencia a la cuenta que LA CEDENTE indique.

CUARTA. Procedimiento de la cesión y de la gestión notarial. El perfeccionamiento de la cesión se desarrollará conforme al siguiente procedimiento, cuyos plazos son aproximados por depender del Juzgado y de las notarías:
1. A la firma de este contrato y cubierto el 35% de la operación, LA CEDENTE registra el pago y gira la instrucción notarial a la notaría que LA CESIONARIA elija.
2. La notaría emite la cotización; en un plazo aproximado de ocho (8) días posteriores, LA CESIONARIA liquida con anticipación el primer acto de cesión.
3. Liquidado lo anterior, el Apoderado General para Pleitos y Cobranzas de LA CEDENTE suscribe las cesiones en firma conjunta (en masa), en un plazo aproximado de quince (15) días.
4. El apoderado presenta las minutas y escritos ante el Juzgado y realiza el apersonamiento de LA CESIONARIA.
5. Cuando el Juzgado ordene la escrituración, LA CEDENTE comunica la liquidación correspondiente, más el porcentaje restante de honorarios y la totalidad de impuestos y derechos aplicables (Cláusula Sexta).
6. LA CESIONARIA cubre el saldo cuando menos quince (15) días naturales antes de la fecha de desalojo (Cláusula Séptima).
7. El Juzgado señala la fecha de desalojo; la diligencia se ejecuta con la presencia de LA CESIONARIA o persona de su confianza, quien recibe la posesión y las llaves.
8. Las partes comparecen ante la notaría para el otorgamiento de la escritura o cesión final, momento en que LA CESIONARIA cubre el finiquito notarial.

QUINTA. Honorarios devengados. Pagos no reembolsables. LA CESIONARIA reconoce y acepta que las cantidades entregadas se encuentran devengadas por concepto de honorarios y gestión de LA CEDENTE, conforme al artículo 2606 del Código Civil Federal. La gestión de LA CEDENTE es independiente de los costos notariales y de los impuestos.

SEXTA. Impuestos, derechos y gastos a cargo de LA CESIONARIA. Serán por cuenta de LA CESIONARIA, y deberán cubrirse antes de la firma respectiva, de manera enunciativa: el Impuesto Sobre Adquisición de Inmuebles (ISAI), los derechos registrales, los honorarios y gastos notariales, y los demás impuestos federales y estatales aplicables.

SÉPTIMA. Saldo previo al desalojo. El saldo deberá quedar íntegramente cubierto a más tardar quince (15) días naturales antes de la fecha de desalojo señalada por el Juzgado, como condición para recibir la posesión y las llaves.

OCTAVA. Entrega de posesión y estado de la garantía. Ejecutado el desalojo, LA CEDENTE entregará la posesión material y jurídica en el estado físico en que se encuentre (cuerpo cierto), libre de ocupantes y de adeudos anteriores de agua, energía eléctrica y predial, que corren a cargo de LA CEDENTE hasta la fecha de entrega; a partir de ésta, corren por cuenta de LA CESIONARIA.

NOVENA. Beneficios y acompañamiento para LA CESIONARIA: la regularización de la garantía a su favor libre de contingencia; la entrega libre de ocupantes y adeudos; y el acompañamiento de LA CEDENTE durante todo el proceso judicial y notarial.

DÉCIMA. Plazos sujetos a la autoridad judicial y notarial. Las fechas de firma, escrituración, desalojo y entrega son determinadas por el Juzgado y las notarías; el tiempo que tomen no es imputable a LA CEDENTE ni constituye incumplimiento de su parte.

DÉCIMA PRIMERA. Vigencia. El presente contrato surtirá efectos hasta la total conclusión del procedimiento judicial —al alcanzar la calidad de cosa juzgada— y su completa ejecución. Durante ese periodo, LA CESIONARIA conserva los derechos de la cesión, sujeta al cumplimiento de sus pagos.

DÉCIMA SEGUNDA. Incumplimiento de LA CESIONARIA: regularización o reversión.
a) Regularización. Si deja de cubrir algún pago, podrá regularizarse cubriendo el monto vencido más una pena convencional del 15% del valor de la operación (art. 1840 CCF y relativos del Código Civil de Jalisco); la pena se incrementa por cada mes de demora. Cubierta, el contrato se mantiene en vigor.
b) Reversión. Si no regulariza ni atiende los requerimientos, las cantidades entregadas quedarán a favor de LA CEDENTE como pena convencional (que comprende daños y perjuicios, art. 1840 CCF), y la cesión revertirá a favor de LA CEDENTE —aun cuando se hubiere apersonado ante el Juzgado— sin necesidad de declaración judicial adicional.

DÉCIMA TERCERA. Protección de LA CESIONARIA. Si la operación se frustra por causa imputable exclusivamente a LA CEDENTE, ésta devolverá íntegramente las cantidades entregadas, más una pena convencional del 10% a favor de LA CESIONARIA, así como una compensación civil por espera del 5% anual sobre las cantidades a devolver, que se incrementa por cada anualidad hasta su pago total.

DÉCIMA CUARTA. Buena fe y reserva de acciones. El simple incumplimiento de pago tiene naturaleza civil. Únicamente ante dolo real y comprobado (falsedad, simulación o engaño) de cualquiera de las partes, la afectada se reserva las acciones civiles y, en su caso, penales que correspondan.

DÉCIMA QUINTA. Caso fortuito o fuerza mayor. Ninguna parte será responsable por retraso o incumplimiento derivado de caso fortuito, fuerza mayor o determinaciones judiciales o notariales ajenas a su voluntad; los plazos se prorrogarán por el tiempo del impedimento.

DÉCIMA SEXTA. Cambio de titular. Si LA CESIONARIA desea cambiar al titular, deberá solicitarlo por escrito y cubrir únicamente el costo del cambio de contrato y de la carta de apartado, sin afectar el avance del procedimiento.

DÉCIMA SÉPTIMA. Confidencialidad y datos personales. Las partes guardarán confidencialidad. LA CEDENTE tratará los datos personales de LA CESIONARIA únicamente para los fines del presente contrato, conforme a la LFPDPPP.

DÉCIMA OCTAVA. Domicilios y notificaciones. Las partes señalan como domicilios los asentados al calce. Cualquier cambio se notificará por escrito con cinco (5) días de anticipación.

DÉCIMA NOVENA. Legislación aplicable y jurisdicción. Se rige por el Código Civil del Estado de Jalisco, el Código Civil Federal supletorio y el Código de Comercio. Las partes se someten a la jurisdicción de los tribunales competentes de {{lugarFirma}}, renunciando a cualquier otro fuero.

VIGÉSIMA. Acuerdo total. Este contrato contiene la totalidad de los acuerdos entre las partes y deja sin efecto cualquier convenio previo sobre la misma materia. Cualquier modificación deberá constar por escrito y firmada por ambas partes.

Leído que fue el presente contrato y enteradas las partes de su contenido, valor y alcance legal, lo firman de conformidad por duplicado en {{lugarFirma}}, a {{fechaFirma}}.


____________________________              ____________________________
        LA CEDENTE                                LA CESIONARIA
   {{nombreApoderado}}                        {{nombreCesionaria}}
 (DIIPA, S.A. de C.V.)`;

export const cesionReestructura: PlantillaContrato = {
  tipo: "cesion_reestructura",
  nombre: "Cesión / Reestructuración de Derechos sobre Garantía",
  descripcion: "Cesión de derechos litigiosos y adjudicatarios sobre garantía hipotecaria (con opción de reestructura del contrato anterior).",
  campos,
  cuerpo,
};

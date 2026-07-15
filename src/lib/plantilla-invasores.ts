// ============================================================================
//  Contrato de Prestación de Servicios y Promesa de Compraventa — INVASORES
//  --------------------------------------------------------------------------
//  Versión corta, de UN solo inmueble (no lista de garantías), para
//  regularizar a personas que ya están en posesión del inmueble (invasores)
//  y se les formaliza como promitentes compradoras. Distinto del machote
//  "prestacion_promesa" (ese es el largo, con lista de varias garantías,
//  para clientes que compran desde cero). El apoderado de DIIPA se
//  auto-llena con el Selector de Apoderado de siempre.
// ============================================================================
import type { PlantillaContrato, PlantillaCampo } from "./contract-templates";
import { testigosCampo } from "./contract-campos-cliente";

const campos: PlantillaCampo[] = [
  // — Compradora (la persona que ya está en posesión del inmueble) —
  { id: "nombreCompradora", label: "Nombre completo de LA PROMITENTE COMPRADORA", tipo: "text", requerido: true },
  { id: "curpCompradora", label: "CURP de LA COMPRADORA", tipo: "text" },
  { id: "rfcCompradora", label: "RFC de LA COMPRADORA", tipo: "text" },
  { id: "domicilioCompradora", label: "Domicilio de LA COMPRADORA", tipo: "textarea" },
  { id: "compradoraPorApoderado", label: "¿LA COMPRADORA comparece por apoderado?", tipo: "checkbox" },
  { id: "nombreApoderadoCompradora", label: "Nombre del apoderado de LA COMPRADORA", tipo: "text", dependeDe: { campo: "compradoraPorApoderado", valor: true } },
  { id: "poderApoderadoCompradora", label: "Instrumento del poder (No., Notario, Plaza)", tipo: "text", dependeDe: { campo: "compradoraPorApoderado", valor: true } },

  // — El inmueble (uno solo) —
  { id: "calleInmueble", label: "Calle", tipo: "text", requerido: true },
  { id: "numeroInmueble", label: "Número", tipo: "text" },
  { id: "manzana", label: "Manzana", tipo: "text" },
  { id: "lote", label: "Lote", tipo: "text" },
  { id: "fraccionamiento", label: "Fraccionamiento / municipio", tipo: "text", valorInicial: "Fraccionamiento Residencial San Antonio, Tlajomulco de Zúñiga, Jalisco" },

  // — Expediente de origen —
  { id: "numeroJuicio", label: "Número de juicio", tipo: "text", valorInicial: "1393/2017" },
  { id: "juzgadoOrigen", label: "Juzgado de origen", tipo: "textarea", valorInicial: "Juzgado Octavo de Jurisdicción Concurrente del Primer Distrito Judicial del Estado de Nuevo León" },
  { id: "numeroExhorto", label: "Número de exhorto", tipo: "text", valorInicial: "82/2026" },
  { id: "juzgadoExhorto", label: "Juzgado del exhorto", tipo: "text", valorInicial: "Juzgado Primero de lo Civil del Trigésimo Primer Partido Judicial del Estado de Jalisco" },

  // — Precio y forma de pago (Apartado + 85% + Pago final) —
  { id: "precioTotal", label: "Precio total de la operación (con letra y número)", tipo: "text", requerido: true, ayuda: "Ej. $330,000.00 (TRESCIENTOS TREINTA MIL PESOS 00/100 M.N.)" },
  { id: "montoApartado", label: "A) Apartado — importe (con letra y número)", tipo: "text", ayuda: "Ej. $40,000.00 (CUARENTA MIL PESOS 00/100 M.N.)" },
  { id: "montoSegundoPago", label: "B) Segundo pago (85%) — importe (con letra y número)", tipo: "text" },
  { id: "montoPagoFinal", label: "C) Pago final — importe (con letra y número)", tipo: "text" },

  // — Firma —
  { id: "lugarFirma", label: "Lugar de firma", tipo: "text", requerido: true, valorInicial: "Tlajomulco de Zúñiga, Jalisco" },
  { id: "fechaFirma", label: "Fecha de firma", tipo: "text", requerido: true, ayuda: "Ej. 15 de julio de 2026" },
  ...testigosCampo,
];

const cuerpo = `CONTRATO DE PRESTACIÓN DE SERVICIOS Y PROMESA DE COMPRAVENTA SOBRE DERECHOS DERIVADOS DE PROCEDIMIENTO JUDICIAL

QUE CELEBRAN POR UNA PARTE DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V., REPRESENTADA EN ESTE ACTO POR SU APODERADO {{apoderadoCargo}} C. {{apoderadoNombre}}, A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ "LA PROMITENTE VENDEDORA"; Y POR LA OTRA PARTE {{nombreCompradora}}{{#compradoraPorApoderado}}, REPRESENTADA EN ESTE ACTO POR SU APODERADO(A) EL (LA) C. {{nombreApoderadoCompradora}}, SEGÚN CONSTA EN {{poderApoderadoCompradora}}{{/compradoraPorApoderado}}, A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ "LA PROMITENTE COMPRADORA"; AL TENOR DE LAS SIGUIENTES DECLARACIONES Y CLÁUSULAS:

DECLARACIONES

I. Declara LA PROMITENTE VENDEDORA:

a) Que es una sociedad mercantil legalmente constituida conforme a las leyes mexicanas, denominada DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V.

b) Que su representante legal cuenta con facultades suficientes para celebrar el presente contrato.

c) Que dentro de su objeto social se encuentra la adquisición, administración, regularización, recuperación y comercialización de derechos litigiosos, garantías hipotecarias, bienes adjudicados y derechos derivados de procedimientos judiciales.

d) Que los derechos objeto del presente contrato derivan del Juicio Ordinario Mercantil número {{numeroJuicio}}, radicado ante el {{juzgadoOrigen}}, así como del Exhorto número {{numeroExhorto}}, tramitado ante el {{juzgadoExhorto}}.

e) Que respecto del inmueble objeto del presente contrato cuenta con los derechos derivados del procedimiento judicial antes señalado y tiene interés en su regularización y futura transmisión conforme a derecho.

II. Declara LA PROMITENTE COMPRADORA:

a) Ser persona física con capacidad legal para obligarse.
Nombre: {{nombreCompradora}}
CURP: {{curpCompradora}}
RFC: {{rfcCompradora}}
Domicilio: {{domicilioCompradora}}

b) Que conoce que el inmueble objeto del presente contrato deriva de un procedimiento judicial y que la formalización definitiva depende de la conclusión de los actos legales, judiciales y notariales correspondientes.

c) Que manifiesta haber recibido información suficiente respecto del estado jurídico del inmueble.

d) Que reconoce que, previo a la celebración del presente instrumento, no cuenta con escritura pública inscrita a su favor ni con título de propiedad respecto del inmueble objeto de la operación.

e) Que es su voluntad celebrar el presente contrato con la finalidad de adquirir y regularizar jurídicamente la situación del inmueble.

CLÁUSULAS

PRIMERA. OBJETO DEL CONTRATO.

El presente contrato tiene por objeto establecer las bases para la futura transmisión de los derechos correspondientes respecto del inmueble ubicado en:
Calle: {{calleInmueble}}
Número: {{numeroInmueble}}
Manzana: {{manzana}}   Lote: {{lote}}
{{fraccionamiento}}.

La operación deriva del procedimiento judicial señalado en las declaraciones del presente contrato.

SEGUNDA. RECONOCIMIENTO DEL ESTADO JURÍDICO.

LA PROMITENTE COMPRADORA reconoce expresamente que conoce el origen judicial del inmueble, así como la existencia del procedimiento referido.

Asimismo manifiesta que la celebración del presente contrato constituye una decisión voluntaria para regularizar su situación jurídica y adquirir los derechos correspondientes conforme a los términos pactados.

TERCERA. PRECIO DE LA OPERACIÓN.

El precio total pactado por las partes es la cantidad de:
{{precioTotal}}

CUARTA. FORMA DE PAGO.

El precio será cubierto de la siguiente manera:

A) APARTADO. LA PROMITENTE COMPRADORA entrega en este acto la cantidad de {{montoApartado}} por concepto de apartado y anticipo a cuenta del precio total.

B) SEGUNDO PAGO. La cantidad de {{montoSegundoPago}}, equivalente al 85% del precio total, será cubierta conforme al avance del procedimiento y a la solicitud de LA PROMITENTE VENDEDORA.

C) PAGO FINAL. La cantidad restante de {{montoPagoFinal}} será cubierta al momento de la formalización definitiva mediante escritura pública o instrumento jurídico correspondiente.

QUINTA. ENTREGA Y RESPONSABILIDAD DEL INMUEBLE.

Una vez autorizada la entrega material del inmueble, LA PROMITENTE COMPRADORA asumirá la conservación, custodia, servicios, contribuciones y gastos derivados del uso del mismo.

LA PROMITENTE COMPRADORA manifiesta haber inspeccionado el inmueble y conocer su estado físico.

SEXTA. CONDICIÓN DE TRANSMISIÓN.

Las partes acuerdan que el presente contrato no transmite por sí mismo la propiedad.

La transmisión definitiva quedará condicionada al pago total del precio y a la realización de los actos jurídicos, judiciales y notariales necesarios.

Mientras no se cumplan dichas condiciones, LA PROMITENTE COMPRADORA no podrá transmitir, vender, gravar o ceder derechos sobre el inmueble sin autorización escrita de LA PROMITENTE VENDEDORA.

SÉPTIMA. INCUMPLIMIENTO.

En caso de incumplimiento de pago por parte de LA PROMITENTE COMPRADORA, LA PROMITENTE VENDEDORA podrá solicitar la rescisión del presente contrato y ejercer las acciones legales correspondientes.

Las cantidades entregadas podrán aplicarse a cubrir gastos, gestiones, daños y afectaciones derivados del incumplimiento, conforme a derecho.

OCTAVA. GASTOS DE ESCRITURACIÓN.

Los impuestos, derechos, honorarios notariales y gastos necesarios para la formalización definitiva serán cubiertos por LA PROMITENTE COMPRADORA, salvo pacto distinto por escrito.

NOVENA. ACEPTACIÓN DEL ESTADO JURÍDICO.

LA PROMITENTE COMPRADORA declara que comprende que la operación deriva de un procedimiento judicial y que los tiempos de formalización pueden depender de autoridades judiciales y notariales.

DÉCIMA. JURISDICCIÓN.

Para la interpretación y cumplimiento del presente contrato, las partes se sujetan a las leyes aplicables del Estado de Jalisco, sin afectar las competencias legales del juzgado que conoce del procedimiento judicial de origen.

Leído que fue el presente contrato y enteradas las partes de su contenido y alcance legal, lo firman por duplicado:

{{lugarFirma}}, a {{fechaFirma}}.

LA PROMITENTE VENDEDORA                    LA PROMITENTE COMPRADORA

DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V.

{{apoderadoNombre}}                        {{nombreCompradora}}

{{#hayTestigos}}
TESTIGOS DESIGNADOS
{{#each testigos}}{{item.n}}. {{item.nombre}}   {{item.identificacion}}
{{/each testigos}}{{/hayTestigos}}

_______________________________          _______________________________
TESTIGO                                   TESTIGO`;

export const promesaInvasores: PlantillaContrato = {
  tipo: "promesa_invasores",
  nombre: "Prestación de Servicios + Promesa de Compraventa (invasores)",
  descripcion: "Versión corta, de un solo inmueble, para regularizar a personas que ya están en posesión del inmueble (invasores) y se formalizan como promitentes compradoras. Apoderado auto-llenado.",
  campos,
  cuerpo,
};

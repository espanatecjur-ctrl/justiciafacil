// JusticiaFácil · Catálogo de etapas procesales por tipo de juicio
// Cada tipo tiene dos versiones: "oral" (sistema nuevo CNPCF) y "escrita" (tradicional).
// El modal de "Seguimiento del juicio" lee este catálogo según el tipo del expediente.
//
// NOTA: Es un borrador técnico para revisión de la abogada (Paola). Las etapas y los
// documentos esperados se pueden ajustar; este archivo es la única fuente del catálogo.

export type ActoTipo = "promocion" | "acuerdo" | "audiencia" | "acta" | "resolucion";

export interface DocEsperado {
  nombre: string;        // qué documento debe existir
  acto: ActoTipo;        // promoción (la mete la parte) / acuerdo (lo da el juzgado) / etc.
  obligatorio?: boolean; // si es indispensable de la etapa
}

export interface EtapaJuicio {
  clave: string;         // id corto y único dentro del tipo
  nombre: string;        // nombre visible
  fase: string;          // agrupador (Postulatoria, Audiencia Preliminar, Juicio, Ejecución…)
  resumen?: string;      // 1 línea de qué pasa aquí
  docs: DocEsperado[];   // documentos que deberían existir en esta etapa
}

export interface TipoJuicio {
  clave: string;         // id del tipo+versión, ej. "ordinario_civil_oral"
  tipo: string;          // ej. "Ordinario Civil"
  via: "oral" | "escrita";
  ley: string;           // fundamento
  etapas: EtapaJuicio[];
}

// =====================================================================
// 1) ORDINARIO CIVIL — ORAL (CNPCF)
// =====================================================================
const ordinarioCivilOral: TipoJuicio = {
  clave: "ordinario_civil_oral",
  tipo: "Ordinario Civil",
  via: "oral",
  ley: "Código Nacional de Procedimientos Civiles y Familiares (CNPCF)",
  etapas: [
    {
      clave: "demanda", nombre: "Presentación de la demanda", fase: "Postulatoria",
      resumen: "Prestaciones, hechos y derecho. Se ofrecen TODAS las pruebas desde aquí (o precluye).",
      docs: [
        { nombre: "Escrito inicial de demanda", acto: "promocion", obligatorio: true },
        { nombre: "Documento(s) base de la acción", acto: "promocion", obligatorio: true },
        { nombre: "Ofrecimiento de pruebas (anexo)", acto: "promocion", obligatorio: true },
      ],
    },
    {
      clave: "admision", nombre: "Auto admisorio / prevención", fase: "Postulatoria",
      resumen: "El juzgado admite, previene (si hay omisión subsanable) o desecha.",
      docs: [
        { nombre: "Auto admisorio", acto: "acuerdo", obligatorio: true },
        { nombre: "Cumplimiento de prevención (si la hubo)", acto: "promocion" },
      ],
    },
    {
      clave: "emplazamiento", nombre: "Emplazamiento", fase: "Postulatoria",
      resumen: "Notificación personal al demandado para que comparezca a juicio.",
      docs: [
        { nombre: "Razón / acta de emplazamiento del actuario", acto: "acta", obligatorio: true },
      ],
    },
    {
      clave: "contestacion", nombre: "Contestación y reconvención", fase: "Postulatoria",
      resumen: "El demandado contesta hecho por hecho, opone excepciones y ofrece sus pruebas. Si reconviene, el actor contesta la reconvención.",
      docs: [
        { nombre: "Escrito de contestación (o acuse de rebeldía)", acto: "promocion", obligatorio: true },
        { nombre: "Escrito de reconvención (si la hay)", acto: "promocion" },
        { nombre: "Contestación a la reconvención (si la hay)", acto: "promocion" },
      ],
    },
    {
      clave: "vista_contestacion", nombre: "Vista con la contestación", fase: "Postulatoria",
      resumen: "Se da vista al actor para manifestar lo que a su derecho convenga.",
      docs: [
        { nombre: "Acuerdo que da vista", acto: "acuerdo" },
        { nombre: "Escrito de desahogo de vista", acto: "promocion" },
      ],
    },
    {
      clave: "audiencia_preliminar", nombre: "Audiencia preliminar", fase: "Audiencia preliminar (oral)",
      resumen: "Depuración, conciliación/mediación, hechos no controvertidos, acuerdos probatorios y admisión de pruebas.",
      docs: [
        { nombre: "Acuerdo que cita a audiencia preliminar", acto: "acuerdo" },
        { nombre: "Acta de la audiencia preliminar", acto: "audiencia", obligatorio: true },
        { nombre: "Auto de admisión/calificación de pruebas", acto: "acuerdo", obligatorio: true },
      ],
    },
    {
      clave: "audiencia_juicio", nombre: "Audiencia de juicio", fase: "Audiencia de juicio (oral)",
      resumen: "Desahogo oral de pruebas (declaración de parte, testimoniales, periciales), alegatos de clausura.",
      docs: [
        { nombre: "Acuerdo que cita a audiencia de juicio", acto: "acuerdo" },
        { nombre: "Acta de la audiencia de juicio", acto: "audiencia", obligatorio: true },
      ],
    },
    {
      clave: "sentencia", nombre: "Sentencia definitiva", fase: "Audiencia de juicio (oral)",
      resumen: "El juez explica oralmente el sentido del fallo; luego se entrega por escrito.",
      docs: [
        { nombre: "Sentencia definitiva", acto: "resolucion", obligatorio: true },
      ],
    },
    {
      clave: "apelacion", nombre: "Apelación (si la hay)", fase: "Recursos",
      resumen: "Recurso ante el superior. Tramitación y resolución.",
      docs: [
        { nombre: "Escrito de apelación", acto: "promocion" },
        { nombre: "Resolución de la apelación", acto: "resolucion" },
      ],
    },
    {
      clave: "amparo", nombre: "Amparo (si lo hay)", fase: "Recursos",
      resumen: "Amparo directo o indirecto contra la resolución.",
      docs: [
        { nombre: "Demanda de amparo", acto: "promocion" },
        { nombre: "Sentencia / ejecutoria de amparo", acto: "resolucion" },
      ],
    },
    {
      clave: "ejecucion", nombre: "Ejecución de sentencia", fase: "Ejecución",
      resumen: "Cumplimiento forzoso: solicitud de ejecución y vía de apremio (embargo, remate).",
      docs: [
        { nombre: "Solicitud de ejecución", acto: "promocion" },
        { nombre: "Auto que ordena la ejecución", acto: "acuerdo" },
      ],
    },
  ],
};

// =====================================================================
// 2) ORDINARIO CIVIL — ESCRITA (tradicional, códigos estatales)
// =====================================================================
const ordinarioCivilEscrita: TipoJuicio = {
  clave: "ordinario_civil_escrita",
  tipo: "Ordinario Civil",
  via: "escrita",
  ley: "Código de Procedimientos Civiles estatal (sistema escrito)",
  etapas: [
    { clave: "demanda", nombre: "Presentación de la demanda", fase: "Postulatoria",
      resumen: "Escrito inicial con prestaciones, hechos y derecho.",
      docs: [
        { nombre: "Escrito inicial de demanda", acto: "promocion", obligatorio: true },
        { nombre: "Documento(s) base de la acción", acto: "promocion", obligatorio: true },
      ] },
    { clave: "admision", nombre: "Auto admisorio / radicación", fase: "Postulatoria",
      resumen: "El juzgado admite y radica el asunto.",
      docs: [{ nombre: "Auto admisorio", acto: "acuerdo", obligatorio: true }] },
    { clave: "emplazamiento", nombre: "Emplazamiento", fase: "Postulatoria",
      resumen: "Notificación personal al demandado.",
      docs: [{ nombre: "Razón / acta de emplazamiento", acto: "acta", obligatorio: true }] },
    { clave: "contestacion", nombre: "Contestación (o rebeldía)", fase: "Postulatoria",
      resumen: "Contestación con excepciones; o acuse de rebeldía.",
      docs: [{ nombre: "Contestación o acuse de rebeldía", acto: "promocion", obligatorio: true }] },
    { clave: "ofrecimiento_pruebas", nombre: "Ofrecimiento de pruebas", fase: "Probatoria",
      resumen: "Periodo para ofrecer pruebas (posterior a la litis, a diferencia del oral).",
      docs: [
        { nombre: "Escrito de ofrecimiento de pruebas (actor)", acto: "promocion" },
        { nombre: "Escrito de ofrecimiento de pruebas (demandado)", acto: "promocion" },
        { nombre: "Auto de admisión de pruebas", acto: "acuerdo" },
      ] },
    { clave: "desahogo", nombre: "Desahogo de pruebas", fase: "Probatoria",
      resumen: "Se desahogan testimoniales, periciales, confesional, etc.",
      docs: [{ nombre: "Constancias de desahogo", acto: "acta" }] },
    { clave: "alegatos", nombre: "Alegatos", fase: "Conclusiva",
      resumen: "Las partes presentan sus alegatos por escrito.",
      docs: [{ nombre: "Escrito de alegatos", acto: "promocion" }] },
    { clave: "citacion_sentencia", nombre: "Citación para sentencia", fase: "Conclusiva",
      resumen: "El juzgado cita para oír sentencia.",
      docs: [{ nombre: "Auto que cita para sentencia", acto: "acuerdo" }] },
    { clave: "sentencia", nombre: "Sentencia definitiva", fase: "Conclusiva",
      resumen: "Resolución de primera instancia.",
      docs: [{ nombre: "Sentencia definitiva", acto: "resolucion", obligatorio: true }] },
    { clave: "apelacion", nombre: "Apelación (si la hay)", fase: "Recursos",
      resumen: "Recurso ante el superior.",
      docs: [{ nombre: "Escrito de apelación", acto: "promocion" }, { nombre: "Resolución de apelación", acto: "resolucion" }] },
    { clave: "amparo", nombre: "Amparo (si lo hay)", fase: "Recursos",
      resumen: "Amparo contra la resolución.",
      docs: [{ nombre: "Demanda de amparo", acto: "promocion" }, { nombre: "Ejecutoria de amparo", acto: "resolucion" }] },
    { clave: "ejecucion", nombre: "Ejecución de sentencia", fase: "Ejecución",
      resumen: "Cumplimiento forzoso y vía de apremio.",
      docs: [{ nombre: "Solicitud de ejecución", acto: "promocion" }, { nombre: "Auto de ejecución", acto: "acuerdo" }] },
  ],
};

// =====================================================================
// 3) EJECUTIVO MERCANTIL — ESCRITA (Código de Comercio)
// =====================================================================
const ejecutivoMercantilEscrita: TipoJuicio = {
  clave: "ejecutivo_mercantil_escrita",
  tipo: "Ejecutivo Mercantil",
  via: "escrita",
  ley: "Código de Comercio (sistema escrito tradicional)",
  etapas: [
    { clave: "demanda", nombre: "Demanda con título ejecutivo", fase: "Postulatoria",
      resumen: "Escrito inicial acompañado del título que trae aparejada ejecución.",
      docs: [
        { nombre: "Escrito inicial de demanda", acto: "promocion", obligatorio: true },
        { nombre: "Título ejecutivo (documento base)", acto: "promocion", obligatorio: true },
      ] },
    { clave: "auto_exequendo", nombre: "Auto de exequendo (admisión + mandamiento)", fase: "Ejecución inicial",
      resumen: "Admite la demanda y ordena requerir de pago, embargar y emplazar.",
      docs: [{ nombre: "Auto de exequendo", acto: "acuerdo", obligatorio: true }] },
    { clave: "requerimiento_embargo", nombre: "Requerimiento de pago, embargo y emplazamiento", fase: "Ejecución inicial",
      resumen: "Diligencia del actuario: requiere pago, traba embargo y emplaza.",
      docs: [{ nombre: "Acta de la diligencia (actuario)", acto: "acta", obligatorio: true }] },
    { clave: "contestacion", nombre: "Contestación u oposición de excepciones", fase: "Postulatoria",
      resumen: "El demandado opone excepciones (o rebeldía) y ofrece pruebas.",
      docs: [{ nombre: "Contestación / oposición o acuse de rebeldía", acto: "promocion", obligatorio: true }] },
    { clave: "pruebas", nombre: "Admisión y desahogo de pruebas", fase: "Probatoria",
      resumen: "Ofrecimiento, admisión y desahogo de pruebas.",
      docs: [{ nombre: "Auto de admisión de pruebas", acto: "acuerdo" }, { nombre: "Constancias de desahogo", acto: "acta" }] },
    { clave: "alegatos", nombre: "Alegatos", fase: "Conclusiva",
      resumen: "Alegatos de las partes.",
      docs: [{ nombre: "Escrito de alegatos", acto: "promocion" }] },
    { clave: "sentencia", nombre: "Sentencia", fase: "Conclusiva",
      resumen: "Sentencia de primera instancia.",
      docs: [{ nombre: "Sentencia definitiva", acto: "resolucion", obligatorio: true }] },
    { clave: "apelacion", nombre: "Apelación (si la hay)", fase: "Recursos",
      resumen: "Recurso ante el superior.",
      docs: [{ nombre: "Escrito de apelación", acto: "promocion" }, { nombre: "Resolución de apelación", acto: "resolucion" }] },
    { clave: "amparo", nombre: "Amparo (si lo hay)", fase: "Recursos",
      resumen: "Amparo contra la resolución.",
      docs: [{ nombre: "Demanda de amparo", acto: "promocion" }, { nombre: "Ejecutoria de amparo", acto: "resolucion" }] },
    { clave: "ejecucion", nombre: "Ejecución de sentencia", fase: "Ejecución",
      resumen: "Se hace efectivo el fallo sobre lo embargado.",
      docs: [{ nombre: "Auto que ordena la ejecución", acto: "acuerdo" }] },
    { clave: "avaluo", nombre: "Avalúo", fase: "Ejecución",
      resumen: "Avalúo del bien embargado.",
      docs: [{ nombre: "Avalúo (perito)", acto: "promocion" }, { nombre: "Acuerdo que tiene por rendido el avalúo", acto: "acuerdo" }] },
    { clave: "remate", nombre: "Remate / almoneda", fase: "Ejecución",
      resumen: "Convocatoria y celebración de la almoneda.",
      docs: [{ nombre: "Convocatoria / edictos", acto: "acuerdo" }, { nombre: "Acta de remate", acto: "acta" }] },
    { clave: "adjudicacion", nombre: "Adjudicación", fase: "Ejecución",
      resumen: "Adjudicación a favor del postor / actor.",
      docs: [{ nombre: "Auto de adjudicación", acto: "acuerdo", obligatorio: true }] },
    { clave: "escrituracion", nombre: "Escrituración y entrega", fase: "Ejecución",
      resumen: "Otorgamiento de escritura (en rebeldía si aplica) y entrega del inmueble.",
      docs: [
        { nombre: "Solicitud de escrituración / firma en rebeldía", acto: "promocion" },
        { nombre: "Escritura", acto: "resolucion" },
        { nombre: "Acta de entrega del inmueble", acto: "acta" },
      ] },
  ],
};

// =====================================================================
// 4) ESPECIAL HIPOTECARIO — ESCRITA (clave para garantías hipotecarias)
// =====================================================================
const hipotecarioEscrita: TipoJuicio = {
  clave: "hipotecario_escrita",
  tipo: "Especial Hipotecario",
  via: "escrita",
  ley: "Código de Procedimientos Civiles / Comercio (juicio especial hipotecario)",
  etapas: [
    { clave: "demanda", nombre: "Demanda hipotecaria", fase: "Postulatoria",
      resumen: "Escrito inicial con el contrato de hipoteca como base.",
      docs: [
        { nombre: "Escrito inicial de demanda", acto: "promocion", obligatorio: true },
        { nombre: "Contrato / escritura de hipoteca (base)", acto: "promocion", obligatorio: true },
        { nombre: "Certificado de gravámenes", acto: "promocion" },
      ] },
    { clave: "admision_cedula", nombre: "Admisión y cédula hipotecaria", fase: "Postulatoria",
      resumen: "Se admite y se expide/registra la cédula hipotecaria (anotación en el RPP).",
      docs: [
        { nombre: "Auto admisorio", acto: "acuerdo", obligatorio: true },
        { nombre: "Cédula hipotecaria", acto: "acuerdo", obligatorio: true },
        { nombre: "Constancia de inscripción en el RPP", acto: "promocion" },
      ] },
    { clave: "emplazamiento", nombre: "Emplazamiento", fase: "Postulatoria",
      resumen: "Notificación personal al deudor / demandado.",
      docs: [{ nombre: "Acta de emplazamiento", acto: "acta", obligatorio: true }] },
    { clave: "contestacion", nombre: "Contestación (o rebeldía)", fase: "Postulatoria",
      resumen: "Contestación con excepciones; o acuse de rebeldía.",
      docs: [{ nombre: "Contestación o acuse de rebeldía", acto: "promocion", obligatorio: true }] },
    { clave: "pruebas", nombre: "Audiencia y pruebas", fase: "Probatoria",
      resumen: "Ofrecimiento, admisión y desahogo de pruebas.",
      docs: [{ nombre: "Auto de admisión de pruebas", acto: "acuerdo" }, { nombre: "Constancias de desahogo", acto: "acta" }] },
    { clave: "alegatos", nombre: "Alegatos", fase: "Conclusiva",
      resumen: "Alegatos de las partes.",
      docs: [{ nombre: "Escrito de alegatos", acto: "promocion" }] },
    { clave: "sentencia", nombre: "Sentencia", fase: "Conclusiva",
      resumen: "Sentencia que, en su caso, ordena el remate del bien hipotecado.",
      docs: [{ nombre: "Sentencia definitiva", acto: "resolucion", obligatorio: true }] },
    { clave: "apelacion_amparo", nombre: "Apelación / Amparo (si hay)", fase: "Recursos",
      resumen: "Medios de impugnación.",
      docs: [{ nombre: "Escrito de apelación / amparo", acto: "promocion" }, { nombre: "Resolución", acto: "resolucion" }] },
    { clave: "ejecucion", nombre: "Ejecución de sentencia", fase: "Ejecución",
      resumen: "Se ordena ejecutar la sentencia sobre el inmueble.",
      docs: [{ nombre: "Auto que ordena la ejecución", acto: "acuerdo" }] },
    { clave: "avaluo", nombre: "Avalúo", fase: "Ejecución",
      resumen: "Avalúo del inmueble hipotecado.",
      docs: [{ nombre: "Avalúo (perito)", acto: "promocion" }, { nombre: "Acuerdo que lo tiene por rendido", acto: "acuerdo" }] },
    { clave: "remate", nombre: "Remate / almoneda", fase: "Ejecución",
      resumen: "Convocatoria y almoneda del inmueble.",
      docs: [{ nombre: "Convocatoria / edictos", acto: "acuerdo" }, { nombre: "Acta de remate", acto: "acta" }] },
    { clave: "adjudicacion", nombre: "Adjudicación", fase: "Ejecución",
      resumen: "Adjudicación del inmueble.",
      docs: [{ nombre: "Auto de adjudicación", acto: "acuerdo", obligatorio: true }] },
    { clave: "escrituracion", nombre: "Escrituración y entrega", fase: "Ejecución",
      resumen: "Escritura (en rebeldía si aplica) y entrega del inmueble.",
      docs: [
        { nombre: "Solicitud de escrituración / firma en rebeldía", acto: "promocion" },
        { nombre: "Escritura", acto: "resolucion" },
        { nombre: "Acta de entrega / posesión", acto: "acta" },
      ] },
  ],
};

// =====================================================================
// 5) ORDINARIO MERCANTIL — ORAL (Código de Comercio, juicio oral mercantil)
// =====================================================================
const ordinarioMercantilOral: TipoJuicio = {
  clave: "ordinario_mercantil_oral",
  tipo: "Ordinario Mercantil",
  via: "oral",
  ley: "Código de Comercio (juicio oral mercantil)",
  etapas: [
    { clave: "demanda", nombre: "Demanda", fase: "Postulatoria",
      resumen: "Escrito inicial; se ofrecen las pruebas desde aquí.",
      docs: [
        { nombre: "Escrito inicial de demanda", acto: "promocion", obligatorio: true },
        { nombre: "Documento(s) base", acto: "promocion", obligatorio: true },
        { nombre: "Ofrecimiento de pruebas", acto: "promocion" },
      ] },
    { clave: "admision", nombre: "Auto admisorio", fase: "Postulatoria",
      resumen: "Admisión o prevención.",
      docs: [{ nombre: "Auto admisorio", acto: "acuerdo", obligatorio: true }] },
    { clave: "emplazamiento", nombre: "Emplazamiento", fase: "Postulatoria",
      resumen: "Notificación personal al demandado.",
      docs: [{ nombre: "Acta de emplazamiento", acto: "acta", obligatorio: true }] },
    { clave: "contestacion", nombre: "Contestación y reconvención", fase: "Postulatoria",
      resumen: "Contestación con excepciones y pruebas; reconvención si la hay.",
      docs: [{ nombre: "Contestación o acuse de rebeldía", acto: "promocion", obligatorio: true }] },
    { clave: "audiencia_preliminar", nombre: "Audiencia preliminar", fase: "Audiencia preliminar (oral)",
      resumen: "Depuración, conciliación, fijación de litis y admisión de pruebas.",
      docs: [{ nombre: "Acta de audiencia preliminar", acto: "audiencia", obligatorio: true }, { nombre: "Auto de admisión de pruebas", acto: "acuerdo" }] },
    { clave: "audiencia_juicio", nombre: "Audiencia de juicio", fase: "Audiencia de juicio (oral)",
      resumen: "Desahogo oral de pruebas y alegatos.",
      docs: [{ nombre: "Acta de audiencia de juicio", acto: "audiencia", obligatorio: true }] },
    { clave: "sentencia", nombre: "Sentencia", fase: "Audiencia de juicio (oral)",
      resumen: "El juez dicta sentencia oralmente; luego por escrito.",
      docs: [{ nombre: "Sentencia definitiva", acto: "resolucion", obligatorio: true }] },
    { clave: "amparo", nombre: "Amparo (si lo hay)", fase: "Recursos",
      resumen: "En el oral mercantil no procede apelación; procede amparo.",
      docs: [{ nombre: "Demanda de amparo", acto: "promocion" }, { nombre: "Ejecutoria de amparo", acto: "resolucion" }] },
    { clave: "ejecucion", nombre: "Ejecución de sentencia", fase: "Ejecución",
      resumen: "Cumplimiento forzoso.",
      docs: [{ nombre: "Auto de ejecución", acto: "acuerdo" }] },
  ],
};

// =====================================================================
// 6) SUCESORIO — INTESTAMENTARIO (escrita)
// =====================================================================
const sucesorioIntestamentario: TipoJuicio = {
  clave: "sucesorio_intestamentario",
  tipo: "Sucesorio Intestamentario",
  via: "escrita",
  ley: "Código de Procedimientos Civiles (sucesiones)",
  etapas: [
    { clave: "denuncia", nombre: "Denuncia del intestado", fase: "Primera sección (sucesión)",
      resumen: "Se denuncia la sucesión y se acredita el parentesco y la muerte.",
      docs: [
        { nombre: "Escrito de denuncia", acto: "promocion", obligatorio: true },
        { nombre: "Acta de defunción", acto: "promocion", obligatorio: true },
        { nombre: "Actas que acrediten parentesco", acto: "promocion" },
      ] },
    { clave: "radicacion", nombre: "Radicación e informes", fase: "Primera sección (sucesión)",
      resumen: "Se radica y se piden informes (testamentos, etc.).",
      docs: [{ nombre: "Auto de radicación", acto: "acuerdo", obligatorio: true }, { nombre: "Informes de no testamento", acto: "acuerdo" }] },
    { clave: "junta_herederos", nombre: "Junta de herederos y nombramiento de albacea", fase: "Primera sección (sucesión)",
      resumen: "Reconocimiento de herederos y designación del albacea.",
      docs: [{ nombre: "Acta de junta de herederos", acto: "acta" }, { nombre: "Auto que declara herederos y nombra albacea", acto: "acuerdo", obligatorio: true }] },
    { clave: "inventario", nombre: "Inventario y avalúo", fase: "Segunda sección (inventarios)",
      resumen: "El albacea formula inventario y avalúo de los bienes.",
      docs: [{ nombre: "Inventario y avalúo", acto: "promocion", obligatorio: true }, { nombre: "Auto que aprueba el inventario", acto: "acuerdo" }] },
    { clave: "administracion", nombre: "Administración", fase: "Tercera sección (administración)",
      resumen: "Rendición de cuentas de la administración del albacea.",
      docs: [{ nombre: "Cuentas de administración", acto: "promocion" }] },
    { clave: "particion", nombre: "Proyecto de partición y adjudicación", fase: "Cuarta sección (partición)",
      resumen: "Proyecto de partición, aprobación y adjudicación a herederos.",
      docs: [
        { nombre: "Proyecto de partición", acto: "promocion", obligatorio: true },
        { nombre: "Auto que aprueba la partición", acto: "acuerdo", obligatorio: true },
        { nombre: "Escritura de adjudicación", acto: "resolucion" },
      ] },
  ],
};

// =====================================================================
// 7) SUCESORIO — TESTAMENTARIO (escrita)
// =====================================================================
const sucesorioTestamentario: TipoJuicio = {
  clave: "sucesorio_testamentario",
  tipo: "Sucesorio Testamentario",
  via: "escrita",
  ley: "Código de Procedimientos Civiles (sucesiones)",
  etapas: [
    { clave: "denuncia", nombre: "Denuncia con testamento", fase: "Primera sección (sucesión)",
      resumen: "Se denuncia la sucesión acompañando el testamento.",
      docs: [
        { nombre: "Escrito de denuncia", acto: "promocion", obligatorio: true },
        { nombre: "Testamento", acto: "promocion", obligatorio: true },
        { nombre: "Acta de defunción", acto: "promocion", obligatorio: true },
      ] },
    { clave: "radicacion", nombre: "Radicación y apertura del testamento", fase: "Primera sección (sucesión)",
      resumen: "Se radica y se reconoce la validez del testamento.",
      docs: [{ nombre: "Auto de radicación", acto: "acuerdo", obligatorio: true }] },
    { clave: "albacea", nombre: "Reconocimiento de herederos y albacea", fase: "Primera sección (sucesión)",
      resumen: "Reconocimiento conforme al testamento y nombramiento de albacea.",
      docs: [{ nombre: "Auto que reconoce herederos y nombra albacea", acto: "acuerdo", obligatorio: true }] },
    { clave: "inventario", nombre: "Inventario y avalúo", fase: "Segunda sección (inventarios)",
      resumen: "Inventario y avalúo de bienes.",
      docs: [{ nombre: "Inventario y avalúo", acto: "promocion", obligatorio: true }, { nombre: "Auto que lo aprueba", acto: "acuerdo" }] },
    { clave: "administracion", nombre: "Administración", fase: "Tercera sección (administración)",
      resumen: "Rendición de cuentas del albacea.",
      docs: [{ nombre: "Cuentas de administración", acto: "promocion" }] },
    { clave: "particion", nombre: "Partición y adjudicación", fase: "Cuarta sección (partición)",
      resumen: "Partición conforme al testamento y adjudicación.",
      docs: [
        { nombre: "Proyecto de partición", acto: "promocion", obligatorio: true },
        { nombre: "Auto que aprueba la partición", acto: "acuerdo", obligatorio: true },
        { nombre: "Escritura de adjudicación", acto: "resolucion" },
      ] },
  ],
};

// =====================================================================
// 8) EJECUTIVO CIVIL — ESCRITA (Código de Procedimientos Civiles)
// =====================================================================
const ejecutivoCivilEscrita: TipoJuicio = {
  clave: "ejecutivo_civil_escrita",
  tipo: "Ejecutivo Civil",
  via: "escrita",
  ley: "Código de Procedimientos Civiles (vía ejecutiva)",
  etapas: [
    { clave: "demanda", nombre: "Demanda con documento ejecutivo", fase: "Postulatoria",
      resumen: "Escrito inicial acompañado del documento que trae aparejada ejecución.",
      docs: [
        { nombre: "Escrito inicial de demanda", acto: "promocion", obligatorio: true },
        { nombre: "Documento base (título ejecutivo)", acto: "promocion", obligatorio: true },
      ] },
    { clave: "auto_ejecucion", nombre: "Auto de ejecución (admisión + mandamiento)", fase: "Ejecución inicial",
      resumen: "Admite y ordena requerir de pago, embargar y emplazar.",
      docs: [{ nombre: "Auto de ejecución / exequendo", acto: "acuerdo", obligatorio: true }] },
    { clave: "requerimiento_embargo", nombre: "Requerimiento de pago, embargo y emplazamiento", fase: "Ejecución inicial",
      resumen: "Diligencia del actuario: requiere pago, traba embargo y emplaza.",
      docs: [{ nombre: "Acta de la diligencia (actuario)", acto: "acta", obligatorio: true }] },
    { clave: "contestacion", nombre: "Contestación u oposición de excepciones", fase: "Postulatoria",
      resumen: "El demandado opone excepciones (o rebeldía) y ofrece pruebas.",
      docs: [{ nombre: "Contestación / oposición o acuse de rebeldía", acto: "promocion", obligatorio: true }] },
    { clave: "pruebas", nombre: "Admisión y desahogo de pruebas", fase: "Probatoria",
      resumen: "Ofrecimiento, admisión y desahogo de pruebas.",
      docs: [{ nombre: "Auto de admisión de pruebas", acto: "acuerdo" }, { nombre: "Constancias de desahogo", acto: "acta" }] },
    { clave: "alegatos", nombre: "Alegatos", fase: "Conclusiva",
      resumen: "Alegatos de las partes.",
      docs: [{ nombre: "Escrito de alegatos", acto: "promocion" }] },
    { clave: "sentencia", nombre: "Sentencia", fase: "Conclusiva",
      resumen: "Sentencia de primera instancia.",
      docs: [{ nombre: "Sentencia definitiva", acto: "resolucion", obligatorio: true }] },
    { clave: "apelacion", nombre: "Apelación (si la hay)", fase: "Recursos",
      resumen: "Recurso ante el superior.",
      docs: [{ nombre: "Escrito de apelación", acto: "promocion" }, { nombre: "Resolución de apelación", acto: "resolucion" }] },
    { clave: "amparo", nombre: "Amparo (si lo hay)", fase: "Recursos",
      resumen: "Amparo contra la resolución.",
      docs: [{ nombre: "Demanda de amparo", acto: "promocion" }, { nombre: "Ejecutoria de amparo", acto: "resolucion" }] },
    { clave: "ejecucion", nombre: "Ejecución de sentencia", fase: "Ejecución",
      resumen: "Se hace efectivo el fallo sobre lo embargado.",
      docs: [{ nombre: "Auto que ordena la ejecución", acto: "acuerdo" }] },
    { clave: "avaluo", nombre: "Avalúo", fase: "Ejecución",
      resumen: "Avalúo del bien embargado.",
      docs: [{ nombre: "Avalúo (perito)", acto: "promocion" }, { nombre: "Acuerdo que lo tiene por rendido", acto: "acuerdo" }] },
    { clave: "remate", nombre: "Remate / almoneda", fase: "Ejecución",
      resumen: "Convocatoria y celebración de la almoneda.",
      docs: [{ nombre: "Convocatoria / edictos", acto: "acuerdo" }, { nombre: "Acta de remate", acto: "acta" }] },
    { clave: "adjudicacion", nombre: "Adjudicación", fase: "Ejecución",
      resumen: "Adjudicación a favor del postor / actor.",
      docs: [{ nombre: "Auto de adjudicación", acto: "acuerdo", obligatorio: true }] },
    { clave: "escrituracion", nombre: "Escrituración y entrega", fase: "Ejecución",
      resumen: "Escritura (en rebeldía si aplica) y entrega del inmueble.",
      docs: [
        { nombre: "Solicitud de escrituración / firma en rebeldía", acto: "promocion" },
        { nombre: "Escritura", acto: "resolucion" },
        { nombre: "Acta de entrega del inmueble", acto: "acta" },
      ] },
  ],
};

// =====================================================================
// 9) ORAL MERCANTIL — ESCRITA (tramitación escrita previa a las audiencias)
// =====================================================================
const oralMercantilEscrita: TipoJuicio = {
  clave: "oral_mercantil_escrita",
  tipo: "Oral Mercantil",
  via: "escrita",
  ley: "Código de Comercio (juicio oral mercantil — fase escrita)",
  etapas: [
    { clave: "demanda", nombre: "Demanda", fase: "Postulatoria",
      resumen: "Escrito inicial; se ofrecen las pruebas desde aquí.",
      docs: [
        { nombre: "Escrito inicial de demanda", acto: "promocion", obligatorio: true },
        { nombre: "Documento(s) base", acto: "promocion", obligatorio: true },
        { nombre: "Ofrecimiento de pruebas", acto: "promocion" },
      ] },
    { clave: "admision", nombre: "Auto admisorio", fase: "Postulatoria",
      resumen: "Admisión o prevención.",
      docs: [{ nombre: "Auto admisorio", acto: "acuerdo", obligatorio: true }] },
    { clave: "emplazamiento", nombre: "Emplazamiento", fase: "Postulatoria",
      resumen: "Notificación personal al demandado.",
      docs: [{ nombre: "Acta de emplazamiento", acto: "acta", obligatorio: true }] },
    { clave: "contestacion", nombre: "Contestación y reconvención", fase: "Postulatoria",
      resumen: "Contestación con excepciones y pruebas; reconvención si la hay.",
      docs: [{ nombre: "Contestación o acuse de rebeldía", acto: "promocion", obligatorio: true }] },
    { clave: "audiencia_preliminar", nombre: "Audiencia preliminar", fase: "Audiencia preliminar",
      resumen: "Depuración, conciliación, fijación de litis y admisión de pruebas.",
      docs: [{ nombre: "Acta de audiencia preliminar", acto: "audiencia", obligatorio: true }, { nombre: "Auto de admisión de pruebas", acto: "acuerdo" }] },
    { clave: "audiencia_juicio", nombre: "Audiencia de juicio", fase: "Audiencia de juicio",
      resumen: "Desahogo de pruebas y alegatos.",
      docs: [{ nombre: "Acta de audiencia de juicio", acto: "audiencia", obligatorio: true }] },
    { clave: "sentencia", nombre: "Sentencia", fase: "Audiencia de juicio",
      resumen: "Sentencia definitiva.",
      docs: [{ nombre: "Sentencia definitiva", acto: "resolucion", obligatorio: true }] },
    { clave: "amparo", nombre: "Amparo (si lo hay)", fase: "Recursos",
      resumen: "En el oral mercantil no procede apelación; procede amparo.",
      docs: [{ nombre: "Demanda de amparo", acto: "promocion" }, { nombre: "Ejecutoria de amparo", acto: "resolucion" }] },
    { clave: "ejecucion", nombre: "Ejecución de sentencia", fase: "Ejecución",
      resumen: "Cumplimiento forzoso.",
      docs: [{ nombre: "Auto de ejecución", acto: "acuerdo" }] },
  ],
};

// =====================================================================
// Catálogo completo
// =====================================================================
export const CATALOGO_ETAPAS: TipoJuicio[] = [
  ordinarioCivilOral,
  ordinarioCivilEscrita,
  ejecutivoMercantilEscrita,
  ejecutivoCivilEscrita,
  hipotecarioEscrita,
  ordinarioMercantilOral,
  oralMercantilEscrita,
  sucesorioIntestamentario,
  sucesorioTestamentario,
];

// posiciones de DIIPA (del pre-dictamen URRJ)
export const POSICIONES = ["Actor", "Demandado", "Sucesión", "Contingencia"] as const;
export type Posicion = typeof POSICIONES[number];

// helper: busca un tipo por su clave
export function tipoJuicioPorClave(clave: string | null | undefined): TipoJuicio | null {
  if (!clave) return null;
  return CATALOGO_ETAPAS.find((t) => t.clave === clave) || null;
}

// helper: lista para selects (tipo + vía)
export function listaTiposJuicio(): { clave: string; etiqueta: string }[] {
  return CATALOGO_ETAPAS.map((t) => ({
    clave: t.clave,
    etiqueta: `${t.tipo} · ${t.via === "oral" ? "Oral (nuevo)" : "Escrito (tradicional)"}`,
  }));
}

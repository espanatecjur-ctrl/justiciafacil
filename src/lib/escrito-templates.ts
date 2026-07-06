// ============================================================
//  Plantillas de ESCRITOS (demandas, promociones, contestaciones)
// ------------------------------------------------------------
//  Módulo 100% independiente de Contratos: tiene su propio motor
//  de render {{marcadores}} para que uno nunca le pegue al otro.
//  El cuerpo usa placeholders {{campo}}, bloques {{#campo}}…{{/campo}}
//  y listas repetibles {{#each nombre}}…{{item.x}}…{{/each nombre}}.
// ============================================================

export interface EscritoCampo {
  id: string;
  label: string;
  tipo: "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "lista";
  opciones?: string[];
  requerido?: boolean;
  dependeDe?: { campo: string; valor: string | boolean };
  ayuda?: string;
  /** Solo para tipo "lista": campos de cada renglón. */
  subcampos?: EscritoCampo[];
  /** Valor inicial sugerido. */
  valorInicial?: string;
}

export interface PlantillaEscrito {
  /** Identificador libre (no depende de ContratoTipo). */
  tipo: string;
  nombre: string;
  descripcion: string;
  materia: "civil" | "mercantil" | "ambas";
  campos: EscritoCampo[];
  /** Cuerpo con placeholders. */
  cuerpo: string;
}

// ---------------------------------------------------------------------------
//  Ordinales y helpers de listas
// ---------------------------------------------------------------------------
const ORDINALES = [
  "PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO",
  "OCTAVO", "NOVENO", "DÉCIMO", "DÉCIMO PRIMERO", "DÉCIMO SEGUNDO",
  "DÉCIMO TERCERO", "DÉCIMO CUARTO", "DÉCIMO QUINTO", "DÉCIMO SEXTO",
  "DÉCIMO SÉPTIMO", "DÉCIMO OCTAVO", "DÉCIMO NOVENO", "VIGÉSIMO",
];

function aRomano(n: number): string {
  const t: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let r = "";
  let x = n;
  for (const [v, s] of t) while (x >= v) { r += s; x -= v; }
  return r;
}

// ---------------------------------------------------------------------------
//  Campos reutilizables
// ---------------------------------------------------------------------------
const posicionCampo: EscritoCampo[] = [
  {
    id: "posicionProcesal",
    label: "Posición procesal del promovente",
    tipo: "select",
    requerido: true,
    opciones: ["Actor", "Demandado", "Tercero llamado a juicio", "Usucapión (actor)", "Sucesorio"],
    ayuda: "Ajusta automáticamente el texto del escrito.",
  },
];

const cabeceraCampos: EscritoCampo[] = [
  { id: "tipoJuicio", label: "Tipo de juicio", tipo: "text", requerido: true, ayuda: "Ej. JUICIO ORDINARIO MERCANTIL" },
  { id: "numeroExpediente", label: "Número de expediente", tipo: "text", ayuda: "Vacío si es demanda inicial" },
  { id: "juzgado", label: "Juzgado (destinatario)", tipo: "text", requerido: true, ayuda: "Ej. PRIMERO DE LO CIVIL DE TLAJOMULCO, JALISCO" },
];

const promoventeCampos: EscritoCampo[] = [
  { id: "domicilioNotificaciones", label: "Domicilio para oír y recibir notificaciones", tipo: "textarea", requerido: true },
  { id: "autorizados", label: "Personas autorizadas para oír notificaciones", tipo: "text", ayuda: "Nombres de los abogados autorizados" },
  { id: "correoElectronico", label: "Correo electrónico autorizado", tipo: "text" },
  { id: "cedulaProfesional", label: "Cédula profesional del autorizado", tipo: "text" },
  { id: "comparecePorApoderado", label: "Comparece por apoderado", tipo: "checkbox" },
  { id: "nombreApoderado", label: "Nombre del apoderado", tipo: "text", dependeDe: { campo: "comparecePorApoderado", valor: true } },
  { id: "instrumentoPoder", label: "Instrumento del poder (No., Notario, Plaza)", tipo: "text", dependeDe: { campo: "comparecePorApoderado", valor: true } },
];

const cierreCampos: EscritoCampo[] = [
  { id: "lugar", label: "Lugar", tipo: "text", requerido: true, ayuda: "Ej. Tlajomulco de Zúñiga, Jalisco" },
  { id: "fecha", label: "Fecha", tipo: "text", requerido: true, ayuda: "Ej. 06 de julio de 2026" },
  { id: "firmaNombre", label: "Nombre de quien firma", tipo: "text", requerido: true },
];

const listaPrestaciones: EscritoCampo = {
  id: "prestaciones", label: "Prestaciones (incisos a, b, c…)", tipo: "lista",
  subcampos: [{ id: "texto", label: "Prestación", tipo: "textarea", requerido: true }],
};
const listaHechos: EscritoCampo = {
  id: "hechos", label: "Hechos (numerados)", tipo: "lista",
  subcampos: [{ id: "texto", label: "Hecho", tipo: "textarea", requerido: true }],
};
const listaPetitorios: EscritoCampo = {
  id: "puntosPetitorios", label: "Puntos petitorios", tipo: "lista",
  subcampos: [{ id: "texto", label: "Petición", tipo: "textarea", requerido: true }],
};

// ---------------------------------------------------------------------------
//  Plantillas base
// ---------------------------------------------------------------------------
const demandaMercantil: PlantillaEscrito = {
  tipo: "demanda_mercantil",
  nombre: "Demanda — Ordinario Mercantil",
  descripcion: "Escrito inicial de demanda en la vía ordinaria mercantil (Código de Comercio).",
  materia: "mercantil",
  campos: [
    ...posicionCampo,
    ...cabeceraCampos,
    { id: "nombreActor", label: "Nombre del actor / promovente", tipo: "text", requerido: true },
    ...promoventeCampos,
    { id: "nombreDemandado", label: "Nombre del demandado", tipo: "text", requerido: true },
    { id: "domicilioDemandado", label: "Domicilio del demandado", tipo: "textarea" },
    { id: "cuantia", label: "Cuantía / valor de lo demandado (MXN)", tipo: "text", ayuda: "Ej. 2,000,000.00" },
    listaPrestaciones,
    listaHechos,
    { id: "fundamentosDerecho", label: "Fundamentos de derecho", tipo: "textarea", requerido: true, valorInicial: "Artículos 1049, 1055, 1061, 1069, 1377 y demás relativos del Código de Comercio; supletoriamente el Código Federal de Procedimientos Civiles." },
    { id: "pruebas", label: "Pruebas que se acompañan", tipo: "textarea" },
    listaPetitorios,
    ...cierreCampos,
  ],
  cuerpo: `{{tipoJuicio}}
EXPEDIENTE: {{numeroExpediente}}

C. JUEZ {{juzgado}}
P R E S E N T E.

{{nombreActor}}{{#comparecePorApoderado}}, por conducto de mi apoderado {{nombreApoderado}} (según {{instrumentoPoder}}){{/comparecePorApoderado}}{{#esActor}}, en mi carácter de parte ACTORA{{/esActor}}{{#esDemandado}}, en mi carácter de parte DEMANDADA{{/esDemandado}}{{#esTercero}}, en mi carácter de TERCERO llamado a juicio{{/esTercero}}, señalando como domicilio para oír y recibir toda clase de notificaciones el ubicado en {{domicilioNotificaciones}}, y autorizando en términos del artículo 1069 del Código de Comercio a {{autorizados}} (correo {{correoElectronico}}), ante Usted con el debido respeto comparezco y expongo:

Que por medio del presente escrito, en la vía ORDINARIA MERCANTIL, vengo a demandar de {{nombreDemandado}}, con domicilio en {{domicilioDemandado}}, las siguientes:

P R E S T A C I O N E S
{{#each prestaciones}}{{item.letra}}) {{item.texto}}
{{/each prestaciones}}
Valor de lo demandado: $ {{cuantia}} MXN.

Fundo la presente demanda en los siguientes:

H E C H O S
{{#each hechos}}{{item.n}}. {{item.texto}}
{{/each hechos}}
D E R E C H O
{{fundamentosDerecho}}

P R U E B A S
{{pruebas}}

Por lo anteriormente expuesto y fundado, a Usted C. Juez atentamente pido se sirva:

P U N T O S   P E T I T O R I O S
{{#each puntosPetitorios}}{{item.orden}}.- {{item.texto}}
{{/each puntosPetitorios}}
PROTESTO LO NECESARIO.
{{lugar}}, a {{fecha}}.


_______________________________
{{firmaNombre}}`,
};

const demandaCivil: PlantillaEscrito = {
  tipo: "demanda_civil",
  nombre: "Demanda — Ordinario Civil (Jalisco)",
  descripcion: "Escrito inicial de demanda en la vía ordinaria civil (Código de Procedimientos Civiles del Estado de Jalisco).",
  materia: "civil",
  campos: [
    ...posicionCampo,
    ...cabeceraCampos,
    { id: "nombreActor", label: "Nombre del actor / promovente", tipo: "text", requerido: true },
    ...promoventeCampos,
    { id: "nombreDemandado", label: "Nombre del demandado", tipo: "text", requerido: true },
    { id: "domicilioDemandado", label: "Domicilio del demandado", tipo: "textarea" },
    { id: "cuantia", label: "Cuantía / valor de lo demandado (MXN)", tipo: "text" },
    listaPrestaciones,
    listaHechos,
    { id: "fundamentosDerecho", label: "Fundamentos de derecho", tipo: "textarea", requerido: true, valorInicial: "Artículos relativos del Código de Procedimientos Civiles del Estado de Jalisco y del Código Civil del Estado de Jalisco aplicables al caso." },
    { id: "pruebas", label: "Pruebas que se acompañan", tipo: "textarea" },
    listaPetitorios,
    ...cierreCampos,
  ],
  cuerpo: `{{tipoJuicio}}
EXPEDIENTE: {{numeroExpediente}}

C. JUEZ {{juzgado}}
P R E S E N T E.

{{nombreActor}}{{#comparecePorApoderado}}, por conducto de mi apoderado {{nombreApoderado}} (según {{instrumentoPoder}}){{/comparecePorApoderado}}{{#esActor}}, en mi carácter de parte ACTORA{{/esActor}}{{#esUsucapion}}, promoviendo acción de USUCAPIÓN{{/esUsucapion}}{{#esDemandado}}, en mi carácter de parte DEMANDADA{{/esDemandado}}{{#esSucesorio}}, en el carácter señalado en la sucesión{{/esSucesorio}}, señalando como domicilio para oír y recibir notificaciones el ubicado en {{domicilioNotificaciones}}, autorizando para tales efectos a {{autorizados}} (correo {{correoElectronico}}), ante Usted respetuosamente comparezco y expongo:

Que en la vía ORDINARIA CIVIL vengo a demandar de {{nombreDemandado}}, con domicilio en {{domicilioDemandado}}, las siguientes:

P R E S T A C I O N E S
{{#each prestaciones}}{{item.letra}}) {{item.texto}}
{{/each prestaciones}}
Valor de lo demandado: $ {{cuantia}} MXN.

Fundo mi demanda en los siguientes:

H E C H O S
{{#each hechos}}{{item.n}}. {{item.texto}}
{{/each hechos}}
D E R E C H O
{{fundamentosDerecho}}

P R U E B A S
{{pruebas}}

Por lo expuesto y fundado, a Usted C. Juez atentamente pido se sirva:

P U N T O S   P E T I T O R I O S
{{#each puntosPetitorios}}{{item.orden}}.- {{item.texto}}
{{/each puntosPetitorios}}
PROTESTO LO NECESARIO.
{{lugar}}, a {{fecha}}.


_______________________________
{{firmaNombre}}`,
};

const promocion: PlantillaEscrito = {
  tipo: "promocion",
  nombre: "Promoción / Escrito simple",
  descripcion: "Escrito de trámite dentro de un juicio ya iniciado (personalidad ya reconocida).",
  materia: "ambas",
  campos: [
    ...posicionCampo,
    ...cabeceraCampos,
    { id: "nombrePromovente", label: "Nombre del promovente", tipo: "text", requerido: true },
    { id: "contenido", label: "Contenido / cuerpo del escrito", tipo: "textarea", requerido: true, ayuda: "Lo que se expone o solicita al juez" },
    listaPetitorios,
    ...cierreCampos,
  ],
  cuerpo: `EXPEDIENTE: {{numeroExpediente}}
{{tipoJuicio}}

C. JUEZ {{juzgado}}
P R E S E N T E.

{{nombrePromovente}}{{#esActor}}, parte ACTORA{{/esActor}}{{#esDemandado}}, parte DEMANDADA{{/esDemandado}}{{#esTercero}}, TERCERO{{/esTercero}} en el juicio al rubro citado, personalidad que tengo debidamente reconocida en autos, ante Usted respetuosamente comparezco y expongo:

{{contenido}}

Por lo expuesto, a Usted C. Juez atentamente pido se sirva:

P U N T O S   P E T I T O R I O S
{{#each puntosPetitorios}}{{item.orden}}.- {{item.texto}}
{{/each puntosPetitorios}}
PROTESTO LO NECESARIO.
{{lugar}}, a {{fecha}}.


_______________________________
{{firmaNombre}}`,
};

const contestacion: PlantillaEscrito = {
  tipo: "contestacion",
  nombre: "Contestación de demanda",
  descripcion: "Escrito de contestación a la demanda, con excepciones y defensas.",
  materia: "ambas",
  campos: [
    ...posicionCampo,
    ...cabeceraCampos,
    { id: "nombreDemandado", label: "Nombre del demandado (promovente)", tipo: "text", requerido: true },
    ...promoventeCampos,
    { id: "nombreActor", label: "Nombre del actor (contraparte)", tipo: "text", requerido: true },
    {
      id: "contestacionHechos", label: "Contestación a los hechos", tipo: "lista",
      subcampos: [{ id: "texto", label: "Respuesta al hecho", tipo: "textarea", requerido: true }],
    },
    {
      id: "excepciones", label: "Excepciones y defensas", tipo: "lista",
      subcampos: [{ id: "texto", label: "Excepción / defensa", tipo: "textarea", requerido: true }],
    },
    { id: "fundamentosDerecho", label: "Fundamentos de derecho", tipo: "textarea", requerido: true },
    { id: "pruebas", label: "Pruebas que se acompañan", tipo: "textarea" },
    listaPetitorios,
    ...cierreCampos,
  ],
  cuerpo: `{{tipoJuicio}}
EXPEDIENTE: {{numeroExpediente}}

C. JUEZ {{juzgado}}
P R E S E N T E.

{{nombreDemandado}}{{#comparecePorApoderado}}, por conducto de mi apoderado {{nombreApoderado}} ({{instrumentoPoder}}){{/comparecePorApoderado}}, en mi carácter de parte DEMANDADA en el juicio al rubro indicado que promueve en mi contra {{nombreActor}}, señalando como domicilio para oír y recibir notificaciones {{domicilioNotificaciones}} y autorizando a {{autorizados}} (correo {{correoElectronico}}), ante Usted comparezco y expongo:

Que en tiempo y forma vengo a dar CONTESTACIÓN a la demanda entablada en mi contra, en los siguientes términos:

CONTESTACIÓN A LAS PRESTACIONES
Se contradicen todas y cada una de las prestaciones reclamadas por no proceder ni en los hechos ni en derecho, conforme se expone en la presente.

CONTESTACIÓN A LOS HECHOS
{{#each contestacionHechos}}{{item.n}}. {{item.texto}}
{{/each contestacionHechos}}
E X C E P C I O N E S   Y   D E F E N S A S
{{#each excepciones}}{{item.orden}}.- {{item.texto}}
{{/each excepciones}}
D E R E C H O
{{fundamentosDerecho}}

P R U E B A S
{{pruebas}}

Por lo expuesto, a Usted C. Juez atentamente pido se sirva:

P U N T O S   P E T I T O R I O S
{{#each puntosPetitorios}}{{item.orden}}.- {{item.texto}}
{{/each puntosPetitorios}}
PROTESTO LO NECESARIO.
{{lugar}}, a {{fecha}}.


_______________________________
{{firmaNombre}}`,
};

export const escritos: PlantillaEscrito[] = [
  demandaMercantil,
  demandaCivil,
  promocion,
  contestacion,
];

export function getEscrito(tipo: string): PlantillaEscrito | undefined {
  return escritos.find((p) => p.tipo === tipo);
}

export function valoresInicialesEscrito(plantilla: PlantillaEscrito): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of plantilla.campos) if (c.valorInicial !== undefined) out[c.id] = c.valorInicial;
  return out;
}

// ---------------------------------------------------------------------------
//  Motor de render (independiente del de Contratos)
// ---------------------------------------------------------------------------
export function renderEscrito(plantilla: PlantillaEscrito, valores: Record<string, unknown>): string {
  let texto = plantilla.cuerpo;

  // Helpers de posición procesal
  const pos = String(valores.posicionProcesal ?? "");
  const esActor = pos.startsWith("Actor") || pos.startsWith("Usucap");
  const esDemandado = pos.startsWith("Demandado");
  const esTercero = pos.startsWith("Tercero");
  const esUsucapion = pos.startsWith("Usucap");
  const esSucesorio = pos.startsWith("Suces");

  // Listas repetibles: {{#each NOMBRE}}…{{item.campo}}…{{/each NOMBRE}}
  // item.n = número (1,2,3), item.letra = a,b,c, item.romano = I,II,III,
  // item.orden = PRIMERO, SEGUNDO…
  texto = texto.replace(/\{\{#each ([a-zA-Z]+)\}\}([\s\S]*?)\{\{\/each \1\}\}/g, (_m, nombre, tpl) => {
    const arr = valores[nombre];
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr
      .map((item, i) => {
        const it = (item ?? {}) as Record<string, unknown>;
        return (tpl as string).replace(/\{\{item\.([a-zA-Z]+)\}\}/g, (_mm: string, campo: string) => {
          if (campo === "n") return String(i + 1);
          if (campo === "letra") return String.fromCharCode(97 + (i % 26));
          if (campo === "romano") return aRomano(i + 1);
          if (campo === "orden") return ORDINALES[i] ?? `${i + 1}º`;
          const v = it[campo];
          return v === undefined || v === null || v === "" ? "" : String(v);
        });
      })
      .join("");
  });

  // Bloques condicionales {{#campo}}…{{/campo}}
  texto = texto.replace(/\{\{#([a-zA-Z]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, key, block) => {
    if (key === "esActor") return esActor ? block : "";
    if (key === "esDemandado") return esDemandado ? block : "";
    if (key === "esTercero") return esTercero ? block : "";
    if (key === "esUsucapion") return esUsucapion ? block : "";
    if (key === "esSucesorio") return esSucesorio ? block : "";
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

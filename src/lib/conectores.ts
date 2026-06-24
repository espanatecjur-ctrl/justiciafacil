/**
 * Catálogo de conectores a fuentes oficiales del Poder Judicial en México.
 * MVP: estructura lista para conectar via scraping configurable o APIs cuando existan.
 */
export interface ConectorJuzgado {
  id: string;
  nombre: string;
  fuero: "federal" | "estatal";
  entidad: string;
  metodo: "api" | "scraping" | "rpa" | "manual";
  url: string;
  estado: "operativo" | "intermitente" | "no_disponible" | "en_desarrollo";
  capacidades: ("consulta_expedientes" | "boletines" | "acuerdos" | "exhortos" | "amparos" | "audiencias")[];
  notas?: string;
}

export const conectores: ConectorJuzgado[] = [
  {
    id: "pjf-sise",
    nombre: "Consejo de la Judicatura Federal — SISE",
    fuero: "federal",
    entidad: "Federal",
    metodo: "scraping",
    url: "https://www.dgepj.cjf.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "acuerdos", "audiencias", "boletines"],
    notas: "Scraping vía dgepj.cjf.gob.mx. Requiere CAPTCHA en algunas consultas.",
  },
  {
    id: "scjn",
    nombre: "SCJN — Sentencias y Tesis",
    fuero: "federal",
    entidad: "Federal",
    metodo: "api",
    url: "https://www.scjn.gob.mx/",
    estado: "operativo",
    capacidades: ["acuerdos", "amparos"],
  },
  {
    id: "tsjcdmx",
    nombre: "Tribunal Superior de Justicia CDMX",
    fuero: "estatal",
    entidad: "CDMX",
    metodo: "scraping",
    url: "https://www.poderjudicialcdmx.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "boletines", "exhortos"],
  },
  {
    id: "pjedomex",
    nombre: "Poder Judicial Estado de México",
    fuero: "estatal",
    entidad: "Estado de México",
    metodo: "scraping",
    url: "https://www.pjedomex.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "boletines"],
  },
  {
    id: "pjj",
    nombre: "Poder Judicial Jalisco",
    fuero: "estatal",
    entidad: "Jalisco",
    metodo: "scraping",
    url: "https://www.cjj.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "boletines", "acuerdos"],
  },
  {
    id: "pjnl",
    nombre: "Poder Judicial Nuevo León",
    fuero: "estatal",
    entidad: "Nuevo León",
    metodo: "scraping",
    url: "https://www.pjenl.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "acuerdos", "boletines"],
  },
  {
    id: "pjqro",
    nombre: "Poder Judicial Querétaro",
    fuero: "estatal",
    entidad: "Querétaro",
    metodo: "scraping",
    url: "https://www.tribunalqro.gob.mx/",
    estado: "intermitente",
    capacidades: ["consulta_expedientes", "boletines"],
  },
  {
    id: "pjpue",
    nombre: "Poder Judicial Puebla",
    fuero: "estatal",
    entidad: "Puebla",
    metodo: "scraping",
    url: "https://www.htsjpuebla.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "boletines"],
  },
  {
    id: "pjbc",
    nombre: "Poder Judicial Baja California",
    fuero: "estatal",
    entidad: "Baja California",
    metodo: "scraping",
    url: "https://www.pjbc.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes"],
  },
  {
    id: "tfja",
    nombre: "Tribunal Federal de Justicia Administrativa",
    fuero: "federal",
    entidad: "Federal",
    metodo: "scraping",
    url: "https://www.tfja.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "boletines"],
  },
  {
    id: "tribunal-laboral-federal",
    nombre: "Tribunales Laborales Federales",
    fuero: "federal",
    entidad: "Federal",
    metodo: "scraping",
    url: "https://www.cjf.gob.mx/",
    estado: "operativo",
    capacidades: ["consulta_expedientes", "audiencias"],
  },
  {
    id: "buho-legal",
    nombre: "Búho Legal (proveedor terceros)",
    fuero: "federal",
    entidad: "Multi-estatal",
    metodo: "api",
    url: "https://www.buholegal.com/",
    estado: "en_desarrollo",
    capacidades: ["consulta_expedientes", "boletines", "acuerdos", "audiencias"],
    notas: "Requiere API key del proveedor. Configurar en Conectores → Búho Legal.",
  },
];

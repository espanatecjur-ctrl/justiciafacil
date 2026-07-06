// JusticiaFácil · Traductor Boletín → Etapa del seguimiento
// Convierte el texto de una actuación del boletín en la etapa procesal que
// le corresponde. Diccionario validado por la abogada (Paola).
// Cada entrada trae su "acto": promoción (la mete la parte) o acuerdo (lo dicta
// el juzgado). Los patrones están ordenados de la etapa MÁS AVANZADA a la más
// inicial, para que si un acuerdo menciona varias, gane la más avanzada.
import { type EtapaJuicio } from "@/lib/etapas-juicio";

export type ActoEtapa = "promocion" | "acuerdo";
export interface MatchEtapa {
  clave: string;      // clave de la etapa en el catálogo (etapas-juicio.ts)
  acto: ActoEtapa;
  etiqueta: string;   // texto para mostrar en la sugerencia
}

const PATRONES: { re: RegExp; clave: string; acto: ActoEtapa; etiqueta: string }[] = [
  // Recursos (lo más avanzado)
  { re: /amparo|suspensi[oó]n/i,                         clave: "amparo",              acto: "promocion", etiqueta: "Amparo" },
  { re: /revocaci[oó]n|queja/i,                          clave: "apelacion",           acto: "promocion", etiqueta: "Recurso (revocación/queja)" },
  { re: /apelaci[oó]n/i,                                 clave: "apelacion",           acto: "promocion", etiqueta: "Apelación" },
  // Ejecución
  { re: /escrituraci[oó]n|otorgamiento en rebeld[ií]a/i, clave: "ejecucion",           acto: "acuerdo",   etiqueta: "Ejecución (escrituración)" },
  { re: /adjudicaci[oó]n|fincamiento/i,                  clave: "ejecucion",           acto: "acuerdo",   etiqueta: "Ejecución (adjudicación)" },
  { re: /remate|almoneda|convocatoria/i,                 clave: "ejecucion",           acto: "acuerdo",   etiqueta: "Ejecución (remate)" },
  { re: /aval[uú]o/i,                                    clave: "ejecucion",           acto: "acuerdo",   etiqueta: "Ejecución (avalúo)" },
  { re: /planilla|liquidaci[oó]n de intereses/i,         clave: "ejecucion",           acto: "promocion", etiqueta: "Ejecución (planilla)" },
  { re: /ejecuci[oó]n|v[ií]a de apremio/i,               clave: "ejecucion",           acto: "acuerdo",   etiqueta: "Ejecución" },
  // Conclusiva
  { re: /citaci[oó]n para sentencia|c[ií]tese|c[ií]tase/i, clave: "citacion_sentencia", acto: "acuerdo",   etiqueta: "Citación para sentencia" },
  { re: /sentencia/i,                                    clave: "sentencia",           acto: "acuerdo",   etiqueta: "Sentencia" },
  { re: /alegatos/i,                                     clave: "alegatos",            acto: "promocion", etiqueta: "Alegatos" },
  // Audiencias
  { re: /audiencia de juicio|juicio oral/i,              clave: "audiencia_juicio",    acto: "acuerdo",   etiqueta: "Audiencia de juicio" },
  { re: /audiencia preliminar|depuraci[oó]n/i,           clave: "audiencia_preliminar", acto: "acuerdo",  etiqueta: "Audiencia preliminar" },
  { re: /audiencia/i,                                    clave: "audiencia_juicio",    acto: "acuerdo",   etiqueta: "Audiencia de juicio" },
  // Probatoria
  { re: /admisi[oó]n de prueba|se admiten prueba/i,      clave: "ofrecimiento_pruebas", acto: "acuerdo",  etiqueta: "Ofrecimiento (admisión)" },
  { re: /ofrecimiento de prueba|ofrece prueba/i,         clave: "ofrecimiento_pruebas", acto: "promocion", etiqueta: "Ofrecimiento de pruebas" },
  { re: /desahogo|audiencia de prueba/i,                 clave: "desahogo",            acto: "acuerdo",   etiqueta: "Desahogo de pruebas" },
  { re: /prueba/i,                                       clave: "desahogo",            acto: "acuerdo",   etiqueta: "Desahogo de pruebas" },
  // Ejecución inicial (ejecutivo mercantil)
  { re: /requerimiento de pago|requerimiento|embargo/i,  clave: "requerimiento_embargo", acto: "acuerdo", etiqueta: "Requerimiento y embargo" },
  { re: /exequendo|mandamiento/i,                        clave: "auto_exequendo",      acto: "acuerdo",   etiqueta: "Auto de exequendo" },
  // Postulatoria
  { re: /dar vista|vista/i,                              clave: "vista_contestacion",  acto: "acuerdo",   etiqueta: "Vista con la contestación" },
  { re: /rebeld[ií]a/i,                                  clave: "contestacion",        acto: "acuerdo",   etiqueta: "Contestación (en rebeldía)" },
  { re: /contesta/i,                                     clave: "contestacion",        acto: "promocion", etiqueta: "Contestación" },
  { re: /emplaza|emplazamiento/i,                        clave: "emplazamiento",       acto: "acuerdo",   etiqueta: "Emplazamiento" },
  { re: /previene|prevenci[oó]n/i,                       clave: "admision",            acto: "acuerdo",   etiqueta: "Admisión (prevención)" },
  { re: /admite|radica|auto admisorio|radicaci[oó]n/i,   clave: "admision",            acto: "acuerdo",   etiqueta: "Admisión" },
  { re: /demanda|escrito inicial/i,                      clave: "demanda",             acto: "promocion", etiqueta: "Presentación de demanda" },
];

// Traduce UN texto del boletín a su etapa (o null si no reconoce nada).
export function traducirBoletin(texto: string | null | undefined): MatchEtapa | null {
  const t = texto || "";
  for (const p of PATRONES) if (p.re.test(t)) return { clave: p.clave, acto: p.acto, etiqueta: p.etiqueta };
  return null;
}

// Dada una lista de textos del boletín y las etapas del tipo de juicio,
// devuelve la etapa MÁS AVANZADA reconocida que aplique a ese tipo (o null).
export function sugerirEtapa(
  textos: (string | null | undefined)[],
  etapas: EtapaJuicio[],
): (MatchEtapa & { indice: number }) | null {
  let mejor: (MatchEtapa & { indice: number }) | null = null;
  for (const txt of textos) {
    const m = traducirBoletin(txt);
    if (!m) continue;
    const idx = etapas.findIndex((e) => e.clave === m.clave);
    if (idx < 0) continue; // esa etapa no aplica a este tipo de juicio
    if (!mejor || idx > mejor.indice) mejor = { ...m, indice: idx };
  }
  return mejor;
}

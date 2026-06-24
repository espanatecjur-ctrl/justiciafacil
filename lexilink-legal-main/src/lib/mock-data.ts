import type {
  Expediente,
  BoletinEntry,
  Exhorto,
  Amparo,
  Recurso,
  Tramite,
  Contrato,
  DictamenIA,
} from "./legal-types";

export const expedientes: Expediente[] = [
  {
    id: "exp-001",
    numero: "1245/2024",
    juzgado: "Juzgado 23º Civil CDMX",
    fuero: "estatal",
    entidad: "CDMX",
    materia: "civil",
    tipoJuicio: "Ordinario Civil — Cumplimiento de contrato",
    estado: "pruebas",
    fechaInicio: "2024-03-12",
    ultimaActuacion: "2026-06-15",
    cuantia: 1850000,
    riesgo: "medio",
    resumen:
      "Demanda por incumplimiento de contrato de prestación de servicios profesionales. Etapa probatoria abierta hasta 30/jul.",
    partes: [
      { id: "p1", nombre: "Inmobiliaria del Valle SA de CV", caracter: "actor", rfc: "IDV950312XX1" },
      { id: "p2", nombre: "Servicios Integrales Maya SC", caracter: "demandado", rfc: "SIM050918AB2", apoderado: "Lic. Roberto Núñez" },
    ],
    hitos: [
      { id: "h1", fecha: "2024-03-12", tipo: "promocion", titulo: "Presentación de demanda" },
      { id: "h2", fecha: "2024-04-02", tipo: "acuerdo", titulo: "Admisión a trámite" },
      { id: "h3", fecha: "2024-05-18", tipo: "notificacion", titulo: "Emplazamiento a demandada" },
      { id: "h4", fecha: "2024-06-08", tipo: "promocion", titulo: "Contestación de demanda" },
      { id: "h5", fecha: "2026-06-15", tipo: "audiencia", titulo: "Audiencia de pruebas y alegatos", critico: true },
    ],
  },
  {
    id: "exp-002",
    numero: "874/2025",
    juzgado: "Juzgado 5º Familiar Edomex (Toluca)",
    fuero: "estatal",
    entidad: "Estado de México",
    materia: "familiar",
    tipoJuicio: "Sucesorio Intestamentario",
    estado: "admision",
    fechaInicio: "2025-11-20",
    ultimaActuacion: "2026-06-20",
    riesgo: "bajo",
    resumen: "Denuncia de sucesión intestamentaria. Pendiente nombramiento de albacea provisional.",
    partes: [
      { id: "p3", nombre: "María Fernanda Soto Hdz.", caracter: "sucesorio", curp: "SOHM850412MDFTRR03" },
      { id: "p4", nombre: "Carlos Eduardo Soto Hdz.", caracter: "sucesorio" },
    ],
    hitos: [
      { id: "h6", fecha: "2025-11-20", tipo: "promocion", titulo: "Denuncia de sucesión" },
      { id: "h7", fecha: "2026-06-20", tipo: "audiencia", titulo: "Junta de herederos", critico: true },
    ],
  },
  {
    id: "exp-003",
    numero: "PE-340/2025",
    juzgado: "Juzgado 3º Distrito en Materia Penal",
    fuero: "federal",
    entidad: "Federal",
    materia: "penal",
    tipoJuicio: "Causa Penal — Fraude específico",
    estado: "alegatos",
    fechaInicio: "2025-02-08",
    ultimaActuacion: "2026-06-10",
    cuantia: 3200000,
    riesgo: "alto",
    resumen: "Carpeta judicializada. Próxima audiencia intermedia. Defensa promovió pruebas supervenientes.",
    partes: [
      { id: "p5", nombre: "Ministerio Público de la Federación", caracter: "denunciante" },
      { id: "p6", nombre: "J. Ramón Pacheco Loera", caracter: "imputado", curp: "PALR780501HDFRRR04" },
      { id: "p7", nombre: "Distribuidora Norte SA de CV", caracter: "victima" },
    ],
    hitos: [
      { id: "h8", fecha: "2025-02-08", tipo: "acuerdo", titulo: "Vinculación a proceso" },
      { id: "h9", fecha: "2025-08-14", tipo: "audiencia", titulo: "Audiencia inicial" },
      { id: "h10", fecha: "2026-07-02", tipo: "audiencia", titulo: "Audiencia intermedia", critico: true },
    ],
  },
  {
    id: "exp-004",
    numero: "MERC-2210/2024",
    juzgado: "Juzgado 8º Mercantil CDMX",
    fuero: "estatal",
    entidad: "CDMX",
    materia: "mercantil",
    tipoJuicio: "Ejecutivo Mercantil",
    estado: "ejecucion",
    fechaInicio: "2024-09-01",
    ultimaActuacion: "2026-06-22",
    cuantia: 745000,
    riesgo: "bajo",
    resumen: "Sentencia firme a favor. En etapa de ejecución y avalúo de bienes embargados.",
    partes: [
      { id: "p8", nombre: "Banco del Bajío SA", caracter: "actor" },
      { id: "p9", nombre: "Comercializadora Río Verde", caracter: "demandado" },
      { id: "p10", nombre: "Juan Manuel Ríos", caracter: "garante", curp: "RIVJ700810HDFXXX01" },
    ],
    hitos: [
      { id: "h11", fecha: "2024-09-01", tipo: "promocion", titulo: "Demanda + auto de exequendo" },
      { id: "h12", fecha: "2026-02-19", tipo: "sentencia", titulo: "Sentencia definitiva" },
      { id: "h13", fecha: "2026-06-22", tipo: "acuerdo", titulo: "Requerimiento de pago y embargo" },
    ],
  },
  {
    id: "exp-005",
    numero: "LAB-1102/2025",
    juzgado: "Tribunal Laboral Federal — Jalisco",
    fuero: "federal",
    entidad: "Jalisco",
    materia: "laboral",
    tipoJuicio: "Demanda Individual — Despido injustificado",
    estado: "contestacion",
    fechaInicio: "2025-12-05",
    ultimaActuacion: "2026-06-18",
    cuantia: 320000,
    riesgo: "medio",
    resumen: "Audiencia preliminar celebrada. Patrón ofreció reinstalación, trabajador rechazó.",
    partes: [
      { id: "p11", nombre: "Andrea Vásquez M.", caracter: "actor" },
      { id: "p12", nombre: "Logística Bajío SA de CV", caracter: "demandado" },
    ],
    hitos: [
      { id: "h14", fecha: "2025-12-05", tipo: "promocion", titulo: "Presentación de demanda" },
      { id: "h15", fecha: "2026-04-10", tipo: "audiencia", titulo: "Audiencia preliminar" },
      { id: "h16", fecha: "2026-07-15", tipo: "audiencia", titulo: "Audiencia de juicio", critico: true },
    ],
  },
];

export const boletines: BoletinEntry[] = [
  { id: "b1", fecha: "2026-06-23", juzgado: "Juzgado 23º Civil CDMX", entidad: "CDMX", expediente: "1245/2024", tipoAcuerdo: "Acuerdo", sintesis: "Se admiten pruebas ofrecidas por la actora y se desahogarán el 15/jul." },
  { id: "b2", fecha: "2026-06-23", juzgado: "Juzgado 8º Mercantil CDMX", entidad: "CDMX", expediente: "MERC-2210/2024", tipoAcuerdo: "Requerimiento", sintesis: "Se requiere pago a la demandada apercibida de embargo en bienes propios." },
  { id: "b3", fecha: "2026-06-22", juzgado: "Tribunal Laboral Federal — Jalisco", entidad: "Jalisco", expediente: "LAB-1102/2025", tipoAcuerdo: "Citación", sintesis: "Se cita a las partes a audiencia de juicio el 15/jul a las 10:00." },
  { id: "b4", fecha: "2026-06-22", juzgado: "Juzgado 3º Distrito Penal", entidad: "Federal", expediente: "PE-340/2025", tipoAcuerdo: "Acuerdo", sintesis: "Se admiten pruebas supervenientes de la defensa." },
  { id: "b5", fecha: "2026-06-20", juzgado: "Juzgado 5º Familiar Edomex", entidad: "Edomex", expediente: "874/2025", tipoAcuerdo: "Acuerdo", sintesis: "Se cita a junta de herederos para el 20/jul." },
];

export const exhortos: Exhorto[] = [
  { id: "ex1", folio: "EXH-552/2026", expedienteOrigen: "1245/2024", juzgadoOrigen: "Juzgado 23º Civil CDMX", juzgadoExhortado: "Juzgado Mixto Mérida", materia: "civil", diligencia: "Notificación personal a testigo", estado: "girado", fechaGiro: "2026-06-01", vencimiento: "2026-07-15" },
  { id: "ex2", folio: "EXH-118/2026", expedienteOrigen: "MERC-2210/2024", juzgadoOrigen: "Juzgado 8º Mercantil CDMX", juzgadoExhortado: "Juzgado 2º Civil Querétaro", materia: "mercantil", diligencia: "Embargo de bien inmueble", estado: "diligenciado", fechaGiro: "2026-05-15", vencimiento: "2026-06-30" },
  { id: "ex3", folio: "EXH-203/2026", expedienteOrigen: "PE-340/2025", juzgadoOrigen: "Juzgado 3º Distrito Penal", juzgadoExhortado: "Juzgado 1º Distrito Monterrey", materia: "penal", diligencia: "Declaración de testigo", estado: "recibido", fechaGiro: "2026-06-10", vencimiento: "2026-07-25" },
];

export const amparos: Amparo[] = [
  { id: "am1", numero: "AI-1240/2026", tipo: "indirecto", juzgadoDistrito: "Juzgado 12º Distrito CDMX", quejoso: "Servicios Integrales Maya SC", autoridadResponsable: "Juez 23º Civil CDMX", actoReclamado: "Acuerdo que admite pruebas", estado: "suspension", fechaPromocion: "2026-06-18" },
  { id: "am2", numero: "AD-330/2026", tipo: "directo", tribunalColegiado: "Primer T.C.C. del 1er Circuito", quejoso: "Andrea Vásquez M.", autoridadResponsable: "Tribunal Laboral Federal Jalisco", actoReclamado: "Sentencia definitiva", estado: "tramite", fechaPromocion: "2026-05-22" },
];

export const recursos: Recurso[] = [
  { id: "r1", tipo: "apelacion", expediente: "MERC-2210/2024", promovente: "Comercializadora Río Verde", estado: "tramite", fechaInterposicion: "2026-03-04" },
  { id: "r2", tipo: "revocacion", expediente: "1245/2024", promovente: "Servicios Integrales Maya SC", estado: "resuelto", fechaInterposicion: "2026-05-10", resolucion: "Improcedente" },
];

export const tramites: Tramite[] = [
  { id: "t1", tipo: "curp", solicitante: "Andrea Vásquez M.", estado: "completado", fechaSolicitud: "2026-04-10" },
  { id: "t2", tipo: "rfc", solicitante: "Inmobiliaria del Valle SA de CV", estado: "en_proceso", fechaSolicitud: "2026-06-15" },
  { id: "t3", tipo: "acta_nacimiento", solicitante: "María Fernanda Soto", estado: "documentos_pendientes", fechaSolicitud: "2026-06-18", notas: "Falta identificación vigente del solicitante." },
  { id: "t4", tipo: "infonavit", solicitante: "Juan Manuel Ríos", estado: "solicitado", fechaSolicitud: "2026-06-20" },
  { id: "t5", tipo: "constancia_situacion_fiscal", solicitante: "Servicios Integrales Maya SC", estado: "completado", fechaSolicitud: "2026-05-30" },
];

export const contratos: Contrato[] = [
  { id: "c1", tipo: "prestacion_servicios", titulo: "Asesoría jurídica corporativa — Inmobiliaria del Valle", partes: ["Despacho SIGA", "Inmobiliaria del Valle SA"], fechaFirma: "2025-09-15", estado: "firmado", cuantia: 360000, vigencia: "12 meses" },
  { id: "c2", tipo: "arrendamiento", titulo: "Oficina Polanco 802", partes: ["Despacho SIGA", "Edificios Reforma SA"], fechaFirma: "2025-01-10", estado: "firmado", cuantia: 480000, vigencia: "24 meses" },
  { id: "c3", tipo: "confidencialidad", titulo: "NDA — Logística Bajío", partes: ["Despacho SIGA", "Logística Bajío SA de CV"], fechaFirma: "2026-03-22", estado: "firmado" },
  { id: "c4", tipo: "poder_notarial", titulo: "Poder general para pleitos y cobranzas", partes: ["Banco del Bajío SA", "Lic. Estela Mendoza"], fechaFirma: "2026-04-05", estado: "firmado" },
  { id: "c5", tipo: "compraventa", titulo: "Inmueble Lomas de Chapultepec", partes: ["Inmobiliaria del Valle SA", "Familia Pacheco"], fechaFirma: "2026-06-01", estado: "revision", cuantia: 18500000 },
];

export const dictamenes: DictamenIA[] = [
  {
    id: "d1",
    expedienteId: "exp-001",
    fecha: "2026-06-22",
    probabilidadExito: 68,
    caracter: "actor",
    resumen:
      "Posición procesal favorable como actor: contrato escrito, evidencia documental de incumplimiento y testigos disponibles. Riesgo principal es la oposición de excepciones por cumplimiento parcial.",
    riesgos: [
      "Demandada puede acreditar pago parcial (40%)",
      "Posible amparo indirecto contra admisión de pruebas",
      "Plazos cortos para alegatos",
    ],
    recomendaciones: [
      "Reforzar prueba pericial contable",
      "Preparar contestación de excepciones por escrito",
      "Solicitar medida cautelar de embargo precautorio",
    ],
    precedentes: [
      { tesis: "1a./J. 45/2022", rubro: "CONTRATO DE PRESTACIÓN DE SERVICIOS. CARGA DE LA PRUEBA.", relevancia: 92 },
      { tesis: "I.7o.C.123 C (10a.)", rubro: "INCUMPLIMIENTO PARCIAL. EFECTOS.", relevancia: 78 },
    ],
  },
];

export function getExpediente(id: string) {
  return expedientes.find((e) => e.id === id);
}

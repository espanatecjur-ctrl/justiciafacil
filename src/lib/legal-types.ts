// Tipos de dominio jurídico — MX
export type EstadoProcesal =
  | "admision"
  | "emplazamiento"
  | "contestacion"
  | "pruebas"
  | "alegatos"
  | "sentencia"
  | "apelacion"
  | "amparo"
  | "ejecucion"
  | "concluido"
  | "archivado";

export type Caracter =
  | "actor"
  | "demandado"
  | "tercero"
  | "sucesorio"
  | "denunciante"
  | "imputado"
  | "victima"
  | "ofendido"
  | "garante"
  | "fiador"
  | "apoderado";

export type Materia =
  | "civil"
  | "mercantil"
  | "familiar"
  | "penal"
  | "laboral"
  | "amparo"
  | "administrativo"
  | "fiscal"
  | "agrario";

export type Fuero = "federal" | "estatal" | "municipal";

export interface Hito {
  id: string;
  fecha: string; // ISO
  tipo: "acuerdo" | "audiencia" | "promocion" | "notificacion" | "sentencia" | "recurso" | "amparo" | "exhorto";
  titulo: string;
  descripcion?: string;
  documentoUrl?: string;
  critico?: boolean;
}

export interface Parte {
  id: string;
  nombre: string;
  caracter: Caracter;
  rfc?: string;
  curp?: string;
  domicilio?: string;
  apoderado?: string;
  estadoCivil?: "soltero" | "casado" | "divorciado" | "viudo";
  conyuge?: string;
}

export interface Expediente {
  id: string;
  numero: string;
  juzgado: string;
  fuero: Fuero;
  entidad: string;
  materia: Materia;
  tipoJuicio: string;
  estado: EstadoProcesal;
  fechaInicio: string;
  ultimaActuacion: string;
  cuantia?: number;
  partes: Parte[];
  hitos: Hito[];
  riesgo: "bajo" | "medio" | "alto" | "critico";
  resumen: string;
}

export interface BoletinEntry {
  id: string;
  fecha: string;
  juzgado: string;
  entidad: string;
  expediente: string;
  tipoAcuerdo: string;
  sintesis: string;
}

export interface Exhorto {
  id: string;
  folio: string;
  expedienteOrigen: string;
  juzgadoOrigen: string;
  juzgadoExhortado: string;
  materia: Materia;
  diligencia: string;
  estado: "girado" | "recibido" | "diligenciado" | "devuelto" | "cumplimentado";
  fechaGiro: string;
  vencimiento: string;
}

export interface Amparo {
  id: string;
  numero: string;
  tipo: "directo" | "indirecto";
  juzgadoDistrito?: string;
  tribunalColegiado?: string;
  quejoso: string;
  autoridadResponsable: string;
  actoReclamado: string;
  estado: "tramite" | "suspension" | "sentencia" | "revision" | "concluido";
  fechaPromocion: string;
}

export interface Recurso {
  id: string;
  tipo: "apelacion" | "revision" | "queja" | "revocacion" | "reposicion";
  expediente: string;
  promovente: string;
  estado: "interpuesto" | "admitido" | "tramite" | "resuelto";
  fechaInterposicion: string;
  resolucion?: string;
}

export interface Tramite {
  id: string;
  tipo: "curp" | "rfc" | "acta_nacimiento" | "acta_matrimonio" | "acta_defuncion" | "infonavit" | "imss" | "antecedentes" | "constancia_situacion_fiscal";
  solicitante: string;
  estado: "solicitado" | "en_proceso" | "documentos_pendientes" | "completado" | "rechazado";
  fechaSolicitud: string;
  vencimiento?: string;
  notas?: string;
}

export interface Contrato {
  id: string;
  tipo: ContratoTipo;
  titulo: string;
  partes: string[];
  fechaFirma: string;
  estado: "borrador" | "revision" | "firmado" | "rescindido" | "vencido";
  cuantia?: number;
  vigencia?: string;
}

export type ContratoTipo =
  | "carta_cambio"
  | "contrato_cambio"
  | "oficio_notarial"
  | "prestacion_servicios"
  | "prestacion_diipa"
  | "comision_mercantil"
  | "acta_finiquito"
  | "compraventa"
  | "arrendamiento"
  | "mutuo"
  | "comodato"
  | "poder_notarial"
  | "transaccion"
  | "donacion"
  | "confidencialidad"
  | "cesion_reestructura"
  | "prestacion_promesa"
  | "laboral";

export interface DictamenIA {
  id: string;
  expedienteId: string;
  fecha: string;
  probabilidadExito: number; // 0-100
  caracter: Caracter;
  resumen: string;
  riesgos: string[];
  recomendaciones: string[];
  precedentes: { tesis: string; rubro: string; relevancia: number }[];
}

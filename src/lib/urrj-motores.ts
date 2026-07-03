// ============================================================
// URRJ · Motores de cálculo legal (pre-dictamen)
// Calcula prescripción, caducidad, usucapión y el cálculo
// financiero según las leyes de México y el estado del juicio.
// El abogado captura las fechas; estos motores hacen los números.
// ============================================================

export type Semaforo = "verde" | "amarillo" | "naranja" | "rojo" | "gris";

export interface ResultadoMotor {
  semaforo: Semaforo;
  etiqueta: string;   // "Vigente", "Prescrita", etc.
  detalle: string;    // explicación en lenguaje sencillo
  dato?: string;      // número clave (ej. "193 días", "6.2 años")
}

// ---------- Plazos por estado (caducidad de la instancia) ----------
// CNPCF = Código Nacional de Procedimientos Civiles y Familiares (120 días hábiles)
// Códigos locales viejos = 180 días naturales (120 en CDMX viejo)
export interface PlazoEstado {
  estado: string;
  caducidadDias: number;
  caducidadHabiles: boolean; // true = días hábiles (CNPCF), false = naturales
  fundamento: string;
}

export const PLAZOS_ESTADO: Record<string, PlazoEstado> = {
  Federal:   { estado: "Federal",   caducidadDias: 120, caducidadHabiles: true,  fundamento: "Art. 389 CNPCF (días hábiles)" },
  Jalisco:   { estado: "Jalisco",   caducidadDias: 180, caducidadHabiles: false, fundamento: "CPC Jalisco (180 días naturales, mientras entra CNPCF)" },
  Sinaloa:   { estado: "Sinaloa",   caducidadDias: 180, caducidadHabiles: false, fundamento: "Art. 137 BIS CPC Sinaloa (180 días naturales)" },
  "Baja California Sur": { estado: "Baja California Sur", caducidadDias: 180, caducidadHabiles: false, fundamento: "Art. 124 CPC-BCS (180 días naturales)" },
  CDMX:      { estado: "CDMX",      caducidadDias: 120, caducidadHabiles: false, fundamento: "Art. 137 BIS CPC CDMX (120 días); CNPCF desde jun-2026" },
};

export const ESTADOS_URRJ = Object.keys(PLAZOS_ESTADO);

// ---------- Plazos de prescripción por tipo de acción ----------
export interface TipoAccion {
  clave: string;
  nombre: string;
  anios: number;
  fundamento: string;
}

export const TIPOS_ACCION: TipoAccion[] = [
  { clave: "hipotecaria",        nombre: "Hipotecaria",                 anios: 10, fundamento: "Art. 2918 CCF (10 años)" },
  { clave: "civil",              nombre: "Civil / ordinaria",           anios: 10, fundamento: "Art. 1159 CCF (10 años)" },
  { clave: "mercantil_ordinaria",nombre: "Mercantil ordinaria",         anios: 10, fundamento: "Art. 1159 CCF (10 años)" },
  { clave: "mercantil_ejecutiva",nombre: "Mercantil ejecutiva",         anios: 3,  fundamento: "Art. 1047 CCom (3 años)" },
  { clave: "pagare",             nombre: "Pagaré",                      anios: 3,  fundamento: "Art. 165 LGTOC (3 años)" },
  { clave: "cheque",             nombre: "Cheque",                      anios: 0.5,fundamento: "Art. 192 LGTOC (6 meses)" },
];

// ---------- Utilidades de fechas ----------
export function diasNaturales(desde: string, hasta: string): number {
  const a = new Date(desde).getTime();
  const b = new Date(hasta).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function diasHabiles(desde: string, hasta: string): number {
  const a = new Date(desde);
  const b = new Date(hasta);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return 0;
  let c = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) c++;
  }
  return c;
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function semaforoPorcentaje(pct: number): Semaforo {
  if (pct >= 1) return "rojo";
  if (pct >= 0.8) return "naranja";
  if (pct >= 0.5) return "amarillo";
  return "verde";
}

// ============================================================
// MOTOR · PRESCRIPCIÓN
// Si está emplazado: años = Emplazamiento − Último pago
// Si NO: años = Hoy − Último pago
// Convenio ratificado reinicia el conteo (esa fecha manda).
// ============================================================
export interface EntradaPrescripcion {
  ultimoPago: string;            // fecha último pago del acreditado
  emplazado: boolean;
  fechaEmplazamiento?: string;
  tipoAccion: string;            // clave de TIPOS_ACCION
  convenioRatificadoFecha?: string; // si hay convenio ratificado
  plazoManualAnios?: number;     // opción: el abogado sobrescribe el plazo
  interpelacionFecha?: string;   // interpelación por jurisdicción voluntaria — interrumpe (Art. 1168 CCF)
}

export function motorPrescripcion(e: EntradaPrescripcion): ResultadoMotor {
  const tipo = TIPOS_ACCION.find((t) => t.clave === e.tipoAccion) || TIPOS_ACCION[0];
  const plazo = e.plazoManualAnios && e.plazoManualAnios > 0 ? e.plazoManualAnios : tipo.anios;

  // El convenio ratificado reinicia el conteo
  const inicio = e.convenioRatificadoFecha || e.ultimoPago;
  if (!inicio) return { semaforo: "gris", etiqueta: "Falta dato", detalle: "Captura la fecha del último pago.", };

  // Interrupciones (Art. 1168 CCF): el emplazamiento de la demanda y la interpelación
  // judicial por jurisdicción voluntaria. La prescripción se detiene en la MÁS TEMPRANA.
  const cortes: { fecha: string; label: string }[] = [];
  if (e.emplazado && e.fechaEmplazamiento) cortes.push({ fecha: e.fechaEmplazamiento, label: "emplazamiento" });
  if (e.interpelacionFecha) cortes.push({ fecha: e.interpelacionFecha, label: "interpelación (jurisdicción voluntaria)" });
  cortes.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const corteEvento = cortes[0];

  const fin = corteEvento ? corteEvento.fecha : hoyISO();
  const dias = diasNaturales(inicio, fin);
  const anios = dias / 365.25;
  const pct = anios / plazo;
  const sem = semaforoPorcentaje(pct);

  const base = e.convenioRatificadoFecha ? "convenio ratificado" : "último pago";
  const corte = corteEvento ? corteEvento.label : "hoy";
  const etiqueta = sem === "rojo" ? "Prescrita" : sem === "naranja" ? "Crítica" : sem === "amarillo" ? "Media" : "Vigente";

  return {
    semaforo: sem,
    etiqueta,
    dato: `${anios.toFixed(1)} de ${plazo} años`,
    detalle: `${tipo.nombre}: ${plazo} años (${tipo.fundamento}). Del ${base} al ${corte} van ${anios.toFixed(1)} años${corteEvento ? ` (interrumpida por ${corteEvento.label})` : ""}.${e.convenioRatificadoFecha ? " El convenio ratificado reinició el conteo." : ""}`,
  };
}

// ============================================================
// MOTOR · CADUCIDAD de la instancia
// Cuenta desde la última actuación procesal hasta hoy.
// Estado auto-detecta el plazo (CNPCF hábiles / local naturales).
// ============================================================
export interface EntradaCaducidad {
  ultimaActuacion: string;   // fecha de la última actuación procesal
  estado: string;            // clave de PLAZOS_ESTADO
  plazoManualDias?: number;  // opción: el abogado sobrescribe
  habilesManual?: boolean;
}

export function motorCaducidad(e: EntradaCaducidad): ResultadoMotor {
  if (!e.ultimaActuacion) return { semaforo: "gris", etiqueta: "Falta dato", detalle: "Captura la fecha de la última actuación procesal." };
  const cfg = PLAZOS_ESTADO[e.estado] || PLAZOS_ESTADO.Sinaloa;
  const plazoDias = e.plazoManualDias && e.plazoManualDias > 0 ? e.plazoManualDias : cfg.caducidadDias;
  const habiles = e.habilesManual ?? cfg.caducidadHabiles;
  const hoy = hoyISO();
  const transcurridos = habiles ? diasHabiles(e.ultimaActuacion, hoy) : diasNaturales(e.ultimaActuacion, hoy);
  const pct = transcurridos / plazoDias;
  const sem = semaforoPorcentaje(pct);
  const etiqueta = sem === "rojo" ? "Caducada" : sem === "naranja" ? "Crítica" : sem === "amarillo" ? "Media" : "En tiempo";
  const tipoDias = habiles ? "días hábiles" : "días naturales";

  // alertas de impulso
  let alerta = "";
  if (transcurridos >= plazoDias) alerta = " Presenta promoción impulsora HOY.";
  else if (pct >= 0.8) alerta = " Presenta escrito impulsor cuanto antes.";

  return {
    semaforo: sem,
    etiqueta,
    dato: `${transcurridos} de ${plazoDias} ${tipoDias}`,
    detalle: `${cfg.estado}: ${plazoDias} ${tipoDias} (${cfg.fundamento}). Desde la última actuación van ${transcurridos} ${tipoDias}.${alerta}`,
  };
}

// ============================================================
// MOTOR · USUCAPIÓN (solo si la posición lo amerita)
// Buena fe (con título) = 5 años; mala fe (sin título) = 10 años.
// Viabilidad = (Hoy − Inicio posesión) >= años requeridos.
// Demanda de despojo interrumpe.
// ============================================================
export interface EntradaUsucapion {
  inicioPosesion: string;     // desde cuándo posee
  buenaFe: boolean;           // con justo título = buena fe
  hayDemandaDespojo: boolean; // interrumpe
  hayInterpelacion?: boolean; // interpelación por jurisdicción voluntaria — también interrumpe (Art. 1168 CCF)
}

export function motorUsucapion(e: EntradaUsucapion): ResultadoMotor {
  if (!e.inicioPosesion) return { semaforo: "gris", etiqueta: "Falta dato", detalle: "Captura desde cuándo inició la posesión." };
  const requeridos = e.buenaFe ? 5 : 10;
  const anios = diasNaturales(e.inicioPosesion, hoyISO()) / 365.25;
  const cumplePlazo = anios >= requeridos;

  if (e.hayDemandaDespojo || e.hayInterpelacion) {
    const via = e.hayDemandaDespojo && e.hayInterpelacion
      ? "demanda de despojo e interpelación por jurisdicción voluntaria"
      : e.hayDemandaDespojo ? "demanda de despojo" : "interpelación judicial por jurisdicción voluntaria";
    return { semaforo: "verde", etiqueta: "Interrumpida", dato: `${anios.toFixed(1)} años`,
      detalle: `La usucapión está interrumpida por ${via} (Art. 1168 CCF): no corre a favor del tercero. Buena señal para comprar la cesión.` };
  }
  if (cumplePlazo) {
    return { semaforo: "rojo", etiqueta: "Riesgo de usucapión", dato: `${anios.toFixed(1)} de ${requeridos} años`,
      detalle: `El poseedor lleva ${anios.toFixed(1)} años (${e.buenaFe ? "buena fe, 5 años, Art. 1152 CCF" : "mala fe, 10 años, Art. 1152 CCF"}). Ya podría alegar propiedad.` };
  }
  return { semaforo: "verde", etiqueta: "Sin riesgo aún", dato: `${anios.toFixed(1)} de ${requeridos} años`,
    detalle: `El poseedor lleva ${anios.toFixed(1)} años de ${requeridos} requeridos (${e.buenaFe ? "buena fe" : "mala fe"}). Todavía no alcanza para usucapir.` };
}

// ============================================================
// CÁLCULO FINANCIERO (tabla tipo SCJN)
// Año comercial 360 días (Art. 362 CCom), sin anatocismo.
// Intereses ordinarios y moratorios se cobran a la vez.
// ============================================================
export interface EntradaFinanciera {
  capital: number;
  tasaOrdinariaAnual: number;  // %
  tasaMoratoriaAnual: number;  // %
  dias: number;                // días de cómputo
  aplicarIVA: boolean;         // 16% sobre intereses (opcional)
  gastos: number;              // gastos y costas
  valorUDI?: number;           // para equivalente en UDIs
}

export interface ResultadoFinanciero {
  ordinarios: number;
  moratorios: number;
  iva: number;
  totalDeuda: number;
  udis?: number;
  alertaUsura: boolean;
}

export function calculoFinanciero(e: EntradaFinanciera): ResultadoFinanciero {
  const ordinarios = e.capital * (e.tasaOrdinariaAnual / 100) / 360 * e.dias;
  const moratorios = e.capital * (e.tasaMoratoriaAnual / 100) / 360 * e.dias;
  const iva = e.aplicarIVA ? (ordinarios + moratorios) * 0.16 : 0;
  const totalDeuda = e.capital + ordinarios + moratorios + iva + (e.gastos || 0);
  const udis = e.valorUDI && e.valorUDI > 0 ? totalDeuda / e.valorUDI : undefined;
  // alerta de usura sencilla: tasa moratoria muy por encima de la ordinaria
  const alertaUsura = e.tasaMoratoriaAnual > e.tasaOrdinariaAnual * 2.5 || e.tasaMoratoriaAnual > 60;
  return { ordinarios, moratorios, iva, totalDeuda, udis, alertaUsura };
}

// ---------- Viabilidad económica (margen) ----------
export function viabilidad(valorComercial: number, adeudo: number, costos: number, precioCesion: number, margenObjetivo: number): ResultadoMotor {
  const neto = valorComercial - (adeudo + costos + precioCesion);
  const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  if (neto >= margenObjetivo) return { semaforo: "verde", etiqueta: "Positivo", dato: fmt(neto), detalle: `Margen estimado ${fmt(neto)} (objetivo ${fmt(margenObjetivo)}). Conviene.` };
  if (neto > 0) return { semaforo: "amarillo", etiqueta: "Condicionado", dato: fmt(neto), detalle: `Margen apretado ${fmt(neto)}, debajo del objetivo. Renegociar precio de cesión.` };
  return { semaforo: "rojo", etiqueta: "Negativo", dato: fmt(neto), detalle: `Margen negativo ${fmt(neto)}. No conviene a este precio.` };
}

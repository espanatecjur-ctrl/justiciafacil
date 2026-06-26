// ============================================================
// URRJ · Motor de TRÁMITES ADMINISTRATIVOS
// Amparo, Contencioso TFJA, laboral con afectación a garantía.
// Aquí el PLAZO lo es todo: cuenta días hábiles desde la
// notificación contra el plazo legal del tipo de trámite.
// Incluye el detalle de Contencioso Administrativo. Solo AVISA.
// ============================================================
import type { Semaforo, ResultadoMotor } from "@/lib/urrj-motores";
import { diasHabiles } from "@/lib/urrj-motores";

const mxn = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
function sem(v: string): Semaforo {
  if (v === "ABORTAR") return "rojo";
  if (v === "LITIGABLE" || v === "TRÁMITE" || v === "PARCIAL") return "naranja";
  if (v === "ALERTA" || v === "PENDIENTE") return "amarillo";
  if (v === "VIABLE" || v === "COMPLETO") return "verde";
  return "gris";
}

// Plazos por tipo de trámite (días hábiles)
export const TIPOS_TRAMITE: { clave: string; nombre: string; plazo: number; fundamento: string }[] = [
  { clave: "amparo_indirecto", nombre: "Amparo indirecto", plazo: 15, fundamento: "15 días hábiles (Ley de Amparo)" },
  { clave: "amparo_directo", nombre: "Amparo directo", plazo: 15, fundamento: "15 días hábiles (Ley de Amparo)" },
  { clave: "contencioso_tfja", nombre: "Contencioso / nulidad TFJA", plazo: 30, fundamento: "30 días hábiles (LFPCA)" },
  { clave: "laboral", nombre: "Laboral (recurso)", plazo: 9, fundamento: "según el recurso que toque" },
];

// ---------- HITO 1 · Acreditación ----------
export interface EntradaTra1 {
  hayActoReclamado: string;   // si/no
  fechaNotificacion: string;  // fecha (clave)
  fuenteRevisada: string;     // real/copias/""
}
export function veredictoTra1(e: EntradaTra1): ResultadoMotor {
  if (e.hayActoReclamado === "no") return { semaforo: "rojo", etiqueta: "BLOQUEANTE (aviso)", detalle: "Sin acto/resolución/laudo identificable no hay qué impugnar." };
  if (!e.fechaNotificacion) return { semaforo: "rojo", etiqueta: "BLOQUEANTE (aviso)", detalle: "Sin fecha de notificación no se puede calcular el plazo, y el plazo lo es todo aquí." };
  if (!e.fuenteRevisada) return { semaforo: "gris", etiqueta: "Sin datos", detalle: "Indica cómo se revisó (órgano o copias)." };
  if (e.fuenteRevisada === "copias") return { semaforo: "rojo", etiqueta: "Crítico", detalle: "Solo copias del interesado. Revisar el expediente directo en el órgano." };
  return { semaforo: "verde", etiqueta: "OK", detalle: "Acto identificable, fecha de notificación y expediente revisado en fuente real." };
}

// ---------- HITO 2 · Procedencia y OPORTUNIDAD -> ¿LITIGABLE? ----------
export interface EntradaTra2 {
  tipoTramite: string;
  fechaNotificacion: string;
  plazoManual?: number;
  faltaInteres: string;       // si/no
  cosaJuzgada: string;        // si/no  (laudo/acto firme)
  suspensionOtorgada: string; // si/no
  actoIlegalClaro: string;    // si/no
  requiereExterno: string;    // si/no
}
export function veredictoTra2(e: EntradaTra2): ResultadoMotor {
  const tipo = TIPOS_TRAMITE.find((t) => t.clave === e.tipoTramite) || TIPOS_TRAMITE[0];
  const plazo = e.plazoManual && e.plazoManual > 0 ? e.plazoManual : tipo.plazo;

  if (e.faltaInteres === "si") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Falta de interés jurídico o legítimo: la afectación no toca un derecho de la parte." };
  if (e.cosaJuzgada === "si") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Cosa juzgada / laudo o acto ya ejecutoriado e inatacable." };

  if (e.fechaNotificacion) {
    const hoy = new Date().toISOString().slice(0, 10);
    const transcurridos = diasHabiles(e.fechaNotificacion, hoy);
    const restantes = plazo - transcurridos;
    if (restantes < 0) return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso) · plazo vencido", detalle: `Pasaron ${transcurridos} días hábiles desde la notificación; el plazo era ${plazo} (${tipo.fundamento}). Preclusión / acto consentido: ya no se puede impugnar.` };
    const externo = e.requiereExterno === "si" ? " Escalar a asesoría fiscal/laboral externa." : "";
    if (restantes <= 3) return { semaforo: sem("ALERTA"), etiqueta: "ALERTA · URGENTE", detalle: `Quedan ${restantes} días hábiles del plazo (${tipo.fundamento}). Presenta YA.${externo}` };
    if (e.suspensionOtorgada === "si" && e.actoIlegalClaro === "si")
      return { semaforo: sem("VIABLE"), etiqueta: "VIABLE", detalle: `Dentro de plazo (${restantes} días restantes), con suspensión otorgada y acto claramente ilegal.${externo}` };
    return { semaforo: sem("LITIGABLE"), etiqueta: "LITIGABLE", detalle: `Dentro de plazo (${restantes} de ${plazo} días hábiles). Agravios por valorar; el resultado depende del juicio.${externo}` };
  }
  return { semaforo: "gris", etiqueta: "Sin datos", detalle: "Captura la fecha de notificación." };
}

// ---------- HITO 3 · Impacto sobre la garantía -> ¿RECUPERABLE? ----------
export interface EntradaTra3 {
  afectacionSuperaValor: string; // si/no
  condenaFirmeArriba: string;    // si/no
  contraparteCede: string;       // si/no
  defendible: string;            // si/no
}
export function veredictoTra3(e: EntradaTra3, vaaeViable: boolean): ResultadoMotor {
  if (e.afectacionSuperaValor === "si") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso) · no recuperable", detalle: "El monto de la afectación + defensa supera el valor de la garantía." };
  if (e.condenaFirmeArriba === "si") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "La condena ya es firme y cuantificada por encima del bien." };
  if (!vaaeViable) return { semaforo: sem("ABORTAR"), etiqueta: "No recuperable", detalle: "El V_AAE administrativo es ≤ 0: la condena + defensa se comen el valor." };
  if (e.defendible === "si") return { semaforo: sem("VIABLE"), etiqueta: "VIABLE · recuperable", detalle: "Afectación menor al margen y defendible." };
  return { semaforo: sem("TRÁMITE"), etiqueta: "EN TRÁMITE", detalle: "Falta confirmar que la afectación quede por debajo del margen." };
}

// ---------- HITO 4 · Bloqueo legal + SUSPENSIÓN ----------
export interface EntradaTra4 {
  suspensionOtorgada: string;  // si/no
  remateInminente: string;     // si/no
  contraparteAceptaPoder: string;
  cesionSuspensiva: string; escrow: string; poderIrrevocable: string; dineroYaEntregado: string;
}
export function veredictoTra4(e: EntradaTra4): ResultadoMotor {
  if (e.suspensionOtorgada === "no" && e.remateInminente === "si")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR provisional", detalle: "Sin suspensión y con remate inminente: primero obtén la suspensión del acto reclamado (que no rematen/cancelen/embarguen)." };
  if (e.contraparteAceptaPoder === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "La contraparte se rehúsa a firmar el Poder Irrevocable." };
  if (e.dineroYaEntregado === "si" || e.escrow === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Sin escrow o con dinero ya entregado: pierdes el blindaje." };
  if (e.cesionSuspensiva === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Cesión sin cláusula suspensiva." };
  const candados = [e.cesionSuspensiva === "si", e.escrow === "si", e.poderIrrevocable === "si"].filter(Boolean).length;
  const susp = e.suspensionOtorgada === "si" ? "Suspensión otorgada. " : "";
  if (candados === 3) return { semaforo: sem("COMPLETO"), etiqueta: "CERRADO · control absoluto 🔒", detalle: `${susp}Los 3 candados cerrados (escrow libera al resolverse a favor).` };
  if (candados >= 1) return { semaforo: sem("PARCIAL"), etiqueta: "PARCIAL", detalle: `${susp}${candados} de 3 candados cerrados.` };
  return { semaforo: sem("PENDIENTE"), etiqueta: "PENDIENTE", detalle: `${susp}Aún no se cierra ningún candado.` };
}

// ---------- Sub-análisis Contencioso Administrativo ----------
export interface EntradaContencioso {
  hayActosAdmin: string;       // si/no
  esCreditoFiscal: string;     // si/no (predial/ISAI)
  esExpropiacionUso: string;   // si/no
  juicioEnCurso: string;       // si/no
}
export function analisisContencioso(e: EntradaContencioso): ResultadoMotor | null {
  if (e.hayActosAdmin !== "si") {
    if (e.hayActosAdmin === "no") return { semaforo: "verde", etiqueta: "Sin actos administrativos", detalle: "No hay actos de autoridad pendientes sobre el inmueble." };
    return null;
  }
  if (e.esExpropiacionUso === "si") return { semaforo: "rojo", etiqueta: "Expropiación / uso de suelo", detalle: "Litigio de expropiación, uso de suelo o regularización: riesgo alto según la etapa." };
  if (e.juicioEnCurso === "si") return { semaforo: "amarillo", etiqueta: "Juicio contencioso en curso", detalle: "Esperar firmeza del tribunal administrativo antes de avanzar." };
  if (e.esCreditoFiscal === "si") return { semaforo: "amarillo", etiqueta: "Crédito fiscal (predial/ISAI)", detalle: "Cuantificar: viaja con el bien y tiene prelación fiscal." };
  return { semaforo: "amarillo", etiqueta: "Actos administrativos", detalle: "Hay actos pendientes; clasifícalos (fiscal / expropiación / juicio)." };
}

// ---------- V_AAE administrativo ----------
export interface EntradaVAAETra { valorComercial: number; condenaLaudoFiscal: number; honorariosDefensa: number; accesorios: number; mesesDesenredo: number; margenPct: number; }
export interface ResultadoVAAETra { cAfe: number; cLit: number; mR: number; vaae: number; viable: boolean; detalle: string; }
export function calcularVAAETra(e: EntradaVAAETra): ResultadoVAAETra {
  const cAfe = e.condenaLaudoFiscal + e.honorariosDefensa + e.accesorios;
  const cLit = e.mesesDesenredo * 0.01 * e.valorComercial;
  const mR = (e.margenPct > 0 ? e.margenPct : 30) / 100 * e.valorComercial;
  const vaae = e.valorComercial - cAfe - cLit - mR;
  const viable = vaae > 0;
  const detalle = viable ? `Lo MÁXIMO que puedes pagar es ${mxn(vaae)}.` : `V_AAE = ${mxn(vaae)} (≤ 0): no recuperable.`;
  return { cAfe, cLit, mR, vaae, viable, detalle };
}

// ---------- Veredicto consolidado ----------
export function consolidadoTra(litigable: Semaforo, recuperable: Semaforo, vaaeViable: boolean): { txt: string; color: string; detalle: string } {
  const noLitigable = litigable === "rojo";
  const noRecuperable = recuperable === "rojo" || !vaaeViable;
  if (noLitigable) return { txt: "PLAZO VENCIDO / ACTO FIRME", color: "bg-red-50 text-red-800 border-red-200", detalle: "Plazo vencido, acto consentido o cosa juzgada. Ni entrar." };
  if (noRecuperable) return { txt: "DEFENDIBLE PERO NO RECUPERABLE", color: "bg-amber-50 text-amber-800 border-amber-200", detalle: "Se puede ganar, pero la condena + defensa se comen el valor." };
  if (litigable === "gris" || recuperable === "gris") return { txt: "FALTAN DATOS", color: "bg-muted text-muted-foreground border-border", detalle: "Completa los hitos." };
  return { txt: "DEFENDIBLE Y DEJA MARGEN", color: "bg-emerald-50 text-emerald-800 border-emerald-200", detalle: "Procede: defiende dentro de plazo, con suspensión, y recupera con margen." };
}

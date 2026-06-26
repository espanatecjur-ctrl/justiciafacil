// ============================================================
// URRJ · Motores del recorrido DEMANDADO
// DIIPA compra los derechos del demandado-vendedor en un juicio.
// 4 hitos con veredictos + el motor financiero V_AAE.
// Los veredictos "ABORTAR" solo AVISAN (no bloquean).
// ============================================================
import type { Semaforo, ResultadoMotor } from "@/lib/urrj-motores";

const n = (s: string | number) => { const v = typeof s === "number" ? s : parseFloat(s); return isNaN(v) ? 0 : v; };

// Veredicto -> semáforo (rojo = abortar, naranja/amarillo = alerta/trámite, verde = viable)
function sem(v: string): Semaforo {
  if (v === "ABORTAR") return "rojo";
  if (v === "LITIGABLE" || v === "EN TRÁMITE" || v === "PARCIAL") return "naranja";
  if (v === "ALERTA" || v === "PENDIENTE") return "amarillo";
  if (v === "VIABLE" || v === "COMPLETO") return "verde";
  return "gris";
}

// ---------- HITO 1 · Extracción del expediente ----------
export interface EntradaHito1 {
  descripcionCoincide: string;   // si/no/""
  fuenteRevisada: string;        // "real" | "fotocopias" | ""
}
export function veredictoHito1(e: EntradaHito1): ResultadoMotor {
  if (!e.fuenteRevisada) return { semaforo: "gris", etiqueta: "Sin datos", detalle: "Indica cómo se revisó el expediente." };
  if (e.fuenteRevisada === "fotocopias")
    return { semaforo: "rojo", etiqueta: "Crítico", detalle: "Solo se revisaron fotocopias proporcionadas por el demandado. No es fuente confiable: hay que revisar el expediente real en el juzgado." };
  let detalle = "Expediente revisado en fuente real (juzgado/RPP).";
  if (e.descripcionCoincide === "no") return { semaforo: "naranja", etiqueta: "Alerta", detalle: "La descripción del inmueble NO coincide entre demanda/escritura/CLG: riesgo de nulidad." };
  return { semaforo: "verde", etiqueta: "OK", detalle };
}

// ---------- HITO 2 · Filtro de legalidad procesal (compuerta dura) ----------
export interface EntradaHito2 {
  emplazamiento: string;     // "personal" | "edictos" | "rebeldia" | ""
  sentenciaEjecutoriada: string; // si/no
  copropietariosNoDemandados: string; // si/no
  descripcionCoincide: string; // si/no
  tercosFiscalLaboral: string; // si/no  (embargo SAT/IMSS/INFONAVIT/laboral)
  almonedaConvocada: string;   // si/no  -> bandera urgente
  sospechaUsura: string;       // si/no
}
export function veredictoHito2(e: EntradaHito2): ResultadoMotor {
  const motivosAbortar: string[] = [];
  if (e.emplazamiento === "edictos") motivosAbortar.push("emplazamiento por edictos (riesgo de amparo, Art. 14 y 16 Const.)");
  if (e.copropietariosNoDemandados === "si") motivosAbortar.push("copropietarios no demandados (pueden ampararse)");
  if (e.descripcionCoincide === "no") motivosAbortar.push("descripción del inmueble no coincide (riesgo de nulidad)");
  if (e.tercosFiscalLaboral === "si") motivosAbortar.push("embargo de tercería SAT/IMSS/INFONAVIT/laboral (cobran antes que tú)");

  const urgente = e.almonedaConvocada === "si" ? " ⚠ URGENTE: la almoneda ya está convocada, tienes días para reaccionar." : "";
  const usura = e.sospechaUsura === "si" ? " Sospecha de anatocismo/usura: revisar el estado de cuenta." : "";

  if (motivosAbortar.length)
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: `Motivos de aborto: ${motivosAbortar.join("; ")}.${urgente}${usura}` };

  // viables
  if (e.sentenciaEjecutoriada === "si")
    return { semaforo: sem("VIABLE"), etiqueta: "VIABLE", detalle: `Sentencia ejecutoriada: riesgo casi cero.${urgente}${usura}` };
  if (e.emplazamiento === "personal")
    return { semaforo: sem("VIABLE"), etiqueta: "VIABLE", detalle: `Emplazamiento personal con firma.${urgente}${usura}` };
  if (e.emplazamiento === "rebeldia")
    return { semaforo: sem("VIABLE"), etiqueta: "VIABLE", detalle: `Rebeldía declarada: ventaja procesal.${urgente}${usura}` };

  return { semaforo: sem("LITIGABLE"), etiqueta: "LITIGABLE", detalle: `Aún no hay sentencia firme: compras los derechos y sigues el pleito.${urgente}${usura}` };
}

// ---------- HITO 3 · Carta Saldo del acreedor ----------
export interface EntradaHito3 {
  estadoCarta: string;       // "negada" | "tramite" | "sin_solicitar" | "otorgada" | ""
  fechaCaducidad: string;    // fecha
  otrosAcreedores: string;   // si/no
  quitaSinCondiciones: string; // si/no
}
export function veredictoHito3(e: EntradaHito3): ResultadoMotor {
  if (e.otrosAcreedores === "si")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Hay otros acreedores formados: cobran primero. No cierres." };
  if (!e.estadoCarta) return { semaforo: "gris", etiqueta: "Sin datos", detalle: "Indica el estado de la Carta Saldo." };
  if (e.estadoCarta === "negada")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Carta Saldo negada: sin documento que congele la deuda, no cierras." };
  if (e.estadoCarta === "tramite" || e.estadoCarta === "sin_solicitar")
    return { semaforo: sem("EN TRÁMITE"), etiqueta: "EN TRÁMITE", detalle: "Carta Saldo en trámite o sin solicitar: no cerrar aún." };
  // otorgada -> revisar caducidad
  if (e.fechaCaducidad) {
    const dias = Math.round((new Date(e.fechaCaducidad).getTime() - Date.now()) / 86400000);
    if (dias < 0) return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: `Carta Saldo vencida hace ${Math.abs(dias)} días.` };
    if (dias <= 7) return { semaforo: sem("ALERTA"), etiqueta: "ALERTA", detalle: `Carta Saldo vence en ${dias} días: cierra ya.` };
    if (dias <= 30) return { semaforo: sem("ALERTA"), etiqueta: "ALERTA", detalle: `Carta Saldo vence en ${dias} días.` };
  }
  const quita = e.quitaSinCondiciones === "si" ? " Quita sin condiciones: factor positivo." : "";
  return { semaforo: sem("VIABLE"), etiqueta: "VIABLE", detalle: `Carta Saldo otorgada y vigente.${quita}` };
}

// ---------- HITO 4 · Bloqueo legal (3 candados) ----------
export interface EntradaHito4 {
  promesaSuspensiva: string;   // si/no
  escrow: string;              // si/no
  poderIrrevocable: string;    // si/no
  vendedorAceptaPoder: string; // si/no
  dineroYaEntregado: string;   // si/no
}
export function veredictoHito4(e: EntradaHito4): ResultadoMotor {
  if (e.vendedorAceptaPoder === "no")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "El vendedor se rehúsa a firmar el Poder Irrevocable: sin eso, no hay control." };
  if (e.dineroYaEntregado === "si" || e.escrow === "no")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Sin escrow o con dinero ya entregado: pierdes todo el blindaje." };
  const candados = [e.promesaSuspensiva === "si", e.escrow === "si", e.poderIrrevocable === "si"].filter(Boolean).length;
  if (e.promesaSuspensiva === "no")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Promesa sin cláusula suspensiva (Art. 1938 CCF): no se blinda el control." };
  if (candados === 3) return { semaforo: sem("COMPLETO"), etiqueta: "CERRADO · control absoluto 🔒", detalle: "Los 3 candados están cerrados: promesa suspensiva + escrow + poder irrevocable." };
  if (candados >= 1) return { semaforo: sem("PARCIAL"), etiqueta: "PARCIAL", detalle: `${candados} de 3 candados cerrados. Faltan los demás antes de soltar dinero.` };
  return { semaforo: sem("PENDIENTE"), etiqueta: "PENDIENTE", detalle: "Aún no se cierra ningún candado." };
}

// ---------- Motor financiero V_AAE (lo máximo que puedes pagar) ----------
export interface EntradaVAAE {
  suertePrincipal: number;
  interesMoratorio: number;
  gastosCostas: number;     // si 0, asume 10% del capital
  valorComercial: number;
  mesesDesenredo: number;
  margenPct: number;        // default 30
}
export interface ResultadoVAAE {
  cLiq: number; cLit: number; mR: number; vaae: number; viable: boolean; detalle: string;
}
export function calcularVAAE(e: EntradaVAAE): ResultadoVAAE {
  const gastos = e.gastosCostas > 0 ? e.gastosCostas : e.suertePrincipal * 0.10;
  const cLiq = e.suertePrincipal + e.interesMoratorio + gastos;
  const cLit = e.mesesDesenredo * 0.01 * e.valorComercial;
  const margen = (e.margenPct > 0 ? e.margenPct : 30) / 100;
  const mR = margen * e.valorComercial;
  const vaae = e.valorComercial - cLiq - cLit - mR;
  const viable = vaae > 0;
  const mxn = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const detalle = viable
    ? `Lo MÁXIMO que puedes pagarle al demandado es ${mxn(vaae)}. Si pide más, renegocia a la baja.`
    : `V_AAE = ${mxn(vaae)} (≤ 0): no es viable a ningún precio.`;
  return { cLiq, cLit, mR, vaae, viable, detalle };
}

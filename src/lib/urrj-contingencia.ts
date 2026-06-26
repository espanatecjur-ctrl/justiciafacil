// ============================================================
// URRJ · Motor de CONTINGENCIA INMOBILIARIA
// ¿El defecto es saneable (litigable) y, una vez limpio, la casa
// vale más de lo que cuesta arreglarla (recuperable)?
// Mismo patrón cruzado + V_AAE de contingencia. Solo AVISA.
// ============================================================
import type { Semaforo, ResultadoMotor } from "@/lib/urrj-motores";

const mxn = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function sem(v: string): Semaforo {
  if (v === "ABORTAR") return "rojo";
  if (v === "LITIGABLE" || v === "TRÁMITE" || v === "PARCIAL") return "naranja";
  if (v === "ALERTA" || v === "PENDIENTE") return "amarillo";
  if (v === "VIABLE" || v === "COMPLETO") return "verde";
  return "gris";
}

// ---------- HITO 1 · Diagnóstico documental ----------
export interface EntradaCont1 {
  hayAntecedenteRegistral: string; // si/no  (tracto)
  fuenteRevisada: string;          // real/copias/""
}
export function veredictoCont1(e: EntradaCont1): ResultadoMotor {
  if (e.hayAntecedenteRegistral === "no")
    return { semaforo: "rojo", etiqueta: "BLOQUEANTE (aviso)", detalle: "Sin antecedente registral (tracto) no hay qué corregir." };
  if (!e.fuenteRevisada) return { semaforo: "gris", etiqueta: "Sin datos", detalle: "Indica cómo se revisó (RPP/catastro o copias)." };
  if (e.fuenteRevisada === "copias")
    return { semaforo: "rojo", etiqueta: "Crítico", detalle: "Solo copias del interesado. Revisar directo en RPP y catastro." };
  return { semaforo: "verde", etiqueta: "OK", detalle: "Revisado directo en RPP/catastro, con tracto identificable." };
}

// ---------- HITO 2 · Tipificación y vía -> ¿LITIGABLE? ----------
export interface EntradaCont2 {
  dobleInscripcionTercero: string;   // si/no
  inmuebleANombreDeOtro: string;     // si/no  (no la contraparte)
  traslapeConTituloFirme: string;    // si/no
  copropietarioNoLocalizable: string;// si/no
  defectoFormalCorregible: string;   // si/no  (rectificación administrativa)
  copropietariosDeAcuerdo: string;   // si/no
  medidasCorregiblesPerito: string;  // si/no
  via: string;                       // vía elegida (texto)
}
export function veredictoCont2(e: EntradaCont2): ResultadoMotor {
  const abortan: string[] = [];
  if (e.dobleInscripcionTercero === "si") abortan.push("doble inscripción a favor de un tercero de buena fe");
  if (e.inmuebleANombreDeOtro === "si") abortan.push("el inmueble está inscrito a nombre de otra persona (no la contraparte)");
  if (e.traslapeConTituloFirme === "si") abortan.push("traslape grave con predio vecino con título firme");
  if (e.copropietarioNoLocalizable === "si") abortan.push("copropietario que se niega y no es localizable");
  if (abortan.length) return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso) · no saneable", detalle: `Motivos: ${abortan.join("; ")}.` };

  const viaTxt = e.via ? ` Vía sugerida: ${e.via}.` : "";
  if (e.defectoFormalCorregible === "si" || e.copropietariosDeAcuerdo === "si")
    return { semaforo: sem("VIABLE"), etiqueta: "VIABLE · saneable", detalle: `Defecto formal corregible por rectificación administrativa, o copropietarios de acuerdo.${viaTxt}` };
  if (e.medidasCorregiblesPerito === "si")
    return { semaforo: sem("ALERTA"), etiqueta: "ALERTA", detalle: `Medidas que no cuadran pero corregibles con perito (o copropietario localizable sin firmar).${viaTxt}` };
  return { semaforo: sem("LITIGABLE"), etiqueta: "LITIGABLE", detalle: `Requiere juicio (jurisdicción voluntaria / deslinde / usucapión / división), pero el derecho es sólido.${viaTxt}` };
}

// ---------- HITO 3 · Costo de saneamiento -> ¿RECUPERABLE? ----------
export interface EntradaCont3 {
  costoSuperaValor: string;   // si/no
  copropietariosCeden: string; // si/no
  cargasMenores: string;      // si/no
}
export function veredictoCont3(e: EntradaCont3, vaaeViable: boolean): ResultadoMotor {
  if (e.costoSuperaValor === "si")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso) · no recuperable", detalle: "El costo de regularización supera el valor del inmueble." };
  if (e.copropietariosCeden === "no")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Un copropietario clave no cede su parte." };
  if (!vaaeViable)
    return { semaforo: sem("ABORTAR"), etiqueta: "No recuperable", detalle: "El V_AAE de contingencia es ≤ 0: el costo de saneamiento se come el valor." };
  if (e.cargasMenores === "si")
    return { semaforo: sem("VIABLE"), etiqueta: "VIABLE · recuperable", detalle: "Queda libre con cargas menores al margen." };
  return { semaforo: sem("TRÁMITE"), etiqueta: "EN TRÁMITE", detalle: "Falta confirmar que las cargas queden por debajo del margen." };
}

// ---------- HITO 4 · Bloqueo legal (3 candados) ----------
export interface EntradaCont4 {
  contraparteAceptaPoder: string; // si/no
  cesionSuspensiva: string;       // si/no (condicionada a RPP limpio)
  escrow: string;                 // si/no (libera al inscribirse la corrección)
  poderIrrevocable: string;       // si/no
  dineroYaEntregado: string;      // si/no
}
export function veredictoCont4(e: EntradaCont4): ResultadoMotor {
  if (e.contraparteAceptaPoder === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "La contraparte se rehúsa a firmar el Poder Irrevocable." };
  if (e.dineroYaEntregado === "si" || e.escrow === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Sin escrow o con dinero ya entregado: pierdes el blindaje." };
  if (e.cesionSuspensiva === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Cesión sin cláusula suspensiva: no se condiciona a que el RPP quede limpio." };
  const candados = [e.cesionSuspensiva === "si", e.escrow === "si", e.poderIrrevocable === "si"].filter(Boolean).length;
  if (candados === 3) return { semaforo: sem("COMPLETO"), etiqueta: "CERRADO · control absoluto 🔒", detalle: "Cesión suspensiva (RPP limpio) + escrow (libera al inscribir) + poder irrevocable." };
  if (candados >= 1) return { semaforo: sem("PARCIAL"), etiqueta: "PARCIAL", detalle: `${candados} de 3 candados cerrados.` };
  return { semaforo: sem("PENDIENTE"), etiqueta: "PENDIENTE", detalle: "Aún no se cierra ningún candado." };
}

// ---------- V_AAE de contingencia ----------
export interface EntradaVAAECont {
  valorComercial: number;
  honorarios: number; perito: number; derechosRPP: number; impuestos: number; // C_REG
  mesesDesenredo: number; margenPct: number;
}
export interface ResultadoVAAECont { cReg: number; cLit: number; mR: number; vaae: number; viable: boolean; detalle: string; }
export function calcularVAAECont(e: EntradaVAAECont): ResultadoVAAECont {
  const cReg = e.honorarios + e.perito + e.derechosRPP + e.impuestos;
  const cLit = e.mesesDesenredo * 0.01 * e.valorComercial;
  const mR = (e.margenPct > 0 ? e.margenPct : 30) / 100 * e.valorComercial;
  const vaae = e.valorComercial - cReg - cLit - mR;
  const viable = vaae > 0;
  const detalle = viable
    ? `Lo MÁXIMO que puedes pagar por la cesión es ${mxn(vaae)}.`
    : `V_AAE = ${mxn(vaae)} (≤ 0): no recuperable a ningún precio.`;
  return { cReg, cLit, mR, vaae, viable, detalle };
}

// ---------- Veredicto consolidado ----------
export function consolidadoCont(litigable: Semaforo, recuperable: Semaforo, vaaeViable: boolean): { txt: string; color: string; detalle: string } {
  const noSaneable = litigable === "rojo";
  const noRecuperable = recuperable === "rojo" || !vaaeViable;
  if (noSaneable) return { txt: "DEFECTO INSALVABLE", color: "bg-red-50 text-red-800 border-red-200", detalle: "El defecto no es saneable (doble inscripción, a nombre de otro o traslape con título firme). Ni entrar." };
  if (noRecuperable) return { txt: "SANEABLE PERO NO RECUPERABLE", color: "bg-amber-50 text-amber-800 border-amber-200", detalle: "Se puede limpiar, pero el costo de saneamiento se come el valor. No conviene." };
  if (litigable === "gris" || recuperable === "gris") return { txt: "FALTAN DATOS", color: "bg-muted text-muted-foreground border-border", detalle: "Completa los hitos para el veredicto." };
  return { txt: "SANEABLE Y DEJA MARGEN", color: "bg-emerald-50 text-emerald-800 border-emerald-200", detalle: "Procede: sanea el inmueble y recupéralo con margen." };
}

// ============================================================
// URRJ · Motores del recorrido SUCESORIO (herencia/posesión)
// Idea central: veredicto CRUZADO -> ¿LITIGABLE? + ¿RECUPERABLE?
// Caso A (murió el deudor, tienes hipoteca) / B (cesión de
// derechos hereditarios) / C (mixto). Solo AVISA, no bloquea.
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

// ---------- HITO 1 · Acreditación documental ----------
export interface EntradaSuc1 {
  hayActaDefuncion: string;     // si/no
  casaANombreDeCujus: string;   // si/no
  fuenteRevisada: string;       // real/fotocopias/""
}
export function veredictoSuc1(e: EntradaSuc1): ResultadoMotor {
  if (e.hayActaDefuncion === "no")
    return { semaforo: "rojo", etiqueta: "BLOQUEANTE (aviso)", detalle: "Sin acta de defunción no hay muerte acreditada, no hay sucesión." };
  if (e.casaANombreDeCujus === "no")
    return { semaforo: "rojo", etiqueta: "BLOQUEANTE (aviso)", detalle: "La casa NO está a nombre del de cujus: la herencia no transmite lo que el muerto no tenía." };
  if (!e.fuenteRevisada) return { semaforo: "gris", etiqueta: "Sin datos", detalle: "Indica cómo se revisó la documentación." };
  if (e.fuenteRevisada === "fotocopias")
    return { semaforo: "rojo", etiqueta: "Crítico", detalle: "Solo fotocopias del heredero. Revisar en fuente real (RPP, juzgado, archivo de notarías)." };
  return { semaforo: "verde", etiqueta: "OK", detalle: "Documentación revisada en fuente real, muerte acreditada y casa a nombre del de cujus." };
}

// ---------- HITO 2 · Legalidad sucesoria -> ¿LITIGABLE? ----------
export interface EntradaSuc2 {
  herederosNoLocalizados: string;  // si/no  (no llamados a juicio)
  testamentoImpugnado: string;     // si/no
  controversiaHerederos: string;   // si/no
  adjudicacionProtocolizada: string; // si/no
  herederoMenorOAusente: string;   // si/no  (obliga judicial)
  conyugeSinAclarar: string;       // si/no  (sociedad conyugal)
  edictosCorriendo: string;        // si/no  -> urgente
  herederoVendeATercero: string;   // si/no  -> urgente
}
export function veredictoSuc2(e: EntradaSuc2): ResultadoMotor {
  const abortan: string[] = [];
  if (e.herederosNoLocalizados === "si") abortan.push("herederos no localizados/llamados (riesgo de nulidad o amparo)");
  if (e.testamentoImpugnado === "si") abortan.push("testamento impugnado o juicio de nulidad en curso (no hay título firme)");
  if (e.controversiaHerederos === "si") abortan.push("controversia abierta entre herederos");
  const urgente = (e.edictosCorriendo === "si" ? " ⚠ URGENTE: edictos con plazo corriendo." : "") + (e.herederoVendeATercero === "si" ? " ⚠ URGENTE: un heredero negocia vender a un tercero." : "");

  if (abortan.length) return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso) · no litigable", detalle: `Motivos: ${abortan.join("; ")}.${urgente}` };

  const alertas: string[] = [];
  if (e.herederoMenorOAusente === "si") alertas.push("heredero menor o ausente (obliga vía judicial)");
  if (e.conyugeSinAclarar === "si") alertas.push("cónyuge con sociedad conyugal no aclarada (la mitad puede ser de la viuda)");

  if (e.adjudicacionProtocolizada === "si")
    return { semaforo: sem("VIABLE"), etiqueta: "VIABLE · litigable", detalle: `Adjudicación dictada/protocolizada: riesgo casi cero.${alertas.length ? " Ojo: " + alertas.join("; ") + "." : ""}${urgente}` };
  if (alertas.length)
    return { semaforo: sem("ALERTA"), etiqueta: "ALERTA", detalle: `${alertas.join("; ")}.${urgente}` };
  return { semaforo: sem("LITIGABLE"), etiqueta: "LITIGABLE", detalle: `Sucesión denunciada sin adjudicación: compras derechos hereditarios y sigues el trámite.${urgente}` };
}

// ---------- HITO 3 · Saneamiento -> ¿RECUPERABLE? + V_AAE ----------
export interface EntradaSuc3 {
  acreedoresSuperanValor: string;  // si/no  (deudas del de cujus/embargos > valor)
  herederosCeden: string;          // si/no
  hipotecaNoNegociable: string;    // si/no  (vigente > valor)
  impuestosCuantificados: string;  // si/no
  cargasManejables: string;        // si/no
}
export function veredictoSuc3(e: EntradaSuc3, vaaeViable: boolean): ResultadoMotor {
  if (e.acreedoresSuperanValor === "si")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso) · no recuperable", detalle: "Deudas del de cujus o embargos superan el valor: la masa se va en pagar y no queda casa." };
  if (e.herederosCeden === "no")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Heredero(s) clave se niegan a ceder sus derechos." };
  if (e.hipotecaNoNegociable === "si")
    return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Hipoteca vigente no negociable mayor al valor." };
  if (!vaaeViable)
    return { semaforo: sem("ABORTAR"), etiqueta: "No recuperable", detalle: "El V_AAE sucesorio es ≤ 0: deudas + impuestos se comen el valor." };
  if (e.impuestosCuantificados === "no")
    return { semaforo: sem("TRÁMITE"), etiqueta: "EN TRÁMITE", detalle: "Faltan cuantificar impuestos sucesorios/ISR/traslado. No cerrar aún." };
  if (e.cargasManejables === "no")
    return { semaforo: sem("ALERTA"), etiqueta: "ALERTA", detalle: "Cargas altas pero manejables (o cónyuge reclama su 50%)." };
  return { semaforo: sem("VIABLE"), etiqueta: "VIABLE · recuperable", detalle: "Propiedad libre o con cargas menores al margen, herederos ceden, impuestos cuantificados." };
}

// ---------- HITO 4 · Bloqueo legal + candados por CASO ----------
export interface EntradaSuc4 {
  caso: string;                 // A / B / C
  vendedorAceptaPoder: string;  // si/no
  cesionSuspensiva: string;     // si/no
  escrow: string;               // si/no
  poderIrrevocable: string;     // si/no
  dineroYaEntregado: string;    // si/no
  // Caso B (cesión de derechos hereditarios)
  cedenteAceptoHerencia: string;   // si/no
  derechoTantoNotificado: string;  // si/no
  cesionEscrituraPublica: string;  // si/no
}
export function veredictoSuc4(e: EntradaSuc4): ResultadoMotor {
  const avisos: string[] = [];
  // candados base
  if (e.vendedorAceptaPoder === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "El heredero se rehúsa a firmar el Poder Irrevocable: sin eso, no hay control." };
  if (e.dineroYaEntregado === "si" || e.escrow === "no") return { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Sin escrow o con dinero ya entregado: pierdes el blindaje." };

  // candados especiales del Caso B
  if (e.caso === "B" || e.caso === "C") {
    if (e.cedenteAceptoHerencia === "no") avisos.push("el cedente NO aceptó la herencia: no puede ceder lo que no tiene (ABORTAR)");
    if (e.derechoTantoNotificado === "no") avisos.push("falta notificar el derecho del tanto a coherederos (8 días): riesgo de retracto/nulidad (ABORTAR)");
    if (e.cesionEscrituraPublica === "no") avisos.push("la cesión de inmueble debe ser en escritura pública: en privado es ineficaz (ABORTAR)");
  }

  const candados = [e.cesionSuspensiva === "si", e.escrow === "si", e.poderIrrevocable === "si"].filter(Boolean).length;
  const tieneAbortoB = avisos.length > 0;

  let base: ResultadoMotor;
  if (e.cesionSuspensiva === "no") base = { semaforo: sem("ABORTAR"), etiqueta: "ABORTAR (aviso)", detalle: "Cesión sin cláusula suspensiva (Art. 1938 CCF): no se blinda el control." };
  else if (candados === 3) base = { semaforo: sem("COMPLETO"), etiqueta: "CERRADO · control absoluto 🔒", detalle: "Los 3 candados cerrados: cesión suspensiva + escrow + poder irrevocable." };
  else if (candados >= 1) base = { semaforo: sem("PARCIAL"), etiqueta: "PARCIAL", detalle: `${candados} de 3 candados cerrados.` };
  else base = { semaforo: sem("PENDIENTE"), etiqueta: "PENDIENTE", detalle: "Aún no se cierra ningún candado." };

  if (tieneAbortoB) {
    return { semaforo: "rojo", etiqueta: "ABORTAR (aviso) · Caso B", detalle: `Candados del Caso B: ${avisos.join("; ")}. Recuerda: compras CUOTA INDIVISA, no la casa (sujeta a partición). ${base.detalle}` };
  }
  if ((e.caso === "B" || e.caso === "C")) base.detalle += " Recuerda: compras CUOTA INDIVISA, no la casa (sujeta a partición).";
  return base;
}

// ---------- V_AAE sucesorio ----------
export interface EntradaVAAESuc {
  valorComercial: number;
  deudasDeCujus: number;
  hipotecaGravamenes: number;
  predialAgua: number;
  impuestos: number;       // sucesorios/ISR/traslado
  mesesDesenredo: number;
  margenPct: number;       // default 30
}
export interface ResultadoVAAESuc { cSan: number; cLit: number; mR: number; vaae: number; viable: boolean; detalle: string; }
export function calcularVAAESuc(e: EntradaVAAESuc): ResultadoVAAESuc {
  const cSan = e.deudasDeCujus + e.hipotecaGravamenes + e.predialAgua + e.impuestos;
  const cLit = e.mesesDesenredo * 0.01 * e.valorComercial;
  const mR = (e.margenPct > 0 ? e.margenPct : 30) / 100 * e.valorComercial;
  const vaae = e.valorComercial - cSan - cLit - mR;
  const viable = vaae > 0;
  const detalle = viable
    ? `Lo MÁXIMO que puedes pagarle al heredero por sus derechos es ${mxn(vaae)}.`
    : `V_AAE = ${mxn(vaae)} (≤ 0): no recuperable a ningún precio.`;
  return { cSan, cLit, mR, vaae, viable, detalle };
}

// ---------- Veredicto consolidado (cruzado) ----------
export function veredictoConsolidado(litigable: Semaforo, recuperable: Semaforo, vaaeViable: boolean): { txt: string; color: string; detalle: string } {
  const noLitigable = litigable === "rojo";
  const noRecuperable = recuperable === "rojo" || !vaaeViable;
  if (noLitigable) return { txt: "NO LITIGABLE", color: "bg-red-50 text-red-800 border-red-200", detalle: "Falla el título (herederos no llamados, testamento impugnado o casa no a nombre del de cujus). Ni entrar." };
  if (noRecuperable) return { txt: "LITIGABLE PERO NO RECUPERABLE", color: "bg-amber-50 text-amber-800 border-amber-200", detalle: "El juicio se gana, pero deudas + impuestos se comen el valor. No conviene meter dinero." };
  if (litigable === "gris" || recuperable === "gris") return { txt: "FALTAN DATOS", color: "bg-muted text-muted-foreground border-border", detalle: "Completa los hitos para el veredicto." };
  return { txt: "LITIGABLE Y RECUPERABLE", color: "bg-emerald-50 text-emerald-800 border-emerald-200", detalle: "Procede: compra derechos, impulsa la adjudicación y recupera la casa." };
}

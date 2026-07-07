// ============================================================
// RecorridoActor · Recorrido de pre-dictamen para la posición "Actor"
// ------------------------------------------------------------
// Antes vivía incrustado dentro de routes/urrj.tsx. Se sacó a su propio
// archivo (sin cambiar nada visible) para poder REUSARLO en la ficha UCP.
// Sigue el mismo patrón autónomo que RecorridoDemandado/Sucesorio:
//   recibe { casos, onVolver, precargar, puedeFirmarElabora, puedeValidar, puedeAdmin }
//   y maneja su propio estado, motores, guardado y PDF.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { guardarPredictamen, buscarPredictamenVigente, diffDatos, type Precarga, type PredictamenExistente } from "@/lib/predictamen-guardar";
import { enviarCorreo } from "@/lib/enviar-correo";
import {
  ESTADOS_URRJ, TIPOS_ACCION, motorPrescripcion, motorCaducidad, motorUsucapion,
  calculoFinanciero, viabilidad, type ResultadoMotor, type Semaforo,
} from "@/lib/urrj-motores";
import {
  ArrowLeft, ArrowRight, Bot, Search, Newspaper, ShieldHalf, Building2,
  Check, X, ClipboardCheck, Lock, Calculator, Download, Eye, RefreshCw } from "lucide-react";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { descargarPredictamenPDF, type DatosPDF } from "@/lib/predictamen-pdf";
import { DictamenRegistral, type PrecargaRegistral } from "@/components/dictamen-registral";
import { registrarEvento } from "@/lib/cronologia-urrj";
import { BannerCorreo } from "@/components/banner-correo";
import { CronologiaURRJ } from "@/components/cronologia-urrj-vista";
import { BloquePrecioURRJ, PRECIO_VACIO, resumenPrecio, type PrecioURRJ } from "@/components/bloque-precio-urrj";
import { Mail } from "lucide-react";

const NAVY = "#0B1E3A";

/** Resultados de los 4 motores que el recorrido Actor entrega hacia afuera
 *  (los usa la ficha UCP para reflejarlos en sus 4 hitos de motor). */
export interface ResultadosActor {
  prescripcion: ResultadoMotor;
  caducidad: ResultadoMotor;
  usucapion: ResultadoMotor;
  viabilidad_economica: ResultadoMotor;
}

const TIPOS_JUICIO = ["Hipotecario", "Mercantil ejecutivo", "Penal", "Familiar"] as const;
const QUE_CEDE = [
  "Derechos litigiosos (juicio vivo)",
  "Derecho de adjudicación (ya ganada)",
  "Crédito + hipoteca (sin demandar)",
];
const FASES = [
  "Datos mínimos", "Verificación registral", "Estado procesal", "Prescripción y caducidad",
  "Posesión y ocupantes", "Cargas ocultas", "Cálculo de intereses", "Dictamen y firmas",
];

interface Datos {
  caso_id: string; expediente: string; juzgado: string; ubicacion: string; deudor: string;
  quienCede: string; queCede: string; tipoJuicio: string; posicion: string; estado: string;
  // H1 registral
  hipotecaInscrita: string; prelacion: string; propietario: string; anotaciones: string;
  // H2 procesal
  etapa: string; sentenciaFirme: string; situacion: string; ultimaActuacion: string;
  // H3 prescripción/caducidad
  ultimoPago: string; emplazado: string; fechaEmplazamiento: string; tipoAccion: string;
  convenioRatificado: string; convenioFecha: string; plazoPrescManual: string; plazoCaducManual: string;
  // H4 posesión
  quienPosee: string; inicioPosesion: string; buenaFe: string; demandaDespojo: string;
  interpelacionJV: string; interpelacionJVFecha: string;
  interpelacionTipo: string; interpelacionExpediente: string; interpelacionJuzgado: string;
  // H5 cargas
  predial: string; agua: string; condominio: string; fiscales: string; laborales: string; otrosGravamenes: string;
  // H6 financiero/viabilidad
  capital: string; tasaOrd: string; tasaMor: string; dias: string; aplicarIVA: string; gastos: string; valorUDI: string; fechaCorte: string;
  valorComercial: string; precioCesion: string; costosOperativos: string; margenObjetivo: string;
  // H7 firmas
  firmaElabora: string; firmaValida: string;
  anotacionesHumanas: string;
}

const VACIO: Datos = {
  caso_id: "", expediente: "", juzgado: "", ubicacion: "", deudor: "",
  quienCede: "", queCede: QUE_CEDE[0], tipoJuicio: "Hipotecario", posicion: "Actor", estado: "Sinaloa",
  hipotecaInscrita: "", prelacion: "", propietario: "", anotaciones: "",
  etapa: "", sentenciaFirme: "", situacion: "", ultimaActuacion: "",
  ultimoPago: "", emplazado: "no", fechaEmplazamiento: "", tipoAccion: "hipotecaria",
  convenioRatificado: "no", convenioFecha: "", plazoPrescManual: "", plazoCaducManual: "",
  quienPosee: "", inicioPosesion: "", buenaFe: "no", demandaDespojo: "no",
  interpelacionJV: "no", interpelacionJVFecha: "",
  interpelacionTipo: "", interpelacionExpediente: "", interpelacionJuzgado: "",
  predial: "", agua: "", condominio: "", fiscales: "", laborales: "", otrosGravamenes: "",
  capital: "", tasaOrd: "", tasaMor: "", dias: "", aplicarIVA: "no", gastos: "", valorUDI: "", fechaCorte: "",
  valorComercial: "", precioCesion: "", costosOperativos: "", margenObjetivo: "",
  firmaElabora: "", firmaValida: "",
  anotacionesHumanas: "",
};

const n = (s: string) => { const v = parseFloat(s); return isNaN(v) ? 0 : v; };

function SemDot({ s }: { s: Semaforo }) {
  const c = s === "verde" ? "var(--color-text-success,#0C5C46)" : s === "amarillo" ? "#C2A24C" : s === "naranja" ? "#D97706" : s === "rojo" ? "#DC2626" : "#9CA3AF";
  return <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c }} />;
}
function semBg(s: Semaforo) {
  return s === "verde" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : s === "amarillo" ? "bg-amber-50 text-amber-800 border-amber-200"
    : s === "naranja" ? "bg-orange-50 text-orange-800 border-orange-200"
    : s === "rojo" ? "bg-red-50 text-red-800 border-red-200"
    : "bg-muted text-muted-foreground border-border";
}

function Aviso({ r }: { r: ResultadoMotor }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${semBg(r.semaforo)}`}>
      <div className="flex items-center gap-2 font-medium">
        <SemDot s={r.semaforo} /> {r.etiqueta}{r.dato ? <span className="font-normal opacity-80">· {r.dato}</span> : null}
      </div>
      <p className="mt-1 text-[13px] leading-snug opacity-90">{r.detalle}</p>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function RecorridoActor({
  casos, onVolver, precargar,
  puedeFirmarElabora = true, puedeValidar = true, puedeAdmin = false, puedePrecioPiso = false,
  onResultados, modoFicha = false, hallazgosIniciales, expedienteInicial, deudorInicial, juzgadoInicial,
}: {
  casos: any[];
  onVolver: () => void;
  precargar?: Precarga | null;
  puedeFirmarElabora?: boolean;
  puedeValidar?: boolean;
  puedeAdmin?: boolean;
  /** Solo la Directora (DGE/Super_Admin) ve/edita el precio piso. */
  puedePrecioPiso?: boolean;
  /** Si se pasa, el recorrido avisa hacia afuera sus 4 resultados de motor
   *  cada vez que cambian (lo usa la ficha UCP). */
  onResultados?: (r: ResultadosActor) => void;
  /** En la ficha UCP: oculta el dictamen/firmas/decisión/PDF propios del
   *  recorrido (el dictamen lo dan los 10 hitos de la ficha). Solo deja la
   *  captura de datos + Administración (para el hito 10 Viabilidad). */
  modoFicha?: boolean;
  hallazgosIniciales?: string[];
  expedienteInicial?: string;
  deudorInicial?: string;
  juzgadoInicial?: string;
}) {
  const [paso, setPaso] = useState(0);
  const [mostrarBoletin, setMostrarBoletin] = useState(false);
  const [mostrarBoletinJV, setMostrarBoletinJV] = useState(false);
  const [d, setD] = useState<Datos>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [verBanner, setVerBanner] = useState(false);
  const [destino, setDestino] = useState<"contabilidad" | "comercial">("contabilidad");
  const [precio, setPrecio] = useState<PrecioURRJ>(PRECIO_VACIO);
  const [seed, setSeed] = useState(0);
  const abrirDestino = (dst: "contabilidad" | "comercial") => { setDestino(dst); setSeed((x) => x + 1); setVerBanner(true); };
  const [verRegistral, setVerRegistral] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [yaExiste, setYaExiste] = useState<PredictamenExistente | null>(null);
  const [ignorarBoletin, setIgnorarBoletin] = useState(false);
  const [hallazgos, setHallazgos] = useState<string[]>([]);
  const [firmaElabora, setFirmaElabora] = useState<DatosFirma | null>(null);
  const [firmaValida, setFirmaValida] = useState<DatosFirma | null>(null);

  // precarga (re-dictaminar desde el historial)
  useEffect(() => { if (precargar?.datos) setD((p) => ({ ...p, ...precargar.datos })); }, [precargar]);

  // Robot al inicio: sembrar expediente + hallazgos (una sola vez).
  useEffect(() => {
    if (hallazgosIniciales && hallazgosIniciales.length) setHallazgos(hallazgosIniciales);
    if ((hallazgosIniciales?.length || expedienteInicial)) {
      setD((p) => {
        const notas = (hallazgosIniciales || []).filter((h) => !p.anotacionesHumanas.includes(h.split("\n")[0]));
        const sep = p.anotacionesHumanas.trim() && notas.length ? "\n\n" : "";
        return { ...p, expediente: p.expediente || expedienteInicial || p.expediente, juzgado: p.juzgado || juzgadoInicial || p.juzgado, anotacionesHumanas: p.anotacionesHumanas + (notas.length ? sep + notas.join("\n\n") : "") };
      });
    }
  }, []);

  const set = (k: keyof Datos, v: string) => setD((p) => ({ ...p, [k]: v }));

  const usaUsucapion = d.posicion === "Sucesorio" || d.quienPosee === "Tercero / invasor";

  // ---- cálculos en vivo ----
  const rPresc = useMemo(() => motorPrescripcion({
    ultimoPago: d.ultimoPago, emplazado: d.emplazado === "si", fechaEmplazamiento: d.fechaEmplazamiento,
    tipoAccion: d.tipoAccion, convenioRatificadoFecha: d.convenioRatificado === "si" ? d.convenioFecha : undefined,
    plazoManualAnios: d.plazoPrescManual ? n(d.plazoPrescManual) : undefined,
    interpelacionFecha: d.interpelacionJV === "si" ? (d.interpelacionJVFecha || undefined) : undefined,
  }), [d.ultimoPago, d.emplazado, d.fechaEmplazamiento, d.tipoAccion, d.convenioRatificado, d.convenioFecha, d.plazoPrescManual, d.interpelacionJV, d.interpelacionJVFecha]);

  const rCaduc = useMemo(() => motorCaducidad({
    ultimaActuacion: d.ultimaActuacion, estado: d.estado,
    plazoManualDias: d.plazoCaducManual ? n(d.plazoCaducManual) : undefined,
  }), [d.ultimaActuacion, d.estado, d.plazoCaducManual]);

  const rUsuc = useMemo(() => motorUsucapion({
    inicioPosesion: d.inicioPosesion, buenaFe: d.buenaFe === "si", hayDemandaDespojo: d.demandaDespojo === "si",
    hayInterpelacion: d.interpelacionJV === "si",
  }), [d.inicioPosesion, d.buenaFe, d.demandaDespojo, d.interpelacionJV]);

  const cargas = n(d.predial) + n(d.agua) + n(d.condominio) + n(d.fiscales) + n(d.laborales) + n(d.otrosGravamenes);
  const hayLaboral = n(d.laborales) > 0;
  const hayFiscal = n(d.fiscales) > 0;
  const avisoJV: ResultadoMotor | null = d.interpelacionJV === "si" ? {
    semaforo: "verde",
    etiqueta: "Interpelación (jurisdicción voluntaria)",
    dato: d.interpelacionExpediente ? `exp. ${d.interpelacionExpediente}` : undefined,
    detalle: `${d.interpelacionTipo || "Interpelación judicial"}${d.interpelacionJVFecha ? ` notificada el ${d.interpelacionJVFecha}` : ""}. Interrumpe la prescripción y la usucapión (Art. 1168 CCF).`,
  } : null;
  const fin = useMemo(() => calculoFinanciero({
    capital: n(d.capital), tasaOrdinariaAnual: n(d.tasaOrd), tasaMoratoriaAnual: n(d.tasaMor),
    dias: n(d.dias), aplicarIVA: d.aplicarIVA === "si", gastos: n(d.gastos), valorUDI: n(d.valorUDI) || undefined,
  }), [d.capital, d.tasaOrd, d.tasaMor, d.dias, d.aplicarIVA, d.gastos, d.valorUDI]);
  const adeudoTotal = fin.totalDeuda;
  const rViab = useMemo(() => viabilidad(n(d.valorComercial), adeudoTotal, cargas + n(d.costosOperativos), n(d.precioCesion), n(d.margenObjetivo)),
    [d.valorComercial, adeudoTotal, cargas, d.costosOperativos, d.precioCesion, d.margenObjetivo]);

  const registralRojo = d.hipotecaInscrita === "no";
  const prelacionRiesgo = d.prelacion === "Hay acreedores anteriores";
  const anotacionesRiesgo = d.anotaciones.trim() !== "";
  const enAmparo = d.situacion === "En amparo";
  const suspendido = d.situacion === "Suspendido";
  const etapaAvanzada = ["Sentencia", "Ejecución", "Remate"].includes(d.etapa);
  const etapaTemprana = ["Admisión", "Emplazamiento"].includes(d.etapa);
  const estadoRobot: "sinaloa" | "bcs" | "jalisco" =
    d.estado === "Jalisco" ? "jalisco" : d.estado === "Baja California Sur" ? "bcs" : "sinaloa";
  const fmt = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  // ---- dictamen sugerido SOLO por lo jurídico (la viabilidad económica es de Administración) ----
  const dictamen = useMemo(() => {
    const sems: Semaforo[] = [rPresc.semaforo, rCaduc.semaforo];
    if (usaUsucapion) sems.push(rUsuc.semaforo);
    if (registralRojo) sems.push("rojo");
    if (prelacionRiesgo) sems.push("naranja");
    if (anotacionesRiesgo) sems.push("amarillo");
    if (enAmparo || suspendido) sems.push("naranja");
    if (etapaTemprana) sems.push("amarillo");
    if (hayLaboral) sems.push("rojo");
    if (hayFiscal) sems.push("naranja");
    if (sems.includes("rojo")) return { txt: "NEGATIVO", color: "bg-red-50 text-red-800 border-red-200" };
    if (sems.includes("naranja") || sems.includes("amarillo")) return { txt: "CONDICIONADO", color: "bg-amber-50 text-amber-800 border-amber-200" };
    if (sems.includes("gris")) return { txt: "FALTAN DATOS", color: "bg-muted text-muted-foreground border-border" };
    return { txt: "POSITIVO", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  }, [rPresc, rCaduc, rUsuc, usaUsucapion, registralRojo, prelacionRiesgo, anotacionesRiesgo, enAmparo, suspendido, etapaTemprana, hayLaboral, hayFiscal]);

  // avisa los resultados de motor hacia afuera (para la ficha UCP)
  useEffect(() => {
    if (!onResultados) return;
    onResultados({
      prescripcion: rPresc,
      caducidad: rCaduc,
      usucapion: usaUsucapion ? rUsuc : { semaforo: "verde", etiqueta: "No aplica", detalle: "No hay tercero poseyendo; la usucapión no aplica en este caso." },
      viabilidad_economica: rViab,
    });
  }, [onResultados, rPresc, rCaduc, rUsuc, usaUsucapion, rViab]);

  // Días de cómputo automáticos: del último pago a la fecha de corte (por defecto hoy).
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const diasEntre = (desde: string, hasta: string) => {
    if (!desde || !hasta) return null;
    const a = new Date(desde + "T00:00:00"), b = new Date(hasta + "T00:00:00");
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    const d = Math.round((b.getTime() - a.getTime()) / 86400000);
    return d >= 0 ? d : null;
  };
  useEffect(() => {
    // al llegar a la fase de intereses, si no hay fecha de corte, poner hoy
    if (paso === 6 && !d.fechaCorte) setD((p) => ({ ...p, fechaCorte: hoyISO() }));
  }, [paso]);
  useEffect(() => {
    const dd = diasEntre(d.ultimoPago, d.fechaCorte);
    if (dd != null) setD((p) => (String(dd) === p.dias ? p : { ...p, dias: String(dd) }));
  }, [d.ultimoPago, d.fechaCorte]);

  const guardar = async (decision: string) => {
    setGuardando(true);
    // Deduplicación: si es un pre-dictamen NUEVO (no un re-dictaminar) y ya existe
    // uno vigente para este expediente o caso, no se duplica: se avisa.
    if (!precargar) {
      const ex = await buscarPredictamenVigente(d.expediente, d.caso_id);
      if (ex) { setYaExiste(ex); setGuardando(false); return; }
    }
    const payload = {
      caso_id: d.caso_id || null, expediente: d.expediente || null, juzgado: d.juzgado || null, estado: d.estado,
      tipo_juicio: d.tipoJuicio, posicion: d.posicion,
      datos: d,
      resultados: { prescripcion: rPresc, caducidad: rCaduc, usucapion: usaUsucapion ? rUsuc : null, viabilidad: rViab, financiero: fin, cargas, firmas: { elabora: firmaElabora, valida: firmaValida } },
      dictamen_sugerido: dictamen.txt, dictamen_final: decision,
      firma_elabora: firmaElabora?.nombre || null, firma_elabora_fecha: firmaElabora?.fecha || null,
      firma_valida: firmaValida?.nombre || null, firma_valida_fecha: firmaValida?.fecha || null,
    };
    try {
      await guardarPredictamen(payload, precargar, construirDatosPDF(decision), { reglaOroURRJ: true });
      registrarEvento({ caso_id: d.caso_id || null, expediente: d.expediente || null, tipo: "dictamen_juridico", resultado: dictamen.txt, firma_elabora: firmaElabora?.nombre || null, firma_valida: firmaValida?.nombre || null, detalle: `Decisión: ${decision}` });
      setGuardado(`Pre-dictamen guardado: ${decision}`);
    } catch (e: any) {
      setGuardado("No se pudo guardar (¿corriste el SQL de predictamen?): " + e.message);
    } finally { setGuardando(false); }
  };

  const construirDatosPDF = (decision: string): DatosPDF => {
    const riesgos = [
      { nombre: "Prescripción", r: rPresc },
      { nombre: "Caducidad", r: rCaduc },
      ...(usaUsucapion ? [{ nombre: "Usucapión", r: rUsuc }] : []),
      ...(avisoJV ? [{ nombre: "Interpelación (JV)", r: avisoJV }] : []),
    ];
    return {
      expediente: d.expediente, juzgado: d.juzgado, estado: d.estado, tipoJuicio: d.tipoJuicio, posicion: d.posicion,
      ubicacion: d.ubicacion, deudor: d.deudor, quienCede: d.quienCede, queCede: d.queCede,
      dictamen: dictamen.txt, riesgos,
      intereses: { ordinarios: fin.ordinarios, moratorios: fin.moratorios, iva: fin.iva, total: fin.totalDeuda, udis: fin.udis, usura: fin.alertaUsura },
      admin: puedeAdmin && (n(d.valorComercial) || n(d.precioCesion)) ? { valorComercial: n(d.valorComercial), costos: cargas + n(d.costosOperativos), precioCesion: n(d.precioCesion), viab: rViab } : null,
      anotaciones: d.anotacionesHumanas,
      firmaElabora, firmaValida, decision,
      cambios: precargar ? { campos: diffDatos(precargar.datos || {}, d), nota: precargar.cambios } : null,
      datos: {
        hipotecaInscrita: d.hipotecaInscrita, prelacion: d.prelacion, propietario: d.propietario, anotaciones: d.anotaciones,
        etapa: d.etapa, sentenciaFirme: d.sentenciaFirme, situacion: d.situacion, ultimaActuacion: d.ultimaActuacion,
        ultimoPago: d.ultimoPago, tipoAccion: d.tipoAccion, emplazado: d.emplazado, fechaEmplazamiento: d.fechaEmplazamiento,
        convenioRatificado: d.convenioRatificado, convenioFecha: d.convenioFecha,
        interpelacionJV: d.interpelacionJV, interpelacionJVFecha: d.interpelacionJVFecha, interpelacionTipo: d.interpelacionTipo, interpelacionExpediente: d.interpelacionExpediente,
        quienPosee: d.quienPosee, inicioPosesion: d.inicioPosesion, buenaFe: d.buenaFe, demandaDespojo: d.demandaDespojo,
        predial: d.predial, agua: d.agua, condominio: d.condominio, fiscales: d.fiscales, laborales: d.laborales, otrosGravamenes: d.otrosGravamenes,
        margenObjetivo: d.margenObjetivo,
      },
      boletines: hallazgos,
    };
  };

  const descargarPDF = async (decision: string, modo: "descargar" | "ver" = "descargar") => {
    try {
      const urlPdf = await descargarPredictamenPDF(construirDatosPDF(decision), modo);
      if (modo === "ver" && typeof urlPdf === "string") setPdfUrl(urlPdf);
    } catch (e: any) {
      setGuardado("No se pudo generar el PDF: " + e.message);
    }
  };

  const dosFirmas = !!(firmaElabora && firmaValida);
  const decidido = !!guardado && guardado.startsWith("Pre-dictamen guardado");

  const checarExiste = async (exp?: string | null, caso?: string | null) => {
    if (precargar) return; // en re-dictaminar no aplica
    if (!exp && !caso) { setYaExiste(null); return; }
    const ex = await buscarPredictamenVigente(exp, caso);
    setYaExiste(ex);
  };

  const asuntoBanner = destino === "contabilidad"
    ? `Solicitud de precio — Dictamen URRJ ${dictamen.txt} · Exp. ${d.expediente || "—"}`
    : `Garantía lista para Comercial — ${dictamen.txt} · Exp. ${d.expediente || "—"}`;
  const mensajeBanner = [
    destino === "contabilidad"
      ? "Se solicita el precio para esta garantía ya dictaminada por URRJ."
      : "Garantía dictaminada y con precio; queda lista para Comercial.",
    "",
    `Resultado jurídico: ${dictamen.txt}`,
    `Expediente: ${d.expediente || "—"}`,
    `Garantía: ${d.ubicacion || "—"}`,
    `Deudor: ${d.deudor || "—"}`,
    "",
    resumenPrecio(precio),
  ].join("\n");

  if (verRegistral) {
    const precReg: PrecargaRegistral = { acreditado: d.deudor || undefined, numeroCredito: d.expediente || undefined, direccion: d.ubicacion || undefined };
    return <DictamenRegistral precarga={precReg} casoId={d.caso_id || undefined} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedePrecioPiso={puedePrecioPiso} onVolver={() => setVerRegistral(false)} />;
  }

  return (
    <div className="space-y-5">
      {pdfUrl && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setPdfUrl(null)}>
          <div className="my-2 flex h-[95vh] w-[97vw] max-w-6xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>Pre-dictamen · Exp. {d.expediente || "—"}</p>
              <div className="flex items-center gap-3">
                <a href={pdfUrl} download={`predictamen-${(d.expediente || "caso").replace(/[^\w-]/g, "_")}.pdf`} className="text-xs font-medium text-[color:var(--teal)] hover:underline">Descargar</a>
                <button onClick={() => setPdfUrl(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <iframe src={pdfUrl} title="Pre-dictamen PDF" className="min-h-0 flex-1 rounded-b-xl" />
          </div>
        </div>
      )}
      {verBanner && (
        <BannerCorreo
          key={`${destino}-${seed}`}
          titulo="Enviar dictamen URRJ"
          asuntoInicial={asuntoBanner}
          mensajeInicial={mensajeBanner}
          folio={d.expediente}
          extra={
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => abrirDestino("contabilidad")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${destino === "contabilidad" ? "bg-[color:var(--teal)] text-white" : "border border-input hover:bg-muted"}`}>1º Contabilidad · solicitar precio</button>
                <button onClick={() => precio.precioPiso.trim() && abrirDestino("comercial")} disabled={!precio.precioPiso.trim()} className={`rounded-md px-3 py-1.5 text-xs font-medium ${destino === "comercial" ? "bg-[color:var(--teal)] text-white" : "border border-input hover:bg-muted"} disabled:opacity-40`}>2º Comercial · con precio</button>
                {!precio.precioPiso.trim() && <span className="self-center text-[11px] text-muted-foreground">Comercial se habilita al poner el precio piso.</span>}
              </div>
              <BloquePrecioURRJ valor={precio} onChange={setPrecio} puedePrecioPiso={puedePrecioPiso} />
              <p className="text-[11px] text-muted-foreground">Al cambiar de destino o poner el precio, vuelve a tocar el botón del destino para actualizar el mensaje.</p>
            </div>
          }
          onCerrar={() => setVerBanner(false)}
          onEnviado={() => registrarEvento({ caso_id: d.caso_id || null, expediente: d.expediente || null, tipo: "correo_juridico", resultado: dictamen.txt, firma_elabora: firmaElabora?.nombre || null, firma_valida: firmaValida?.nombre || null, vista_previa: `A ${destino} · Asunto: ${asuntoBanner}\n\n${mensajeBanner}`, detalle: `Enviado a ${destino}` })}
        />
      )}

      <div className="-mt-1 flex justify-start">
        <button onClick={onVolver} className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Cambiar posición (Actor)</button>
      </div>

      {/* Robot de búsqueda (accesos directos por ahora) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Bot className="h-4 w-4" /> Robot de búsqueda jurídica (próximamente activo)</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input placeholder="Buscar por expediente, parte o juzgado…" className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" />
          </div>
          <a className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs hover:bg-muted" href="https://www.stj-sin.gob.mx" target="_blank" rel="noreferrer"><Newspaper className="h-3.5 w-3.5" /> Boletín judicial</a>
          <span className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs text-muted-foreground"><ShieldHalf className="h-3.5 w-3.5" /> Amparo</span>
          <span className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> RPPC</span>
        </div>
      </div>

      {/* Progreso */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{d.tipoJuicio} · {d.posicion} · {d.estado}</span>
          <span>Fase {paso + 1} de {FASES.length}: {modoFicha && paso === 7 ? "Administración / Viabilidad" : FASES[paso]}</span>
        </div>
        <div className="flex gap-1">
          {FASES.map((_, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < paso ? "#0C5C46" : i === paso ? NAVY : "var(--border, #e5e7eb)" }} />
          ))}
        </div>
      </div>

      {yaExiste && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Ya existe un pre-dictamen para este expediente{yaExiste.folio ? ` (folio ${yaExiste.folio})` : ""}.</p>
          <p className="text-[13px]">No se creará otro para no duplicarlo. Puedes ver la ficha o re-dictaminar.</p>
          <div className="flex flex-wrap gap-2">
            {(yaExiste.caso_id || d.caso_id) && (
              <Link to="/expediente" search={{ id: (yaExiste.caso_id || d.caso_id) as string, origen: "urrj" } as any} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">Ver ficha (cronología / cambios)</Link>
            )}
            <Link to="/urrj" className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-white">Re-dictaminar (ir al Registro URRJ)</Link>
            <button onClick={() => setYaExiste(null)} className="text-xs font-medium text-muted-foreground underline">Ignorar por ahora</button>
          </div>
        </div>
      )}

      {/* Contenido de cada fase */}
      <div className="rounded-xl border border-border bg-card p-5">
        {paso === 0 && (
          <div className="space-y-4">
            <H titulo="0 · Datos mínimos / admisión" sub="Lo básico para abrir el expediente." />
            {expedienteInicial && d.expediente && expedienteInicial !== d.expediente && !ignorarBoletin && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">El boletín que buscaste es de OTRO expediente.</p>
                <p className="text-[13px]">Boletín: <b>{expedienteInicial}</b>{deudorInicial ? ` · ${deudorInicial}` : ""} — Solicitud/registro: <b>{d.expediente}</b>{d.deudor ? ` · ${d.deudor}` : ""}. ¿Con cuál abro el pre-dictamen?</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setD((p) => ({ ...p, expediente: expedienteInicial, deudor: deudorInicial || p.deudor, juzgado: juzgadoInicial || p.juzgado })); setIgnorarBoletin(true); }} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">Usar el del boletín ({expedienteInicial})</button>
                  <button onClick={() => setIgnorarBoletin(true)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-white">Mantener el de la solicitud ({d.expediente})</button>
                </div>
              </div>
            )}
            <Campo label="Caso de la cartera (opcional)">
              <select className={inp} value={d.caso_id} onChange={(e) => {
                const c = casos.find((x) => String(x.id) === e.target.value);
                setD((p) => ({ ...p, caso_id: e.target.value, expediente: c?.expediente || p.expediente, juzgado: c?.juzgado || p.juzgado, ubicacion: c?.direccion_garantia || p.ubicacion, deudor: c?.cliente_nombre || p.deudor, estado: ESTADOS_URRJ.includes(c?.entidad) ? c.entidad : p.estado }));
                checarExiste(c?.expediente || d.expediente, e.target.value);
              }}>
                <option value="">— Escribir a mano —</option>
                {casos.map((c) => <option key={c.id} value={c.id}>{c.expediente} · {c.juzgado}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Tipo de juicio"><select className={inp} value={d.tipoJuicio} onChange={(e) => set("tipoJuicio", e.target.value)}>{TIPOS_JUICIO.map((t) => <option key={t}>{t}</option>)}</select></Campo>
              <Campo label="Estado del juicio"><select className={inp} value={d.estado} onChange={(e) => set("estado", e.target.value)}>{ESTADOS_URRJ.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Expediente"><input className={inp} value={d.expediente} onChange={(e) => set("expediente", e.target.value)} onBlur={() => checarExiste(d.expediente, d.caso_id)} /></Campo>
              <Campo label="Juzgado"><input className={inp} value={d.juzgado} onChange={(e) => set("juzgado", e.target.value)} /></Campo>
              <Campo label="Ubicación del inmueble"><input className={inp} value={d.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} /></Campo>
              <Campo label="Deudor"><input className={inp} value={d.deudor} onChange={(e) => set("deudor", e.target.value)} /></Campo>
              <Campo label="Quién cede (banco / administradora)"><input className={inp} value={d.quienCede} onChange={(e) => set("quienCede", e.target.value)} /></Campo>
              <Campo label="Qué se cede"><select className={inp} value={d.queCede} onChange={(e) => set("queCede", e.target.value)}>{QUE_CEDE.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            </div>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <H titulo="1 · Verificación registral (RPP)" sub="Folio real y gravámenes. Lo primero y más importante." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Hipoteca inscrita y vigente?"><SiNo v={d.hipotecaInscrita} on={(x) => set("hipotecaInscrita", x)} /></Campo>
              <Campo label="Prelación"><select className={inp} value={d.prelacion} onChange={(e) => set("prelacion", e.target.value)}><option value="">—</option><option>Primer lugar</option><option>Hay acreedores anteriores</option></select></Campo>
              <Campo label="Propietario actual (según RPP)"><input className={inp} value={d.propietario} onChange={(e) => set("propietario", e.target.value)} /></Campo>
              <Campo label="Anotaciones / embargos / fideicomisos"><input className={inp} value={d.anotaciones} onChange={(e) => set("anotaciones", e.target.value)} /></Campo>
            </div>
            {registralRojo && <Aviso r={{ semaforo: "rojo", etiqueta: "Riesgo grave", detalle: "La hipoteca no está inscrita/vigente. Sin inscripción, la cesión es muy riesgosa (normalmente sería PARO)." }} />}
            {prelacionRiesgo && <Aviso r={{ semaforo: "naranja", etiqueta: "Prelación", detalle: "Hay acreedores anteriores: la hipoteca no está en primer lugar. Riesgo alto sobre la recuperación de la garantía." }} />}
            {anotacionesRiesgo && <Aviso r={{ semaforo: "amarillo", etiqueta: "Anotaciones / gravámenes", detalle: "Hay embargos, anotaciones o fideicomisos registrados. Revisar su alcance antes de avanzar." }} />}
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <H titulo="2 · Estado procesal real" sub="Lo que dice el expediente, no lo que dicen." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Etapa del juicio"><select className={inp} value={d.etapa} onChange={(e) => set("etapa", e.target.value)}><option value="">—</option><option>Admisión</option><option>Emplazamiento</option><option>Contestación</option><option>Pruebas</option><option>Sentencia</option><option>Ejecución</option><option>Remate</option></select></Campo>
              <Campo label="¿Sentencia firme a favor?"><SiNo v={d.sentenciaFirme} on={(x) => set("sentenciaFirme", x)} /></Campo>
              <Campo label="Situación"><select className={inp} value={d.situacion} onChange={(e) => set("situacion", e.target.value)}><option value="">—</option><option>En trámite</option><option>En ejecución</option><option>En amparo</option><option>Suspendido</option></select></Campo>
              <Campo label="Fecha de última actuación procesal"><input type="date" className={inp} value={d.ultimaActuacion} onChange={(e) => set("ultimaActuacion", e.target.value)} /></Campo>
            </div>
            {d.sentenciaFirme === "si" && <Aviso r={{ semaforo: "verde", etiqueta: "Sentencia firme a favor", detalle: "Sube mucho el valor de la cesión." }} />}
            {enAmparo && <Aviso r={{ semaforo: "naranja", etiqueta: "En amparo", detalle: "El juicio está en amparo: puede suspenderse o revertirse lo ganado. Riesgo alto para comprar la cesión." }} />}
            {suspendido && <Aviso r={{ semaforo: "naranja", etiqueta: "Suspendido", detalle: "El juicio está detenido; no avanza hasta que se levante la suspensión." }} />}
            {etapaAvanzada && <Aviso r={{ semaforo: "verde", etiqueta: "Etapa avanzada", detalle: `El juicio está en ${d.etapa}: cerca de la recuperación.` }} />}
            {etapaTemprana && <Aviso r={{ semaforo: "amarillo", etiqueta: "Etapa temprana", detalle: `El juicio está en ${d.etapa}: falta camino procesal (más tiempo y riesgo).` }} />}
            {enAmparo && (
              <div className="rounded-lg border border-border p-3">
                <button
                  type="button"
                  onClick={() => setMostrarBoletin((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Search className="h-3.5 w-3.5" /> {mostrarBoletin ? "Ocultar búsqueda del boletín" : "Buscar en el boletín (robot)"}
                </button>
                {mostrarBoletin && (
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                      Busca el expediente en el boletín para ver si <b>asoma el amparo</b> (oficios del Juzgado de Distrito, suspensión recibida). El robot lee el boletín <b>estatal</b>, no el federal.
                    </p>
                    <BuscadorBoletin
                      expedienteInicial={d.expediente}
                      estadoInicial={estadoRobot}
                      resaltarAmparo
                      onHallazgoAmparo={(nota) => {
                        const marca = nota.split("\n")[0];
                        setHallazgos((prev) => prev.some((x) => x.includes(marca)) ? prev : [...prev, nota]);
                        setD((p) => {
                          if (p.anotacionesHumanas.includes(marca)) return p; // no duplicar el mismo expediente
                          const sep = p.anotacionesHumanas.trim() ? "\n\n" : "";
                          return { ...p, anotacionesHumanas: p.anotacionesHumanas + sep + nota };
                        });
                      }}
                    />
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Búsqueda de amparo <b>federal</b> directa:{" "}
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">en construcción</span>. Por ahora se revisa el reflejo en el boletín estatal.
                </p>
              </div>
            )}
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <H titulo="3 · Prescripción y caducidad" sub="El motor que más mata cesiones. Captura las fechas y el sistema calcula." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Fecha del último pago del acreditado"><input type="date" className={inp} value={d.ultimoPago} onChange={(e) => set("ultimoPago", e.target.value)} /></Campo>
              <Campo label="Tipo de acción"><select className={inp} value={d.tipoAccion} onChange={(e) => set("tipoAccion", e.target.value)}>{TIPOS_ACCION.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}</select></Campo>
              <Campo label="¿Está emplazado?"><SiNo v={d.emplazado} on={(x) => set("emplazado", x)} /></Campo>
              {d.emplazado === "si" && <Campo label="Fecha de emplazamiento"><input type="date" className={inp} value={d.fechaEmplazamiento} onChange={(e) => set("fechaEmplazamiento", e.target.value)} /></Campo>}
              <Campo label="¿Convenio ratificado ante juez/notario?"><SiNo v={d.convenioRatificado} on={(x) => set("convenioRatificado", x)} /></Campo>
              {d.convenioRatificado === "si" && <Campo label="Fecha del convenio ratificado"><input type="date" className={inp} value={d.convenioFecha} onChange={(e) => set("convenioFecha", e.target.value)} /></Campo>}
              <Campo label="¿Interpelación / diligencia de jurisdicción voluntaria notificada?"><SiNo v={d.interpelacionJV} on={(x) => set("interpelacionJV", x)} /></Campo>
              {d.interpelacionJV === "si" && <Campo label="Fecha de la interpelación (jurisdicción voluntaria)"><input type="date" className={inp} value={d.interpelacionJVFecha} onChange={(e) => set("interpelacionJVFecha", e.target.value)} /></Campo>}
            </div>
            {d.interpelacionJV === "si" && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground">Datos de la interpelación (jurisdicción voluntaria) — para ubicarla</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Tipo de interpelación">
                    <select className={inp} value={d.interpelacionTipo} onChange={(e) => set("interpelacionTipo", e.target.value)}>
                      <option value="">—</option>
                      <option>Requerimiento / interpelación de pago</option>
                      <option>Diligencias preparatorias</option>
                      <option>Notificación por jurisdicción voluntaria</option>
                      <option>Consignación de pago</option>
                      <option>Otra</option>
                    </select>
                  </Campo>
                  <Campo label="Expediente de la JV"><input className={inp} value={d.interpelacionExpediente} onChange={(e) => set("interpelacionExpediente", e.target.value)} placeholder="Ej. 512/2024" /></Campo>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setMostrarBoletinJV((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    <Search className="h-3.5 w-3.5" /> {mostrarBoletinJV ? "Ocultar búsqueda de la JV" : "Buscar la JV en el boletín (robot)"}
                  </button>
                  {mostrarBoletinJV && (
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                        Las jurisdicciones voluntarias <b>sí aparecen</b> en el boletín estatal. Busca el expediente de la JV para confirmar la interpelación y su fecha.
                      </p>
                      <BuscadorBoletin expedienteInicial={d.interpelacionExpediente} estadoInicial={estadoRobot} />
                    </div>
                  )}
                </div>
              </div>
            )}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Ajustar plazos a mano (opcional)</summary>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="Plazo prescripción (años) — si quieres cambiarlo"><input type="number" className={inp} value={d.plazoPrescManual} onChange={(e) => set("plazoPrescManual", e.target.value)} placeholder="auto por ley" /></Campo>
                <Campo label="Plazo caducidad (días) — si quieres cambiarlo"><input type="number" className={inp} value={d.plazoCaducManual} onChange={(e) => set("plazoCaducManual", e.target.value)} placeholder="auto por estado" /></Campo>
              </div>
            </details>
            <Aviso r={rPresc} />
            <Aviso r={rCaduc} />
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <H titulo="4 · Posesión física y ocupantes" sub="Quién está en el inmueble y desde cuándo (alerta de usucapión)." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Quién posee el inmueble?"><select className={inp} value={d.quienPosee} onChange={(e) => set("quienPosee", e.target.value)}><option value="">—</option><option>El deudor</option><option>Inquilino</option><option>Tercero / invasor</option><option>Nadie</option></select></Campo>
              <Campo label="Posesión desde (fecha)"><input type="date" className={inp} value={d.inicioPosesion} onChange={(e) => set("inicioPosesion", e.target.value)} /></Campo>
              <Campo label="¿Tiene título aparente (buena fe)?"><SiNo v={d.buenaFe} on={(x) => set("buenaFe", x)} /></Campo>
              <Campo label="¿Hay demanda de despojo?"><SiNo v={d.demandaDespojo} on={(x) => set("demandaDespojo", x)} /></Campo>
            </div>
            {usaUsucapion ? <Aviso r={rUsuc} /> : <p className="text-xs text-muted-foreground">El motor de usucapión se activa cuando hay un tercero poseyendo o la posición es Sucesorio.</p>}
          </div>
        )}

        {paso === 5 && (
          <div className="space-y-4">
            <H titulo="5 · Cargas ocultas" sub="Todo esto se hereda con el inmueble y se come el margen. En pesos." />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Predial atrasado"><input type="number" className={inp} value={d.predial} onChange={(e) => set("predial", e.target.value)} /></Campo>
              <Campo label="Agua"><input type="number" className={inp} value={d.agua} onChange={(e) => set("agua", e.target.value)} /></Campo>
              <Campo label="Cuotas de condominio"><input type="number" className={inp} value={d.condominio} onChange={(e) => set("condominio", e.target.value)} /></Campo>
              <Campo label="Créditos fiscales"><input type="number" className={inp} value={d.fiscales} onChange={(e) => set("fiscales", e.target.value)} /></Campo>
              <Campo label="Créditos laborales"><input type="number" className={inp} value={d.laborales} onChange={(e) => set("laborales", e.target.value)} /></Campo>
              <Campo label="Otros gravámenes"><input type="number" className={inp} value={d.otrosGravamenes} onChange={(e) => set("otrosGravamenes", e.target.value)} /></Campo>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">Total de cargas ocultas: <b>{fmt(cargas)}</b></div>
            {hayLaboral && <Aviso r={{ semaforo: "rojo", etiqueta: "Crédito laboral (kill switch)", detalle: "Los créditos laborales tienen preferencia sobre la hipoteca y el fisco (Art. 113 LFT). Pueden vaciar la garantía aunque ganes el juicio." }} />}
            {hayFiscal && <Aviso r={{ semaforo: "naranja", etiqueta: "Crédito fiscal", detalle: "El crédito fiscal tiene preferencia (Art. 149 CFF): puede cobrarse antes que la hipoteca." }} />}
          </div>
        )}

        {paso === 6 && (
          <div className="space-y-4">
            <H titulo="6 · Cálculo de intereses" sub="Solo intereses de la deuda. La valuación y el precio los hace Administración." />
            <p className="text-xs font-medium text-muted-foreground">Cálculo de la deuda (año comercial 360 días, Art. 362 CCom)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Capital"><input type="number" className={inp} value={d.capital} onChange={(e) => set("capital", e.target.value)} /></Campo>
              <Campo label="Tasa ordinaria (% anual)"><input type="number" className={inp} value={d.tasaOrd} onChange={(e) => set("tasaOrd", e.target.value)} /></Campo>
              <Campo label="Tasa moratoria (% anual)"><input type="number" className={inp} value={d.tasaMor} onChange={(e) => set("tasaMor", e.target.value)} /></Campo>
              <Campo label="Fecha del último pago"><input type="date" className={inp} value={d.ultimoPago} onChange={(e) => set("ultimoPago", e.target.value)} /></Campo>
              <Campo label="Calcular hasta (fecha de corte)"><input type="date" className={inp} value={d.fechaCorte} onChange={(e) => set("fechaCorte", e.target.value)} /></Campo>
              <Campo label="Días de cómputo (auto, editable)"><input type="number" className={inp} value={d.dias} onChange={(e) => set("dias", e.target.value)} /></Campo>
              <Campo label="Gastos y costas"><input type="number" className={inp} value={d.gastos} onChange={(e) => set("gastos", e.target.value)} /></Campo>
              <Campo label="¿Aplicar IVA 16% a intereses?"><SiNo v={d.aplicarIVA} on={(x) => set("aplicarIVA", x)} /></Campo>
              <Campo label="Valor UDI (opcional)"><input type="number" className={inp} value={d.valorUDI} onChange={(e) => set("valorUDI", e.target.value)} /></Campo>
            </div>
            <p className="text-[11px] text-muted-foreground">Los <b>días de cómputo</b> se calculan solos: de la <b>fecha del último pago</b> a la <b>fecha de corte</b> (por defecto hoy). Cambia la fecha de corte para calcular a otra fecha, o edita los días a mano.</p>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-0.5">
              <div>Intereses ordinarios: <b>{fmt(fin.ordinarios)}</b></div>
              <div>Intereses moratorios: <b>{fmt(fin.moratorios)}</b></div>
              {fin.iva > 0 && <div>IVA: <b>{fmt(fin.iva)}</b></div>}
              <div>Total deuda: <b>{fmt(fin.totalDeuda)}</b>{fin.udis ? <span className="text-muted-foreground"> · {fin.udis.toLocaleString("es-MX", { maximumFractionDigits: 0 })} UDIs</span> : null}</div>
              {fin.alertaUsura && <div className="text-red-700 font-medium">⚠ Posible usura: la tasa moratoria está muy alta.</div>}
            </div>
            <p className="text-xs text-muted-foreground">La valuación, costos y precio de cesión se llenan en la sección de <b>Administración</b> (al final), solo para los roles autorizados.</p>
          </div>
        )}

        {paso === 7 && (
          <div className="space-y-4">
            {modoFicha ? (
              <H titulo="Administración · valuación y precio" sub="De aquí sale el hito 10 (Viabilidad económica)." />
            ) : (<>
            <H titulo="7 · Dictamen y firmas" sub="Riesgos, pre-dictamen del sistema, firmas y decisión humana." />
            <div className="space-y-2">
              <Aviso r={rPresc} /><Aviso r={rCaduc} />{usaUsucapion && <Aviso r={rUsuc} />}
              {avisoJV && <Aviso r={avisoJV} />}
              {registralRojo && <Aviso r={{ semaforo: "rojo", etiqueta: "Registral", detalle: "Hipoteca no inscrita/vigente." }} />}
              {prelacionRiesgo && <Aviso r={{ semaforo: "naranja", etiqueta: "Prelación", detalle: "Hay acreedores anteriores (no primer lugar)." }} />}
              {anotacionesRiesgo && <Aviso r={{ semaforo: "amarillo", etiqueta: "Anotaciones / gravámenes", detalle: "Hay embargos, anotaciones o fideicomisos registrados." }} />}
              {enAmparo && <Aviso r={{ semaforo: "naranja", etiqueta: "En amparo", detalle: "El juicio está en amparo: puede revertir lo ganado." }} />}
              {suspendido && <Aviso r={{ semaforo: "naranja", etiqueta: "Suspendido", detalle: "El juicio está detenido." }} />}
              {hayLaboral && <Aviso r={{ semaforo: "rojo", etiqueta: "Crédito laboral", detalle: "Preferencia sobre la hipoteca (Art. 113 LFT). Kill switch." }} />}
              {hayFiscal && <Aviso r={{ semaforo: "naranja", etiqueta: "Crédito fiscal", detalle: "Preferencia (Art. 149 CFF)." }} />}
            </div>
            <div className={`rounded-lg border p-4 ${dictamen.color}`}>
              <p className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" /> Pre-dictamen del sistema (sugerido): {dictamen.txt}</p>
              <p className="mt-1 text-xs opacity-80">El sistema solo sugiere con base en los semáforos. La decisión final es humana.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Anotaciones del abogado (observaciones a mano)</label>
              <textarea value={d.anotacionesHumanas} onChange={(e) => set("anotacionesHumanas", e.target.value)} rows={4} placeholder="Escribe aquí cualquier observación, contexto o recomendación que el sistema no calcula…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FirmaParte titulo="Elabora · abogado URRJ" valor={firmaElabora} onFirmar={(f) => setFirmaElabora(f.fecha ? f : null)} cargoSugerido="Abogado URRJ" bloqueado={!puedeFirmarElabora} />
              <FirmaParte titulo="Valida · Director Legal" valor={firmaValida} onFirmar={(f) => setFirmaValida(f.fecha ? f : null)} cargoSugerido="Director Legal (DIL)" bloqueado={!puedeValidar} />
            </div>
            <p className="text-sm font-medium">Decisión humana · ¿pasa para la compra de la cesión de la garantía?</p>
            {!dosFirmas && !decidido && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Faltan las dos firmas (Elabora + Valida) para poder decidir y para el PDF.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => guardar("Sí pasa")} disabled={guardando || !dosFirmas || decidido} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"><Check className="h-4 w-4" /> Sí pasa</button>
              <button onClick={() => guardar("No pasa")} disabled={guardando || !dosFirmas || decidido} className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"><X className="h-4 w-4" /> No pasa</button>
              <button onClick={() => guardar("Pasa a UCP (dictamen formal)")} disabled={guardando || !dosFirmas || decidido} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed">Pasa a UCP (dictamen formal)</button>
              {decidido && (
                <button onClick={() => setGuardado(null)} className="flex items-center gap-1.5 rounded-md border border-[color:var(--teal)] px-4 py-2 text-sm font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10"><RefreshCw className="h-4 w-4" /> Re-pre-dictaminar</button>
              )}
            </div>
            {decidido && (
              <p className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><Lock className="h-3.5 w-3.5" /> Pre-dictamen bloqueado. Solo queda enviar el correo y continuar con el registral. Para cambiarlo, toca “Re-pre-dictaminar”.</p>
            )}
            {decidido && !/no pasa/i.test(guardado || "") && (
              <Link to="/urrj" search={{ registral: true, exp: d.expediente || "", cliente: d.deudor || "", caso: d.caso_id || "" } as any} className="inline-flex w-fit items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "#0B1E3A" }}>
                <ArrowRight className="h-4 w-4" /> Continuar con el registral
              </Link>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => descargarPDF("(borrador)", "ver")} disabled={!dosFirmas} title={!dosFirmas ? "Disponible cuando estén las dos firmas" : ""} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: "#C2A24C" }}>
                <Eye className="h-4 w-4" style={{ color: "#C2A24C" }} /> Ver PDF
              </button>
              <button onClick={() => descargarPDF("(borrador)")} disabled={!dosFirmas} title={!dosFirmas ? "Disponible cuando estén las dos firmas" : ""} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: "#C2A24C" }}>
                <Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF del pre-dictamen
              </button>
            </div>
            {guardado && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{guardado}</div>}
            {yaExiste && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Ya existe un pre-dictamen para este expediente{yaExiste.folio ? ` (folio ${yaExiste.folio})` : ""}.</p>
                <p className="text-[13px]">No se crea otro para no duplicarlo. ¿Qué quieres hacer?</p>
                <div className="flex flex-wrap gap-2">
                  {(yaExiste.caso_id || d.caso_id) && (
                    <Link to="/expediente" search={{ id: (yaExiste.caso_id || d.caso_id) as string, origen: "urrj" } as any} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">Ver ficha (cronología / cambios)</Link>
                  )}
                  <Link to="/urrj" className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-white">Re-dictaminar (ir al Registro URRJ)</Link>
                  <button onClick={() => setYaExiste(null)} className="text-xs font-medium text-muted-foreground underline">Cancelar</button>
                </div>
              </div>
            )}
            <button onClick={() => abrirDestino("contabilidad")} className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--teal)" }}>
              <Mail className="h-4 w-4" /> Solicitar precio / enviar
            </button>
            {guardado && !/no pasa/i.test(guardado) && (
              <button onClick={() => setVerRegistral(true)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: "#B26B00" }}>
                <ArrowRight className="h-4 w-4" /> Continuar al registral
              </button>
            )}
            </>)}

            {/* ---- Sección de Administración (valuación y precio) ---- */}
            <div className="mt-2 rounded-xl border border-dashed border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                {puedeAdmin ? <Calculator className="h-4 w-4" style={{ color: "#C2A24C" }} /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                <p className="text-sm font-semibold">Administración · valuación y precio</p>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Solo GAD · Super_Admin · DGE</span>
              </div>
              {!puedeAdmin ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> Esta sección la llena Administración. No tienes permiso para editarla.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Campo label="Valor comercial del inmueble"><input type="number" className={inp} value={d.valorComercial} onChange={(e) => set("valorComercial", e.target.value)} /></Campo>
                    <Campo label="Costos (litigio/desalojo/regularización)"><input type="number" className={inp} value={d.costosOperativos} onChange={(e) => set("costosOperativos", e.target.value)} /></Campo>
                    <Campo label="Precio de la cesión"><input type="number" className={inp} value={d.precioCesion} onChange={(e) => set("precioCesion", e.target.value)} /></Campo>
                    <Campo label="Margen objetivo"><input type="number" className={inp} value={d.margenObjetivo} onChange={(e) => set("margenObjetivo", e.target.value)} /></Campo>
                  </div>
                  <Aviso r={rViab} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cronología del expediente (mismo componente que la ficha) */}
      {(d.caso_id || d.expediente) && (
        <div className="rounded-xl border border-border bg-card p-5">
          <CronologiaURRJ casoId={d.caso_id || undefined} expediente={d.expediente || undefined} />
        </div>
      )}

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <button onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Atrás</button>
        {paso < FASES.length - 1 && (
          <button onClick={() => setPaso((p) => Math.min(FASES.length - 1, p + 1))} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: NAVY }}>Siguiente fase <ArrowRight className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
}

function H({ titulo, sub }: { titulo: string; sub: string }) {
  return <div><p className="text-base font-semibold">{titulo}</p><p className="text-sm text-muted-foreground">{sub}</p></div>;
}
function SiNo({ v, on }: { v: string; on: (x: string) => void }) {
  return (
    <div className="flex gap-2">
      {[["si", "Sí"], ["no", "No"]].map(([val, lbl]) => (
        <button key={val} onClick={() => on(val)} className={`flex-1 rounded-md border px-3 py-2 text-sm ${v === val ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>{lbl}</button>
      ))}
    </div>
  );
}

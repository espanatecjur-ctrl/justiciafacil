import { useEffect, useMemo, useState } from "react";
import { guardarPredictamen, buscarPredictamenVigente, diffDatos, type Precarga, type PredictamenExistente } from "@/lib/predictamen-guardar";
import { Link } from "@tanstack/react-router";
import { enviarCorreo } from "@/lib/enviar-correo";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import {
  veredictoHito1, veredictoHito2, veredictoHito3, veredictoHito4, calcularVAAE,
} from "@/lib/urrj-demandado";
import type { ResultadoMotor, Semaforo } from "@/lib/urrj-motores";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { BannerCorreo } from "@/components/banner-correo";
import { BloquePrecioURRJ, PRECIO_VACIO, resumenPrecio, type PrecioURRJ } from "@/components/bloque-precio-urrj";
import { registrarEvento } from "@/lib/cronologia-urrj";
import { CronologiaURRJ } from "@/components/cronologia-urrj-vista";
import { Mail, Eye } from "lucide-react";
import { ArrowLeft, ArrowRight, ClipboardCheck, Check, X, Download, Scale, Lock, Calculator, Search, Bot } from "lucide-react";

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const n = (s: string) => { const v = parseFloat(s); return isNaN(v) ? 0 : v; };

const FASES = ["Datos básicos", "Extracción del expediente", "Legalidad procesal", "Carta saldo", "Bloqueo legal", "Dictamen y firmas"];

function SemDot({ s }: { s: Semaforo }) {
  const c = s === "verde" ? "#0C5C46" : s === "amarillo" ? "#C2A24C" : s === "naranja" ? "#D97706" : s === "rojo" ? "#DC2626" : "#9CA3AF";
  return <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c }} />;
}
function semBg(s: Semaforo) {
  return s === "verde" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : s === "amarillo" ? "bg-amber-50 text-amber-800 border-amber-200"
    : s === "naranja" ? "bg-orange-50 text-orange-800 border-orange-200"
    : s === "rojo" ? "bg-red-50 text-red-800 border-red-200" : "bg-muted text-muted-foreground border-border";
}
function Aviso({ r }: { r: ResultadoMotor }) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${semBg(r.semaforo)}`}>
      <div className="flex items-center gap-2 font-medium"><SemDot s={r.semaforo} /> {r.etiqueta}{r.dato ? <span className="font-normal opacity-80">· {r.dato}</span> : null}</div>
      <p className="mt-1 text-[13px] leading-snug opacity-90">{r.detalle}</p>
    </div>
  );
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
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

export function RecorridoDemandado({ casos, onVolver, precargar, puedeFirmarElabora = true, puedeValidar = true, puedeAdmin = false, puedePrecioPiso = false, hallazgosIniciales, expedienteInicial, deudorInicial, juzgadoInicial }: { casos: any[]; onVolver: () => void; precargar?: Precarga | null; puedeFirmarElabora?: boolean; puedeValidar?: boolean; puedeAdmin?: boolean; puedePrecioPiso?: boolean; hallazgosIniciales?: string[]; expedienteInicial?: string; deudorInicial?: string; juzgadoInicial?: string }) {
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [verBanner, setVerBanner] = useState(false);
  const [destino, setDestino] = useState<"contabilidad" | "comercial">("contabilidad");
  const [precio, setPrecio] = useState<PrecioURRJ>(PRECIO_VACIO);
  const [seed, setSeed] = useState(0);
  const abrirDestino = (dst: "contabilidad" | "comercial") => { setDestino(dst); setSeed((z) => z + 1); setVerBanner(true); };
  const [hallazgos, setHallazgos] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [yaExiste, setYaExiste] = useState<PredictamenExistente | null>(null);
  const [ignorarBoletin, setIgnorarBoletin] = useState(false);
  const [mostrarBoletin, setMostrarBoletin] = useState(false);
  const [fElabora, setFElabora] = useState<DatosFirma | null>(null);
  const [fValida, setFValida] = useState<DatosFirma | null>(null);
  // estadoRobot se calcula más abajo con x.estado
  const [x, setX] = useState<Record<string, string>>({
    caso_id: "", expediente: "", juzgado: "", estado: "Sinaloa", deudor: "", rfc: "", ubicacion: "",
    acreedor: "", tipoAcreedor: "", materia: "", tipoJuicio: "Hipotecario", copropietarios: "",
    descripcionCoincide: "", fuenteRevisada: "", fechaUltimoAuto: "", etapa: "",
    emplazamiento: "", sentenciaEjecutoriada: "", tercosFiscalLaboral: "", almonedaConvocada: "", sospechaUsura: "",
    remateEjecutado: "", adjudicacion: "", adjudicacionFirme: "", adjudicacionAFavor: "", amparoRemate: "", escrituradoPosesion: "",
    estadoCarta: "", fechaCaducidad: "", otrosAcreedores: "", quitaSinCondiciones: "",
    suertePrincipal: "", interesMoratorio: "", gastosCostas: "", montoQuita: "", valorComercial: "", mesesDesenredo: "", margenPct: "30",
    promesaSuspensiva: "", escrow: "", poderIrrevocable: "", vendedorAceptaPoder: "", dineroYaEntregado: "", ratificadoNotario: "",
    anotaciones: "",
  });
  const set = (k: string, v: string) => setX((p) => ({ ...p, [k]: v }));
  const estadoRobot: "sinaloa" | "bcs" | "jalisco" = x.estado === "Jalisco" ? "jalisco" : x.estado === "Baja California Sur" ? "bcs" : "sinaloa";
  useEffect(() => { if (precargar?.datos) setX((p) => ({ ...p, ...precargar.datos })); }, []);

  // Robot al inicio: sembrar expediente + hallazgos (una sola vez).
  useEffect(() => {
    if (hallazgosIniciales && hallazgosIniciales.length) setHallazgos(hallazgosIniciales);
    if ((hallazgosIniciales?.length || expedienteInicial)) {
      setX((p) => {
        const prev = p.anotaciones || "";
        const notas = (hallazgosIniciales || []).filter((h) => !prev.includes(h.split("\n")[0]));
        const sep = prev.trim() && notas.length ? "\n\n" : "";
        return { ...p, expediente: p.expediente || expedienteInicial || p.expediente, juzgado: p.juzgado || juzgadoInicial || p.juzgado, anotaciones: prev + (notas.length ? sep + notas.join("\n\n") : "") };
      });
    }
  }, []);

  const r1 = useMemo(() => veredictoHito1({ descripcionCoincide: x.descripcionCoincide, fuenteRevisada: x.fuenteRevisada }), [x.descripcionCoincide, x.fuenteRevisada]);
  const r2 = useMemo(() => veredictoHito2({
    emplazamiento: x.emplazamiento, sentenciaEjecutoriada: x.sentenciaEjecutoriada, copropietariosNoDemandados: x.copropietarios,
    descripcionCoincide: x.descripcionCoincide, tercosFiscalLaboral: x.tercosFiscalLaboral, almonedaConvocada: x.almonedaConvocada, sospechaUsura: x.sospechaUsura,
  }), [x.emplazamiento, x.sentenciaEjecutoriada, x.copropietarios, x.descripcionCoincide, x.tercosFiscalLaboral, x.almonedaConvocada, x.sospechaUsura]);
  const r3 = useMemo(() => veredictoHito3({ estadoCarta: x.estadoCarta, fechaCaducidad: x.fechaCaducidad, otrosAcreedores: x.otrosAcreedores, quitaSinCondiciones: x.quitaSinCondiciones }), [x.estadoCarta, x.fechaCaducidad, x.otrosAcreedores, x.quitaSinCondiciones]);
  const r4 = useMemo(() => veredictoHito4({ promesaSuspensiva: x.promesaSuspensiva, escrow: x.escrow, poderIrrevocable: x.poderIrrevocable, vendedorAceptaPoder: x.vendedorAceptaPoder, dineroYaEntregado: x.dineroYaEntregado, ratificadoNotario: x.ratificadoNotario }), [x.promesaSuspensiva, x.escrow, x.poderIrrevocable, x.vendedorAceptaPoder, x.dineroYaEntregado, x.ratificadoNotario]);
  const vaae = useMemo(() => calcularVAAE({
    suertePrincipal: n(x.suertePrincipal), interesMoratorio: n(x.interesMoratorio), gastosCostas: n(x.gastosCostas),
    quita: x.quitaSinCondiciones === "si" ? n(x.montoQuita) : 0,
    valorComercial: n(x.valorComercial), mesesDesenredo: n(x.mesesDesenredo), margenPct: n(x.margenPct),
  }), [x.suertePrincipal, x.interesMoratorio, x.gastosCostas, x.montoQuita, x.quitaSinCondiciones, x.valorComercial, x.mesesDesenredo, x.margenPct]);

  // Adjudicación / remate (Art. 1410-1414 CCom · vía de apremio CNPCF · Ley de Amparo).
  // La adjudicación firme NO es un abort automático: depende de a favor de quién quedó,
  // si hay amparo que la pueda revertir, y si ya se escrituró/entregó posesión.
  const avisoAdj = useMemo<ResultadoMotor | null>(() => {
    if (x.adjudicacion !== "si") return null;
    const firme = x.adjudicacionFirme === "si";
    const amparo = x.amparoRemate === "si";
    const escriturado = x.escrituradoPosesion === "si";
    if (x.adjudicacionAFavor === "propietario")
      return { semaforo: "amarillo", etiqueta: "El propietario conservó la garantía", detalle: "El propietario pagó/redimió o conservó la garantía: sigue con él y puede haber operación. Revisar el resto del recorrido." };
    if (x.adjudicacionAFavor === "actor" || x.adjudicacionAFavor === "tercero") {
      const quien = x.adjudicacionAFavor === "tercero" ? "un tercero postor" : "el actor/acreedor";
      if (firme && escriturado && !amparo)
        return { semaforo: "rojo", etiqueta: "Adjudicación consumada", detalle: `Adjudicación firme a favor de ${quien}, ya escriturada y con posesión, sin amparo: el demandado perdió la garantía y es casi irreversible. ABORTAR.` };
      if (amparo)
        return { semaforo: "naranja", etiqueta: "Adjudicación con amparo", detalle: `Adjudicación a favor de ${quien}, pero hay amparo pendiente o promovible: existe ventana para suspenderla o revertirla. Litigable con riesgo alto.` };
      return { semaforo: "naranja", etiqueta: "Adjudicación en curso", detalle: `Adjudicación a favor de ${quien} aún no consumada (no firme o sin escriturar/posesión): ventana corta y riesgo alto.` };
    }
    return { semaforo: "amarillo", etiqueta: "Adjudicación", detalle: "Hay adjudicación; captura a favor de quién quedó y si hay amparo para valorar el riesgo." };
  }, [x.adjudicacion, x.adjudicacionFirme, x.adjudicacionAFavor, x.amparoRemate, x.escrituradoPosesion]);

  const fmt = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  const dictamen = useMemo(() => {
    const sems: Semaforo[] = [r1.semaforo, r2.semaforo, r3.semaforo, r4.semaforo, vaae.viable ? "verde" : "rojo"];
    if (avisoAdj) sems.push(avisoAdj.semaforo);
    if (sems.includes("rojo")) return { txt: "NEGATIVO", color: "bg-red-50 text-red-800 border-red-200" };
    if (sems.includes("naranja") || sems.includes("amarillo")) return { txt: "CONDICIONADO", color: "bg-amber-50 text-amber-800 border-amber-200" };
    if (sems.includes("gris")) return { txt: "FALTAN DATOS", color: "bg-muted text-muted-foreground border-border" };
    return { txt: "POSITIVO", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  }, [r1, r2, r3, r4, vaae, avisoAdj]);

  const checarExiste = async (exp?: string | null, caso?: string | null) => {
    if (precargar) return;
    if (!exp && !caso) { setYaExiste(null); return; }
    const ex = await buscarPredictamenVigente(exp, caso);
    setYaExiste(ex);
  };

  const guardar = async (decision: string) => {
    if (!precargar) {
      const ex = await buscarPredictamenVigente(x.expediente, x.caso_id);
      if (ex) { setYaExiste(ex); return; }
    }
    const payload = {
      caso_id: x.caso_id || null, expediente: x.expediente || null, juzgado: x.juzgado || null, estado: x.estado,
      tipo_juicio: x.tipoJuicio, posicion: "Demandado", datos: x,
      resultados: { hito1: r1, hito2: r2, hito3: r3, hito4: r4, vaae, firmas: { elabora: fElabora, valida: fValida } },
      dictamen_sugerido: dictamen.txt, dictamen_final: decision,
      firma_elabora: fElabora?.nombre || null, firma_elabora_fecha: fElabora?.fecha || null,
      firma_valida: fValida?.nombre || null, firma_valida_fecha: fValida?.fecha || null,
    };
    try {
      await guardarPredictamen(payload, precargar);
      registrarEvento({ caso_id: x.caso_id || null, expediente: x.expediente || null, tipo: "dictamen_juridico", resultado: dictamen.txt, firma_elabora: fElabora?.nombre || null, firma_valida: fValida?.nombre || null, detalle: `Demandado · Decisión: ${decision}` });
      setGuardado("Pre-dictamen (Demandado) guardado: " + decision);
    } catch (e: any) { setGuardado("No se pudo guardar: " + e.message); }
  };

  const descargarPDF = async (decision: string, modo: "descargar" | "ver" = "descargar") => {
    const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
    const urlPdf = await descargarPredictamenPDF({
      expediente: x.expediente, juzgado: x.juzgado, estado: x.estado, tipoJuicio: x.tipoJuicio, posicion: "Demandado",
      ubicacion: x.ubicacion, deudor: x.deudor, quienCede: x.acreedor, queCede: "Derechos del demandado-vendedor",
      dictamen: dictamen.txt,
      riesgos: [
        { nombre: "Extracción del expediente", r: r1 },
        { nombre: "Legalidad procesal", r: r2 },
        ...(avisoAdj ? [{ nombre: "Remate / adjudicación", r: avisoAdj }] : []),
        { nombre: "Carta saldo", r: r3 },
        { nombre: "Bloqueo legal", r: r4 },
        { nombre: "V_AAE (máximo a pagar)", r: { semaforo: vaae.viable ? "verde" : "rojo", etiqueta: vaae.viable ? "Viable" : "No viable", dato: fmt(vaae.vaae), detalle: vaae.detalle } },
      ],
      intereses: { ordinarios: 0, moratorios: n(x.interesMoratorio), iva: 0, total: vaae.cLiq, usura: false },
      admin: null, anotaciones: x.anotaciones, firmaElabora: fElabora, firmaValida: fValida, decision,
      cambios: precargar ? { campos: diffDatos(precargar.datos || {}, x), nota: precargar.cambios } : null,
      boletines: hallazgos,
    }, modo);
    if (modo === "ver" && typeof urlPdf === "string") setPdfUrl(urlPdf);
  };

  return (
    <>
      {pdfUrl && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setPdfUrl(null)}>
          <div className="my-4 flex h-[88vh] w-[94vw] max-w-4xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>Pre-dictamen · Exp. {x.expediente || "—"}</p>
              <div className="flex items-center gap-3">
                <a href={pdfUrl} download={`predictamen-${(x.expediente || "caso").replace(/[^\w-]/g, "_")}.pdf`} className="text-xs font-medium text-[color:var(--teal)] hover:underline">Descargar</a>
                <button onClick={() => setPdfUrl(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <iframe src={pdfUrl} title="Pre-dictamen PDF" className="min-h-0 flex-1 rounded-b-xl" />
          </div>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={onVolver} className="flex items-center gap-1 hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Cambiar posición</button>
          <span>Demandado · Fase {paso + 1} de {FASES.length}: {FASES[paso]}</span>
        </div>
        <div className="flex gap-1">{FASES.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < paso ? "#0C5C46" : i === paso ? NAVY : "var(--border,#e5e7eb)" }} />)}</div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {paso === 0 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">0 · Datos básicos</p>
            {expedienteInicial && x.expediente && expedienteInicial !== x.expediente && !ignorarBoletin && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">El boletín que buscaste es de OTRO expediente.</p>
                <p className="text-[13px]">Boletín: <b>{expedienteInicial}</b>{deudorInicial ? ` · ${deudorInicial}` : ""} — Solicitud/registro: <b>{x.expediente}</b>{x.deudor ? ` · ${x.deudor}` : ""}. ¿Con cuál abro?</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setX((p) => ({ ...p, expediente: expedienteInicial, deudor: deudorInicial || p.deudor, juzgado: juzgadoInicial || p.juzgado })); setIgnorarBoletin(true); }} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">Usar el del boletín ({expedienteInicial})</button>
                  <button onClick={() => setIgnorarBoletin(true)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-white">Mantener el de la solicitud ({x.expediente})</button>
                </div>
              </div>
            )}
            <Campo label="Caso de la cartera (opcional)">
              <select className={inp} value={x.caso_id} onChange={(e) => { const c = casos.find((y) => String(y.id) === e.target.value); setX((p) => ({ ...p, caso_id: e.target.value, expediente: c?.expediente || p.expediente, juzgado: c?.juzgado || p.juzgado, deudor: c?.cliente_nombre || p.deudor, ubicacion: c?.direccion_garantia || p.ubicacion })); checarExiste(c?.expediente || x.expediente, e.target.value); }}>
                <option value="">— Escribir a mano —</option>
                {casos.map((c) => <option key={c.id} value={c.id}>{c.expediente} · {c.juzgado}</option>)}
              </select>
            </Campo>
            {yaExiste && (
              <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Ya existe un pre-dictamen para este expediente{yaExiste.folio ? ` (folio ${yaExiste.folio})` : ""}.</p>
                <p className="text-[13px]">No se creará otro para no duplicarlo. Puedes ver la ficha o re-dictaminar.</p>
                <div className="flex flex-wrap gap-2">
                  {(yaExiste.caso_id || x.caso_id) && (
                    <Link to="/expediente" search={{ id: (yaExiste.caso_id || x.caso_id) as string, origen: "urrj" } as any} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">Ver ficha (cronología / cambios)</Link>
                  )}
                  <Link to="/urrj" className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-white">Re-dictaminar (ir al Registro URRJ)</Link>
                  <button onClick={() => setYaExiste(null)} className="text-xs font-medium text-muted-foreground underline">Ignorar por ahora</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Demandado-vendedor (nombre)"><input className={inp} value={x.deudor} onChange={(e) => set("deudor", e.target.value)} /></Campo>
              <Campo label="RFC del demandado"><input className={inp} value={x.rfc} onChange={(e) => set("rfc", e.target.value)} /></Campo>
              <Campo label="Dirección de la garantía"><input className={inp} value={x.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} /></Campo>
              <Campo label="Acreedor original (demandante)"><input className={inp} value={x.acreedor} onChange={(e) => set("acreedor", e.target.value)} /></Campo>
              <Campo label="Tipo de acreedor"><input className={inp} value={x.tipoAcreedor} onChange={(e) => set("tipoAcreedor", e.target.value)} placeholder="banco / administradora / particular" /></Campo>
              <Campo label="Materia / tipo de juicio"><input className={inp} value={x.tipoJuicio} onChange={(e) => set("tipoJuicio", e.target.value)} /></Campo>
              <Campo label="¿Hay copropietarios NO demandados?"><SiNo v={x.copropietarios} on={(v) => set("copropietarios", v)} /></Campo>
            </div>
            {x.copropietarios === "si" && <Aviso r={{ semaforo: "naranja", etiqueta: "Copropietarios no demandados", detalle: "La sentencia no cubre a los copropietarios no demandados: no se consolida el 100% de la garantía y pueden ampararse. Se marcará como ABORTAR en la Legalidad procesal (Fase 3)." }} />}
            <p className="text-xs text-muted-foreground">Regla: si los datos básicos no cuadran, el algoritmo se detiene aquí (solo avisa).</p>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">1 · Extracción del expediente</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Expediente"><input className={inp} value={x.expediente} onChange={(e) => set("expediente", e.target.value)} /></Campo>
              <Campo label="Juzgado / jurisdicción"><input className={inp} value={x.juzgado} onChange={(e) => set("juzgado", e.target.value)} /></Campo>
              <Campo label="Etapa del juicio"><input className={inp} value={x.etapa} onChange={(e) => set("etapa", e.target.value)} /></Campo>
              <Campo label="Fecha del último auto"><input type="date" className={inp} value={x.fechaUltimoAuto} onChange={(e) => set("fechaUltimoAuto", e.target.value)} /></Campo>
              <Campo label="¿La descripción del inmueble coincide (demanda/escritura/CLG)?"><SiNo v={x.descripcionCoincide} on={(v) => set("descripcionCoincide", v)} /></Campo>
              <Campo label="¿Cómo se revisó el expediente?">
                <select className={inp} value={x.fuenteRevisada} onChange={(e) => set("fuenteRevisada", e.target.value)}>
                  <option value="">—</option>
                  <option value="real">Revisión real (juzgado/RPP)</option>
                  <option value="fotocopias">Solo fotocopias del demandado</option>
                </select>
              </Campo>
            </div>
            <Aviso r={r1} />
            <div className="rounded-lg border border-border p-3">
              <button type="button" onClick={() => setMostrarBoletin((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                <Bot className="h-3.5 w-3.5" /> {mostrarBoletin ? "Ocultar búsqueda del boletín" : "Buscar el expediente en el boletín (robot)"}
              </button>
              {mostrarBoletin && (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] leading-snug text-muted-foreground">El robot lee el boletín <b>estatal</b>. Lo que encuentre se guarda como hallazgo y entra al PDF.</p>
                  <BuscadorBoletin
                    expedienteInicial={x.expediente}
                    estadoInicial={estadoRobot}
                    resaltarAmparo
                    onHallazgoAmparo={(nota) => {
                      const marca = nota.split("\n")[0];
                      setHallazgos((prev) => prev.some((h) => h.includes(marca)) ? prev : [...prev, nota]);
                      setX((p) => {
                        if ((p.anotaciones || "").includes(marca)) return p;
                        const sep = (p.anotaciones || "").trim() ? "\n\n" : "";
                        return { ...p, anotaciones: (p.anotaciones || "") + sep + nota };
                      });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">2 · Filtro de legalidad procesal</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Tipo de emplazamiento">
                <select className={inp} value={x.emplazamiento} onChange={(e) => set("emplazamiento", e.target.value)}>
                  <option value="">—</option><option value="personal">Personal con firma</option><option value="edictos">Por edictos</option><option value="rebeldia">Rebeldía declarada</option>
                </select>
              </Campo>
              <Campo label="¿Sentencia ya ejecutoriada?"><SiNo v={x.sentenciaEjecutoriada} on={(v) => set("sentenciaEjecutoriada", v)} /></Campo>
              <Campo label="¿Embargo de tercería (SAT/IMSS/INFONAVIT/laboral)?"><SiNo v={x.tercosFiscalLaboral} on={(v) => set("tercosFiscalLaboral", v)} /></Campo>
              <Campo label="¿La almoneda/subasta ya está convocada?"><SiNo v={x.almonedaConvocada} on={(v) => set("almonedaConvocada", v)} /></Campo>
              <Campo label="¿El remate ya se ejecutó (se celebró la almoneda)?"><SiNo v={x.remateEjecutado} on={(v) => set("remateEjecutado", v)} /></Campo>
              <Campo label="¿Hay adjudicación a favor del acreedor?"><SiNo v={x.adjudicacion} on={(v) => set("adjudicacion", v)} /></Campo>
              {x.adjudicacion === "si" && <Campo label="¿La adjudicación quedó firme?"><SiNo v={x.adjudicacionFirme} on={(v) => set("adjudicacionFirme", v)} /></Campo>}
              {x.adjudicacion === "si" && <Campo label="¿A favor de quién quedó?">
                <select className={inp} value={x.adjudicacionAFavor} onChange={(e) => set("adjudicacionAFavor", e.target.value)}>
                  <option value="">—</option>
                  <option value="actor">Actor / acreedor</option>
                  <option value="propietario">El propietario lo conservó / redimió</option>
                  <option value="tercero">Tercero postor</option>
                </select>
              </Campo>}
              {x.adjudicacion === "si" && <Campo label="¿Hay amparo pendiente o promovible contra el remate/adjudicación?"><SiNo v={x.amparoRemate} on={(v) => set("amparoRemate", v)} /></Campo>}
              {x.adjudicacion === "si" && <Campo label="¿Ya se escrituró y entregó posesión (lanzamiento)?"><SiNo v={x.escrituradoPosesion} on={(v) => set("escrituradoPosesion", v)} /></Campo>}
              <Campo label="¿Sospecha de anatocismo/usura?"><SiNo v={x.sospechaUsura} on={(v) => set("sospechaUsura", v)} /></Campo>
            </div>
            <Aviso r={r2} />
            {avisoAdj && <Aviso r={avisoAdj} />}
            {x.remateEjecutado === "si" && x.adjudicacion !== "si" && <Aviso r={{ semaforo: "naranja", etiqueta: "Remate ejecutado", detalle: "El remate ya se celebró; la ventana para operar con el demandado es muy corta y el riesgo es alto." }} />}
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">3 · Carta saldo del acreedor</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Estado de la Carta Saldo">
                <select className={inp} value={x.estadoCarta} onChange={(e) => set("estadoCarta", e.target.value)}>
                  <option value="">—</option><option value="otorgada">Otorgada y firmada</option><option value="tramite">En trámite</option><option value="sin_solicitar">Sin solicitar</option><option value="negada">Negada</option>
                </select>
              </Campo>
              <Campo label="Fecha de caducidad de la carta"><input type="date" className={inp} value={x.fechaCaducidad} onChange={(e) => set("fechaCaducidad", e.target.value)} /></Campo>
              <Campo label="¿Hay otros acreedores formados?"><SiNo v={x.otrosAcreedores} on={(v) => set("otrosAcreedores", v)} /></Campo>
              <Campo label="¿Quita sin condiciones?"><SiNo v={x.quitaSinCondiciones} on={(v) => set("quitaSinCondiciones", v)} /></Campo>
            </div>
            <Aviso r={r3} />
            <p className="text-[11px] text-muted-foreground">El cálculo financiero V_AAE se hace al final, en la sección de Contabilidad.</p>
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">4 · Bloqueo legal (3 candados)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿El vendedor acepta firmar el Poder Irrevocable?"><SiNo v={x.vendedorAceptaPoder} on={(v) => set("vendedorAceptaPoder", v)} /></Campo>
              <Campo label="¿Promesa con cláusula suspensiva (Art. 1938)?"><SiNo v={x.promesaSuspensiva} on={(v) => set("promesaSuspensiva", v)} /></Campo>
              <Campo label="¿Escrow (cuenta de custodia)?"><SiNo v={x.escrow} on={(v) => set("escrow", v)} /></Campo>
              <Campo label="¿Poder General Irrevocable (Art. 2596)?"><SiNo v={x.poderIrrevocable} on={(v) => set("poderIrrevocable", v)} /></Campo>
              <Campo label="¿El dinero ya se entregó al vendedor?"><SiNo v={x.dineroYaEntregado} on={(v) => set("dineroYaEntregado", v)} /></Campo>
              <Campo label="¿El poder irrevocable y la promesa están ratificados ante notario?"><SiNo v={x.ratificadoNotario} on={(v) => set("ratificadoNotario", v)} /></Campo>
            </div>
            <Aviso r={r4} />
          </div>
        )}

        {paso === 5 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">5 · Dictamen y firmas</p>
            <div className="space-y-2"><Aviso r={r1} /><Aviso r={r2} />{avisoAdj && <Aviso r={avisoAdj} />}<Aviso r={r3} /><Aviso r={r4} /></div>
            <div className={`rounded-lg border p-4 ${dictamen.color}`}>
              <p className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" /> Pre-dictamen del sistema (sugerido): {dictamen.txt}</p>
              <p className="mt-1 text-xs opacity-80">El sistema solo sugiere. La decisión final es humana.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Anotaciones del abogado</label>
              <textarea value={x.anotaciones} onChange={(e) => set("anotaciones", e.target.value)} rows={3} className={inp} placeholder="Observaciones a mano…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FirmaParte titulo="Elabora · abogado URRJ" valor={fElabora} onFirmar={(f) => setFElabora(f.fecha ? f : null)} cargoSugerido="Abogado URRJ" bloqueado={!puedeFirmarElabora} />
              <FirmaParte titulo="Valida · Director Legal" valor={fValida} onFirmar={(f) => setFValida(f.fecha ? f : null)} cargoSugerido="Director Legal (DIL)" bloqueado={!puedeValidar} />
            </div>
            <p className="text-sm font-medium">Decisión humana · ¿pasa para la compra de derechos?</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => guardar("Sí pasa")} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><Check className="h-4 w-4" /> Sí pasa</button>
              <button onClick={() => guardar("No pasa")} className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"><X className="h-4 w-4" /> No pasa</button>
              <button onClick={() => guardar("Pasa a UCP (dictamen formal)")} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted">Pasa a UCP</button>
            </div>
            <div className="flex flex-wrap gap-2"><button onClick={() => descargarPDF("(borrador)", "ver")} className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}><Eye className="h-4 w-4" style={{ color: "#C2A24C" }} /> Ver PDF</button><button onClick={() => descargarPDF("(borrador)")} className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}><Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF</button></div>
            {guardado && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{guardado}</div>}
            {yaExiste && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Ya existe un pre-dictamen para este expediente{yaExiste.folio ? ` (folio ${yaExiste.folio})` : ""}.</p>
                <p className="text-[13px]">No se crea otro para no duplicarlo. ¿Qué quieres hacer?</p>
                <div className="flex flex-wrap gap-2">
                  {(yaExiste.caso_id || x.caso_id) && (
                    <Link to="/expediente" search={{ id: (yaExiste.caso_id || x.caso_id) as string, origen: "urrj" } as any} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">Ver ficha (cronología / cambios)</Link>
                  )}
                  <Link to="/urrj" className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-white">Re-dictaminar (ir al Registro URRJ)</Link>
                  <button onClick={() => setYaExiste(null)} className="text-xs font-medium text-muted-foreground underline">Cancelar</button>
                </div>
              </div>
            )}
            {guardado && !/no pasa/i.test(guardado) && (
              <button onClick={() => abrirDestino("contabilidad")} className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--teal)" }}>
                <Mail className="h-4 w-4" /> Solicitar precio / enviar
              </button>
            )}

            {verBanner && (
              <BannerCorreo
                key={`${destino}-${seed}`}
                titulo="Enviar dictamen URRJ (Demandado)"
                asuntoInicial={destino === "contabilidad" ? `Solicitud de precio — Dictamen URRJ (Demandado) ${dictamen.txt} · Exp. ${x.expediente || "—"}` : `Garantía lista para Comercial (Demandado) — ${dictamen.txt} · Exp. ${x.expediente || "—"}`}
                mensajeInicial={[
                  destino === "contabilidad" ? "Se solicita el precio para esta garantía (Demandado) ya dictaminada por URRJ." : "Garantía (Demandado) dictaminada y con precio; queda lista para Comercial.",
                  "",
                  `Resultado jurídico: ${dictamen.txt}`,
                  `Expediente: ${x.expediente || "—"}`,
                  `Garantía: ${x.ubicacion || "—"}`,
                  `Demandado-vendedor: ${x.deudor || "—"}`,
                  "",
                  resumenPrecio(precio),
                ].join("\n")}
                folio={x.expediente}
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
                onEnviado={() => registrarEvento({ caso_id: x.caso_id || null, expediente: x.expediente || null, tipo: "correo_juridico", resultado: dictamen.txt, firma_elabora: fElabora?.nombre || null, firma_valida: fValida?.nombre || null, vista_previa: `A ${destino} · Demandado · Exp. ${x.expediente || "—"}`, detalle: `Enviado a ${destino}` })}
              />
            )}

            {/* ---- Motor financiero V_AAE (solo Contabilidad) ---- */}
            <div className="mt-2 rounded-xl border border-dashed border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                {puedeAdmin ? <Calculator className="h-4 w-4" style={{ color: "#C2A24C" }} /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                <p className="text-sm font-semibold">V_AAE · lo máximo a pagarle al demandado</p>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Solo Contabilidad (GAD)</span>
              </div>
              {!puedeAdmin ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> Este cálculo lo hace Contabilidad. No tienes permiso para editarlo.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Campo label="Suerte principal (capital)"><input type="number" className={inp} value={x.suertePrincipal} onChange={(e) => set("suertePrincipal", e.target.value)} /></Campo>
                    <Campo label="Interés moratorio"><input type="number" className={inp} value={x.interesMoratorio} onChange={(e) => set("interesMoratorio", e.target.value)} /></Campo>
                    <Campo label="Gastos y costas (si 0, asume 10%)"><input type="number" className={inp} value={x.gastosCostas} onChange={(e) => set("gastosCostas", e.target.value)} /></Campo>
                    {x.quitaSinCondiciones === "si" && <Campo label="Monto de la quita (descuento del acreedor)"><input type="number" className={inp} value={x.montoQuita} onChange={(e) => set("montoQuita", e.target.value)} /></Campo>}
                    <Campo label="Valor comercial del inmueble"><input type="number" className={inp} value={x.valorComercial} onChange={(e) => set("valorComercial", e.target.value)} /></Campo>
                    <Campo label="Meses de desenredo"><input type="number" className={inp} value={x.mesesDesenredo} onChange={(e) => set("mesesDesenredo", e.target.value)} /></Campo>
                    <Campo label="Margen reservado (%)"><input type="number" className={inp} value={x.margenPct} onChange={(e) => set("margenPct", e.target.value)} /></Campo>
                  </div>
                  <div className={`rounded-lg border p-3 text-sm ${vaae.viable ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
                    <p className="font-semibold">V_AAE = {fmt(vaae.vaae)}</p>
                    <p className="mt-1 text-[13px]">{vaae.detalle}</p>
                    <p className="mt-1 text-[11px] opacity-80">C_LIQ {fmt(vaae.cLiq)}{x.quitaSinCondiciones === "si" && n(x.montoQuita) > 0 ? ` (ya con la quita de ${fmt(n(x.montoQuita))})` : ""} · C_LIT {fmt(vaae.cLit)} · Margen {fmt(vaae.mR)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {(x.caso_id || x.expediente) && (
        <div className="rounded-xl border border-border bg-card p-5">
          <CronologiaURRJ casoId={x.caso_id || undefined} expediente={x.expediente || undefined} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Atrás</button>
        {paso < FASES.length - 1 && <button onClick={() => setPaso((p) => Math.min(FASES.length - 1, p + 1))} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: NAVY }}>Siguiente fase <ArrowRight className="h-4 w-4" /></button>}
      </div>
    </>
  );
}

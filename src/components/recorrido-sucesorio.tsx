import { useEffect, useMemo, useState } from "react";
import { guardarPredictamen, buscarPredictamenVigente, diffDatos, type Precarga, type PredictamenExistente } from "@/lib/predictamen-guardar";
import { Link } from "@tanstack/react-router";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import {
  veredictoSuc1, veredictoSuc2, veredictoSuc3, veredictoSuc4, calcularVAAESuc, veredictoConsolidado,
} from "@/lib/urrj-sucesorio";
import type { ResultadoMotor, Semaforo } from "@/lib/urrj-motores";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { BannerCorreo } from "@/components/banner-correo";
import { BloquePrecioURRJ, PRECIO_VACIO, resumenPrecio, type PrecioURRJ } from "@/components/bloque-precio-urrj";
import { registrarEvento } from "@/lib/cronologia-urrj";
import { CronologiaURRJ } from "@/components/cronologia-urrj-vista";
import { Mail, Eye } from "lucide-react";
import { ArrowLeft, ArrowRight, ClipboardCheck, Check, X, Download, Search, Bot } from "lucide-react";

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const n = (s: string) => { const v = parseFloat(s); return isNaN(v) ? 0 : v; };
const FASES = ["Identificación + caso", "Acreditación", "¿Litigable?", "¿Recuperable? + V_AAE", "Bloqueo legal", "Dictamen y firmas"];

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

export function RecorridoSucesorio({ casos, onVolver, precargar, puedeFirmarElabora = true, puedeValidar = true, puedePrecioPiso = false, hallazgosIniciales, expedienteInicial }: { casos: any[]; onVolver: () => void; precargar?: Precarga | null; puedeFirmarElabora?: boolean; puedeValidar?: boolean; puedePrecioPiso?: boolean; hallazgosIniciales?: string[]; expedienteInicial?: string }) {
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [hallazgos, setHallazgos] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [yaExiste, setYaExiste] = useState<PredictamenExistente | null>(null);
  const [mostrarBoletin, setMostrarBoletin] = useState(false);
  const [verBanner, setVerBanner] = useState(false);
  const [destino, setDestino] = useState<"contabilidad" | "comercial">("contabilidad");
  const [precio, setPrecio] = useState<PrecioURRJ>(PRECIO_VACIO);
  const [seed, setSeed] = useState(0);
  const abrirDestino = (dst: "contabilidad" | "comercial") => { setDestino(dst); setSeed((z) => z + 1); setVerBanner(true); };
  const [fElabora, setFElabora] = useState<DatosFirma | null>(null);
  const [fValida, setFValida] = useState<DatosFirma | null>(null);
  const [x, setX] = useState<Record<string, string>>({
    caso_id: "", expediente: "", juzgado: "", estado: "Sinaloa",
    deCujus: "", fechaDefuncion: "", hayActaDefuncion: "", ubicacion: "", casaANombreDeCujus: "",
    hayTestamento: "", via: "", heredero: "", caso: "B", fuenteRevisada: "",
    herederosNoLocalizados: "", testamentoImpugnado: "", controversiaHerederos: "", adjudicacionProtocolizada: "",
    herederoMenorOAusente: "", conyugeSinAclarar: "", edictosCorriendo: "", herederoVendeATercero: "",
    acreedoresSuperanValor: "", herederosCeden: "", hipotecaNoNegociable: "", impuestosCuantificados: "", cargasManejables: "",
    valorComercial: "", deudasDeCujus: "", hipotecaGravamenes: "", predialAgua: "", impuestos: "", mesesDesenredo: "", margenPct: "30",
    vendedorAceptaPoder: "", cesionSuspensiva: "", escrow: "", poderIrrevocable: "", dineroYaEntregado: "",
    cedenteAceptoHerencia: "", derechoTantoNotificado: "", cesionEscrituraPublica: "", anotaciones: "",
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
        return { ...p, expediente: p.expediente || expedienteInicial || p.expediente, anotaciones: prev + (notas.length ? sep + notas.join("\n\n") : "") };
      });
    }
  }, []);

  const r1 = useMemo(() => veredictoSuc1({ hayActaDefuncion: x.hayActaDefuncion, casaANombreDeCujus: x.casaANombreDeCujus, fuenteRevisada: x.fuenteRevisada }), [x.hayActaDefuncion, x.casaANombreDeCujus, x.fuenteRevisada]);
  const r2 = useMemo(() => veredictoSuc2({
    herederosNoLocalizados: x.herederosNoLocalizados, testamentoImpugnado: x.testamentoImpugnado, controversiaHerederos: x.controversiaHerederos,
    adjudicacionProtocolizada: x.adjudicacionProtocolizada, herederoMenorOAusente: x.herederoMenorOAusente, conyugeSinAclarar: x.conyugeSinAclarar,
    edictosCorriendo: x.edictosCorriendo, herederoVendeATercero: x.herederoVendeATercero,
  }), [x.herederosNoLocalizados, x.testamentoImpugnado, x.controversiaHerederos, x.adjudicacionProtocolizada, x.herederoMenorOAusente, x.conyugeSinAclarar, x.edictosCorriendo, x.herederoVendeATercero]);
  const vaae = useMemo(() => calcularVAAESuc({
    valorComercial: n(x.valorComercial), deudasDeCujus: n(x.deudasDeCujus), hipotecaGravamenes: n(x.hipotecaGravamenes),
    predialAgua: n(x.predialAgua), impuestos: n(x.impuestos), mesesDesenredo: n(x.mesesDesenredo), margenPct: n(x.margenPct),
  }), [x.valorComercial, x.deudasDeCujus, x.hipotecaGravamenes, x.predialAgua, x.impuestos, x.mesesDesenredo, x.margenPct]);
  const r3 = useMemo(() => veredictoSuc3({
    acreedoresSuperanValor: x.acreedoresSuperanValor, herederosCeden: x.herederosCeden, hipotecaNoNegociable: x.hipotecaNoNegociable,
    impuestosCuantificados: x.impuestosCuantificados, cargasManejables: x.cargasManejables,
  }, vaae.viable), [x.acreedoresSuperanValor, x.herederosCeden, x.hipotecaNoNegociable, x.impuestosCuantificados, x.cargasManejables, vaae.viable]);
  const r4 = useMemo(() => veredictoSuc4({
    caso: x.caso, vendedorAceptaPoder: x.vendedorAceptaPoder, cesionSuspensiva: x.cesionSuspensiva, escrow: x.escrow,
    poderIrrevocable: x.poderIrrevocable, dineroYaEntregado: x.dineroYaEntregado,
    cedenteAceptoHerencia: x.cedenteAceptoHerencia, derechoTantoNotificado: x.derechoTantoNotificado, cesionEscrituraPublica: x.cesionEscrituraPublica,
  }), [x.caso, x.vendedorAceptaPoder, x.cesionSuspensiva, x.escrow, x.poderIrrevocable, x.dineroYaEntregado, x.cedenteAceptoHerencia, x.derechoTantoNotificado, x.cesionEscrituraPublica]);

  const consolidado = useMemo(() => veredictoConsolidado(r2.semaforo, r3.semaforo, vaae.viable), [r2.semaforo, r3.semaforo, vaae.viable]);
  const fmt = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const esB = x.caso === "B" || x.caso === "C";

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
      tipo_juicio: "Sucesorio (Caso " + x.caso + ")", posicion: "Sucesorio", datos: x,
      resultados: { hito1: r1, litigable: r2, recuperable: r3, bloqueo: r4, vaae, consolidado, firmas: { elabora: fElabora, valida: fValida } },
      dictamen_sugerido: consolidado.txt, dictamen_final: decision,
      firma_elabora: fElabora?.nombre || null, firma_elabora_fecha: fElabora?.fecha || null,
      firma_valida: fValida?.nombre || null, firma_valida_fecha: fValida?.fecha || null,
    };
    try {
      await guardarPredictamen(payload, precargar);
      registrarEvento({ caso_id: x.caso_id || null, expediente: x.expediente || null, tipo: "dictamen_juridico", resultado: consolidado.txt, firma_elabora: fElabora?.nombre || null, firma_valida: fValida?.nombre || null, detalle: `Sucesorio · Decisión: ${decision}` });
      setGuardado("Pre-dictamen (Sucesorio) guardado: " + decision);
    } catch (e: any) { setGuardado("No se pudo guardar: " + e.message); }
  };

  const descargarPDF = async (decision: string, modo: "descargar" | "ver" = "descargar") => {
    const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
    const urlPdf = await descargarPredictamenPDF({
      expediente: x.expediente, juzgado: x.juzgado, estado: x.estado, tipoJuicio: "Sucesorio · Caso " + x.caso, posicion: "Sucesorio",
      ubicacion: x.ubicacion, deudor: x.deCujus, quienCede: x.heredero, queCede: "Derechos hereditarios",
      dictamen: consolidado.txt,
      riesgos: [
        { nombre: "Acreditación", r: r1 },
        { nombre: "¿Litigable?", r: r2 },
        { nombre: "¿Recuperable?", r: r3 },
        { nombre: "Bloqueo legal", r: r4 },
        { nombre: "V_AAE (máximo a pagar)", r: { semaforo: vaae.viable ? "verde" : "rojo", etiqueta: vaae.viable ? "Viable" : "No recuperable", dato: fmt(vaae.vaae), detalle: vaae.detalle } },
      ],
      intereses: { ordinarios: 0, moratorios: 0, iva: 0, total: vaae.cSan, usura: false },
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
          <span>Sucesorio · Caso {x.caso} · Fase {paso + 1} de {FASES.length}: {FASES[paso]}</span>
        </div>
        <div className="flex gap-1">{FASES.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < paso ? "#0C5C46" : i === paso ? NAVY : "var(--border,#e5e7eb)" }} />)}</div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {paso === 0 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">0 · Identificación y clasificación del caso</p>
            <Campo label="Caso de la cartera (opcional)">
              <select className={inp} value={x.caso_id} onChange={(e) => { const c = casos.find((y) => String(y.id) === e.target.value); setX((p) => ({ ...p, caso_id: e.target.value, expediente: c?.expediente || p.expediente, juzgado: c?.juzgado || p.juzgado, ubicacion: c?.direccion_garantia || p.ubicacion })); checarExiste(c?.expediente || x.expediente, e.target.value); }}>
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
            <Campo label="Tipo de caso sucesorio">
              <select className={inp} value={x.caso} onChange={(e) => set("caso", e.target.value)}>
                <option value="A">Caso A · murió el DEUDOR (tú tienes la hipoteca)</option>
                <option value="B">Caso B · cesión de derechos hereditarios</option>
                <option value="C">Caso C · mixto</option>
              </select>
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="De cujus (fallecido)"><input className={inp} value={x.deCujus} onChange={(e) => set("deCujus", e.target.value)} /></Campo>
              <Campo label="Fecha de defunción"><input type="date" className={inp} value={x.fechaDefuncion} onChange={(e) => set("fechaDefuncion", e.target.value)} /></Campo>
              <Campo label="¿Hay acta de defunción?"><SiNo v={x.hayActaDefuncion} on={(v) => set("hayActaDefuncion", v)} /></Campo>
              <Campo label="Dirección de la casa/garantía"><input className={inp} value={x.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} /></Campo>
              <Campo label="¿La escritura está a nombre del de cujus?"><SiNo v={x.casaANombreDeCujus} on={(v) => set("casaANombreDeCujus", v)} /></Campo>
              <Campo label="¿Hay testamento?"><select className={inp} value={x.hayTestamento} onChange={(e) => set("hayTestamento", e.target.value)}><option value="">—</option><option value="si">Sí (Testamentaria)</option><option value="no">No (Intestamentaria)</option></select></Campo>
              <Campo label="Vía"><select className={inp} value={x.via} onChange={(e) => set("via", e.target.value)}><option value="">—</option><option>Judicial</option><option>Notarial</option></select></Campo>
              <Campo label="Heredero con quien DIIPA trata"><input className={inp} value={x.heredero} onChange={(e) => set("heredero", e.target.value)} /></Campo>
            </div>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">1 · Acreditación documental</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Expediente del sucesorio"><input className={inp} value={x.expediente} onChange={(e) => set("expediente", e.target.value)} /></Campo>
              <Campo label="Juzgado"><input className={inp} value={x.juzgado} onChange={(e) => set("juzgado", e.target.value)} /></Campo>
              <Campo label="Estado del juicio"><input className={inp} value={x.estado} onChange={(e) => set("estado", e.target.value)} /></Campo>
              <Campo label="¿Cómo se revisó la documentación?">
                <select className={inp} value={x.fuenteRevisada} onChange={(e) => set("fuenteRevisada", e.target.value)}>
                  <option value="">—</option><option value="real">Fuente real (RPP/juzgado/notarías)</option><option value="fotocopias">Solo fotocopias del heredero</option>
                </select>
              </Campo>
            </div>
            <p className="text-xs text-muted-foreground">Checklist: acta de defunción · escritura a nombre del de cujus + CLG · testamento o constancia de intestado · parentescos · predial/agua · inventario/avalúos.</p>
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
            <p className="text-base font-semibold">2 · Legalidad sucesoria · ¿es LITIGABLE?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Herederos desconocidos/no llamados a juicio?"><SiNo v={x.herederosNoLocalizados} on={(v) => set("herederosNoLocalizados", v)} /></Campo>
              <Campo label="¿Testamento impugnado / nulidad en curso?"><SiNo v={x.testamentoImpugnado} on={(v) => set("testamentoImpugnado", v)} /></Campo>
              <Campo label="¿Controversia abierta entre herederos?"><SiNo v={x.controversiaHerederos} on={(v) => set("controversiaHerederos", v)} /></Campo>
              <Campo label="¿Adjudicación ya dictada/protocolizada?"><SiNo v={x.adjudicacionProtocolizada} on={(v) => set("adjudicacionProtocolizada", v)} /></Campo>
              <Campo label="¿Heredero menor o ausente? (obliga judicial)"><SiNo v={x.herederoMenorOAusente} on={(v) => set("herederoMenorOAusente", v)} /></Campo>
              <Campo label="¿Cónyuge con sociedad conyugal sin aclarar?"><SiNo v={x.conyugeSinAclarar} on={(v) => set("conyugeSinAclarar", v)} /></Campo>
              <Campo label="¿Edictos con plazo corriendo?"><SiNo v={x.edictosCorriendo} on={(v) => set("edictosCorriendo", v)} /></Campo>
              <Campo label="¿Un heredero negocia vender a un tercero?"><SiNo v={x.herederoVendeATercero} on={(v) => set("herederoVendeATercero", v)} /></Campo>
            </div>
            <Aviso r={r2} />
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">3 · Saneamiento · ¿es RECUPERABLE? + V_AAE</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Deudas/embargos del de cujus superan el valor?"><SiNo v={x.acreedoresSuperanValor} on={(v) => set("acreedoresSuperanValor", v)} /></Campo>
              <Campo label="¿Los herederos aceptan ceder?"><SiNo v={x.herederosCeden} on={(v) => set("herederosCeden", v)} /></Campo>
              <Campo label="¿Hipoteca vigente no negociable > valor?"><SiNo v={x.hipotecaNoNegociable} on={(v) => set("hipotecaNoNegociable", v)} /></Campo>
              <Campo label="¿Impuestos sucesorios/ISR ya cuantificados?"><SiNo v={x.impuestosCuantificados} on={(v) => set("impuestosCuantificados", v)} /></Campo>
              <Campo label="¿Cargas manejables?"><SiNo v={x.cargasManejables} on={(v) => set("cargasManejables", v)} /></Campo>
            </div>
            <p className="pt-1 text-xs font-medium text-muted-foreground">V_AAE sucesorio (lo máximo a pagar al heredero)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Valor comercial"><input type="number" className={inp} value={x.valorComercial} onChange={(e) => set("valorComercial", e.target.value)} /></Campo>
              <Campo label="Deudas del de cujus"><input type="number" className={inp} value={x.deudasDeCujus} onChange={(e) => set("deudasDeCujus", e.target.value)} /></Campo>
              <Campo label="Hipoteca / gravámenes"><input type="number" className={inp} value={x.hipotecaGravamenes} onChange={(e) => set("hipotecaGravamenes", e.target.value)} /></Campo>
              <Campo label="Predial / agua"><input type="number" className={inp} value={x.predialAgua} onChange={(e) => set("predialAgua", e.target.value)} /></Campo>
              <Campo label="Impuestos (sucesorios/ISR/traslado)"><input type="number" className={inp} value={x.impuestos} onChange={(e) => set("impuestos", e.target.value)} /></Campo>
              <Campo label="Meses de desenredo"><input type="number" className={inp} value={x.mesesDesenredo} onChange={(e) => set("mesesDesenredo", e.target.value)} /></Campo>
              <Campo label="Margen reservado (%)"><input type="number" className={inp} value={x.margenPct} onChange={(e) => set("margenPct", e.target.value)} /></Campo>
            </div>
            <div className={`rounded-lg border p-3 text-sm ${vaae.viable ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
              <p className="font-semibold">V_AAE = {fmt(vaae.vaae)}</p>
              <p className="mt-1 text-[13px]">{vaae.detalle}</p>
              <p className="mt-1 text-[11px] opacity-80">C_SAN {fmt(vaae.cSan)} · C_LIT {fmt(vaae.cLit)} · Margen {fmt(vaae.mR)}</p>
            </div>
            <Aviso r={r3} />
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">4 · Bloqueo legal (3 candados){esB ? " + candados Caso B" : ""}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿El heredero acepta firmar Poder Irrevocable?"><SiNo v={x.vendedorAceptaPoder} on={(v) => set("vendedorAceptaPoder", v)} /></Campo>
              <Campo label="¿Cesión con cláusula suspensiva (Art. 1938)?"><SiNo v={x.cesionSuspensiva} on={(v) => set("cesionSuspensiva", v)} /></Campo>
              <Campo label="¿Escrow (cuenta de custodia)?"><SiNo v={x.escrow} on={(v) => set("escrow", v)} /></Campo>
              <Campo label="¿Poder General Irrevocable (Art. 2596)?"><SiNo v={x.poderIrrevocable} on={(v) => set("poderIrrevocable", v)} /></Campo>
              <Campo label="¿El dinero ya se entregó?"><SiNo v={x.dineroYaEntregado} on={(v) => set("dineroYaEntregado", v)} /></Campo>
            </div>
            {esB && (
              <>
                <p className="pt-1 text-xs font-medium text-muted-foreground">Candados especiales del Caso B (cesión de derechos hereditarios)</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="¿El cedente ACEPTÓ la herencia?"><SiNo v={x.cedenteAceptoHerencia} on={(v) => set("cedenteAceptoHerencia", v)} /></Campo>
                  <Campo label="¿Se notificó el derecho del tanto a coherederos (8 días)?"><SiNo v={x.derechoTantoNotificado} on={(v) => set("derechoTantoNotificado", v)} /></Campo>
                  <Campo label="¿La cesión es en escritura pública?"><SiNo v={x.cesionEscrituraPublica} on={(v) => set("cesionEscrituraPublica", v)} /></Campo>
                </div>
              </>
            )}
            <Aviso r={r4} />
          </div>
        )}

        {paso === 5 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">5 · Dictamen y firmas</p>
            <div className="space-y-2"><Aviso r={r1} /><Aviso r={r2} /><Aviso r={r3} /><Aviso r={r4} /></div>
            <div className={`rounded-lg border p-4 ${consolidado.color}`}>
              <p className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" /> Veredicto consolidado: {consolidado.txt}</p>
              <p className="mt-1 text-xs opacity-90">{consolidado.detalle}</p>
              <p className="mt-1 text-xs opacity-70">El sistema solo sugiere. La decisión final es humana.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Anotaciones del abogado</label>
              <textarea value={x.anotaciones} onChange={(e) => set("anotaciones", e.target.value)} rows={3} className={inp} placeholder="Observaciones a mano…" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FirmaParte titulo="Elabora · abogado URRJ" valor={fElabora} onFirmar={(f) => setFElabora(f.fecha ? f : null)} cargoSugerido="Abogado URRJ" bloqueado={!puedeFirmarElabora} />
              <FirmaParte titulo="Valida · Director Legal" valor={fValida} onFirmar={(f) => setFValida(f.fecha ? f : null)} cargoSugerido="Director Legal (DIL)" bloqueado={!puedeValidar} />
            </div>
            <p className="text-sm font-medium">Decisión humana · ¿pasa para la compra de derechos hereditarios?</p>
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
                titulo="Enviar dictamen URRJ (Sucesorio)"
                asuntoInicial={destino === "contabilidad" ? `Solicitud de precio — Dictamen URRJ (Sucesorio) ${consolidado.txt} · Exp. ${x.expediente || "—"}` : `Garantía lista para Comercial (Sucesorio) — ${consolidado.txt} · Exp. ${x.expediente || "—"}`}
                mensajeInicial={[
                  destino === "contabilidad" ? "Se solicita el precio para esta garantía (Sucesorio) ya dictaminada por URRJ." : "Garantía (Sucesorio) dictaminada y con precio; queda lista para Comercial.",
                  "",
                  `Resultado jurídico: ${consolidado.txt}`,
                  `Expediente: ${x.expediente || "—"}`,
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
                onEnviado={() => registrarEvento({ caso_id: x.caso_id || null, expediente: x.expediente || null, tipo: "correo_juridico", resultado: consolidado.txt, firma_elabora: fElabora?.nombre || null, firma_valida: fValida?.nombre || null, vista_previa: `A ${destino} · Sucesorio · Exp. ${x.expediente || "—"}`, detalle: `Enviado a ${destino}` })}
              />
            )}
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

import { useEffect, useMemo, useState } from "react";
import { guardarPredictamen, type Precarga } from "@/lib/predictamen-guardar";
import type { DatosPDF } from "@/lib/predictamen-pdf";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import {
  TIPOS_TRAMITE, veredictoTra1, veredictoTra2, veredictoTra3, veredictoTra4, analisisContencioso, calcularVAAETra, consolidadoTra,
} from "@/lib/urrj-tramites";
import type { ResultadoMotor, Semaforo } from "@/lib/urrj-motores";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { ArrowLeft, ArrowRight, ClipboardCheck, Check, X, Download, Lock, RefreshCw } from "lucide-react";

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const n = (s: string) => { const v = parseFloat(s); return isNaN(v) ? 0 : v; };
const FASES = ["Identificación", "Acreditación", "Procedencia + plazo", "Impacto + V_AAE", "Bloqueo + suspensión", "Dictamen y firmas"];

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

export function RecorridoTramites({ casos, onVolver, precargar, puedeFirmarElabora = true, puedeValidar = true }: { casos: any[]; onVolver: () => void; precargar?: Precarga | null; puedeFirmarElabora?: boolean; puedeValidar?: boolean }) {
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [fElabora, setFElabora] = useState<DatosFirma | null>(null);
  const [fValida, setFValida] = useState<DatosFirma | null>(null);
  const [x, setX] = useState<Record<string, string>>({
    caso_id: "", expediente: "", estado: "Sinaloa", tipoTramite: "amparo_indirecto", autoridad: "", ubicacion: "", afectaComo: "", contraparte: "",
    hayActoReclamado: "", fechaNotificacion: "", fuenteRevisada: "", plazoManual: "",
    faltaInteres: "", cosaJuzgada: "", suspensionOtorgada: "", actoIlegalClaro: "", requiereExterno: "",
    hayActosAdmin: "", esCreditoFiscal: "", esExpropiacionUso: "", juicioEnCurso: "",
    afectacionSuperaValor: "", condenaFirmeArriba: "", contraparteCede: "", defendible: "",
    valorComercial: "", condenaLaudoFiscal: "", honorariosDefensa: "", accesorios: "", mesesDesenredo: "", margenPct: "30",
    remateInminente: "", contraparteAceptaPoder: "", cesionSuspensiva: "", escrow: "", poderIrrevocable: "", dineroYaEntregado: "", anotaciones: "",
  });
  const set = (k: string, v: string) => setX((p) => ({ ...p, [k]: v }));
  useEffect(() => { if (precargar?.datos) setX((p) => ({ ...p, ...precargar.datos })); }, []);

  const r1 = useMemo(() => veredictoTra1({ hayActoReclamado: x.hayActoReclamado, fechaNotificacion: x.fechaNotificacion, fuenteRevisada: x.fuenteRevisada }), [x.hayActoReclamado, x.fechaNotificacion, x.fuenteRevisada]);
  const r2 = useMemo(() => veredictoTra2({
    tipoTramite: x.tipoTramite, fechaNotificacion: x.fechaNotificacion, plazoManual: x.plazoManual ? n(x.plazoManual) : undefined,
    faltaInteres: x.faltaInteres, cosaJuzgada: x.cosaJuzgada, suspensionOtorgada: x.suspensionOtorgada, actoIlegalClaro: x.actoIlegalClaro, requiereExterno: x.requiereExterno,
  }), [x.tipoTramite, x.fechaNotificacion, x.plazoManual, x.faltaInteres, x.cosaJuzgada, x.suspensionOtorgada, x.actoIlegalClaro, x.requiereExterno]);
  const cont = useMemo(() => analisisContencioso({ hayActosAdmin: x.hayActosAdmin, esCreditoFiscal: x.esCreditoFiscal, esExpropiacionUso: x.esExpropiacionUso, juicioEnCurso: x.juicioEnCurso }), [x.hayActosAdmin, x.esCreditoFiscal, x.esExpropiacionUso, x.juicioEnCurso]);
  const vaae = useMemo(() => calcularVAAETra({ valorComercial: n(x.valorComercial), condenaLaudoFiscal: n(x.condenaLaudoFiscal), honorariosDefensa: n(x.honorariosDefensa), accesorios: n(x.accesorios), mesesDesenredo: n(x.mesesDesenredo), margenPct: n(x.margenPct) }), [x.valorComercial, x.condenaLaudoFiscal, x.honorariosDefensa, x.accesorios, x.mesesDesenredo, x.margenPct]);
  const r3 = useMemo(() => veredictoTra3({ afectacionSuperaValor: x.afectacionSuperaValor, condenaFirmeArriba: x.condenaFirmeArriba, contraparteCede: x.contraparteCede, defendible: x.defendible }, vaae.viable), [x.afectacionSuperaValor, x.condenaFirmeArriba, x.contraparteCede, x.defendible, vaae.viable]);
  const r4 = useMemo(() => veredictoTra4({ suspensionOtorgada: x.suspensionOtorgada, remateInminente: x.remateInminente, contraparteAceptaPoder: x.contraparteAceptaPoder, cesionSuspensiva: x.cesionSuspensiva, escrow: x.escrow, poderIrrevocable: x.poderIrrevocable, dineroYaEntregado: x.dineroYaEntregado }), [x.suspensionOtorgada, x.remateInminente, x.contraparteAceptaPoder, x.cesionSuspensiva, x.escrow, x.poderIrrevocable, x.dineroYaEntregado]);
  const consolidado = useMemo(() => consolidadoTra(r2.semaforo, r3.semaforo, vaae.viable), [r2.semaforo, r3.semaforo, vaae.viable]);
  const fmt = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  const dosFirmas = !!(fElabora && fValida);
  const decidido = !!guardado && guardado.startsWith("Pre-dictamen");

  const guardar = async (decision: string) => {
    const payload = {
      caso_id: x.caso_id || null, expediente: x.expediente || null, juzgado: x.autoridad || null, estado: x.estado,
      tipo_juicio: "Trámite · " + (TIPOS_TRAMITE.find((t) => t.clave === x.tipoTramite)?.nombre || x.tipoTramite), posicion: "Trámite administrativo", datos: x,
      resultados: { acreditacion: r1, litigable: r2, contencioso: cont, recuperable: r3, bloqueo: r4, vaae, consolidado, firmas: { elabora: fElabora, valida: fValida } },
      dictamen_sugerido: consolidado.txt, dictamen_final: decision,
      firma_elabora: fElabora?.nombre || null, firma_elabora_fecha: fElabora?.fecha || null,
      firma_valida: fValida?.nombre || null, firma_valida_fecha: fValida?.fecha || null,
    };
    try {
      await guardarPredictamen(payload, precargar, construirDatosPDF(decision));
      setGuardado("Pre-dictamen (Trámite) guardado: " + decision);
    } catch (e: any) { setGuardado("No se pudo guardar: " + e.message); }
  };

  const construirDatosPDF = (decision: string): DatosPDF => {
    const tipoNom = TIPOS_TRAMITE.find((t) => t.clave === x.tipoTramite)?.nombre || x.tipoTramite;
    return {
      expediente: x.expediente, juzgado: x.autoridad, estado: x.estado, tipoJuicio: tipoNom, posicion: "Trámite administrativo",
      ubicacion: x.ubicacion, deudor: "—", quienCede: x.contraparte, queCede: x.afectaComo || "Afectación a la garantía",
      dictamen: consolidado.txt,
      riesgos: [
        { nombre: "Acreditación", r: r1 }, { nombre: "Procedencia / plazo", r: r2 },
        ...(cont ? [{ nombre: "Contencioso admin.", r: cont }] : []),
        { nombre: "Impacto / recuperable", r: r3 }, { nombre: "Bloqueo + suspensión", r: r4 },
        { nombre: "V_AAE (máximo a pagar)", r: { semaforo: vaae.viable ? "verde" : "rojo", etiqueta: vaae.viable ? "Viable" : "No recuperable", dato: fmt(vaae.vaae), detalle: vaae.detalle } },
      ],
      intereses: { ordinarios: 0, moratorios: 0, iva: 0, total: vaae.cAfe, usura: false },
      admin: null, anotaciones: x.anotaciones, firmaElabora: fElabora, firmaValida: fValida, decision,
    };
  };

  const descargarPDF = async (decision: string) => {
    const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
    await descargarPredictamenPDF(construirDatosPDF(decision));
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={onVolver} className="flex items-center gap-1 hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Cambiar posición</button>
          <span>Trámite admin. · Fase {paso + 1} de {FASES.length}: {FASES[paso]}</span>
        </div>
        <div className="flex gap-1">{FASES.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < paso ? "#0C5C46" : i === paso ? NAVY : "var(--border,#e5e7eb)" }} />)}</div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {paso === 0 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">0 · Identificación</p>
            <Campo label="Caso de la cartera (opcional)">
              <select className={inp} value={x.caso_id} onChange={(e) => { const c = casos.find((y) => String(y.id) === e.target.value); setX((p) => ({ ...p, caso_id: e.target.value, expediente: c?.expediente || p.expediente, ubicacion: c?.direccion_garantia || p.ubicacion })); }}>
                <option value="">— Escribir a mano —</option>{casos.map((c) => <option key={c.id} value={c.id}>{c.expediente} · {c.juzgado}</option>)}
              </select>
            </Campo>
            <Campo label="Tipo de trámite"><select className={inp} value={x.tipoTramite} onChange={(e) => set("tipoTramite", e.target.value)}>{TIPOS_TRAMITE.map((t) => <option key={t.clave} value={t.clave}>{t.nombre} · {t.plazo} días háb.</option>)}</select></Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Autoridad u órgano"><input className={inp} value={x.autoridad} onChange={(e) => set("autoridad", e.target.value)} placeholder="Juzgado de distrito / TFJA / junta laboral" /></Campo>
              <Campo label="Inmueble / garantía afectada"><input className={inp} value={x.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} /></Campo>
              <Campo label="¿Cómo afecta la garantía?"><input className={inp} value={x.afectaComo} onChange={(e) => set("afectaComo", e.target.value)} placeholder="embargo / remate / cancelación / crédito fiscal" /></Campo>
              <Campo label="Contraparte que cede"><input className={inp} value={x.contraparte} onChange={(e) => set("contraparte", e.target.value)} /></Campo>
            </div>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">1 · Acreditación del expediente</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Hay acto reclamado / resolución / laudo?"><SiNo v={x.hayActoReclamado} on={(v) => set("hayActoReclamado", v)} /></Campo>
              <Campo label="Fecha de notificación (clave para el plazo)"><input type="date" className={inp} value={x.fechaNotificacion} onChange={(e) => set("fechaNotificacion", e.target.value)} /></Campo>
              <Campo label="Expediente"><input className={inp} value={x.expediente} onChange={(e) => set("expediente", e.target.value)} /></Campo>
              <Campo label="¿Cómo se revisó?"><select className={inp} value={x.fuenteRevisada} onChange={(e) => set("fuenteRevisada", e.target.value)}><option value="">—</option><option value="real">Directo en el órgano</option><option value="copias">Solo copias del interesado</option></select></Campo>
            </div>
            <Aviso r={r1} />
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">2 · Procedencia y oportunidad · ¿es LITIGABLE?</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Falta de interés jurídico/legítimo?"><SiNo v={x.faltaInteres} on={(v) => set("faltaInteres", v)} /></Campo>
              <Campo label="¿Cosa juzgada / acto firme?"><SiNo v={x.cosaJuzgada} on={(v) => set("cosaJuzgada", v)} /></Campo>
              <Campo label="¿Suspensión otorgada?"><SiNo v={x.suspensionOtorgada} on={(v) => set("suspensionOtorgada", v)} /></Campo>
              <Campo label="¿Acto claramente ilegal/viciado?"><SiNo v={x.actoIlegalClaro} on={(v) => set("actoIlegalClaro", v)} /></Campo>
              <Campo label="¿Requiere asesoría externa (fiscal/laboral)?"><SiNo v={x.requiereExterno} on={(v) => set("requiereExterno", v)} /></Campo>
              <Campo label="Plazo a mano (días háb., opcional)"><input type="number" className={inp} value={x.plazoManual} onChange={(e) => set("plazoManual", e.target.value)} placeholder="auto por tipo" /></Campo>
            </div>
            <Aviso r={r2} />
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Actos administrativos sobre el inmueble (contencioso)</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo label="¿Hay actos administrativos pendientes?"><SiNo v={x.hayActosAdmin} on={(v) => set("hayActosAdmin", v)} /></Campo>
                <Campo label="¿Es crédito fiscal (predial/ISAI)?"><SiNo v={x.esCreditoFiscal} on={(v) => set("esCreditoFiscal", v)} /></Campo>
                <Campo label="¿Es expropiación / uso de suelo?"><SiNo v={x.esExpropiacionUso} on={(v) => set("esExpropiacionUso", v)} /></Campo>
                <Campo label="¿Juicio contencioso en curso?"><SiNo v={x.juicioEnCurso} on={(v) => set("juicioEnCurso", v)} /></Campo>
              </div>
              {cont && <div className="mt-3"><Aviso r={cont} /></div>}
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">3 · Impacto sobre la garantía · ¿es RECUPERABLE? + V_AAE</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿La afectación + defensa supera el valor?"><SiNo v={x.afectacionSuperaValor} on={(v) => set("afectacionSuperaValor", v)} /></Campo>
              <Campo label="¿Condena firme por encima del bien?"><SiNo v={x.condenaFirmeArriba} on={(v) => set("condenaFirmeArriba", v)} /></Campo>
              <Campo label="¿La contraparte cede sus derechos?"><SiNo v={x.contraparteCede} on={(v) => set("contraparteCede", v)} /></Campo>
              <Campo label="¿Defendible (afectación menor al margen)?"><SiNo v={x.defendible} on={(v) => set("defendible", v)} /></Campo>
            </div>
            <p className="pt-1 text-xs font-medium text-muted-foreground">V_AAE administrativo</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Valor comercial"><input type="number" className={inp} value={x.valorComercial} onChange={(e) => set("valorComercial", e.target.value)} /></Campo>
              <Campo label="Condena / laudo / crédito fiscal"><input type="number" className={inp} value={x.condenaLaudoFiscal} onChange={(e) => set("condenaLaudoFiscal", e.target.value)} /></Campo>
              <Campo label="Honorarios de defensa externa"><input type="number" className={inp} value={x.honorariosDefensa} onChange={(e) => set("honorariosDefensa", e.target.value)} /></Campo>
              <Campo label="Accesorios"><input type="number" className={inp} value={x.accesorios} onChange={(e) => set("accesorios", e.target.value)} /></Campo>
              <Campo label="Meses de desenredo"><input type="number" className={inp} value={x.mesesDesenredo} onChange={(e) => set("mesesDesenredo", e.target.value)} /></Campo>
              <Campo label="Margen reservado (%)"><input type="number" className={inp} value={x.margenPct} onChange={(e) => set("margenPct", e.target.value)} /></Campo>
            </div>
            <div className={`rounded-lg border p-3 text-sm ${vaae.viable ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
              <p className="font-semibold">V_AAE = {fmt(vaae.vaae)}</p>
              <p className="mt-1 text-[13px]">{vaae.detalle}</p>
              <p className="mt-1 text-[11px] opacity-80">C_AFE {fmt(vaae.cAfe)} · C_LIT {fmt(vaae.cLit)} · Margen {fmt(vaae.mR)}</p>
            </div>
            <Aviso r={r3} />
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">4 · Bloqueo legal + SUSPENSIÓN</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Hay suspensión del acto reclamado?"><SiNo v={x.suspensionOtorgada} on={(v) => set("suspensionOtorgada", v)} /></Campo>
              <Campo label="¿El remate/cancelación es inminente?"><SiNo v={x.remateInminente} on={(v) => set("remateInminente", v)} /></Campo>
              <Campo label="¿La contraparte acepta firmar Poder Irrevocable?"><SiNo v={x.contraparteAceptaPoder} on={(v) => set("contraparteAceptaPoder", v)} /></Campo>
              <Campo label="¿Cesión con cláusula suspensiva?"><SiNo v={x.cesionSuspensiva} on={(v) => set("cesionSuspensiva", v)} /></Campo>
              <Campo label="¿Escrow (libera al resolverse a favor)?"><SiNo v={x.escrow} on={(v) => set("escrow", v)} /></Campo>
              <Campo label="¿Poder Irrevocable con actos de dominio?"><SiNo v={x.poderIrrevocable} on={(v) => set("poderIrrevocable", v)} /></Campo>
              <Campo label="¿El dinero ya se entregó?"><SiNo v={x.dineroYaEntregado} on={(v) => set("dineroYaEntregado", v)} /></Campo>
            </div>
            <Aviso r={r4} />
          </div>
        )}

        {paso === 5 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">5 · Dictamen y firmas</p>
            <div className="space-y-2"><Aviso r={r1} /><Aviso r={r2} />{cont && <Aviso r={cont} />}<Aviso r={r3} /><Aviso r={r4} /></div>
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
            <p className="text-sm font-medium">Decisión humana · ¿pasa para la defensa/compra?</p>
            {!dosFirmas && !decidido && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Faltan las dos firmas (Elabora + Valida) para poder decidir y para el PDF.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => guardar("Sí pasa")} disabled={!dosFirmas || decidido} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"><Check className="h-4 w-4" /> Sí pasa</button>
              <button onClick={() => guardar("No pasa")} disabled={!dosFirmas || decidido} className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"><X className="h-4 w-4" /> No pasa</button>
              <button onClick={() => guardar("Pasa a UCP (dictamen formal)")} disabled={!dosFirmas || decidido} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed">Pasa a UCP</button>
              {decidido && (
                <button onClick={() => setGuardado(null)} className="flex items-center gap-1.5 rounded-md border border-[color:var(--teal)] px-4 py-2 text-sm font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10"><RefreshCw className="h-4 w-4" /> Re-pre-dictaminar</button>
              )}
            </div>
            {decidido && (
              <p className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><Lock className="h-3.5 w-3.5" /> Pre-dictamen bloqueado. Solo queda enviar el correo y continuar con el registral. Para cambiarlo, toca “Re-pre-dictaminar”.</p>
            )}
            <div><button onClick={() => descargarPDF("(borrador)")} disabled={!dosFirmas} title={!dosFirmas ? "Disponible cuando estén las dos firmas" : ""} className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderColor: "#C2A24C" }}><Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF</button></div>
            {guardado && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{guardado}</div>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Atrás</button>
        {paso < FASES.length - 1 && <button onClick={() => setPaso((p) => Math.min(FASES.length - 1, p + 1))} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: NAVY }}>Siguiente fase <ArrowRight className="h-4 w-4" /></button>}
      </div>
    </>
  );
}

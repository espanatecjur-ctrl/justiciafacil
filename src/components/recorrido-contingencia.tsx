import { useEffect, useMemo, useState } from "react";
import { guardarPredictamen, type Precarga } from "@/lib/predictamen-guardar";
import type { DatosPDF } from "@/lib/predictamen-pdf";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import {
  veredictoCont1, veredictoCont2, veredictoCont3, veredictoCont4, calcularVAAECont, consolidadoCont,
} from "@/lib/urrj-contingencia";
import type { ResultadoMotor, Semaforo } from "@/lib/urrj-motores";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { ArrowLeft, ArrowRight, ClipboardCheck, Check, X, Download } from "lucide-react";

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const n = (s: string) => { const v = parseFloat(s); return isNaN(v) ? 0 : v; };
const FASES = ["Identificación", "Diagnóstico documental", "¿Saneable?", "¿Recuperable? + V_AAE", "Bloqueo legal", "Dictamen y firmas"];
const TIPOS = ["Defecto registral", "Posesión sin escritura", "Escritura sin posesión", "Copropiedad proindiviso", "Doble inscripción", "Traslape de medidas"];
const VIAS = ["Rectificación administrativa (RPP)", "Jurisdicción voluntaria", "Apeo y deslinde", "Usucapión", "División de copropiedad"];

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

export function RecorridoContingencia({ casos, onVolver, precargar, puedeFirmarElabora = true, puedeValidar = true }: { casos: any[]; onVolver: () => void; precargar?: Precarga | null; puedeFirmarElabora?: boolean; puedeValidar?: boolean }) {
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [fElabora, setFElabora] = useState<DatosFirma | null>(null);
  const [fValida, setFValida] = useState<DatosFirma | null>(null);
  const [x, setX] = useState<Record<string, string>>({
    caso_id: "", expediente: "", estado: "Sinaloa", tipoContingencia: TIPOS[0], ubicacion: "", titularRPP: "", contraparte: "",
    hayAntecedenteRegistral: "", fuenteRevisada: "",
    dobleInscripcionTercero: "", inmuebleANombreDeOtro: "", traslapeConTituloFirme: "", copropietarioNoLocalizable: "",
    defectoFormalCorregible: "", copropietariosDeAcuerdo: "", medidasCorregiblesPerito: "", via: "",
    costoSuperaValor: "", copropietariosCeden: "", cargasMenores: "",
    valorComercial: "", honorarios: "", perito: "", derechosRPP: "", impuestos: "", mesesDesenredo: "", margenPct: "30",
    contraparteAceptaPoder: "", cesionSuspensiva: "", escrow: "", poderIrrevocable: "", dineroYaEntregado: "", anotaciones: "",
  });
  const set = (k: string, v: string) => setX((p) => ({ ...p, [k]: v }));
  useEffect(() => { if (precargar?.datos) setX((p) => ({ ...p, ...precargar.datos })); }, []);

  const r1 = useMemo(() => veredictoCont1({ hayAntecedenteRegistral: x.hayAntecedenteRegistral, fuenteRevisada: x.fuenteRevisada }), [x.hayAntecedenteRegistral, x.fuenteRevisada]);
  const r2 = useMemo(() => veredictoCont2({
    dobleInscripcionTercero: x.dobleInscripcionTercero, inmuebleANombreDeOtro: x.inmuebleANombreDeOtro, traslapeConTituloFirme: x.traslapeConTituloFirme,
    copropietarioNoLocalizable: x.copropietarioNoLocalizable, defectoFormalCorregible: x.defectoFormalCorregible, copropietariosDeAcuerdo: x.copropietariosDeAcuerdo,
    medidasCorregiblesPerito: x.medidasCorregiblesPerito, via: x.via,
  }), [x.dobleInscripcionTercero, x.inmuebleANombreDeOtro, x.traslapeConTituloFirme, x.copropietarioNoLocalizable, x.defectoFormalCorregible, x.copropietariosDeAcuerdo, x.medidasCorregiblesPerito, x.via]);
  const vaae = useMemo(() => calcularVAAECont({
    valorComercial: n(x.valorComercial), honorarios: n(x.honorarios), perito: n(x.perito), derechosRPP: n(x.derechosRPP), impuestos: n(x.impuestos),
    mesesDesenredo: n(x.mesesDesenredo), margenPct: n(x.margenPct),
  }), [x.valorComercial, x.honorarios, x.perito, x.derechosRPP, x.impuestos, x.mesesDesenredo, x.margenPct]);
  const r3 = useMemo(() => veredictoCont3({ costoSuperaValor: x.costoSuperaValor, copropietariosCeden: x.copropietariosCeden, cargasMenores: x.cargasMenores }, vaae.viable), [x.costoSuperaValor, x.copropietariosCeden, x.cargasMenores, vaae.viable]);
  const r4 = useMemo(() => veredictoCont4({ contraparteAceptaPoder: x.contraparteAceptaPoder, cesionSuspensiva: x.cesionSuspensiva, escrow: x.escrow, poderIrrevocable: x.poderIrrevocable, dineroYaEntregado: x.dineroYaEntregado }), [x.contraparteAceptaPoder, x.cesionSuspensiva, x.escrow, x.poderIrrevocable, x.dineroYaEntregado]);
  const consolidado = useMemo(() => consolidadoCont(r2.semaforo, r3.semaforo, vaae.viable), [r2.semaforo, r3.semaforo, vaae.viable]);
  const fmt = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  const guardar = async (decision: string) => {
    const payload = {
      caso_id: x.caso_id || null, expediente: x.expediente || null, juzgado: null, estado: x.estado,
      tipo_juicio: "Contingencia · " + x.tipoContingencia, posicion: "Contingencia", datos: x,
      resultados: { diagnostico: r1, saneable: r2, recuperable: r3, bloqueo: r4, vaae, consolidado, firmas: { elabora: fElabora, valida: fValida } },
      dictamen_sugerido: consolidado.txt, dictamen_final: decision,
      firma_elabora: fElabora?.nombre || null, firma_elabora_fecha: fElabora?.fecha || null,
      firma_valida: fValida?.nombre || null, firma_valida_fecha: fValida?.fecha || null,
    };
    try {
      await guardarPredictamen(payload, precargar, construirDatosPDF(decision));
      setGuardado("Pre-dictamen (Contingencia) guardado: " + decision);
    } catch (e: any) { setGuardado("No se pudo guardar: " + e.message); }
  };

  const construirDatosPDF = (decision: string): DatosPDF => ({
    expediente: x.expediente, juzgado: "—", estado: x.estado, tipoJuicio: x.tipoContingencia, posicion: "Contingencia inmobiliaria",
    ubicacion: x.ubicacion, deudor: x.titularRPP, quienCede: x.contraparte, queCede: "Cesión de derechos (saneamiento)",
    dictamen: consolidado.txt,
    riesgos: [
      { nombre: "Diagnóstico", r: r1 }, { nombre: "¿Saneable?", r: r2 }, { nombre: "¿Recuperable?", r: r3 }, { nombre: "Bloqueo legal", r: r4 },
      { nombre: "V_AAE (máximo a pagar)", r: { semaforo: vaae.viable ? "verde" : "rojo", etiqueta: vaae.viable ? "Viable" : "No recuperable", dato: fmt(vaae.vaae), detalle: vaae.detalle } },
    ],
    intereses: { ordinarios: 0, moratorios: 0, iva: 0, total: vaae.cReg, usura: false },
    admin: null, anotaciones: x.anotaciones, firmaElabora: fElabora, firmaValida: fValida, decision,
  });

  const descargarPDF = async (decision: string) => {
    const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
    await descargarPredictamenPDF(construirDatosPDF(decision));
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={onVolver} className="flex items-center gap-1 hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Cambiar posición</button>
          <span>Contingencia · Fase {paso + 1} de {FASES.length}: {FASES[paso]}</span>
        </div>
        <div className="flex gap-1">{FASES.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < paso ? "#0C5C46" : i === paso ? NAVY : "var(--border,#e5e7eb)" }} />)}</div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        {paso === 0 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">0 · Identificación</p>
            <Campo label="Caso de la cartera (opcional)">
              <select className={inp} value={x.caso_id} onChange={(e) => { const c = casos.find((y) => String(y.id) === e.target.value); setX((p) => ({ ...p, caso_id: e.target.value, expediente: c?.expediente || p.expediente, ubicacion: c?.direccion_garantia || p.ubicacion })); }}>
                <option value="">— Escribir a mano —</option>
                {casos.map((c) => <option key={c.id} value={c.id}>{c.expediente} · {c.juzgado}</option>)}
              </select>
            </Campo>
            <Campo label="Tipo de contingencia">
              <select className={inp} value={x.tipoContingencia} onChange={(e) => set("tipoContingencia", e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Inmueble (dirección)"><input className={inp} value={x.ubicacion} onChange={(e) => set("ubicacion", e.target.value)} /></Campo>
              <Campo label="Estado"><input className={inp} value={x.estado} onChange={(e) => set("estado", e.target.value)} /></Campo>
              <Campo label="Titular actual según RPP"><input className={inp} value={x.titularRPP} onChange={(e) => set("titularRPP", e.target.value)} /></Campo>
              <Campo label="Contraparte que cede"><input className={inp} value={x.contraparte} onChange={(e) => set("contraparte", e.target.value)} /></Campo>
            </div>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">1 · Diagnóstico documental</p>
            <p className="text-xs text-muted-foreground">La clave: ¿qué dice el RPP vs la realidad física y la escritura? (tracto, plano/medidas, colindancias, predial).</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Hay antecedente registral (tracto) identificable?"><SiNo v={x.hayAntecedenteRegistral} on={(v) => set("hayAntecedenteRegistral", v)} /></Campo>
              <Campo label="¿Cómo se revisó?">
                <select className={inp} value={x.fuenteRevisada} onChange={(e) => set("fuenteRevisada", e.target.value)}>
                  <option value="">—</option><option value="real">Directo en RPP/catastro</option><option value="copias">Solo copias del interesado</option>
                </select>
              </Campo>
            </div>
            <Aviso r={r1} />
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">2 · Tipificación y vía · ¿es SANEABLE?</p>
            <Campo label="Vía de corrección sugerida">
              <select className={inp} value={x.via} onChange={(e) => set("via", e.target.value)}><option value="">—</option>{VIAS.map((v) => <option key={v}>{v}</option>)}</select>
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿Doble inscripción a favor de un tercero?"><SiNo v={x.dobleInscripcionTercero} on={(v) => set("dobleInscripcionTercero", v)} /></Campo>
              <Campo label="¿El inmueble está a nombre de otro (no la contraparte)?"><SiNo v={x.inmuebleANombreDeOtro} on={(v) => set("inmuebleANombreDeOtro", v)} /></Campo>
              <Campo label="¿Traslape grave con predio con título firme?"><SiNo v={x.traslapeConTituloFirme} on={(v) => set("traslapeConTituloFirme", v)} /></Campo>
              <Campo label="¿Copropietario que se niega y no localizable?"><SiNo v={x.copropietarioNoLocalizable} on={(v) => set("copropietarioNoLocalizable", v)} /></Campo>
              <Campo label="¿Defecto formal corregible (rectificación admin.)?"><SiNo v={x.defectoFormalCorregible} on={(v) => set("defectoFormalCorregible", v)} /></Campo>
              <Campo label="¿Copropietarios identificados y de acuerdo?"><SiNo v={x.copropietariosDeAcuerdo} on={(v) => set("copropietariosDeAcuerdo", v)} /></Campo>
              <Campo label="¿Medidas corregibles con perito?"><SiNo v={x.medidasCorregiblesPerito} on={(v) => set("medidasCorregiblesPerito", v)} /></Campo>
            </div>
            <Aviso r={r2} />
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">3 · Costo de saneamiento · ¿es RECUPERABLE? + V_AAE</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿El costo de regularización supera el valor?"><SiNo v={x.costoSuperaValor} on={(v) => set("costoSuperaValor", v)} /></Campo>
              <Campo label="¿Los copropietarios ceden su parte?"><SiNo v={x.copropietariosCeden} on={(v) => set("copropietariosCeden", v)} /></Campo>
              <Campo label="¿Cargas menores al margen?"><SiNo v={x.cargasMenores} on={(v) => set("cargasMenores", v)} /></Campo>
            </div>
            <p className="pt-1 text-xs font-medium text-muted-foreground">V_AAE de contingencia (lo máximo a pagar por la cesión)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Valor comercial"><input type="number" className={inp} value={x.valorComercial} onChange={(e) => set("valorComercial", e.target.value)} /></Campo>
              <Campo label="Honorarios de regularización"><input type="number" className={inp} value={x.honorarios} onChange={(e) => set("honorarios", e.target.value)} /></Campo>
              <Campo label="Perito / topógrafo"><input type="number" className={inp} value={x.perito} onChange={(e) => set("perito", e.target.value)} /></Campo>
              <Campo label="Derechos del RPP"><input type="number" className={inp} value={x.derechosRPP} onChange={(e) => set("derechosRPP", e.target.value)} /></Campo>
              <Campo label="Impuestos (actualización/traslado)"><input type="number" className={inp} value={x.impuestos} onChange={(e) => set("impuestos", e.target.value)} /></Campo>
              <Campo label="Meses de desenredo"><input type="number" className={inp} value={x.mesesDesenredo} onChange={(e) => set("mesesDesenredo", e.target.value)} /></Campo>
              <Campo label="Margen reservado (%)"><input type="number" className={inp} value={x.margenPct} onChange={(e) => set("margenPct", e.target.value)} /></Campo>
            </div>
            <div className={`rounded-lg border p-3 text-sm ${vaae.viable ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"}`}>
              <p className="font-semibold">V_AAE = {fmt(vaae.vaae)}</p>
              <p className="mt-1 text-[13px]">{vaae.detalle}</p>
              <p className="mt-1 text-[11px] opacity-80">C_REG {fmt(vaae.cReg)} · C_LIT {fmt(vaae.cLit)} · Margen {fmt(vaae.mR)}</p>
            </div>
            <Aviso r={r3} />
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-4">
            <p className="text-base font-semibold">4 · Bloqueo legal (3 candados)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="¿La contraparte acepta firmar Poder Irrevocable?"><SiNo v={x.contraparteAceptaPoder} on={(v) => set("contraparteAceptaPoder", v)} /></Campo>
              <Campo label="¿Cesión suspensiva (condicionada a RPP limpio)?"><SiNo v={x.cesionSuspensiva} on={(v) => set("cesionSuspensiva", v)} /></Campo>
              <Campo label="¿Escrow (libera al inscribirse la corrección)?"><SiNo v={x.escrow} on={(v) => set("escrow", v)} /></Campo>
              <Campo label="¿Poder Irrevocable con actos de dominio?"><SiNo v={x.poderIrrevocable} on={(v) => set("poderIrrevocable", v)} /></Campo>
              <Campo label="¿El dinero ya se entregó?"><SiNo v={x.dineroYaEntregado} on={(v) => set("dineroYaEntregado", v)} /></Campo>
            </div>
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
            <p className="text-sm font-medium">Decisión humana · ¿pasa para el saneamiento/compra?</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => guardar("Sí pasa")} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><Check className="h-4 w-4" /> Sí pasa</button>
              <button onClick={() => guardar("No pasa")} className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"><X className="h-4 w-4" /> No pasa</button>
              <button onClick={() => guardar("Pasa a UCP (dictamen formal)")} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted">Pasa a UCP</button>
            </div>
            <div><button onClick={() => descargarPDF("(borrador)")} className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}><Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF</button></div>
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

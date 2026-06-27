import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { guardarPredictamen, type Precarga } from "@/lib/predictamen-guardar";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import {
  ESTADOS_URRJ, TIPOS_ACCION, motorPrescripcion, motorCaducidad, motorUsucapion,
  calculoFinanciero, viabilidad, type ResultadoMotor, type Semaforo,
} from "@/lib/urrj-motores";
import {
  Scale, ArrowLeft, ArrowRight, Bot, Search, Newspaper, ShieldHalf, Building2,
  Check, X, ClipboardCheck, Lock, Calculator, Download,
} from "lucide-react";
import { getAuth } from "@/lib/auth";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { descargarPredictamenPDF } from "@/lib/predictamen-pdf";
import { RecorridoDemandado } from "@/components/recorrido-demandado";
import { RecorridoSucesorio } from "@/components/recorrido-sucesorio";
import { RecorridoContingencia } from "@/components/recorrido-contingencia";
import { RecorridoTramites } from "@/components/recorrido-tramites";
import { HistorialPredictamen } from "@/components/historial-predictamen";

export const Route = createFileRoute("/urrj")({
  head: () => ({ meta: [{ title: "URRJ — Pre-dictamen — JusticiaFácil" }] }),
  validateSearch: (s: Record<string, unknown>): { soloRegistro?: boolean } => ({
    soloRegistro: s.soloRegistro === true || s.soloRegistro === "true",
  }),
  component: URRJ,
});

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

const POSICIONES = ["Actor", "Demandado", "Sucesorio"] as const;
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
  // H5 cargas
  predial: string; agua: string; condominio: string; fiscales: string; otrosGravamenes: string;
  // H6 financiero/viabilidad
  capital: string; tasaOrd: string; tasaMor: string; dias: string; aplicarIVA: string; gastos: string; valorUDI: string;
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
  predial: "", agua: "", condominio: "", fiscales: "", otrosGravamenes: "",
  capital: "", tasaOrd: "", tasaMor: "", dias: "", aplicarIVA: "no", gastos: "", valorUDI: "",
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

function URRJ() {
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState<Datos>(VACIO);
  const [casos, setCasos] = useState<any[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [firmaElabora, setFirmaElabora] = useState<DatosFirma | null>(null);
  const [firmaValida, setFirmaValida] = useState<DatosFirma | null>(null);
  const [vista, setVista] = useState<"elegir" | "Actor" | "Demandado" | "Sucesorio" | "Contingencia" | "Tramites">("elegir");
  const { soloRegistro } = Route.useSearch();
  const [precargar, setPrecargar] = useState<Precarga | null>(null);
  const [permisos, setPermisos] = useState<string[]>([]);
  useEffect(() => { cargarPermisosURRJ().then((p) => setPermisos(p.acciones)); }, []);
  const puede = (a: string) => permisos.length === 0 || permisos.includes(a);
  useEffect(() => { if (precargar?.datos && vista === "Actor") setD((p) => ({ ...p, ...precargar.datos })); }, [precargar, vista]);
  const volver = () => { setPrecargar(null); setVista("elegir"); };
  const reDictaminar = (fila: any) => {
    const map: Record<string, any> = { Actor: "Actor", Demandado: "Demandado", Sucesorio: "Sucesorio", Contingencia: "Contingencia", "Trámite administrativo": "Tramites" };
    const v = map[fila.posicion];
    if (!v) { alert("No se pudo identificar la posición de este pre-dictamen."); return; }
    const nota = prompt("Nota de cambios (opcional): ¿qué cambió o qué vas a agregar en esta nueva versión?") || "";
    setPrecargar({ datos: fila.datos || {}, antecedenteId: fila.id, version: fila.version || 1, cambios: nota });
    setVista(v);
  };
  const puedeAdmin = ["GAD", "Super_Admin", "DGE"].includes(rolUsuario || "");

  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        const correo = data.session?.user?.email;
        if (!correo) return;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers });
        const j = r.ok ? await r.json() : [];
        setRolUsuario(j?.[0]?.rol ?? null);
      } catch { /* si falla, queda sin permiso de admin */ }
    })();
  }, []);
  const set = (k: keyof Datos, v: string) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,juzgado,entidad,cliente_nombre,direccion_garantia&order=expediente.asc&limit=300`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setCasos).catch(() => {});
  }, []);

  const usaUsucapion = d.posicion === "Sucesorio" || d.quienPosee === "Tercero / invasor";

  // ---- cálculos en vivo ----
  const rPresc = useMemo(() => motorPrescripcion({
    ultimoPago: d.ultimoPago, emplazado: d.emplazado === "si", fechaEmplazamiento: d.fechaEmplazamiento,
    tipoAccion: d.tipoAccion, convenioRatificadoFecha: d.convenioRatificado === "si" ? d.convenioFecha : undefined,
    plazoManualAnios: d.plazoPrescManual ? n(d.plazoPrescManual) : undefined,
  }), [d.ultimoPago, d.emplazado, d.fechaEmplazamiento, d.tipoAccion, d.convenioRatificado, d.convenioFecha, d.plazoPrescManual]);

  const rCaduc = useMemo(() => motorCaducidad({
    ultimaActuacion: d.ultimaActuacion, estado: d.estado,
    plazoManualDias: d.plazoCaducManual ? n(d.plazoCaducManual) : undefined,
  }), [d.ultimaActuacion, d.estado, d.plazoCaducManual]);

  const rUsuc = useMemo(() => motorUsucapion({
    inicioPosesion: d.inicioPosesion, buenaFe: d.buenaFe === "si", hayDemandaDespojo: d.demandaDespojo === "si",
  }), [d.inicioPosesion, d.buenaFe, d.demandaDespojo]);

  const cargas = n(d.predial) + n(d.agua) + n(d.condominio) + n(d.fiscales) + n(d.otrosGravamenes);
  const fin = useMemo(() => calculoFinanciero({
    capital: n(d.capital), tasaOrdinariaAnual: n(d.tasaOrd), tasaMoratoriaAnual: n(d.tasaMor),
    dias: n(d.dias), aplicarIVA: d.aplicarIVA === "si", gastos: n(d.gastos), valorUDI: n(d.valorUDI) || undefined,
  }), [d.capital, d.tasaOrd, d.tasaMor, d.dias, d.aplicarIVA, d.gastos, d.valorUDI]);
  const adeudoTotal = fin.totalDeuda;
  const rViab = useMemo(() => viabilidad(n(d.valorComercial), adeudoTotal, cargas + n(d.costosOperativos), n(d.precioCesion), n(d.margenObjetivo)),
    [d.valorComercial, adeudoTotal, cargas, d.costosOperativos, d.precioCesion, d.margenObjetivo]);

  const registralRojo = d.hipotecaInscrita === "no";
  const fmt = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

  // ---- dictamen sugerido SOLO por lo jurídico (la viabilidad económica es de Administración) ----
  const dictamen = useMemo(() => {
    const sems: Semaforo[] = [rPresc.semaforo, rCaduc.semaforo];
    if (usaUsucapion) sems.push(rUsuc.semaforo);
    if (registralRojo) sems.push("rojo");
    if (sems.includes("rojo")) return { txt: "NEGATIVO", color: "bg-red-50 text-red-800 border-red-200" };
    if (sems.includes("naranja") || sems.includes("amarillo")) return { txt: "CONDICIONADO", color: "bg-amber-50 text-amber-800 border-amber-200" };
    if (sems.includes("gris")) return { txt: "FALTAN DATOS", color: "bg-muted text-muted-foreground border-border" };
    return { txt: "POSITIVO", color: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  }, [rPresc, rCaduc, rUsuc, usaUsucapion, registralRojo]);

  const guardar = async (decision: string) => {
    setGuardando(true);
    const ahora = new Date().toISOString();
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
      await guardarPredictamen(payload, precargar);
      setGuardado(`Pre-dictamen guardado: ${decision}`);
    } catch (e: any) {
      setGuardado("No se pudo guardar (¿corriste el SQL de predictamen?): " + e.message);
    } finally { setGuardando(false); }
  };

  const descargarPDF = async (decision: string) => {
    const riesgos = [
      { nombre: "Prescripción", r: rPresc },
      { nombre: "Caducidad", r: rCaduc },
      ...(usaUsucapion ? [{ nombre: "Usucapión", r: rUsuc }] : []),
    ];
    try {
      await descargarPredictamenPDF({
        expediente: d.expediente, juzgado: d.juzgado, estado: d.estado, tipoJuicio: d.tipoJuicio, posicion: d.posicion,
        ubicacion: d.ubicacion, deudor: d.deudor, quienCede: d.quienCede, queCede: d.queCede,
        dictamen: dictamen.txt, riesgos,
        intereses: { ordinarios: fin.ordinarios, moratorios: fin.moratorios, iva: fin.iva, total: fin.totalDeuda, udis: fin.udis, usura: fin.alertaUsura },
        admin: puedeAdmin && (n(d.valorComercial) || n(d.precioCesion)) ? { valorComercial: n(d.valorComercial), costos: cargas + n(d.costosOperativos), precioCesion: n(d.precioCesion), viab: rViab } : null,
        anotaciones: d.anotacionesHumanas,
        firmaElabora, firmaValida, decision,
      });
    } catch (e: any) {
      setGuardado("No se pudo generar el PDF: " + e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, #0C5C46)` }}>
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6" style={{ color: "#C2A24C" }} />
          <div>
            <h1 className="text-xl font-bold">{soloRegistro ? "URRJ · Registro" : "JUFA · Pre-dictaminador"}</h1>
            <p className="text-sm text-white/70">{soloRegistro ? "Unidad de Resolución Jurídica · registro de pre-dictámenes" : "Pre-dictaminador de URRJ · el sistema calcula y avisa, las personas firman y deciden"}</p>
          </div>
        </div>
      </div>

      {!soloRegistro && vista === "elegir" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-base font-semibold">¿Cuál es la posición de DIIPA en este caso?</p>
          <p className="mb-4 text-sm text-muted-foreground">Cada posición tiene su propio recorrido de pre-dictamen.</p>
          {!puede("elaborar") && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">🔒 Tu rol no puede elaborar pre-dictámenes nuevos. Puedes consultar el historial de abajo.</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } set("posicion", "Actor"); setVista("Actor"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0C5C46" }} />
              <p className="font-semibold">Actor</p>
              <p className="text-xs text-muted-foreground">DIIPA demanda / recupera (cesión hipotecaria). 8 fases.</p>
            </button>
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Demandado"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0B1E3A" }} />
              <p className="font-semibold">Demandado</p>
              <p className="text-xs text-muted-foreground">DIIPA compra los derechos del demandado-vendedor. 6 fases.</p>
            </button>
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Sucesorio"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#C2A24C" }} />
              <p className="font-semibold">Sucesorio</p>
              <p className="text-xs text-muted-foreground">Vía herencia / posesión. Veredicto cruzado. 6 fases.</p>
            </button>
          </div>
          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Otros saneamientos</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Contingencia"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0C5C46" }} />
              <p className="font-semibold">Contingencia inmobiliaria</p>
              <p className="text-xs text-muted-foreground">Defectos registrales, posesión, copropiedad, doble inscripción, traslapes. 6 fases.</p>
            </button>
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Tramites"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0B1E3A" }} />
              <p className="font-semibold">Trámites administrativos</p>
              <p className="text-xs text-muted-foreground">Amparo, contencioso TFJA, laboral, créditos fiscales. Cuenta el plazo. 6 fases.</p>
            </button>
          </div>
        </div>
      )}

      {soloRegistro && vista === "elegir" && <HistorialPredictamen onReDictaminar={reDictaminar} />}

      {vista === "Demandado" && <RecorridoDemandado casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}
      {vista === "Sucesorio" && <RecorridoSucesorio casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}
      {vista === "Contingencia" && <RecorridoContingencia casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}
      {vista === "Tramites" && <RecorridoTramites casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}

      {vista === "Actor" && (<>
      <div className="-mt-1 flex justify-start">
        <button onClick={() => setVista("elegir")} className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Cambiar posición (Actor)</button>
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
          <span>Fase {paso + 1} de {FASES.length}: {FASES[paso]}</span>
        </div>
        <div className="flex gap-1">
          {FASES.map((_, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < paso ? "#0C5C46" : i === paso ? NAVY : "var(--border, #e5e7eb)" }} />
          ))}
        </div>
      </div>

      {/* Contenido de cada fase */}
      <div className="rounded-xl border border-border bg-card p-5">
        {paso === 0 && (
          <div className="space-y-4">
            <H titulo="0 · Datos mínimos / admisión" sub="Lo básico para abrir el expediente." />
            <Campo label="Caso de la cartera (opcional)">
              <select className={inp} value={d.caso_id} onChange={(e) => {
                const c = casos.find((x) => String(x.id) === e.target.value);
                setD((p) => ({ ...p, caso_id: e.target.value, expediente: c?.expediente || p.expediente, juzgado: c?.juzgado || p.juzgado, ubicacion: c?.direccion_garantia || p.ubicacion, deudor: c?.cliente_nombre || p.deudor, estado: ESTADOS_URRJ.includes(c?.entidad) ? c.entidad : p.estado }));
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
              <Campo label="Expediente"><input className={inp} value={d.expediente} onChange={(e) => set("expediente", e.target.value)} /></Campo>
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
            </div>
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
              <Campo label="Otros gravámenes"><input type="number" className={inp} value={d.otrosGravamenes} onChange={(e) => set("otrosGravamenes", e.target.value)} /></Campo>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">Total de cargas ocultas: <b>{fmt(cargas)}</b></div>
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
              <Campo label="Días de cómputo"><input type="number" className={inp} value={d.dias} onChange={(e) => set("dias", e.target.value)} /></Campo>
              <Campo label="Gastos y costas"><input type="number" className={inp} value={d.gastos} onChange={(e) => set("gastos", e.target.value)} /></Campo>
              <Campo label="¿Aplicar IVA 16% a intereses?"><SiNo v={d.aplicarIVA} on={(x) => set("aplicarIVA", x)} /></Campo>
              <Campo label="Valor UDI (opcional)"><input type="number" className={inp} value={d.valorUDI} onChange={(e) => set("valorUDI", e.target.value)} /></Campo>
            </div>
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
            <H titulo="7 · Dictamen y firmas" sub="Riesgos, pre-dictamen del sistema, firmas y decisión humana." />
            <div className="space-y-2">
              <Aviso r={rPresc} /><Aviso r={rCaduc} />{usaUsucapion && <Aviso r={rUsuc} />}
              {registralRojo && <Aviso r={{ semaforo: "rojo", etiqueta: "Registral", detalle: "Hipoteca no inscrita/vigente." }} />}
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
              <FirmaParte titulo="Elabora · abogado URRJ" valor={firmaElabora} onFirmar={(f) => setFirmaElabora(f.fecha ? f : null)} cargoSugerido="Abogado URRJ" bloqueado={!puede("firmar_elabora")} />
              <FirmaParte titulo="Valida · Director Legal" valor={firmaValida} onFirmar={(f) => setFirmaValida(f.fecha ? f : null)} cargoSugerido="Director Legal (DIL)" bloqueado={!puede("validar")} />
            </div>
            <p className="text-sm font-medium">Decisión humana · ¿pasa para compra / inversión en garantía?</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => guardar("Sí pasa")} disabled={guardando} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"><Check className="h-4 w-4" /> Sí pasa</button>
              <button onClick={() => guardar("No pasa")} disabled={guardando} className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"><X className="h-4 w-4" /> No pasa</button>
              <button onClick={() => guardar("Pasa a UCP (dictamen formal)")} disabled={guardando} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted">Pasa a UCP (dictamen formal)</button>
            </div>
            <div className="pt-1">
              <button onClick={() => descargarPDF("(borrador)")} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}>
                <Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF del pre-dictamen
              </button>
            </div>
            {guardado && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{guardado}</div>}

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

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <button onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Atrás</button>
        {paso < FASES.length - 1 && (
          <button onClick={() => setPaso((p) => Math.min(FASES.length - 1, p + 1))} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: NAVY }}>Siguiente fase <ArrowRight className="h-4 w-4" /></button>
        )}
      </div>
      </>)}
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

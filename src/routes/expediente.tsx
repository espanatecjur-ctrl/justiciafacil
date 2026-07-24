import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { AntecedentesGarantia } from "@/components/antecedentes-garantia";
import { CronologiaURRJ } from "@/components/cronologia-urrj-vista";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { DocumentosGarantia } from "@/components/documentos-garantia";
import { SeguimientoJuicioModal } from "@/components/seguimiento-juicio-modal";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { SubJuicios } from "@/components/sub-juicios";
import { IndicadorRepetido } from "@/components/indicador-repetido";
import { BoletinExpediente } from "@/components/boletin-expediente";
import { LineaTiempoJuicio } from "@/components/linea-tiempo-juicio";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { VincularClienteModal } from "@/components/vincular-cliente";
import { BadgeAvance } from "@/components/badge-avance";
import {
  ArrowLeft, Loader2, AlertTriangle, Landmark, Scale, PenLine,
  DollarSign, Megaphone, Lightbulb, Lock, Shield, Layers, Send,
  LayoutGrid, GitBranch, FolderOpen,
} from "lucide-react";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

type Modulo = "general" | "subjuicios" | "documentos" | "boletin";

interface Acuerdo {
  id: string;
  expediente: string | null;
  fecha_acuerdo: string | null;
  texto: string | null;
  tipo_acuerdo: string | null;
  urgente: boolean | null;
}

export const Route = createFileRoute("/expediente")({
  validateSearch: (s: Record<string, unknown>): { id?: string; nueva?: boolean; origen?: string } => ({
    id: typeof s.id === "string" ? s.id : undefined,
    nueva: s.nueva === true || s.nueva === "true",
    origen: typeof s.origen === "string" ? s.origen : undefined,
  }),
  head: () => ({ meta: [{ title: "Ficha del expediente — JusticiaFácil" }] }),
  component: FichaExpedientePage,
});

// Parsea "YYYY-MM-DD" como fecha LOCAL (evita que se vea un día antes)
function parseLocal(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtFecha(s: string | null): string {
  const d = parseLocal(s);
  return d ? d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) : "—";
}
function diasDesde(s: string | null): number | null {
  const d = parseLocal(s);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Sugerencia simple de "qué sigue" según el último acuerdo del boletín
function sugerencia(texto: string | null): string {
  const t = (texto || "").toUpperCase();
  if (!t) return "Aún no hay actuación registrada en el boletín. Verifica que el juzgado esté asignado.";
  if (t.includes("ESCRITURA")) return "Dar seguimiento a la escrituración / otorgamiento en rebeldía.";
  if (t.includes("REMATE") || t.includes("AUDIENCIA")) return "Confirmar la fecha de audiencia/remate y preparar lo necesario.";
  if (t.includes("SENTENCIA")) return "Revisar la sentencia: términos para recurso o para iniciar ejecución.";
  if (t.includes("EJECUCION") || t.includes("EJECUCIÓN")) return "Impulsar el procedimiento de ejecución.";
  if (t.includes("GIRESE OFICIO") || t.includes("GIRENSE OFICIOS")) return "Vigilar la respuesta del oficio girado.";
  if (t.includes("LIQUIDACION") || t.includes("PLANILLA")) return "Dar seguimiento a la planilla de liquidación.";
  if (t.includes("NO HA LUGAR") || t.includes("PREVIENE")) return "Atender la prevención / subsanar lo requerido por el juzgado.";
  return "Registrar la próxima actuación y dar impulso procesal.";
}

// Triangulito rojo cuando falta info
function Faltante({ texto = "Falta información" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700" title={texto}>
      <AlertTriangle className="h-3 w-3" /> {texto}
    </span>
  );
}

// Input y campo para los mini formularios de edición
const inp = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

// Tarjeta de sección reutilizable
function Seccion({ icon, titulo, falta, accion, children }: { icon: React.ReactNode; titulo: string; falta?: boolean; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
        <div className="flex items-center gap-2">
          {falta && <Faltante />}
          {accion}
        </div>
      </div>
      {children}
    </div>
  );
}

// Fila de dato: label + valor (marca ⚠️ si vacío y es importante)
function Dato({ label, valor, importante }: { label: string; valor?: string | null; importante?: boolean }) {
  const vacio = !valor || !String(valor).trim();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">
        {vacio ? (importante ? <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> falta</span> : "—") : valor}
      </span>
    </div>
  );
}

// Sección "próximamente" (placeholder de partes 2 y 3)
function Proximamente({ icon, titulo, nota }: { icon: React.ReactNode; titulo: string; nota: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">{icon} {titulo} <Lock className="h-3.5 w-3.5" /></p>
      <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}

function FichaExpedientePage() {
  const { id, origen } = Route.useSearch();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<CasoJuridico | null>(null);
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modulo, setModulo] = useState<Modulo>("general");
  const [verSeguimiento, setVerSeguimiento] = useState(false);
  const [verVincular, setVerVincular] = useState(false);
  const [editAnt, setEditAnt] = useState(false);
  const [editEst, setEditEst] = useState(false);
  const [verBoletin, setVerBoletin] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  const guardarDatos = async (campos: Record<string, string>, cerrar: () => void) => {
    if (!caso) return;
    setGuardandoDatos(true); setErrorDatos(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${caso.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      });
      if (!r.ok) throw new Error(String(r.status));
      setCaso({ ...caso, ...(campos as any) });
      cerrar();
    } catch {
      setErrorDatos("No se pudo guardar. Revisa las columnas del caso.");
    } finally { setGuardandoDatos(false); }
  };

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${id}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(async (d) => {
        const c: CasoJuridico | null = d?.[0] ?? null;
        setCaso(c);
        if (c?.expediente) {
          const exp = c.expediente.trim();
          const ra = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=*&expediente=eq.${encodeURIComponent(exp)}&order=fecha_acuerdo.desc&limit=200`, { headers });
          setAcuerdos(ra.ok ? await ra.json() : []);
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [id]);

  // si vino de una área específica (ej. URRJ), regresa ahí; si no, por tipo de registro
  const rutasOrigen: Record<string, string> = { urrj: "/urrj", ucp: "/ucp", udp: "/udp", ucm: "/ucm", expedientes: "/expedientes" };
  const destino = origen && rutasOrigen[origen]
    ? rutasOrigen[origen]
    : caso?.tipo_registro === "amparo" ? "/amparos" : caso?.tipo_registro === "recurso" ? "/recursos" : caso?.tipo_registro === "exhorto" ? "/exhortos" : "/ucm";
  const volver = () => navigate({ to: destino });

  if (cargando) return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…</div>
  );
  if (!caso) return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">No se encontró el expediente.</p>
      <button onClick={volver} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver</button>
    </div>
  );

  const c = caso;
  const ultima = acuerdos[0] || null;
  const dias = ultima ? diasDesde(ultima.fecha_acuerdo) : null;
  const sinJuzgado = !(c.nombre_juzgado || c.cve_juzgado || c.juzgado);

  // banderas de faltantes por sección
  const esEspecial = ["amparo", "recurso", "exhorto"].includes(c.tipo_registro || "juicio");
  // el área de la ficha: primero respeta de dónde vino (origen), si no, la deduce de la unidad
  const areaPorUnidad = (c.unidad || "").toUpperCase().includes("UCP") ? "UCP" : (c.unidad || "").toUpperCase().includes("UDP") ? "UDP" : (c.unidad || "").toUpperCase().includes("URRJ") ? "URRJ" : "UCM";
  const areaFicha = origen ? origen.toUpperCase() : areaPorUnidad;
  const _mapMod: Record<string, "ucm"|"ucp"|"udp"|"ufc"|"amparos"> = { UCM: "ucm", UCP: "ucp", UDP: "udp", UFC: "ufc" };
  const moduloPermFicha = esEspecial ? "amparos" : _mapMod[areaFicha];
  // color de la etiqueta según el área
  const colorArea: Record<string, string> = { URRJ: "#7A4FB0", UCM: "#0C5C46", UCP: "#0C447C", UDP: "#854F0B" };
  const areaBg = colorArea[areaFicha] || "#0B1E3A";
  const faltaAntecedente = !c.proveedor || !c.no_credito || !c.direccion_garantia || !(c.cliente_nombre || c.cliente_codigo);
  const faltaEstatus = esEspecial ? !c.estatus_general : (!c.etapa_actual || !c.estatus_general || !c.prioridad);
  const faltaSeguimiento = sinJuzgado; // solo es "falta" si no hay juzgado; sin actuaciones aún NO es falta (el robot las trae)

  // Pestañas de módulos (Parte 1: solo "General" activa; las demás llegan en Parte 2 y 3)
  const MODULOS: { id: Modulo; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "subjuicios", label: "Sub-juicios", icon: <GitBranch className="h-4 w-4" /> },
    { id: "documentos", label: "Documentos", icon: <FolderOpen className="h-4 w-4" /> },
    { id: "boletin", label: "Boletín", icon: <Megaphone className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* volver + área */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={volver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </button>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: areaBg }} title={`Ficha del área ${areaFicha}`}>{areaFicha}</span>
          <BadgeAvance caso={c} />
        </div>
      </div>

      {/* Encabezado (identidad del expediente — siempre visible) */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
        <p className="text-xs uppercase tracking-wider text-white/60">Ficha del expediente</p>
        <h1 className="mt-0.5 text-2xl font-bold">{c.expediente || "— sin expediente —"}</h1>
        <p className="mt-1 text-sm text-white/85">
          {(c.actor || "—")} <span className="text-white/50">vs</span> {(c.demandado || "—")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {c.materia && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{c.materia}</span>}
          {c.via_procesal && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{c.via_procesal}</span>}
          {c.entidad && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{c.entidad}</span>}
          {c.prioridad && <span className="rounded-full bg-white/15 px-2.5 py-0.5">Prioridad {c.prioridad}</span>}
        </div>
        <p className="mt-2 text-xs text-white/70">{c.nombre_juzgado || c.juzgado || "Juzgado sin asignar"}{c.distrito_judicial ? ` · ${c.distrito_judicial}` : ""}</p>
      </div>

      {/* Pestañas de módulos */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {MODULOS.map((m) => (
          <button
            key={m.id}
            onClick={() => setModulo(m.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${modulo === m.id ? "text-white" : "text-muted-foreground hover:bg-muted"}`}
            style={modulo === m.id ? { background: TEAL } : undefined}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ============ MÓDULO GENERAL (todo lo de siempre) ============ */}
      {modulo === "general" && (
        <div className="space-y-4">
          <IndicadorRepetido casoId={c.id || ""} />
          {/* Línea de vida: recorrido por áreas (URRJ→SVT→UCP→UFC→UCM) */}
          <LineaVidaAreas caso={c} />

          {/* Línea del tiempo del juicio (dónde vamos y qué sigue) */}
          <LineaTiempoJuicio caso={c} onAbrir={() => setVerSeguimiento(true)} />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Antecedente: garantía (juicio) o datos del amparo */}
            {c.tipo_registro === "amparo" ? (
              <Seccion icon={<Shield className="h-4 w-4" style={{ color: TEAL }} />} titulo="Datos del amparo" falta={!c.quejoso || !c.acto_reclamado}>
                <Dato label="Tipo de amparo" valor={c.tipo_amparo} />
                <Dato label="Quejoso" valor={c.quejoso} importante />
                <Dato label="Autoridad responsable" valor={c.autoridad_responsable} importante />
                <Dato label="Acto reclamado" valor={c.acto_reclamado} importante />
              </Seccion>
            ) : c.tipo_registro === "recurso" ? (
              <Seccion icon={<Layers className="h-4 w-4" style={{ color: TEAL }} />} titulo="Datos del recurso" falta={!c.promovente}>
                <Dato label="Tipo de recurso" valor={c.tipo_recurso} />
                <Dato label="Promovente" valor={c.promovente} importante />
                <Dato label="Fecha de interposición" valor={c.fecha_interposicion} />
                <Dato label="Resolución" valor={c.resolucion} />
              </Seccion>
            ) : c.tipo_registro === "exhorto" ? (
              <Seccion icon={<Send className="h-4 w-4" style={{ color: TEAL }} />} titulo="Datos del exhorto" falta={!c.diligencia}>
                <Dato label="Folio" valor={c.folio} />
                <Dato label="Expediente origen" valor={c.expediente_origen} />
                <Dato label="Juzgado origen" valor={c.juzgado_origen} />
                <Dato label="Diligencia" valor={c.diligencia} importante />
                <Dato label="Vence" valor={c.fecha_vence} />
              </Seccion>
            ) : (
              <Seccion
                icon={<Landmark className="h-4 w-4" style={{ color: TEAL }} />}
                titulo="Antecedente de la garantía"
                falta={faltaAntecedente}
                accion={
                  <button onClick={() => { setForm({ proveedor: c.proveedor || "", no_credito: c.no_credito || "", direccion_garantia: c.direccion_garantia || "", entidad: c.entidad || "" }); setErrorDatos(null); setEditAnt(true); }} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}>
                    <PenLine className="h-3 w-3" /> Editar / validar
                  </button>
                }
              >
                {editAnt ? (
                  <div className="space-y-2">
                    <Campo label="Proveedor / Administradora"><input className={inp} value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} /></Campo>
                    <Campo label="No. de crédito"><input className={inp} value={form.no_credito} onChange={(e) => setForm({ ...form, no_credito: e.target.value })} /></Campo>
                    <Campo label="Dirección de la garantía"><input className={inp} value={form.direccion_garantia} onChange={(e) => setForm({ ...form, direccion_garantia: e.target.value })} /></Campo>
                    <Campo label="Entidad"><input className={inp} value={form.entidad} onChange={(e) => setForm({ ...form, entidad: e.target.value })} /></Campo>
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                      <span className="text-[11px] text-muted-foreground">Cliente: <b className="text-foreground">{c.cliente_nombre || c.cliente_codigo || "sin vincular"}</b></span>
                      <button onClick={() => setVerVincular(true)} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}><Scale className="h-3 w-3" /> {c.cliente_id ? "Cambiar" : "Vincular"} cliente</button>
                    </div>
                    {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => guardarDatos({ proveedor: form.proveedor, no_credito: form.no_credito, direccion_garantia: form.direccion_garantia, entidad: form.entidad }, () => setEditAnt(false))} disabled={guardandoDatos} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>{guardandoDatos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar</button>
                      <button onClick={() => setEditAnt(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Dato label="ID garantía" valor={c.gar_id} />
                    <Dato label="Proveedor / Administradora" valor={c.proveedor} importante />
                    <Dato label="No. de crédito" valor={c.no_credito} importante />
                    <Dato label="Dirección de la garantía" valor={c.direccion_garantia} importante />
                    <div className="flex items-center justify-between gap-2">
                      <Dato label="Cliente" valor={c.cliente_nombre || c.cliente_codigo} importante />
                      <button onClick={() => setVerVincular(true)} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}>
                        <Scale className="h-3 w-3" /> {c.cliente_id ? "Cambiar" : "Vincular"}
                      </button>
                    </div>
                    <Dato label="Tipo de proceso" valor={c.tipo_proceso} />
                  </>
                )}
              </Seccion>
            )}

            {/* Estatus actual */}
            <Seccion
              icon={<Scale className="h-4 w-4" style={{ color: TEAL }} />}
              titulo="Estatus actual"
              falta={faltaEstatus}
              accion={
                <button onClick={() => { setForm({ etapa_actual: c.etapa_actual || "", estatus_general: c.estatus_general || "", prioridad: c.prioridad || "", expediente: c.expediente || "", juzgado: c.juzgado || "", actor: c.actor || "", demandado: c.demandado || "" }); setErrorDatos(null); setVerBoletin(false); setEditEst(true); }} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}>
                  <PenLine className="h-3 w-3" /> Editar / validar
                </button>
              }
            >
              {editEst ? (
                <div className="space-y-2">
                  {!esEspecial && <Campo label="Etapa actual"><input className={inp} value={form.etapa_actual} onChange={(e) => setForm({ ...form, etapa_actual: e.target.value })} /></Campo>}
                  <Campo label={esEspecial ? "Estado" : "Estatus general"}><input className={inp} value={form.estatus_general} onChange={(e) => setForm({ ...form, estatus_general: e.target.value })} /></Campo>
                  <Campo label="Prioridad"><input className={inp} value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} placeholder="ALTA / MEDIA / BAJA" /></Campo>
                  <Campo label="No. de expediente / juicio"><input className={inp} value={form.expediente} onChange={(e) => setForm({ ...form, expediente: e.target.value })} placeholder="Ej. 1393/2017" /></Campo>
                  <Campo label="No. de juzgado"><input className={inp} value={form.juzgado} onChange={(e) => setForm({ ...form, juzgado: e.target.value })} placeholder="Ej. Juzgado Primero Civil…" /></Campo>
                  <Campo label="Actor"><input className={inp} value={form.actor} onChange={(e) => setForm({ ...form, actor: e.target.value })} placeholder="Quien demanda" /></Campo>
                  <Campo label="Demandado"><input className={inp} value={form.demandado} onChange={(e) => setForm({ ...form, demandado: e.target.value })} placeholder="Contra quién" /></Campo>

                  {/* Robot del boletín: elige jurisdicción + juzgado, busca y rellena */}
                  <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2.5">
                    <button type="button" onClick={() => setVerBoletin((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-xs font-semibold" style={{ color: TEAL }}>
                      <Send className="h-3.5 w-3.5" /> {verBoletin ? "Ocultar buscador del boletín" : "Buscar en el boletín (jurisdicción, juzgado y expediente)"}
                    </button>
                    {verBoletin && (
                      <div className="mt-2">
                        <p className="mb-2 text-[11px] text-muted-foreground">Elige la jurisdicción y el juzgado, busca el expediente y dale <b>“Guardar hallazgos del boletín”</b>: se rellenan solos el expediente, el juzgado, el actor, el demandado y la última etapa. Luego revisa y dale <b>Guardar</b>.</p>
                        <BuscadorBoletin
                          expedienteInicial={form.expediente}
                          onGuardarHallazgos={() => {}}
                          onDatosBoletin={(d) => setForm((f) => ({
                            ...f,
                            expediente: d.expediente || f.expediente,
                            juzgado: d.juzgado || f.juzgado,
                            actor: d.actor || f.actor,
                            demandado: d.demandado || f.demandado,
                            etapa_actual: d.etapa || f.etapa_actual,
                          }))}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Con el expediente y el juzgado, el robot del Boletín ya puede seguir las actuaciones.</p>
                  {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => guardarDatos({ etapa_actual: form.etapa_actual, estatus_general: form.estatus_general, prioridad: form.prioridad, expediente: form.expediente, juzgado: form.juzgado, actor: form.actor, demandado: form.demandado }, () => setEditEst(false))} disabled={guardandoDatos} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>{guardandoDatos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar</button>
                    <button onClick={() => setEditEst(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  {!esEspecial && <Dato label="Etapa actual" valor={c.etapa_actual} importante />}
                  <Dato label={esEspecial ? "Estado" : "Estatus general"} valor={c.estatus_general} importante />
                  <Dato label="Prioridad" valor={c.prioridad} importante={!esEspecial} />
                  {!esEspecial && <Dato label="No. de expediente / juicio" valor={c.expediente} />}
                  {!esEspecial && <Dato label="No. de juzgado" valor={c.juzgado} />}
                  <Dato label="Unidad / Encargado" valor={[c.unidad, c.encargado_unidad].filter(Boolean).join(" · ")} />
                  <Dato label="Nota adicional" valor={c.nota_adicional} />
                </>
              )}
            </Seccion>
          </div>

          {/* Última actuación en el boletín + Qué sigue */}
          <Seccion icon={<Megaphone className="h-4 w-4" style={{ color: TEAL }} />} titulo="Última actuación en el boletín" falta={faltaSeguimiento}
            accion={
              <button onClick={() => setVerSeguimiento(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: NAVY }}>
                <Scale className="h-3.5 w-3.5" /> Seguimiento del juicio
              </button>
            }>
            {sinJuzgado ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mr-1 inline h-4 w-4" /> Falta asignar el juzgado para que el robot pueda seguir este expediente en el boletín.
              </div>
            ) : ultima ? (
              <>
                <div className="rounded-md bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{fmtFecha(ultima.fecha_acuerdo)}{dias != null && ` · hace ${dias} días`}</span>
                    {ultima.urgente && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">urgente</span>}
                  </div>
                  <p className="mt-1 text-sm">{ultima.texto || "—"}</p>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: TEAL }}>Qué sigue (sugerencia)</p>
                    <p className="text-sm">{sugerencia(ultima.texto)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{acuerdos.length} actuaciones registradas en el boletín.</p>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3 text-sm">
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                  <div>
                    <p className="font-medium" style={{ color: TEAL }}>Listo para el robot — aún sin actuaciones.</p>
                    <p className="mt-0.5 text-muted-foreground">El juzgado ya está asignado. El robot revisa el boletín <b>todos los días a las 9:00 AM</b> y, cuando aparezca un acuerdo de este expediente, se llenará aquí solo. No necesitas hacer nada.</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Si después de varios días sigue vacío, revisa que el <b>número de expediente</b> y el <b>juzgado</b> coincidan exactamente con los del boletín (puedes corregirlos en "Asignar juzgado").</p>
              </div>
            )}
          </Seccion>

          {/* Cronología URRJ: dictámenes firmados y correos preparados */}
          <div className="rounded-xl border border-border bg-card p-5">
            <CronologiaURRJ casoId={c.id} expediente={c.expediente} />
          </div>

          {/* ANTECEDENTES (solo lectura): pre-dictámenes, dictámenes, firmas, actuaciones y evidencias */}
          <AntecedentesGarantia casoId={c.id} expediente={c.expediente} />

          {/* Sección que llega en la siguiente parte */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Proximamente icon={<DollarSign className="h-4 w-4" />} titulo="Precios" nota="Valores de la garantía. (Parte 3)" />
          </div>
        </div>
      )}

      {/* ============ MÓDULO SUB-JUICIOS (Parte 2) ============ */}
      {modulo === "subjuicios" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <SubJuicios casoId={c.id} />
        </div>
      )}

      {/* ============ MÓDULO DOCUMENTOS (Parte 3) ============ */}
      {modulo === "documentos" && (
        <div className="space-y-4">
          {/* Carpeta de Drive vinculada + vista previa de documentos */}
          <CarpetaDriveVinculada caso={c} area={areaFicha} modulo={moduloPermFicha} onGuardar={(campos) => guardarDatos(campos, () => {})} />

          <DocumentosGarantia area={areaFicha} caso={c} />
        </div>
      )}

      {/* ============ MÓDULO BOLETÍN (Parte 3) ============ */}
      {modulo === "boletin" && (
        <BoletinExpediente acuerdos={acuerdos} expediente={c.expediente} sinJuzgado={sinJuzgado} cargando={cargando} />
      )}

      {verSeguimiento && <SeguimientoJuicioModal area={areaFicha} caso={c} onClose={() => setVerSeguimiento(false)} />}
      {verVincular && <VincularClienteModal caso={c} onClose={() => setVerVincular(false)} onVinculado={(cl) => { setCaso({ ...c, cliente_nombre: cl.nombre, cliente_codigo: cl.codigo, cliente_jc_id: cl.id }); setVerVincular(false); }} />}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, FileSignature, Loader2, Save, X, Send, LayoutGrid, Stamp, GitBranch,
  FolderOpen, Megaphone, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { obtenerFormalizacion, actualizarFormalizacion, TIPOS_PROCESO, TIPOS_CONTRATO, ESTADOS_TRAMITE, type Formalizacion } from "@/lib/formalizacion";
import { crearSolicitud, TIPOS_DOCUMENTO_SOLICITUD, limite24hHabiles } from "@/lib/solicitud-contrato";
import { usuarioActualEtiqueta } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { DocumentosFijos } from "@/components/documentos-fijos";
import { SubJuicios } from "@/components/sub-juicios";
import { BoletinExpediente } from "@/components/boletin-expediente";

export const Route = createFileRoute("/ufc-ficha")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Ficha UFC — JusticiaFácil" }] }),
  component: UFCFicha,
});

const NAVY = "#0B1E3A";
const ROJO = "#8A1F2B"; // color de UFC (formalizaciones)
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

type Modulo = "general" | "proceso" | "subjuicios" | "documentos" | "boletin";

interface Acuerdo { id: string; expediente: string | null; fecha_acuerdo: string | null; texto: string | null; tipo_acuerdo: string | null; urgente: boolean | null; }

// Documentos generalmente pedidos por notaría para una cesión de derechos (litigiosos/adjudicatarios).
// Guía general — cada estado puede sumar formatos o cuotas propias (Registro Público, ISAI local, etc.).
const DOCUMENTOS_REQUERIDOS = [
  "Identificación oficial vigente del cedente y del cesionario",
  "Documento que acredite el derecho a ceder (sentencia, adjudicación, contrato, declaratoria de herederos)",
  "Predial al corriente de la garantía",
  "Certificado del Registro Público (situación jurídica y gravámenes)",
  "Avalúo (cuando lo pida el notario o la autoridad fiscal local)",
  "Acta de matrimonio del cedente, si aplica sociedad conyugal",
  "CURP y RFC de ambas partes",
];

function UFCFicha() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [f, setF] = useState<Formalizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [modulo, setModulo] = useState<Modulo>("general");
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);

  // Mini formulario de solicitud a Contratos
  const [pidiendo, setPidiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msgSol, setMsgSol] = useState("");
  const [sol, setSol] = useState({ tipo_documento: TIPOS_DOCUMENTO_SOLICITUD[0], detalle: "", solicitante: "" });

  useEffect(() => { usuarioActualEtiqueta().then((v) => setSol((s) => ({ ...s, solicitante: v }))); }, []);

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    obtenerFormalizacion(id).then((datos) => {
      setF(datos);
      if (datos?.expediente) {
        fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=*&expediente=eq.${encodeURIComponent(datos.expediente.trim())}&order=fecha_acuerdo.desc&limit=200`, { headers })
          .then((r) => (r.ok ? r.json() : [])).then(setAcuerdos).catch(() => {});
      }
    }).finally(() => setCargando(false));
  }, [id]);

  const set = (k: keyof Formalizacion, v: any) => setF((p) => (p ? { ...p, [k]: v } : p));

  const guardar = async () => {
    if (!f?.id) return;
    setGuardando(true); setMsg("");
    const ok = await actualizarFormalizacion(f.id, f);
    setGuardando(false);
    setMsg(ok ? "Guardado ✓" : "No se pudo guardar");
    setTimeout(() => setMsg(""), 2500);
  };

  // Documentos: la carpeta de Drive se guarda directo en la fila de formalizacion (independiente del expediente original).
  const guardarCarpeta = async (campos: Record<string, string>) => {
    if (!f?.id) return;
    await actualizarFormalizacion(f.id, campos as Partial<Formalizacion>);
    setF((p) => (p ? { ...p, ...(campos as any) } : p));
  };

  const enviarSolicitud = async () => {
    if (!f) return;
    setEnviando(true); setMsgSol("");
    const ok = await crearSolicitud({
      garantia_ref: f.id_interno || f.direccion_garantia || "Sin ID",
      origen: "UFC",
      area: "UFC",
      tipo_documento: sol.tipo_documento,
      detalle: sol.detalle,
      solicitante: sol.solicitante,
      estado: "Pendiente",
      fecha_solicitud: new Date().toISOString(),
      fecha_limite: limite24hHabiles().toISOString(),
    });
    setEnviando(false);
    if (ok) {
      setMsgSol("Solicitud enviada a Contratos ✓");
      setTimeout(() => { setPidiendo(false); setMsgSol(""); setSol({ tipo_documento: TIPOS_DOCUMENTO_SOLICITUD[0], detalle: "", solicitante: "" }); }, 1400);
    } else {
      setMsgSol("No se pudo enviar (¿corriste el SQL de solicitudes?).");
    }
  };

  if (cargando) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…</div>;
  if (!f) return <div className="p-8 text-sm text-muted-foreground">No se encontró la formalización. <button onClick={() => navigate({ to: "/ufc" })} className="underline">Volver</button></div>;

  // Objeto "caso virtual" para reusar los mismos componentes de Drive que UCM/UCP (carpeta propia e independiente).
  const casoVirtual: CasoJuridico = {
    id: f.id || "",
    expediente: f.expediente ?? null,
    no_credito: f.id_interno ?? null,
    cliente_nombre: f.nombre_cesionario ?? null,
    drive_carpeta_id: f.drive_carpeta_id ?? null,
    drive_carpeta_nombre: f.drive_carpeta_nombre ?? null,
  } as unknown as CasoJuridico;

  const MODULOS: { id: Modulo; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "proceso", label: "Proceso", icon: <Stamp className="h-4 w-4" /> },
    { id: "subjuicios", label: "Sub-juicios", icon: <GitBranch className="h-4 w-4" /> },
    { id: "documentos", label: "Documentos", icon: <FolderOpen className="h-4 w-4" /> },
    { id: "boletin", label: "Boletín", icon: <Megaphone className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* barra superior */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate({ to: "/ufc" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Volver a UFC</button>
        <div className="flex items-center gap-2">
          <button onClick={() => setPidiendo(true)} className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: ROJO, color: ROJO }}>
            <FileSignature className="h-4 w-4" /> Solicitar a Contratos
          </button>
          <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: ROJO }}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar {msg && <span className="ml-1 text-xs">· {msg}</span>}
          </button>
        </div>
      </div>

      {/* Mini formulario: solicitar a Contratos */}
      {pidiendo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !enviando && setPidiendo(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-base font-bold" style={{ color: NAVY }}>Solicitar a Contratos</p>
              <button onClick={() => setPidiendo(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Garantía: <b>{f.id_interno || f.direccion_garantia || "Sin ID"}</b> · Área: UFC</p>

            <label className={lbl}>¿Qué se necesita elaborar?</label>
            <select className={inp} value={sol.tipo_documento} onChange={(e) => setSol({ ...sol, tipo_documento: e.target.value })}>
              {TIPOS_DOCUMENTO_SOLICITUD.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label className={`${lbl} mt-3`}>Detalle de lo que se necesita</label>
            <textarea className={inp} rows={3} value={sol.detalle} onChange={(e) => setSol({ ...sol, detalle: e.target.value })} placeholder="Ej. Escriturar 3 lotes adjudicados a favor del cesionario…" />

            <label className={`${lbl} mt-3`}>¿Quién lo solicita?</label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
              <span className="truncate">{sol.solicitante || "Detectando sesión…"}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Se toma solo de tu sesión (rol · correo). No se captura a mano.</p>

            <p className="mt-3 text-[11px] text-muted-foreground">Plazo de entrega: <b>24 horas hábiles</b> (el fin de semana no cuenta).</p>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={enviarSolicitud} disabled={enviando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: ROJO }}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar solicitud
              </button>
              <button onClick={() => setPidiendo(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
              {msgSol && <span className="text-xs">{msgSol}</span>}
            </div>
          </div>
        </div>
      )}

      {/* encabezado */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${ROJO})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Ficha UFC · Formalización y cierre</p>
        <p className="text-2xl font-bold">{f.id_interno || "Sin ID"}</p>
        <p className="text-sm text-white/80">{f.direccion_garantia || "Sin dirección"}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {f.tipo_proceso && <span className="rounded-full bg-white/15 px-2 py-0.5">{f.tipo_proceso}</span>}
          {f.tipo_contrato && <span className="rounded-full bg-white/15 px-2 py-0.5">{f.tipo_contrato}</span>}
          {f.estado_tramite && <span className="rounded-full bg-white/15 px-2 py-0.5">{f.estado_tramite}</span>}
        </div>
      </div>

      {/* pestañas */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {MODULOS.map((m) => (
          <button key={m.id} onClick={() => setModulo(m.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${modulo === m.id ? "text-white" : "text-muted-foreground hover:bg-muted"}`} style={modulo === m.id ? { background: ROJO } : undefined}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ============ GENERAL ============ */}
      {modulo === "general" && (
        <Seccion titulo="Identificación" color={ROJO}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="ID interno"><input className={inp} value={f.id_interno || ""} onChange={(e) => set("id_interno", e.target.value)} /></Campo>
            <Campo label="Tipo de proceso"><select className={inp} value={f.tipo_proceso || ""} onChange={(e) => set("tipo_proceso", e.target.value)}><option value="">—</option>{TIPOS_PROCESO.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            <Campo label="Tipo de contrato"><select className={inp} value={f.tipo_contrato || ""} onChange={(e) => set("tipo_contrato", e.target.value)}><option value="">—</option>{TIPOS_CONTRATO.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            <Campo label="Estado del trámite"><select className={inp} value={f.estado_tramite || ""} onChange={(e) => set("estado_tramite", e.target.value)}><option value="">—</option>{ESTADOS_TRAMITE.map((t) => <option key={t}>{t}</option>)}</select></Campo>
            <Campo label="Dirección de la garantía" full><input className={inp} value={f.direccion_garantia || ""} onChange={(e) => set("direccion_garantia", e.target.value)} /></Campo>
            <Campo label="Expediente"><input className={inp} value={f.expediente || ""} onChange={(e) => set("expediente", e.target.value)} /></Campo>
            <Campo label="Distrito judicial"><input className={inp} value={f.distrito_judicial || ""} onChange={(e) => set("distrito_judicial", e.target.value)} /></Campo>
            <Campo label="Juzgado" full><input className={inp} value={f.juzgado || ""} onChange={(e) => set("juzgado", e.target.value)} /></Campo>
            <Campo label="Tipo de juicio"><input className={inp} value={f.tipo_juicio || ""} onChange={(e) => set("tipo_juicio", e.target.value)} /></Campo>
            <Campo label="Vía procesal"><input className={inp} value={f.via_procesal || ""} onChange={(e) => set("via_procesal", e.target.value)} /></Campo>
            <Campo label="Etapa a seguir"><input className={inp} value={f.etapa_a_seguir || ""} onChange={(e) => set("etapa_a_seguir", e.target.value)} /></Campo>
            <Campo label="Observaciones" full><textarea className={inp} rows={2} value={f.observaciones || ""} onChange={(e) => set("observaciones", e.target.value)} /></Campo>
          </div>
        </Seccion>
      )}

      {/* ============ PROCESO (instrucción notarial, escritura, minuta/pagos, RPP, entrega) ============ */}
      {modulo === "proceso" && (
        <div className="space-y-4">
          <Seccion titulo="Instrucción notarial" color={ROJO}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Encargado de instrucción"><input className={inp} value={f.encargado_instruccion || ""} onChange={(e) => set("encargado_instruccion", e.target.value)} /></Campo>
              <Campo label="Responsable de instrucción"><input className={inp} value={f.responsable_instruccion || ""} onChange={(e) => set("responsable_instruccion", e.target.value)} /></Campo>
              <Campo label="Documento de instrucción notarial" full><input className={inp} value={f.doc_instruccion_notarial || ""} onChange={(e) => set("doc_instruccion_notarial", e.target.value)} placeholder="Enlace o referencia del documento" /></Campo>
              <Campo label="Número de notaría"><input className={inp} value={f.numero_notaria || ""} onChange={(e) => set("numero_notaria", e.target.value)} /></Campo>
              <Campo label="Nombre del notario"><input className={inp} value={f.nombre_notario || ""} onChange={(e) => set("nombre_notario", e.target.value)} /></Campo>
              <Campo label="Jurisdicción del notario" full><input className={inp} value={f.jurisdiccion_notario || ""} onChange={(e) => set("jurisdiccion_notario", e.target.value)} placeholder="Ej. Guadalajara, Jalisco" /></Campo>
            </div>
          </Seccion>

          <Seccion titulo="Escritura y cesión" color={ROJO}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Documento de escritura" full><input className={inp} value={f.doc_escritura || ""} onChange={(e) => set("doc_escritura", e.target.value)} /></Campo>
              <Campo label="Número de escritura"><input className={inp} value={f.numero_escritura || ""} onChange={(e) => set("numero_escritura", e.target.value)} /></Campo>
              <Campo label="Fecha de escritura"><input type="date" className={inp} value={f.fecha_escritura ? String(f.fecha_escritura).slice(0, 10) : ""} onChange={(e) => set("fecha_escritura", e.target.value)} /></Campo>
              <Campo label="Libro"><input className={inp} value={f.libro || ""} onChange={(e) => set("libro", e.target.value)} /></Campo>
              <Campo label="Nombre del cedente"><input className={inp} value={f.nombre_cedente || ""} onChange={(e) => set("nombre_cedente", e.target.value)} /></Campo>
              <Campo label="Sujeto de derecho (cedente)"><input className={inp} value={f.sujeto_derecho_cedente || ""} onChange={(e) => set("sujeto_derecho_cedente", e.target.value)} /></Campo>
              <Campo label="Nombre del cesionario"><input className={inp} value={f.nombre_cesionario || ""} onChange={(e) => set("nombre_cesionario", e.target.value)} /></Campo>
              <Campo label="Sujeto de derecho (cesionario)"><input className={inp} value={f.sujeto_derecho_cesionario || ""} onChange={(e) => set("sujeto_derecho_cesionario", e.target.value)} /></Campo>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.firma_apoderado} onChange={(e) => set("firma_apoderado", e.target.checked)} /> Firma del apoderado</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.firma_notario} onChange={(e) => set("firma_notario", e.target.checked)} /> Firma del notario</label>
            </div>
          </Seccion>

          <Seccion titulo="Minuta y pagos" color={ROJO}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Encargado de minuta"><input className={inp} value={f.encargado_minuta || ""} onChange={(e) => set("encargado_minuta", e.target.value)} /></Campo>
              <Campo label="Fecha de solicitud de minuta"><input type="date" className={inp} value={f.fecha_solicitud_minuta ? String(f.fecha_solicitud_minuta).slice(0, 10) : ""} onChange={(e) => set("fecha_solicitud_minuta", e.target.value)} /></Campo>
              <Campo label="Fecha de revisión"><input type="date" className={inp} value={f.fecha_revision ? String(f.fecha_revision).slice(0, 10) : ""} onChange={(e) => set("fecha_revision", e.target.value)} /></Campo>
              <Campo label="Enlace a contabilidad" full><input className={inp} value={f.enlace_contabilidad || ""} onChange={(e) => set("enlace_contabilidad", e.target.value)} /></Campo>
              <Campo label="Validación de contabilidad"><input className={inp} value={f.validacion_contabilidad || ""} onChange={(e) => set("validacion_contabilidad", e.target.value)} /></Campo>
              <Campo label="Ficha de pago de notaría"><input className={inp} value={f.ficha_pago_notaria || ""} onChange={(e) => set("ficha_pago_notaria", e.target.value)} /></Campo>
              <Campo label="Fecha para firmar"><input type="date" className={inp} value={f.fecha_para_firmar ? String(f.fecha_para_firmar).slice(0, 10) : ""} onChange={(e) => set("fecha_para_firmar", e.target.value)} /></Campo>
              <Campo label="Fecha de entrega de testimonio"><input type="date" className={inp} value={f.fecha_entrega_testimonio ? String(f.fecha_entrega_testimonio).slice(0, 10) : ""} onChange={(e) => set("fecha_entrega_testimonio", e.target.value)} /></Campo>
              <Campo label="Días de mora (testimonio)"><input type="number" className={inp} value={f.dias_mora_testimonio ?? ""} onChange={(e) => set("dias_mora_testimonio", e.target.value ? Number(e.target.value) : null)} /></Campo>
            </div>
          </Seccion>

          <Seccion titulo="Registro Público de la Propiedad" color={ROJO}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Fecha de ingreso a RPP"><input type="date" className={inp} value={f.fecha_ingreso_rpp ? String(f.fecha_ingreso_rpp).slice(0, 10) : ""} onChange={(e) => set("fecha_ingreso_rpp", e.target.value)} /></Campo>
              <Campo label="Recibo de pago RPP"><input className={inp} value={f.recibo_pago_rpp || ""} onChange={(e) => set("recibo_pago_rpp", e.target.value)} /></Campo>
              <Campo label="Folio de registro"><input className={inp} value={f.folio_registro || ""} onChange={(e) => set("folio_registro", e.target.value)} /></Campo>
              <Campo label="Fecha de entrega RPP"><input type="date" className={inp} value={f.fecha_entrega_rpp ? String(f.fecha_entrega_rpp).slice(0, 10) : ""} onChange={(e) => set("fecha_entrega_rpp", e.target.value)} /></Campo>
              <Campo label="Días de mora (RPP)"><input type="number" className={inp} value={f.dias_mora_rpp ?? ""} onChange={(e) => set("dias_mora_rpp", e.target.value ? Number(e.target.value) : null)} /></Campo>
              <Campo label="Boleta de inscripción"><input className={inp} value={f.boleta_inscripcion || ""} onChange={(e) => set("boleta_inscripcion", e.target.value)} /></Campo>
              <Campo label="Nuevo CLG" full><input className={inp} value={f.nuevo_clg || ""} onChange={(e) => set("nuevo_clg", e.target.value)} /></Campo>
            </div>
          </Seccion>

          <Seccion titulo="Entrega y seguimiento" color={ROJO}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Fecha de entrega a DIL"><input type="date" className={inp} value={f.fecha_entrega_dil ? String(f.fecha_entrega_dil).slice(0, 10) : ""} onChange={(e) => set("fecha_entrega_dil", e.target.value)} /></Campo>
              <Campo label="Documentación"><input className={inp} value={f.documentacion || ""} onChange={(e) => set("documentacion", e.target.value)} /></Campo>
              <Campo label="Fecha de entrega a UCM"><input type="date" className={inp} value={f.fecha_entrega_ucm ? String(f.fecha_entrega_ucm).slice(0, 10) : ""} onChange={(e) => set("fecha_entrega_ucm", e.target.value)} /></Campo>
              <Campo label="Días de mora (entrega)"><input type="number" className={inp} value={f.dias_mora_entrega ?? ""} onChange={(e) => set("dias_mora_entrega", e.target.value ? Number(e.target.value) : null)} /></Campo>
              <Campo label="Responsable jurídico"><input className={inp} value={f.responsable_juridico || ""} onChange={(e) => set("responsable_juridico", e.target.value)} /></Campo>
              <Campo label="Director jurídico"><input className={inp} value={f.director_juridico || ""} onChange={(e) => set("director_juridico", e.target.value)} /></Campo>
              <Campo label="Unidad a la que pertenece"><input className={inp} value={f.unidad_pertenece || ""} onChange={(e) => set("unidad_pertenece", e.target.value)} /></Campo>
              <Campo label="Encargado de la unidad"><input className={inp} value={f.encargado_unidad || ""} onChange={(e) => set("encargado_unidad", e.target.value)} /></Campo>
              <Campo label="Otra etapa" full><input className={inp} value={f.otra_etapa || ""} onChange={(e) => set("otra_etapa", e.target.value)} /></Campo>
            </div>
          </Seccion>
        </div>
      )}

      {/* ============ SUB-JUICIOS (del expediente jurídico de origen, si hay uno vinculado) ============ */}
      {modulo === "subjuicios" && (
        f.caso_id
          ? <div className="rounded-xl border border-border bg-card p-4"><SubJuicios casoId={f.caso_id} /></div>
          : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Esta formalización no tiene un expediente jurídico (UCP/UCM) vinculado — sin expediente no hay sub-juicios que mostrar.</div>
      )}

      {/* ============ DOCUMENTOS (carpeta de Drive propia de UFC) ============ */}
      {modulo === "documentos" && (
        <div className="space-y-4">
          <CarpetaDriveVinculada caso={casoVirtual} area="UFC" modulo="ufc" onGuardar={guardarCarpeta} />
          <DocumentosFijos caso={casoVirtual} area="UFC" />
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: ROJO }} />
              <h3 className="text-sm font-semibold">Documentos que normalmente pide la notaría</h3>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">Guía general para una cesión de derechos (litigiosos o adjudicatarios). Cada estado puede sumar formatos o cuotas propias — confirma con la notaría asignada.</p>
            <ul className="space-y-1.5">
              {DOCUMENTOS_REQUERIDOS.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ROJO }} />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ============ BOLETÍN ============ */}
      {modulo === "boletin" && (
        f.expediente
          ? <BoletinExpediente acuerdos={acuerdos} expediente={f.expediente} sinJuzgado={!f.juzgado} cargando={false} />
          : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"><AlertTriangle className="mx-auto mb-2 h-5 w-5 text-amber-500" />Falta capturar el número de expediente (pestaña General) para que el robot pueda seguirlo en el boletín.</div>
      )}
    </div>
  );
}

function Seccion({ titulo, color, children }: { titulo: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold" style={{ color: color || NAVY }}>{titulo}</p>
      {children}
    </div>
  );
}

function Campo({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block text-sm ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

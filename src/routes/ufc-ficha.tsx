import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileSignature, Loader2, Save, X, Send } from "lucide-react";
import { obtenerFormalizacion, actualizarFormalizacion, TIPOS_PROCESO, TIPOS_CONTRATO, ESTADOS_TRAMITE, type Formalizacion } from "@/lib/formalizacion";
import { crearSolicitud, TIPOS_DOCUMENTO_SOLICITUD, limite24hHabiles } from "@/lib/solicitud-contrato";

export const Route = createFileRoute("/ufc-ficha")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Ficha UFC — JusticiaFácil" }] }),
  component: UFCFicha,
});

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";

function UFCFicha() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [f, setF] = useState<Formalizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  // Mini formulario de solicitud a Contratos
  const [pidiendo, setPidiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msgSol, setMsgSol] = useState("");
  const [sol, setSol] = useState({ tipo_documento: TIPOS_DOCUMENTO_SOLICITUD[0], detalle: "", solicitante: "" });

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    obtenerFormalizacion(id).then(setF).finally(() => setCargando(false));
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

  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* barra superior */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate({ to: "/ufc" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Volver a UFC</button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPidiendo(true)}
            className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium"
            style={{ borderColor: TEAL, color: TEAL }}
          >
            <FileSignature className="h-4 w-4" /> Solicitar a Contratos
          </button>
          <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
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
            <input className={inp} value={sol.solicitante} onChange={(e) => setSol({ ...sol, solicitante: e.target.value })} placeholder="Tu nombre" />

            <p className="mt-3 text-[11px] text-muted-foreground">Plazo de entrega: <b>24 horas hábiles</b> (el fin de semana no cuenta).</p>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={enviarSolicitud} disabled={enviando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar solicitud
              </button>
              <button onClick={() => setPidiendo(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
              {msgSol && <span className="text-xs">{msgSol}</span>}
            </div>
          </div>
        </div>
      )}

      {/* encabezado */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Formalización</p>
        <p className="text-2xl font-bold">{f.id_interno || "Sin ID"}</p>
        <p className="text-sm text-white/80">{f.direccion_garantia || "Sin dirección"}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {f.tipo_proceso && <span className="rounded-full bg-white/15 px-2 py-0.5">{f.tipo_proceso}</span>}
          {f.tipo_contrato && <span className="rounded-full bg-white/15 px-2 py-0.5">{f.tipo_contrato}</span>}
          {f.estado_tramite && <span className="rounded-full bg-white/15 px-2 py-0.5">{f.estado_tramite}</span>}
        </div>
      </div>

      {/* Bloque 1 · Identificación */}
      <Seccion titulo="Bloque 1 · Identificación">
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

      <p className="text-center text-xs text-muted-foreground">Los bloques 2–6 (instrucción notarial, escritura, pagos, registro público, entrega) se agregan en el siguiente paso.</p>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>{titulo}</p>
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

// JusticiaFácil · Sub-juicios (juicios dentro del juicio)
// Lista + alta de juicios internos ligados a una garantía: amparos,
// prescripción, jurisdicción voluntaria, familiar, laboral, hipotecario,
// recursos… cualquiera relacionado. Cada uno con su propio expediente y
// juzgado, y con el mismo buscador del boletín que el expediente principal.
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { SubJuicioFicha } from "@/components/sub-juicio-ficha";
import { GitBranch, Plus, Loader2, Trash2, Scale, Send, X, AlertTriangle } from "lucide-react";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const wHeaders = { ...headers, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";

// Tipos comunes; "Otro" deja escribir el que sea (queda libre)
const TIPOS = ["Amparo", "Prescripción", "Jurisdicción voluntaria", "Juicio familiar", "Juicio laboral", "Hipotecario", "Recurso", "Incidente", "Otro"];

export interface SubJuicio {
  id: string;
  caso_id: string | null;
  tipo: string | null;
  expediente: string | null;
  juzgado: string | null;
  entidad: string | null;
  distrito_judicial: string | null;
  actor: string | null;
  demandado: string | null;
  etapa: string | null;
  estatus: string | null;
  prioridad: string | null;
  nota: string | null;
  creado_en: string | null;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function SubJuicios({ casoId }: { casoId: string }) {
  const [items, setItems] = useState<SubJuicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [agregar, setAgregar] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<SubJuicio | null>(null);

  const cargar = () => {
    setCargando(true);
    fetch(`${SUPABASE_URL}/rest/v1/sub_juicio?select=*&caso_id=eq.${casoId}&order=creado_en.desc`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setItems(d || []))
      .catch(() => setItems([]))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, [casoId]);

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar este sub-juicio? Se quita de la lista.")) return;
    setBorrando(id);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sub_juicio?id=eq.${id}`, { method: "DELETE", headers });
      if (r.ok) setItems((p) => p.filter((x) => x.id !== id));
    } finally { setBorrando(null); }
  };

  return (
    <div className="space-y-3">
      {abierto ? (
        <SubJuicioFicha sub={abierto} onVolver={() => { setAbierto(null); cargar(); }} />
      ) : (
      <>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>
          <GitBranch className="h-4 w-4" style={{ color: TEAL }} /> Sub-juicios ({items.length})
        </p>
        <button onClick={() => setAgregar(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: TEAL }}>
          <Plus className="h-3.5 w-3.5" /> Agregar sub-juicio
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Los juicios internos ligados a esta misma garantía (amparos, prescripción, jurisdicción voluntaria, familiar, laboral, hipotecario, recursos…). Cada uno con su propio expediente y juzgado.
      </p>

      {cargando ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Todavía no hay sub-juicios. Usa <b>“Agregar sub-juicio”</b> para registrar el primero.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.tipo && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: NAVY }}>{s.tipo}</span>}
                    <span className="text-sm font-semibold text-[color:var(--teal)]">{s.expediente || "— sin expediente —"}</span>
                    {s.prioridad && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Prioridad {s.prioridad}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.juzgado || "—"}{s.entidad ? ` · ${s.entidad}` : ""}</p>
                  {(s.actor || s.demandado) && <p className="truncate text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{s.actor || "—"}</span> vs. <span className="font-medium text-foreground">{s.demandado || "—"}</span></p>}
                  {s.etapa && <p className="text-[11px] text-muted-foreground">Etapa: {s.etapa}</p>}
                  {s.nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{s.nota}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => setAbierto(s)} title="Abrir sub-juicio" className="rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}>Abrir</button>
                  <button onClick={() => borrar(s.id)} disabled={borrando === s.id} title="Borrar sub-juicio" className="rounded-md border border-input p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                    {borrando === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {agregar && <AltaSubJuicioModal casoId={casoId} onClose={() => setAgregar(false)} onGuardado={() => { setAgregar(false); cargar(); }} />}
      </>
      )}
    </div>
  );
}

// ---- Modal: alta de un sub-juicio ----
function AltaSubJuicioModal({ casoId, onClose, onGuardado }: { casoId: string; onClose: () => void; onGuardado: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({ tipo: "Amparo", tipoOtro: "", expediente: "", juzgado: "", entidad: "", actor: "", demandado: "", etapa: "", estatus: "", prioridad: "", nota: "" });
  const [verBoletin, setVerBoletin] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = async () => {
    const tipoFinal = form.tipo === "Otro" ? form.tipoOtro.trim() : form.tipo;
    if (!tipoFinal) { setError("Elige o escribe el tipo de sub-juicio."); return; }
    if (!form.expediente.trim()) { setError("Escribe el número de expediente."); return; }
    setGuardando(true); setError(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sub_juicio`, {
        method: "POST", headers: wHeaders,
        body: JSON.stringify({
          caso_id: casoId, tipo: tipoFinal,
          expediente: form.expediente.trim() || null, juzgado: form.juzgado.trim() || null,
          entidad: form.entidad.trim() || null, actor: form.actor.trim() || null,
          demandado: form.demandado.trim() || null, etapa: form.etapa.trim() || null,
          estatus: form.estatus.trim() || null, prioridad: form.prioridad.trim() || null,
          nota: form.nota.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      onGuardado();
    } catch (e: any) {
      setError("No se pudo guardar (" + e.message + "). Revisa que la tabla sub_juicio exista.");
    } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 p-4 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
          <p className="flex items-center gap-2 text-sm font-semibold"><GitBranch className="h-4 w-4" /> Agregar sub-juicio</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-2 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Tipo de sub-juicio">
              <select className={inp} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>
            {form.tipo === "Otro" ? (
              <Campo label="Especifica el tipo"><input className={inp} value={form.tipoOtro} onChange={(e) => set("tipoOtro", e.target.value)} placeholder="Ej. Nulidad de juicio" /></Campo>
            ) : (
              <Campo label="Prioridad"><input className={inp} value={form.prioridad} onChange={(e) => set("prioridad", e.target.value)} placeholder="ALTA / MEDIA / BAJA" /></Campo>
            )}
          </div>

          <Campo label="No. de expediente"><input className={inp} value={form.expediente} onChange={(e) => set("expediente", e.target.value)} placeholder="Ej. 611/2025" /></Campo>
          <Campo label="Juzgado"><input className={inp} value={form.juzgado} onChange={(e) => set("juzgado", e.target.value)} placeholder="Ej. Juzgado 9º de Distrito" /></Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Entidad"><input className={inp} value={form.entidad} onChange={(e) => set("entidad", e.target.value)} placeholder="Sinaloa / BCS / Jalisco…" /></Campo>
            {form.tipo === "Otro" && <Campo label="Prioridad"><input className={inp} value={form.prioridad} onChange={(e) => set("prioridad", e.target.value)} placeholder="ALTA / MEDIA / BAJA" /></Campo>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Actor / promovente"><input className={inp} value={form.actor} onChange={(e) => set("actor", e.target.value)} placeholder="Quejoso / actor" /></Campo>
            <Campo label="Demandado / contraparte"><input className={inp} value={form.demandado} onChange={(e) => set("demandado", e.target.value)} placeholder="Autoridad / demandado" /></Campo>
          </div>
          <Campo label="Etapa / estatus"><input className={inp} value={form.etapa} onChange={(e) => set("etapa", e.target.value)} placeholder="Ej. Admitido, en trámite…" /></Campo>
          <Campo label="Nota"><textarea rows={2} className={inp} value={form.nota} onChange={(e) => set("nota", e.target.value)} placeholder="Observación u origen del sub-juicio" /></Campo>

          {/* Robot del boletín: mismo que el expediente principal */}
          <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2.5">
            <button type="button" onClick={() => setVerBoletin((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-xs font-semibold" style={{ color: TEAL }}>
              <Send className="h-3.5 w-3.5" /> {verBoletin ? "Ocultar buscador del boletín" : "Buscar en el boletín (jurisdicción, juzgado y expediente)"}
            </button>
            {verBoletin && (
              <div className="mt-2">
                <p className="mb-2 text-[11px] text-muted-foreground">Elige jurisdicción + juzgado, busca el expediente y dale <b>“Guardar hallazgos del boletín”</b>: se rellenan solos el expediente, el juzgado, el actor, el demandado y la etapa.</p>
                <BuscadorBoletin
                  expedienteInicial={form.expediente}
                  onGuardarHallazgos={() => {}}
                  onDatosBoletin={(d) => setForm((f) => ({
                    ...f,
                    expediente: d.expediente || f.expediente,
                    juzgado: d.juzgado || f.juzgado,
                    actor: d.actor || f.actor,
                    demandado: d.demandado || f.demandado,
                    etapa: d.etapa || f.etapa,
                  }))}
                />
              </div>
            )}
          </div>

          {error && <p className="flex items-center gap-1 text-[11px] text-red-600"><AlertTriangle className="h-3 w-3" /> {error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-3">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />} Guardar sub-juicio
          </button>
        </div>
      </div>
    </div>
  );
}

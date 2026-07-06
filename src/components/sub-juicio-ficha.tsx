// JusticiaFácil · Mini-ficha de un SUB-JUICIO (juicio dentro del juicio)
// Vista propia con sus pestañas: Datos (editable + robotsito) · Documentos
// (carpeta propia) · Boletín (búsqueda en vivo con su expediente/juzgado).
import { useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { DocumentosGarantia } from "@/components/documentos-garantia";
import { ArrowLeft, LayoutGrid, FolderOpen, Megaphone, Send, PenLine, Loader2, Lock } from "lucide-react";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";

type Tab = "datos" | "documentos" | "boletin";

// Tipo local (evita ciclos de import); refleja las columnas de sub_juicio
export interface SubJuicioRow {
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

export function SubJuicioFicha({ sub, onVolver }: { sub: SubJuicioRow; onVolver: () => void }) {
  const [tab, setTab] = useState<Tab>("datos");
  const [edit, setEdit] = useState(false);
  const [verBoletin, setVerBoletin] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<SubJuicioRow>(sub);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const abrirEdicion = () => {
    setForm({
      tipo: row.tipo || "", expediente: row.expediente || "", juzgado: row.juzgado || "",
      entidad: row.entidad || "", actor: row.actor || "", demandado: row.demandado || "",
      etapa: row.etapa || "", prioridad: row.prioridad || "", nota: row.nota || "",
    });
    setError(null); setVerBoletin(false); setEdit(true);
  };

  const guardar = async () => {
    setGuardando(true); setError(null);
    try {
      const campos = {
        tipo: form.tipo.trim() || null, expediente: form.expediente.trim() || null,
        juzgado: form.juzgado.trim() || null, entidad: form.entidad.trim() || null,
        actor: form.actor.trim() || null, demandado: form.demandado.trim() || null,
        etapa: form.etapa.trim() || null, prioridad: form.prioridad.trim() || null,
        nota: form.nota.trim() || null,
      };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/sub_juicio?id=eq.${row.id}`, { method: "PATCH", headers: wHeaders, body: JSON.stringify(campos) });
      if (!r.ok) throw new Error(String(r.status));
      setRow({ ...row, ...campos });
      setEdit(false);
    } catch (e: any) {
      setError("No se pudo guardar (" + e.message + ").");
    } finally { setGuardando(false); }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "datos", label: "Datos", icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "documentos", label: "Documentos", icon: <FolderOpen className="h-4 w-4" /> },
    { id: "boletin", label: "Boletín", icon: <Megaphone className="h-4 w-4" /> },
  ];

  const Fila = ({ label, valor }: { label: string; valor?: string | null }) => (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{valor && valor.trim() ? valor : "—"}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a los sub-juicios
      </button>

      {/* Encabezado del sub-juicio */}
      <div className="rounded-xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
        <div className="flex flex-wrap items-center gap-2">
          {row.tipo && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">{row.tipo}</span>}
          {row.prioridad && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">Prioridad {row.prioridad}</span>}
        </div>
        <h2 className="mt-1 text-xl font-bold">{row.expediente || "— sin expediente —"}</h2>
        <p className="mt-0.5 text-sm text-white/85">{(row.actor || "—")} <span className="text-white/50">vs</span> {(row.demandado || "—")}</p>
        <p className="mt-1 text-xs text-white/70">{row.juzgado || "Juzgado sin asignar"}{row.entidad ? ` · ${row.entidad}` : ""}</p>
      </div>

      {/* Pestañas del sub-juicio */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === t.id ? "text-white" : "text-muted-foreground hover:bg-muted"}`} style={tab === t.id ? { background: TEAL } : undefined}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ---- DATOS ---- */}
      {tab === "datos" && (
        <div className="rounded-xl border border-border bg-card p-4">
          {!edit ? (
            <>
              <div className="mb-2 flex justify-end">
                <button onClick={abrirEdicion} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}>
                  <PenLine className="h-3 w-3" /> Editar / validar
                </button>
              </div>
              <Fila label="Tipo" valor={row.tipo} />
              <Fila label="No. de expediente" valor={row.expediente} />
              <Fila label="Juzgado" valor={row.juzgado} />
              <Fila label="Entidad" valor={row.entidad} />
              <Fila label="Actor / promovente" valor={row.actor} />
              <Fila label="Demandado / contraparte" valor={row.demandado} />
              <Fila label="Etapa / estatus" valor={row.etapa} />
              <Fila label="Prioridad" valor={row.prioridad} />
              <Fila label="Nota" valor={row.nota} />
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Tipo"><input className={inp} value={form.tipo} onChange={(e) => set("tipo", e.target.value)} /></Campo>
                <Campo label="Prioridad"><input className={inp} value={form.prioridad} onChange={(e) => set("prioridad", e.target.value)} placeholder="ALTA / MEDIA / BAJA" /></Campo>
              </div>
              <Campo label="No. de expediente"><input className={inp} value={form.expediente} onChange={(e) => set("expediente", e.target.value)} /></Campo>
              <Campo label="Juzgado"><input className={inp} value={form.juzgado} onChange={(e) => set("juzgado", e.target.value)} /></Campo>
              <Campo label="Entidad"><input className={inp} value={form.entidad} onChange={(e) => set("entidad", e.target.value)} placeholder="Sinaloa / BCS / Jalisco…" /></Campo>
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Actor / promovente"><input className={inp} value={form.actor} onChange={(e) => set("actor", e.target.value)} /></Campo>
                <Campo label="Demandado / contraparte"><input className={inp} value={form.demandado} onChange={(e) => set("demandado", e.target.value)} /></Campo>
              </div>
              <Campo label="Etapa / estatus"><input className={inp} value={form.etapa} onChange={(e) => set("etapa", e.target.value)} /></Campo>
              <Campo label="Nota"><textarea rows={2} className={inp} value={form.nota} onChange={(e) => set("nota", e.target.value)} /></Campo>

              {/* Robotsito del boletín para rellenar */}
              <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2.5">
                <button type="button" onClick={() => setVerBoletin((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-xs font-semibold" style={{ color: TEAL }}>
                  <Send className="h-3.5 w-3.5" /> {verBoletin ? "Ocultar buscador del boletín" : "Buscar en el boletín (rellena solo)"}
                </button>
                {verBoletin && (
                  <div className="mt-2">
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

              {error && <p className="text-[11px] text-red-600">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: TEAL }}>{guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar</button>
                <button onClick={() => setEdit(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- DOCUMENTOS (propios del sub-juicio: carpeta y lista aparte) ---- */}
      {tab === "documentos" && (
        row.expediente ? (
          <DocumentosGarantia
            area="UCM"
            caso={{
              // Caso sintético: da al sub-juicio su PROPIA carpeta de Drive (SUB-{id})
              // y su propia lista de documentos (por expediente), aparte del principal.
              id: undefined,
              gar_id: `SUB-${row.id}`,
              expediente: row.expediente,
              juzgado: row.juzgado,
              nombre_juzgado: null,
              entidad: row.entidad,
              actor: row.actor,
              demandado: row.demandado,
              tipo_registro: "juicio",
            } as unknown as CasoJuridico}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground"><FolderOpen className="h-4 w-4" /> Documentos del sub-juicio <Lock className="h-3.5 w-3.5" /></p>
            <p className="mt-1 text-xs text-muted-foreground">Primero ponle un número de expediente en la pestaña <b>Datos</b>; con eso se crea su carpeta propia.</p>
          </div>
        )
      )}

      {/* ---- BOLETÍN (en vivo) ---- */}
      {tab === "boletin" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs text-muted-foreground">Consulta el boletín en vivo con el expediente y juzgado de este sub-juicio.</p>
          <BuscadorBoletin expedienteInicial={row.expediente || ""} />
        </div>
      )}
    </div>
  );
}

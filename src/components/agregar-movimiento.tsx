import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Check, Gavel, Camera, ClipboardList, File as FileIcon, Upload, Paperclip } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { guardarMovimiento, type DatosMovimiento, type DocumentoGarantia } from "@/lib/drive";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";

const hoy = () => new Date().toISOString().slice(0, 10);

const TIPOS = [
  { v: "actuacion", t: "Actuación", icon: Gavel, desc: "Algo que pasó en el juicio" },
  { v: "evidencia", t: "Evidencia", icon: Camera, desc: "Foto o prueba de respaldo" },
  { v: "tarea", t: "Tarea", icon: ClipboardList, desc: "Algo por hacer" },
  { v: "otro", t: "Documento", icon: FileIcon, desc: "Solo guardar el archivo" },
];

interface Colab { id: string; nombre: string; rol: string | null; correo: string | null; }

export function AgregarMovimientoModal({ area, caso, onClose, onCreado }: {
  area: string; caso: CasoJuridico; onClose: () => void; onCreado: (doc: DocumentoGarantia) => void;
}) {
  const [tipo, setTipo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [colabs, setColabs] = useState<Colab[]>([]);

  const [fecha, setFecha] = useState(hoy());
  const [nota, setNota] = useState("");
  const [proxima, setProxima] = useState("");
  const [fechaProxima, setFechaProxima] = useState("");
  const [asignado, setAsignado] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=id,nombre,rol,correo&activo=eq.true&order=nombre`, { headers: wHeaders })
      .then((r) => (r.ok ? r.json() : [])).then(setColabs).catch(() => {});
  }, []);

  const tdef = useMemo(() => TIPOS.find((t) => t.v === tipo), [tipo]);

  const guardar = async () => {
    if (!tipo) return;
    setGuardando(true); setError(null);
    const datos: DatosMovimiento = {
      tipo,
      fecha_mov: fecha || null,
      nota: nota.trim() || null,
      proxima_actuacion: tipo === "actuacion" ? (proxima.trim() || null) : null,
      fecha_proxima: tipo === "actuacion" ? (fechaProxima || null) : null,
      asignado_a: tipo === "tarea" ? (asignado.trim() || null) : null,
      fecha_limite: tipo === "tarea" ? (fechaLimite || null) : null,
    };
    const r = await guardarMovimiento(area, caso, datos, file);
    setGuardando(false);
    if (!r.ok) { setError(r.error || "No se pudo guardar."); return; }
    if (r.doc) onCreado(r.doc);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><Upload className="h-4 w-4" /> Agregar a la garantía</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className={lbl}>Archivo (opcional)</label>
            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><Paperclip className="h-4 w-4 shrink-0 text-[color:var(--teal)]" /> <span className="truncate">{file.name}</span></span>
                <button onClick={() => setFile(null)} className="shrink-0 text-xs text-red-600">Quitar</button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="h-4 w-4" /> Elegir archivo…
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          <div>
            <label className={lbl}>¿Qué es esto?</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => {
                const Icono = t.icon;
                const activo = tipo === t.v;
                return (
                  <button key={t.v} onClick={() => setTipo(t.v)}
                    className={`flex items-start gap-2 rounded-md border p-2.5 text-left ${activo ? "border-2 border-[color:var(--teal)] bg-[color:var(--teal)]/5" : "border-input"}`}>
                    <Icono className="mt-0.5 h-4 w-4 shrink-0" style={{ color: activo ? TEAL : "#5F5E5A" }} />
                    <span>
                      <span className="block text-sm font-medium">{t.t}</span>
                      <span className="block text-[11px] text-muted-foreground">{t.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {tipo && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="text-xs font-medium" style={{ color: TEAL }}>Datos de la {tdef?.t.toLowerCase()}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={lbl}>Fecha</label>
                  <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                {tipo === "tarea" && (
                  <div>
                    <label className={lbl}>Fecha límite (opcional)</label>
                    <input type="date" className={inp} value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
                  </div>
                )}
                {tipo === "actuacion" && (
                  <div>
                    <label className={lbl}>Fecha de lo que sigue (opcional)</label>
                    <input type="date" className={inp} value={fechaProxima} onChange={(e) => setFechaProxima(e.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <label className={lbl}>{tipo === "tarea" ? "¿Qué hay que hacer?" : "Nota / qué pasó"}{tipo === "otro" ? " (opcional)" : ""}</label>
                <textarea className={inp} rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={tipo === "tarea" ? "ej. Revisar el convenio y responder" : "ej. Se señaló fecha de remate"} />
              </div>

              {tipo === "actuacion" && (
                <div>
                  <label className={lbl}>Próxima actuación (opcional)</label>
                  <input className={inp} value={proxima} onChange={(e) => setProxima(e.target.value)} placeholder="ej. Audiencia de remate" />
                </div>
              )}

              {tipo === "tarea" && (
                <div>
                  <label className={lbl}>Asignar a (opcional)</label>
                  <select className={inp} value={asignado} onChange={(e) => setAsignado(e.target.value)}>
                    <option value="">— sin asignar —</option>
                    {colabs.map((c) => <option key={c.id} value={`${c.rol || ""}${c.rol ? " · " : ""}${c.nombre}`}>{c.nombre}{c.rol ? ` (${c.rol})` : ""}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={!tipo || guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: TEAL }}>
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : <><Check className="h-4 w-4" /> Guardar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

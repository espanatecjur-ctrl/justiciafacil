// ============================================================
// PanelSeguimiento · cuadro de abajo de la ficha (común a los módulos)
// ------------------------------------------------------------
// TAREAS editables que se asignan a un colaborador (correo + rol)
// y se marcan pendiente → hecha. El botón "Agregar" (banner elevado)
// crea tareas y también evidencias. Las evidencias y las actuaciones
// del boletín se MUESTRAN en el panel de Antecedentes (solo lectura),
// no aquí, para no duplicar. Parte 2: widget "Mis tareas" del Inicio.
// Acepta `caso` completo o solo `expediente` (reusable en cualquier módulo).
// ============================================================
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { getAuth } from "@/lib/auth";
import { ClipboardList, Plus, Paperclip, Loader2, X, CheckSquare, Square, User } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export interface Tarea {
  id: string; caso_id: string | null; expediente: string | null;
  tipo: string; titulo: string; descripcion: string | null;
  responsable_correo: string | null; responsable_nombre: string | null; responsable_rol: string | null;
  fecha_limite: string | null; estado: string; evidencia_url: string | null;
  creado_por: string | null; created_at: string;
}
interface Colaborador { id: string; nombre: string; rol: string | null; correo: string | null; }

const fmt = (f?: string | null) => {
  if (!f) return "—";
  const d = new Date(String(f).slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

export function PanelSeguimiento({ caso, expediente }: { caso?: CasoJuridico; expediente?: string }) {
  const exp = (expediente ?? caso?.expediente ?? "").trim();
  const casoId = (caso as any)?.id ?? null;
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [colabs, setColabs] = useState<Colaborador[]>([]);
  const [agregar, setAgregar] = useState(false);
  const [correoYo, setCorreoYo] = useState<string | null>(null);

  const cargarTareas = () => {
    if (!exp) { setTareas([]); return; }
    sbSelect<Tarea>("tarea", `select=*&expediente=eq.${encodeURIComponent(exp)}&order=estado.desc,created_at.desc`).then(setTareas).catch(() => setTareas([]));
  };
  useEffect(() => {
    cargarTareas();
    sbSelect<Colaborador>("colaboradores", "select=id,nombre,rol,correo&activo=eq.true&order=nombre").then(setColabs).catch(() => setColabs([]));
    (async () => { try { const a = await getAuth(); const { data } = await a.auth.getSession(); setCorreoYo(data.session?.user?.email ?? null); } catch { /* sin sesión */ } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp]);

  const pendientes = tareas.filter((t) => t.estado !== "hecha" && t.tipo !== "evidencia").length;
  const soloTareas = tareas.filter((t) => t.tipo !== "evidencia");

  const toggle = async (t: Tarea) => {
    const nuevo = t.estado === "hecha" ? "pendiente" : "hecha";
    setTareas((p) => p.map((x) => (x.id === t.id ? { ...x, estado: nuevo } : x)));
    await fetch(`${SUPABASE_URL}/rest/v1/tarea?id=eq.${t.id}`, { method: "PATCH", headers, body: JSON.stringify({ estado: nuevo, updated_at: new Date().toISOString() }) }).catch(() => {});
  };

  return (
    <div className="mt-6 border-t-2 border-dashed border-border pt-4">
      {/* banner ELEVADO de agregar */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border-2 border-[color:var(--teal)]/40 bg-card p-3 shadow-md">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--teal)]"><ClipboardList className="h-4 w-4" /> Seguimiento · tareas</span>
        {pendientes > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{pendientes} pendiente{pendientes === 1 ? "" : "s"}</span>}
        <button onClick={() => setAgregar(true)} className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "#0C5C46" }}><Plus className="h-4 w-4" /> Agregar</button>
      </div>

      {/* tareas */}
      <div className="space-y-2">
        {soloTareas.length === 0 && <p className="text-xs text-muted-foreground">Sin tareas todavía. Agrega la primera (ej. "Visita al juzgado a revisar expediente").</p>}
        {soloTareas.map((t) => {
          const hecha = t.estado === "hecha";
          const esEvid = t.tipo === "evidencia";
          return (
            <div key={t.id} className={`rounded-lg border p-2.5 ${hecha ? "border-border bg-muted/30" : esEvid ? "border-border bg-background" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-start gap-2">
                {esEvid ? <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  : <button onClick={() => toggle(t)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-[color:var(--teal)]" title={hecha ? "Marcar pendiente" : "Marcar hecha"}>
                      {hecha ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4" />}
                    </button>}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${hecha ? "text-muted-foreground line-through" : ""}`}>{t.titulo}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.responsable_nombre ? <><User className="mr-0.5 inline h-3 w-3" />{t.responsable_nombre}{t.responsable_rol ? <span className="text-[color:var(--teal)]"> · {t.responsable_rol}</span> : null}</> : "Sin responsable"}
                    {t.fecha_limite && !esEvid ? ` · vence ${fmt(t.fecha_limite)}` : ""}
                  </p>
                  {esEvid && t.evidencia_url && <a href={t.evidencia_url} target="_blank" rel="noreferrer" className="text-[11px] text-[color:var(--teal)] hover:underline">ver evidencia</a>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${esEvid ? "bg-muted text-muted-foreground" : hecha ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{esEvid ? "evidencia" : hecha ? "hecha" : "tarea"}</span>
              </div>
            </div>
          );
        })}
      </div>

      {agregar && <AgregarModal casoId={casoId} exp={exp} colabs={colabs} creadoPor={correoYo} onClose={() => setAgregar(false)} onGuardado={() => { setAgregar(false); cargarTareas(); }} />}
    </div>
  );
}

function AgregarModal({ casoId, exp, colabs, creadoPor, onClose, onGuardado }: { casoId: string | null; exp: string; colabs: Colaborador[]; creadoPor: string | null; onClose: () => void; onGuardado: () => void }) {
  const [tipo, setTipo] = useState<"tarea" | "evidencia">("tarea");
  const [titulo, setTitulo] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fecha, setFecha] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!titulo.trim()) { setError("Escribe el título."); return; }
    setGuardando(true); setError(null);
    try {
      let evidencia_url: string | null = null;
      if (tipo === "evidencia" && archivo) {
        const path = `${exp || "sin-exp"}/${Date.now()}-${archivo.name}`.replace(/[^\w./-]/g, "_");
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/evidencias/${path}`, {
          method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, body: archivo,
        });
        if (!up.ok) throw new Error("No se pudo subir el archivo (¿existe el bucket 'evidencias' en Storage?).");
        evidencia_url = `${SUPABASE_URL}/storage/v1/object/public/evidencias/${path}`;
      }
      const c = colabs.find((x) => x.id === responsableId);
      const body = {
        caso_id: casoId, expediente: exp || null,
        tipo, titulo: titulo.trim(),
        responsable_correo: c?.correo || null, responsable_nombre: c?.nombre || null, responsable_rol: c?.rol || null,
        fecha_limite: tipo === "tarea" && fecha ? fecha : null,
        estado: "pendiente", evidencia_url, creado_por: creadoPor || null,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tarea`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onGuardado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="font-semibold">Agregar al expediente{exp ? ` · ${exp}` : ""}</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          {error && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
          <div className="flex gap-2">
            {(["tarea", "evidencia"] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)} className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize ${tipo === t ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>{t}</button>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título</label>
            <input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "tarea" ? "Ej. Visita al juzgado a revisar expediente" : "Ej. Foto del expediente"} />
          </div>
          {tipo === "tarea" && (<>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Responsable</label>
              <select className={inp} value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
                <option value="">— Elegir colaborador —</option>
                {colabs.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.rol ? ` · ${c.rol}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Fecha límite (opcional)</label>
              <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </>)}
          {tipo === "evidencia" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Archivo (opcional)</label>
              <input type="file" className={inp} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MisTareas · widget de Inicio (Parte 2)
// Muestra las tareas PENDIENTES asignadas al colaborador con la sesión
// abierta (match por su correo). Permite marcarlas como hechas.
// ============================================================
export function MisTareas() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [correo, setCorreo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const a = await getAuth();
        const { data } = await a.auth.getSession();
        const email = data.session?.user?.email ?? null;
        setCorreo(email);
        if (email) {
          const t = await sbSelect<Tarea>("tarea", `select=*&responsable_correo=eq.${encodeURIComponent(email)}&estado=neq.hecha&tipo=eq.tarea&order=fecha_limite.asc.nullslast,created_at.desc`);
          setTareas(t || []);
        }
      } catch { /* sin sesión */ } finally { setCargando(false); }
    })();
  }, []);

  const marcarHecha = async (t: Tarea) => {
    setTareas((p) => p.filter((x) => x.id !== t.id));
    await fetch(`${SUPABASE_URL}/rest/v1/tarea?id=eq.${t.id}`, { method: "PATCH", headers, body: JSON.stringify({ estado: "hecha", updated_at: new Date().toISOString() }) }).catch(() => {});
  };

  const diasPara = (f?: string | null) => {
    if (!f) return null;
    const d = new Date(String(f).slice(0, 10) + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    return Math.floor((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  };

  return (
    <Card className="legal-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[color:var(--teal)]" />
        <h3 className="font-display text-base font-semibold">Mis tareas</h3>
        {tareas.length > 0 && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{tareas.length}</span>}
      </div>
      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !correo ? (
        <p className="text-sm text-muted-foreground">Inicia sesión para ver tus tareas.</p>
      ) : tareas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes tareas pendientes. 🎉</p>
      ) : (
        <div className="divide-y divide-border">
          {tareas.map((t) => {
            const dias = diasPara(t.fecha_limite);
            const vencida = dias !== null && dias < 0;
            const hoy = dias === 0;
            return (
              <div key={t.id} className="flex items-start gap-2.5 py-2.5">
                <button onClick={() => marcarHecha(t)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-600" title="Marcar hecha"><Square className="h-4 w-4" /></button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.expediente ? `Exp. ${t.expediente}` : "Sin expediente"}
                    {t.fecha_limite ? ` · ${vencida ? "venció" : hoy ? "vence hoy" : "vence"} ${fmt(t.fecha_limite)}` : ""}
                  </p>
                </div>
                {(vencida || hoy) && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${vencida ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{vencida ? "vencida" : "hoy"}</span>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

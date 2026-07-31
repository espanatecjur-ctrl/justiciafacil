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
import { BotonVerDoc } from "@/components/visor-documento";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { getAuth } from "@/lib/auth";
import { ClipboardList, Plus, Paperclip, Loader2, X, CheckSquare, Square, User, Scale, Gavel } from "lucide-react";
import { recomendacionParaEtapa } from "@/lib/recomendaciones-juridicas";
import { crearSolicitudEscrito, DECISIONES_RECURSO } from "@/lib/solicitud-escrito";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export interface Tarea {
  id: string; caso_id: string | null; expediente: string | null;
  tipo: string; titulo: string; descripcion: string | null;
  responsable_correo: string | null; responsable_nombre: string | null; responsable_rol: string | null;
  fecha_limite: string | null; estado: string; evidencia_url: string | null;
  creado_por: string | null; created_at: string;
  etapa?: string | null; orden_etapa?: number | null;
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
  const [solicitarPara, setSolicitarPara] = useState<string | null>(null);

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

  // Agrupa por etapa (procesal/jurídica) conservando el orden con orden_etapa.
  // Las tareas sin etapa asignada (tareas sueltas de siempre) van al final, sin encabezado.
  // Si una etapa no trae orden_etapa (se escribió libre desde "Agregar"), se ordena
  // por la fecha de creación de su primera tarea, para que quede cronológico igual.
  const gruposEtapa = (() => {
    const mapa = new Map<string, { etapa: string; orden: number; items: Tarea[] }>();
    for (const t of soloTareas) {
      const clave = t.etapa || "__sin_etapa__";
      if (!mapa.has(clave)) mapa.set(clave, { etapa: clave, orden: t.orden_etapa ?? new Date(t.created_at).getTime(), items: [] });
      const grp = mapa.get(clave)!;
      grp.items.push(t);
      if (t.orden_etapa != null && (grp.orden > t.orden_etapa || grp.orden > 1e12)) grp.orden = t.orden_etapa;
    }
    return Array.from(mapa.values())
      .sort((a, b) => (a.etapa === "__sin_etapa__" ? 1 : b.etapa === "__sin_etapa__" ? -1 : a.orden - b.orden))
      .map((g) => {
        const estadoEtapa = g.items.every((i) => i.estado === "hecha") ? "hecha"
          : g.items.some((i) => i.estado === "en_proceso") ? "en_proceso"
          : "pendiente";
        return { ...g, estadoEtapa };
      });
  })();


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

      {/* tareas agrupadas por etapa (si tienen etapa asignada) */}
      <div className="space-y-4">
        {soloTareas.length === 0 && <p className="text-xs text-muted-foreground">Sin tareas todavía. Agrega la primera (ej. "Visita al juzgado a revisar expediente").</p>}
        {gruposEtapa.map((g) => (
          <div key={g.etapa}>
            {g.etapa !== "__sin_etapa__" && (
              <div className="mb-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: "#0C5C46" }}>{g.etapa}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    g.estadoEtapa === "hecha" ? "bg-emerald-100 text-emerald-800"
                    : g.estadoEtapa === "en_proceso" ? "bg-sky-100 text-sky-800"
                    : "bg-amber-100 text-amber-800"
                  }`}>
                    {g.estadoEtapa === "hecha" ? "✓ completada" : g.estadoEtapa === "en_proceso" ? "en curso" : "pendiente"}
                  </span>
                  {g.estadoEtapa !== "hecha" && (
                    <button onClick={() => setSolicitarPara(g.etapa)} className="ml-auto flex items-center gap-1 rounded-md border border-[color:var(--teal)]/40 px-2 py-1 text-[11px] font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
                      <Gavel className="h-3 w-3" /> Solicitar escrito
                    </button>
                  )}
                </div>
                {g.estadoEtapa !== "hecha" && (() => {
                  const r = recomendacionParaEtapa(g.etapa);
                  return (
                    <div className="mt-1.5 rounded-md border border-dashed border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2 text-[11px] text-muted-foreground">
                      <p className="flex items-center gap-1 font-medium text-[color:var(--teal)]"><Scale className="h-3 w-3" /> Recomendación jurídica (validar con DIL)</p>
                      <p className="mt-0.5">{r.recomendacion}</p>
                      <p className="mt-0.5 italic">Base legal de referencia: {r.baseLegal}</p>
                      {r.accionesGenerales.length > 0 && (
                        <p className="mt-1">Acciones sugeridas: {r.accionesGenerales.join(" · ")}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="space-y-2">
              {g.items.map((t) => {
                const hecha = t.estado === "hecha";
                const enProceso = t.estado === "en_proceso";
                const esEvid = t.tipo === "evidencia";
                return (
                  <div key={t.id} className={`rounded-lg border p-2.5 ${hecha ? "border-border bg-muted/30" : esEvid ? "border-border bg-background" : enProceso ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-start gap-2">
                      {esEvid ? <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        : <button onClick={() => toggle(t)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-[color:var(--teal)]" title={hecha ? "Marcar pendiente" : "Marcar hecha"}>
                            {hecha ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4" />}
                          </button>}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${hecha ? "text-muted-foreground line-through" : ""}`}>{t.titulo}</p>
                        {t.descripcion && <p className="mt-0.5 text-xs text-muted-foreground">{t.descripcion}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t.responsable_nombre ? <><User className="mr-0.5 inline h-3 w-3" />{t.responsable_nombre}{t.responsable_rol ? <span className="text-[color:var(--teal)]"> · {t.responsable_rol}</span> : null}</> : t.responsable_rol ? <span className="text-[color:var(--teal)]"><User className="mr-0.5 inline h-3 w-3" />{t.responsable_rol}</span> : "Sin responsable"}
                          {t.fecha_limite && !esEvid ? ` · vence ${fmt(t.fecha_limite)}` : ""}
                        </p>
                        {esEvid && t.evidencia_url && <BotonVerDoc url={t.evidencia_url} nombre="Evidencia" label="ver evidencia" className="text-[11px] text-[color:var(--teal)] hover:underline inline-flex items-center gap-1" />}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${esEvid ? "bg-muted text-muted-foreground" : hecha ? "bg-emerald-100 text-emerald-800" : enProceso ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>{esEvid ? "evidencia" : hecha ? "hecha" : enProceso ? "en curso" : "tarea"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {agregar && <AgregarModal casoId={casoId} exp={exp} colabs={colabs} creadoPor={correoYo} etapasExistentes={Array.from(new Set(tareas.map((t) => t.etapa).filter(Boolean) as string[]))} onClose={() => setAgregar(false)} onGuardado={() => { setAgregar(false); cargarTareas(); }} />}
      {solicitarPara && (
        <SolicitarEscritoModal
          casoId={casoId}
          exp={exp}
          garantiaId={(caso as any)?.gar_id || (caso as any)?.no_credito || null}
          etapa={solicitarPara}
          actor={(caso as any)?.actor}
          demandado={(caso as any)?.demandado}
          creadoPor={correoYo}
          onClose={() => setSolicitarPara(null)}
          onGuardado={() => setSolicitarPara(null)}
        />
      )}
    </div>
  );
}

function AgregarModal({ casoId, exp, colabs, creadoPor, etapasExistentes = [], onClose, onGuardado }: { casoId: string | null; exp: string; colabs: Colaborador[]; creadoPor: string | null; etapasExistentes?: string[]; onClose: () => void; onGuardado: () => void }) {
  const [tipo, setTipo] = useState<"tarea" | "evidencia">("tarea");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [etapa, setEtapa] = useState("");
  const [estadoInicial, setEstadoInicial] = useState<"pendiente" | "en_proceso" | "hecha">("pendiente");
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
        tipo, titulo: titulo.trim(), descripcion: descripcion.trim() || null,
        etapa: tipo === "tarea" && etapa.trim() ? etapa.trim() : null,
        responsable_correo: c?.correo || null, responsable_nombre: c?.nombre || null, responsable_rol: c?.rol || null,
        fecha_limite: tipo === "tarea" && fecha ? fecha : null,
        estado: tipo === "tarea" ? estadoInicial : "pendiente", evidencia_url, creado_por: creadoPor || null,
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nota / de dónde sale (opcional)</label>
              <textarea className={inp} rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Confirmado en boletín del 12/jul. Ver documento X." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Etapa (opcional — agrupa esta tarea con otras de la misma etapa)</label>
              <input className={inp} list="etapas-sugeridas" value={etapa} onChange={(e) => setEtapa(e.target.value)} placeholder="Ej. 4. Caducidad — en validación" />
              <datalist id="etapas-sugeridas">
                {etapasExistentes.map((e) => <option key={e} value={e} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Estado inicial</label>
              <select className={inp} value={estadoInicial} onChange={(e) => setEstadoInicial(e.target.value as any)}>
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En curso</option>
                <option value="hecha">Ya se hizo (registrar como hecha)</option>
              </select>
            </div>
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
// SolicitarEscritoModal · pide un escrito para la etapa actual
// ------------------------------------------------------------
// Si "quien_elabora" es zona: nace en estado "solicitado" y cae en
// Escritos ▸ Solicitudes para que alguien lo tome y lo redacte.
// Si es DIL y ya lo trae elaborado: nace en "validado_dil" directo,
// listo para presentarse (se salta la cola).
// ============================================================
const TIPOS_ESCRITO = [
  { value: "promocion", label: "Promoción / escrito simple" },
  { value: "contestacion", label: "Contestación de demanda" },
  { value: "demanda_mercantil", label: "Demanda — Ordinario Mercantil" },
  { value: "demanda_civil", label: "Demanda — Ordinario Civil" },
  { value: "recurso_apelacion", label: "Recurso de apelación" },
  { value: "amparo_indirecto", label: "Amparo indirecto" },
  { value: "amparo_directo", label: "Amparo directo" },
  { value: "otro", label: "Otro" },
];

function SolicitarEscritoModal({ casoId, exp, garantiaId, etapa, actor, demandado, creadoPor, onClose, onGuardado }: {
  casoId: string | null; exp: string; garantiaId?: string | null; etapa: string;
  actor?: string; demandado?: string; creadoPor: string | null;
  onClose: () => void; onGuardado: () => void;
}) {
  const rec = recomendacionParaEtapa(etapa);
  const [titulo, setTitulo] = useState(`${rec.tituloCorto} — ${exp || "expediente"}`);
  const [tipoEscrito, setTipoEscrito] = useState(rec.tipoEscritoSugerido);
  const [posicion, setPosicion] = useState("Actor");
  const [quienElabora, setQuienElabora] = useState<"zona" | "dil">("zona");
  const [notas, setNotas] = useState("");
  const [decisionRecurso, setDecisionRecurso] = useState<string>("Ninguno");
  const [decisionNotas, setDecisionNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!titulo.trim()) { setError("Escribe el título del escrito."); return; }
    setGuardando(true); setError(null);
    const ok = await crearSolicitudEscrito({
      caso_id: casoId, expediente: exp || null, garantia_id: garantiaId || null,
      etapa, posicion_procesal: posicion, tipo_escrito: tipoEscrito, titulo: titulo.trim(),
      recomendacion: rec.recomendacion, notas_solicitud: notas.trim() || null,
      quien_elabora: quienElabora,
      decision_recurso: decisionRecurso !== "Ninguno" ? decisionRecurso : null,
      decision_notas: decisionRecurso !== "Ninguno" ? decisionNotas.trim() || null : null,
      creado_por: creadoPor || null,
    });
    setGuardando(false);
    if (!ok) { setError("No se pudo guardar la solicitud."); return; }
    onGuardado();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="flex items-center gap-1.5 font-semibold"><Gavel className="h-4 w-4" /> Solicitar escrito · {etapa}</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          {error && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
          <div className="rounded-md border border-dashed border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2 text-[11px] text-muted-foreground">
            <p className="font-medium text-[color:var(--teal)]">Recomendación de referencia</p>
            <p className="mt-0.5">{rec.recomendacion}</p>
            <p className="mt-0.5 italic">{rec.baseLegal}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título del escrito</label>
            <input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de escrito</label>
              <select className={inp} value={tipoEscrito} onChange={(e) => setTipoEscrito(e.target.value)}>
                {TIPOS_ESCRITO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Posición procesal de nuestra parte</label>
              <select className={inp} value={posicion} onChange={(e) => setPosicion(e.target.value)}>
                <option>Actor</option>
                <option>Demandado</option>
                <option>Tercero llamado a juicio</option>
              </select>
              {(actor || demandado) && <p className="mt-0.5 text-[10px] text-muted-foreground">Actor: {actor || "—"} · Demandado: {demandado || "—"}</p>}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">¿Quién lo elabora?</label>
            <div className="flex gap-2">
              <button onClick={() => setQuienElabora("zona")} className={`flex-1 rounded-md border px-3 py-2 text-sm ${quienElabora === "zona" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>
                El de zona <span className="block text-[10px] font-normal text-muted-foreground">cae en Escritos ▸ Solicitudes</span>
              </button>
              <button onClick={() => setQuienElabora("dil")} className={`flex-1 rounded-md border px-3 py-2 text-sm ${quienElabora === "dil" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>
                El DIL (ya elaborado) <span className="block text-[10px] font-normal text-muted-foreground">pasa directo a UCM</span>
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notas para quien lo redacte (opcional)</label>
            <textarea className={inp} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Puntos que debe incluir, hechos a citar, etc." />
          </div>
          <div className="border-t border-dashed border-border pt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">¿Se acordó presentar recurso o amparo?</label>
            <select className={inp} value={decisionRecurso} onChange={(e) => setDecisionRecurso(e.target.value)}>
              {DECISIONES_RECURSO.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {decisionRecurso !== "Ninguno" && (
              <textarea className={`${inp} mt-2`} rows={2} value={decisionNotas} onChange={(e) => setDecisionNotas(e.target.value)} placeholder="Qué se acordó exactamente y por qué (referencia para el módulo de Amparos/Recursos)." />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Guardar solicitud
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

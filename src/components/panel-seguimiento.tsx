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
import { Link } from "@tanstack/react-router";
import { BotonVerDoc } from "@/components/visor-documento";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { getAuth } from "@/lib/auth";
import { ClipboardList, Plus, Paperclip, Loader2, X, CheckSquare, Square, User, Scale, Pencil, Trash2, ArchiveRestore } from "lucide-react";
import { recomendacionParaEtapa } from "@/lib/recomendaciones-juridicas";
import { crearEvento, actualizarEvento, eliminarEvento } from "@/lib/evento-agenda";
import { avisarTareaPorCorreo } from "@/lib/avisar-tarea";
import { listarColaboradoresJC, plataformaDeAreaJC } from "@/lib/tareas-jc";
import { crearNotificacion } from "@/lib/notificaciones";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

// Refleja una tarea (con fecha límite) en el Calendario (evento_agenda), para
// que aparezca ahí y desde ahí se pueda "ir a elaborar" de vuelta a la ficha.
// Si ya existía el espejo (por tarea_id) lo actualiza; si no, lo crea.
async function sincronizarEventoDeTarea(t: { id: string; titulo: string; fecha_limite: string | null; estado: string; expediente: string | null; caso_id: string | null; responsable_correo: string | null }) {
  try {
    const existentes = await sbSelect<{ id: string }>("evento_agenda", `select=id&tarea_id=eq.${t.id}&limit=1`);
    const existente = existentes?.[0] || null;

    if (!t.fecha_limite) {
      if (existente) await eliminarEvento(existente.id); // ya no tiene fecha: se quita del calendario
      return;
    }

    const estadoEvento = t.estado === "hecha" ? "hecho" : "pendiente";
    if (existente) {
      await actualizarEvento(existente.id, { titulo: t.titulo, fecha: t.fecha_limite, estado: estadoEvento, asignado_a: t.responsable_correo, expediente: t.expediente });
    } else {
      await crearEvento({
        titulo: t.titulo, tipo: "tarea", fecha: t.fecha_limite, estado: estadoEvento,
        expediente: t.expediente, asignado_a: t.responsable_correo,
        ref_caso_id: t.caso_id, ref_modulo: "ucm-ficha", tarea_id: t.id,
      });
    }
  } catch { /* si falla el espejo, no bloquea el guardado de la tarea */ }
}

export interface Tarea {
  id: string; caso_id: string | null; expediente: string | null;
  tipo: string; titulo: string; descripcion: string | null;
  responsable_correo: string | null; responsable_nombre: string | null; responsable_rol: string | null;
  fecha_limite: string | null; estado: string; evidencia_url: string | null;
  creado_por: string | null; created_at: string;
  etapa?: string | null; orden_etapa?: number | null; nota_cierre?: string | null;
}
interface Colaborador { id: string; nombre: string; rol: string | null; correo: string | null; }

const fmt = (f?: string | null) => {
  if (!f) return "—";
  const d = new Date(String(f).slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

export function PanelSeguimiento({ caso, expediente }: { caso?: CasoJuridico; expediente?: string }) {
  const exp = (expediente ?? caso?.expediente ?? "").trim();
  const casoId = (caso as any)?.id ?? null;
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [papelera, setPapelera] = useState<Tarea[]>([]);
  const [verPapelera, setVerPapelera] = useState(false);
  const [colabs, setColabs] = useState<Colaborador[]>([]);
  const [agregar, setAgregar] = useState(false);
  const [editando, setEditando] = useState<Tarea | null>(null);
  const [correoYo, setCorreoYo] = useState<string | null>(null);
  const [cerrarTarea, setCerrarTarea] = useState<Tarea | null>(null);

  const cargarTareas = () => {
    if (!exp) { setTareas([]); setPapelera([]); return; }
    sbSelect<Tarea>("tarea", `select=*&expediente=eq.${encodeURIComponent(exp)}&estado=neq.papelera&order=estado.desc,created_at.desc`).then(setTareas).catch(() => setTareas([]));
    sbSelect<Tarea>("tarea", `select=*&expediente=eq.${encodeURIComponent(exp)}&estado=eq.papelera&order=created_at.desc`).then(setPapelera).catch(() => setPapelera([]));
  };
  useEffect(() => {
    cargarTareas();
    sbSelect<Colaborador>("colaboradores", "select=id,nombre,rol,correo&activo=eq.true&order=nombre").then(setColabs).catch(() => setColabs([]));
    // Además de los colaboradores de JusticiaFácil, se agregan los de JurisConecta
    // (ej. RAC, Comercial) para poder asignarles tareas directo desde aquí.
    listarColaboradoresJC().then((jc) => {
      if (!jc.length) return;
      const extra: Colaborador[] = jc.map((c) => ({
        id: "jc:" + c.correo,
        nombre: `${c.nombre} (${plataformaDeAreaJC(c.area)})`,
        rol: c.rol || c.area || null,
        correo: c.correo,
      }));
      setColabs((prev) => {
        const yaHay = new Set(prev.map((p) => p.correo));
        return [...prev, ...extra.filter((e) => !yaHay.has(e.correo))];
      });
    }).catch(() => {});
    (async () => { try { const a = await getAuth(); const { data } = await a.auth.getSession(); setCorreoYo(data.session?.user?.email ?? null); } catch { /* sin sesión */ } })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp]);

  const mandarPapelera = async (t: Tarea) => {
    if (!confirm(`¿Mandar "${t.titulo}" a la papelera?`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/tarea?id=eq.${t.id}`, { method: "PATCH", headers, body: JSON.stringify({ estado: "papelera", updated_at: new Date().toISOString() }) }).catch(() => {});
    sincronizarEventoDeTarea({ ...t, fecha_limite: null }); // se quita del calendario mientras esté en papelera
    cargarTareas();
  };
  const restaurar = async (t: Tarea) => {
    await fetch(`${SUPABASE_URL}/rest/v1/tarea?id=eq.${t.id}`, { method: "PATCH", headers, body: JSON.stringify({ estado: "pendiente", updated_at: new Date().toISOString() }) }).catch(() => {});
    sincronizarEventoDeTarea({ ...t, estado: "pendiente" });
    cargarTareas();
  };

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
    if (t.estado !== "hecha") {
      // Marcar como hecha SIEMPRE pide la anotación de cierre — no es un clic simple.
      setCerrarTarea(t);
      return;
    }
    // Reabrir (hecha -> pendiente) sí es directo, no necesita nota.
    setTareas((p) => p.map((x) => (x.id === t.id ? { ...x, estado: "pendiente" } : x)));
    await fetch(`${SUPABASE_URL}/rest/v1/tarea?id=eq.${t.id}`, { method: "PATCH", headers, body: JSON.stringify({ estado: "pendiente", updated_at: new Date().toISOString() }) }).catch(() => {});
    sincronizarEventoDeTarea({ ...t, estado: "pendiente" });
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
                      <p className="mt-1 text-[10px]">Para solicitar el escrito de esta etapa, usa el botón "Solicitar escrito" en la Línea del tiempo del juicio (arriba).</p>
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
                        {hecha && t.nota_cierre && (
                          <p className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
                            <span className="font-medium">✓ Cierre:</span> {t.nota_cierre}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t.responsable_nombre ? <><User className="mr-0.5 inline h-3 w-3" />{t.responsable_nombre}{t.responsable_rol ? <span className="text-[color:var(--teal)]"> · {t.responsable_rol}</span> : null}</> : t.responsable_rol ? <span className="text-[color:var(--teal)]"><User className="mr-0.5 inline h-3 w-3" />{t.responsable_rol}</span> : "Sin responsable"}
                          {t.fecha_limite && !esEvid ? ` · vence ${fmt(t.fecha_limite)}` : ""}
                        </p>
                        {esEvid && t.evidencia_url && <BotonVerDoc url={t.evidencia_url} nombre="Evidencia" label="ver evidencia" className="text-[11px] text-[color:var(--teal)] hover:underline inline-flex items-center gap-1" />}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${esEvid ? "bg-muted text-muted-foreground" : hecha ? "bg-emerald-100 text-emerald-800" : enProceso ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"}`}>{esEvid ? "evidencia" : hecha ? "hecha" : enProceso ? "en curso" : "tarea"}</span>
                      {!esEvid && (
                        <div className="flex shrink-0 items-center gap-1">
                          {!hecha && (
                            <button onClick={() => setCerrarTarea(t)} className="flex items-center gap-1 rounded-md border border-[color:var(--teal)]/40 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10">
                              <ClipboardList className="h-3 w-3" /> Elaborar
                            </button>
                          )}
                          <button onClick={() => setEditando(t)} title="Editar" className="text-muted-foreground hover:text-[color:var(--teal)]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => mandarPapelera(t)} title="Mandar a papelera" className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {papelera.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setVerPapelera((v) => !v)} className="text-[11px] text-muted-foreground hover:underline">
            {verPapelera ? "Ocultar" : "Ver"} papelera ({papelera.length})
          </button>
          {verPapelera && (
            <div className="mt-2 space-y-1.5">
              {papelera.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2 text-xs">
                  <span className="text-muted-foreground line-through">{t.titulo}</span>
                  <button onClick={() => restaurar(t)} className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[color:var(--teal)] hover:underline"><ArchiveRestore className="h-3 w-3" /> Restaurar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {agregar && <AgregarModal casoId={casoId} exp={exp} colabs={colabs} creadoPor={correoYo} etapasExistentes={Array.from(new Set(tareas.map((t) => t.etapa).filter(Boolean) as string[]))} onClose={() => setAgregar(false)} onGuardado={() => { setAgregar(false); cargarTareas(); }} />}
      {editando && <AgregarModal casoId={casoId} exp={exp} colabs={colabs} creadoPor={correoYo} etapasExistentes={Array.from(new Set(tareas.map((t) => t.etapa).filter(Boolean) as string[]))} tareaEditar={editando} onClose={() => setEditando(null)} onGuardado={() => { setEditando(null); cargarTareas(); }} />}
      {cerrarTarea && (
        <ElaborarTareaModal
          tarea={cerrarTarea}
          caso={caso}
          onClose={() => setCerrarTarea(null)}
          onCerrada={(nuevoEstado, notaCierre) => {
            setTareas((p) => p.map((x) => (x.id === cerrarTarea.id ? { ...x, estado: nuevoEstado, nota_cierre: notaCierre ?? x.nota_cierre } : x)));
            sincronizarEventoDeTarea({ ...cerrarTarea, estado: nuevoEstado });
            setCerrarTarea(null);
          }}
        />
      )}
    </div>
  );
}

function AgregarModal({ casoId, exp, colabs, creadoPor, etapasExistentes = [], tareaEditar, onClose, onGuardado }: { casoId: string | null; exp: string; colabs: Colaborador[]; creadoPor: string | null; etapasExistentes?: string[]; tareaEditar?: Tarea; onClose: () => void; onGuardado: () => void }) {
  const [tipo, setTipo] = useState<"tarea" | "evidencia">(tareaEditar?.tipo === "evidencia" ? "evidencia" : "tarea");
  const [titulo, setTitulo] = useState(tareaEditar?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(tareaEditar?.descripcion ?? "");
  const [etapa, setEtapa] = useState(tareaEditar?.etapa ?? "");
  const [estadoInicial, setEstadoInicial] = useState<"pendiente" | "en_proceso" | "hecha">((tareaEditar?.estado as any) ?? "pendiente");
  const [responsableId, setResponsableId] = useState(() => colabs.find((c) => c.correo === tareaEditar?.responsable_correo)?.id ?? "");
  const [fecha, setFecha] = useState(tareaEditar?.fecha_limite ?? "");
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
      const res = tareaEditar
        ? await fetch(`${SUPABASE_URL}/rest/v1/tarea?id=eq.${tareaEditar.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }) })
        : await fetch(`${SUPABASE_URL}/rest/v1/tarea`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      if (tipo === "tarea") {
        const filas = await res.json().catch(() => []);
        const guardada = filas?.[0];
        if (guardada?.id) await sincronizarEventoDeTarea(guardada);
        if (!tareaEditar && guardada) {
          avisarTareaPorCorreo(guardada); // solo al crear, no al editar
          if (guardada.responsable_correo) {
            crearNotificacion({
              para: guardada.responsable_correo,
              texto: `Nueva tarea: "${guardada.titulo}"${guardada.expediente ? ` — ${guardada.expediente}` : ""}`,
              enlace: "/calendario",
              importante: false,
              tipo: "tarea",
            }).catch(() => {});
          }
        }
      }
      onGuardado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="font-semibold">{tareaEditar ? "Editar" : "Agregar al expediente"}{exp ? ` · ${exp}` : ""}</p>
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
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tareaEditar ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CerrarTareaModal · exige anotar qué se hizo antes de marcar hecha
// ------------------------------------------------------------
// No se puede cerrar una tarea con un clic simple: hay que decir qué
// se hizo y si queda un siguiente paso o se da por terminado.
// ============================================================
// ============================================================
// ElaborarTareaModal · aquí se trabaja la tarea de verdad
// ------------------------------------------------------------
// No se puede marcar hecha con un clic: hay que anotar qué se hizo
// y, si aplica, subir el documento que la resuelve (se liga a la
// misma etapa, así aparece también en la Línea del tiempo). "Guardar
// avance" deja la tarea en curso sin cerrarla.
// ============================================================
function ElaborarTareaModal({ tarea, caso, onClose, onCerrada }: { tarea: Tarea; caso?: CasoJuridico; onClose: () => void; onCerrada: (nuevoEstado: string, notaCierre: string | null) => void }) {
  const [comoQueda, setComoQueda] = useState<"avance" | "terminado" | "siguiente_paso">(tarea.estado === "hecha" ? "terminado" : "avance");
  const [nota, setNota] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [subidos, setSubidos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subirArchivos = async () => {
    if (archivos.length === 0 || !caso) return;
    setSubiendo(true); setError(null);
    try {
      const { subirDocumento } = await import("@/lib/drive");
      for (const f of archivos) {
        const r = await subirDocumento("UCM", caso, f, "otro");
        if (r.ok && r.doc?.id && tarea.etapa) {
          await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${r.doc.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ etapa: tarea.etapa }) });
        }
        if (r.ok) setSubidos((p) => [...p, f.name]);
        else setError(`No se pudo subir "${f.name}": ${r.error || "error desconocido"}`);
      }
      setArchivos([]);
    } finally { setSubiendo(false); }
  };

  const guardar = async () => {
    if (!nota.trim()) { setError("Escribe qué se hizo (o el avance), aunque sea breve."); return; }
    setGuardando(true); setError(null);
    const etiqueta = comoQueda === "avance" ? "Avance: " : comoQueda === "terminado" ? "Se da por terminado. " : "Siguiente paso: ";
    const notaCompleta = etiqueta + nota.trim() + (subidos.length > 0 ? ` (Se subió: ${subidos.join(", ")})` : "");
    const nuevoEstado = comoQueda === "avance" ? "en_proceso" : "hecha";
    try {
      const cambios: Record<string, unknown> = { estado: nuevoEstado, updated_at: new Date().toISOString() };
      if (nuevoEstado === "hecha") cambios.nota_cierre = notaCompleta;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/tarea?id=eq.${tarea.id}`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(cambios),
      });
      if (!r.ok) throw new Error(`Supabase ${r.status}`);
      onCerrada(nuevoEstado, nuevoEstado === "hecha" ? notaCompleta : null);
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="font-semibold">Elaborar tarea</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          {error && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
          <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">{tarea.titulo}</p>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Subir archivo (opcional{tarea.etapa ? " — se liga a esta etapa" : ""})</label>
            <input type="file" multiple className={inp} onChange={(e) => setArchivos(Array.from(e.target.files || []))} disabled={!caso} />
            {!caso && <p className="mt-1 text-[10px] text-amber-700">No se puede subir archivo desde aquí (falta el caso completo). Usa "Subir documento" en la Línea del tiempo.</p>}
            {archivos.length > 0 && (
              <button onClick={subirArchivos} disabled={subiendo} className="mt-1.5 flex items-center gap-1.5 rounded-md border border-[color:var(--teal)]/40 px-2 py-1 text-[11px] font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/5 disabled:opacity-60">
                {subiendo ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Subir {archivos.length} archivo(s) ahora
              </button>
            )}
            {subidos.length > 0 && <p className="mt-1 text-[11px] text-emerald-700">✓ Subido: {subidos.join(", ")}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">¿Cómo queda?</label>
            <div className="flex gap-1.5">
              <button onClick={() => setComoQueda("avance")} className={`flex-1 rounded-md border px-2 py-2 text-xs ${comoQueda === "avance" ? "border-sky-400 bg-sky-50 font-medium text-sky-800" : "border-input"}`}>Sigo trabajando<span className="block text-[9px] font-normal text-muted-foreground">guarda avance</span></button>
              <button onClick={() => setComoQueda("terminado")} className={`flex-1 rounded-md border px-2 py-2 text-xs ${comoQueda === "terminado" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>Se da por terminado</button>
              <button onClick={() => setComoQueda("siguiente_paso")} className={`flex-1 rounded-md border px-2 py-2 text-xs ${comoQueda === "siguiente_paso" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>Hay siguiente paso</button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {comoQueda === "avance" ? "¿Qué llevas hecho hasta ahora?" : comoQueda === "terminado" ? "¿Qué se hizo?" : "¿Qué se hizo y cuál es el siguiente paso?"}
            </label>
            <textarea className={inp} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} autoFocus
              placeholder={comoQueda === "avance" ? "Ej. Ya se pidió el CLG a RPPC, falta que lo manden." : comoQueda === "terminado" ? "Ej. Se confirmó en boletín que el emplazamiento sí se practicó." : "Ej. Se validó la caducidad, sigue firme. Siguiente: preparar reposición de procedimiento."} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: comoQueda === "avance" ? "#0369a1" : "#0C5C46" }}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />} {comoQueda === "avance" ? "Guardar avance" : "Marcar hecha"}
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
  const [cerrarTarea, setCerrarTarea] = useState<Tarea | null>(null);

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

  const marcarHecha = (t: Tarea) => setCerrarTarea(t);

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
                <button onClick={() => marcarHecha(t)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-600" title="Elaborar / marcar hecha"><Square className="h-4 w-4" /></button>
                <Link
                  to={t.caso_id ? "/expedientes/$id" : t.expediente ? "/urrj" : "/calendario"}
                  params={t.caso_id ? { id: t.caso_id } : undefined}
                  search={!t.caso_id && t.expediente ? ({ ficha: t.expediente } as any) : undefined}
                  className="min-w-0 flex-1 rounded hover:bg-muted/30"
                  title="Ir a hacer esta tarea"
                >
                  <p className="text-sm font-medium">{t.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.expediente ? `Exp. ${t.expediente}` : "Sin expediente"}
                    {t.fecha_limite ? ` · ${vencida ? "venció" : hoy ? "vence hoy" : "vence"} ${fmt(t.fecha_limite)}` : ""}
                  </p>
                </Link>
                {(vencida || hoy) && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${vencida ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{vencida ? "vencida" : "hoy"}</span>}
              </div>
            );
          })}
        </div>
      )}
      {cerrarTarea && (
        <ElaborarTareaModal
          tarea={cerrarTarea}
          onClose={() => setCerrarTarea(null)}
          onCerrada={(nuevoEstado, notaCierre) => {
            if (nuevoEstado === "hecha") {
              setTareas((p) => p.filter((x) => x.id !== cerrarTarea.id));
              sincronizarEventoDeTarea({ ...cerrarTarea, estado: "hecha" });
            } else {
              setTareas((p) => p.map((x) => (x.id === cerrarTarea.id ? { ...x, estado: nuevoEstado } : x)));
            }
            setCerrarTarea(null);
          }}
        />
      )}
    </Card>
  );
}

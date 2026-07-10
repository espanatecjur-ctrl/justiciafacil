import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Check, Circle, CheckCircle2 } from "lucide-react";
import { correoActual, rolActual } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { crearNotificacion } from "@/lib/notificaciones";
import {
  listarEventosMes, crearEvento, actualizarEvento, eliminarEvento,
  listarColaboradores,
  TIPOS_EVENTO, ESTILO_EVENTO, type Evento, type Colaborador,
} from "@/lib/evento-agenda";
import { buscarClientesJC, clienteJCPorNombre, type ClienteJC } from "@/lib/juris-clientes";
import {
  crearTareaEspejoJC, crearSolicitudClienteJF, marcarTareaJC,
  estadoSolicitudJF, vincularSolicitudJF, descartarSolicitudJF,
} from "@/lib/tareas-jc";
import { AlertTriangle, MoreVertical, Loader2, Search } from "lucide-react";

// Grupo al que pertenece cada rol (para armar "el equipo jurídico").
const GRUPO_DE_ROL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.codigo, r.grupo]));
// Es "director" quien ve todos los módulos (DGE, DIL, Super_Admin): puede ver a su equipo.
const esDirector = (rol: string) => ROLES.find((r) => r.codigo === rol)?.modulos === "todos";
// Colores para distinguir a cada persona del equipo.
const PALETA_PERSONA = ["#0C5C46", "#B45309", "#1D4ED8", "#9333EA", "#BE123C", "#0891B2", "#4D7C0F", "#C2410C", "#7C3AED", "#0F766E", "#A21CAF", "#374151"];

export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [{ title: "Calendario — SIGA-DIIPA" }] }),
  component: Calendario,
});

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function fechaStr(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function Calendario() {
  const ahora = new Date();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [editando, setEditando] = useState<Evento | null>(null); // null = modal cerrado
  const [colabs, setColabs] = useState<Colaborador[]>([]);
  useEffect(() => { listarColaboradores().then(setColabs); }, []);
  const [correoYo, setCorreoYo] = useState<string | null>(null);
  useEffect(() => { correoActual().then(setCorreoYo); }, []);
  const [rolYo, setRolYo] = useState("");
  useEffect(() => { rolActual().then(setRolYo); }, []);
  const soyDirector = esDirector(rolYo);
  const [filtro, setFiltro] = useState<"mias" | "equipo" | "todas">("mias"); // por defecto, cada quien ve las suyas

  // Equipo jurídico (para el director): colaboradores de las unidades jurídicas + colores por persona.
  const equipoJuridico = useMemo(() => colabs.filter((c) => GRUPO_DE_ROL[c.rol || ""] === "Jurídico" && c.correo), [colabs]);
  const equipoCorreos = useMemo(() => {
    const s = new Set(equipoJuridico.map((c) => c.correo));
    if (correoYo) s.add(correoYo);
    return s;
  }, [equipoJuridico, correoYo]);
  const colorPorCorreo = useMemo(() => {
    const m: Record<string, string> = {};
    equipoJuridico.forEach((c, i) => { m[c.correo] = PALETA_PERSONA[i % PALETA_PERSONA.length]; });
    return m;
  }, [equipoJuridico]);

  // Mapa correo -> nombre corto (para mostrar a quién está asignada cada tarea).
  const nombrePorCorreo = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of colabs) if (c.correo) m[c.correo] = (c.nombre || c.correo).split(" ")[0];
    return m;
  }, [colabs]);

  const recargar = () => { listarEventosMes(anio, mes).then(setEventos); };
  useEffect(recargar, [anio, mes]); // eslint-disable-line

  const hoyStr = fechaStr(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  // "Mías" = asignadas a mí o creadas por mí. "Mi equipo" = todo el jurídico. "Todas" = todo.
  const eventosVisibles = useMemo(() => {
    if (filtro === "todas" || !correoYo) return eventos;
    if (filtro === "equipo") return eventos.filter((e) => (e.asignado_a && equipoCorreos.has(e.asignado_a)) || (e.creado_por && equipoCorreos.has(e.creado_por)));
    return eventos.filter((e) => e.asignado_a === correoYo || e.creado_por === correoYo);
  }, [eventos, filtro, correoYo, equipoCorreos]);

  // Eventos agrupados por día.
  const porDia = useMemo(() => {
    const m: Record<string, Evento[]> = {};
    for (const e of eventosVisibles) if (e.fecha) (m[e.fecha] ??= []).push(e);
    return m;
  }, [eventosVisibles]);

  // Celdas del mes (con huecos al inicio para cuadrar la semana).
  const celdas = useMemo(() => {
    const offset = new Date(anio, mes, 1).getDay();
    const dias = new Date(anio, mes + 1, 0).getDate();
    const c: (number | null)[] = [];
    for (let i = 0; i < offset; i++) c.push(null);
    for (let d = 1; d <= dias; d++) c.push(d);
    while (c.length % 7 !== 0) c.push(null);
    return c;
  }, [anio, mes]);

  const cambiarMes = (delta: number) => {
    let nm = mes + delta, na = anio;
    if (nm < 0) { nm = 11; na--; }
    if (nm > 11) { nm = 0; na++; }
    setMes(nm); setAnio(na);
  };

  const nuevoEnDia = (dia: number) => setEditando({ tipo: "evento", fecha: fechaStr(anio, mes, dia) });

  // Marca una tarea como hecha/pendiente de un clic (sin abrir el modal).
  const toggleHecha = async (e: Evento) => {
    if (!e.id) return;
    const nuevo = e.estado === "hecho" ? "pendiente" : "hecho";
    await actualizarEvento(e.id, { estado: nuevo });
    if (e.jc_tarea_id) marcarTareaJC(e.jc_tarea_id, nuevo === "hecho" ? "hecha" : "pendiente");
    recargar();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Agenda"
        title="Calendario"
        description="Coloca eventos, tareas, recordatorios y citas. Da clic en un día para agendar."
        actions={
          <Button onClick={() => setEditando({ tipo: "evento", fecha: hoyStr })} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo
          </Button>
        }
      />

      {/* Barra de mes + leyenda */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => cambiarMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="min-w-[190px] text-center font-display text-lg font-bold">{MESES[mes]} {anio}</h2>
          <Button variant="outline" size="icon" onClick={() => cambiarMes(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setAnio(ahora.getFullYear()); setMes(ahora.getMonth()); }}>Hoy</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="inline-flex overflow-hidden rounded-md border border-input">
            <button onClick={() => setFiltro("mias")} className={`px-3 py-1.5 font-medium ${filtro === "mias" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground hover:bg-muted"}`}>Mías</button>
            {soyDirector && (
              <button onClick={() => setFiltro("equipo")} className={`border-l border-input px-3 py-1.5 font-medium ${filtro === "equipo" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground hover:bg-muted"}`}>Mi equipo</button>
            )}
            <button onClick={() => setFiltro("todas")} className={`border-l border-input px-3 py-1.5 font-medium ${filtro === "todas" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground hover:bg-muted"}`}>Todas</button>
          </div>
          {filtro === "equipo" ? (
            equipoJuridico.map((c) => (
              <span key={c.correo} className="inline-flex items-center gap-1.5 text-muted-foreground" title={c.correo}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorPorCorreo[c.correo] }} /> {(c.nombre || c.correo).split(" ")[0]}
              </span>
            ))
          ) : (
            TIPOS_EVENTO.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ESTILO_EVENTO[t].dot }} /> {ESTILO_EVENTO[t].label}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Calendario */}
      <Card className="legal-card overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {DIAS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((dia, i) => {
            if (dia === null) return <div key={i} className="min-h-[104px] border-b border-r border-border bg-muted/20" />;
            const f = fechaStr(anio, mes, dia);
            const evs = porDia[f] ?? [];
            const esHoy = f === hoyStr;
            return (
              <div
                key={i}
                onClick={() => nuevoEnDia(dia)}
                className="group min-h-[104px] cursor-pointer border-b border-r border-border p-1.5 transition hover:bg-muted/40"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${esHoy ? "bg-[color:var(--teal)] text-white" : "text-foreground"}`}>{dia}</span>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="space-y-1">
                  {evs.slice(0, 3).map((e) => {
                    const st = ESTILO_EVENTO[e.tipo || "evento"] ?? ESTILO_EVENTO.evento;
                    const hecha = e.tipo === "tarea" && e.estado === "hecho";
                    return (
                      <button
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); setEditando(e); }}
                        className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] ${st.bg} ${st.text} ${hecha ? "line-through opacity-60" : ""}`}
                        title={`${e.titulo || ""}${e.asignado_a ? ` · para ${nombrePorCorreo[e.asignado_a] || e.asignado_a}` : ""}`}
                      >
                        {filtro === "equipo" && e.asignado_a && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorPorCorreo[e.asignado_a] || "#9CA3AF" }} />}
                        {e.tipo === "tarea" && (
                          <span role="button" onClick={(ev) => { ev.stopPropagation(); toggleHecha(e); }} title={hecha ? "Marcar como pendiente" : "Marcar como hecha"} className="shrink-0 hover:opacity-100">
                            {hecha ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3 opacity-60" />}
                          </span>
                        )}
                        {e.hora && <span className="font-mono text-[10px] opacity-80">{e.hora}</span>}
                        <span className="truncate">{e.titulo || "(sin título)"}</span>
                        {e.cliente_estado === "no_encontrado" && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" aria-label="Cliente no encontrado en JurisConecta" />}
                        {e.asignado_a && <span className="ml-auto shrink-0 rounded-full bg-white/60 px-1 text-[9px] font-medium">👤 {nombrePorCorreo[e.asignado_a] || "?"}</span>}
                      </button>
                    );
                  })}
                  {evs.length > 3 && <p className="pl-1 text-[10px] text-muted-foreground">+{evs.length - 3} más</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {editando && (
        <ModalEvento
          evento={editando}
          colabs={colabs}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); recargar(); }}
        />
      )}
    </div>
  );
}

function ModalEvento({ evento, colabs, onCerrar, onGuardado }: { evento: Evento; colabs: Colaborador[]; onCerrar: () => void; onGuardado: () => void }) {
  const [titulo, setTitulo] = useState(evento.titulo ?? "");
  const [tipo, setTipo] = useState(evento.tipo ?? "evento");
  const [fecha, setFecha] = useState(evento.fecha ?? "");
  const [hora, setHora] = useState(evento.hora ?? "");
  const [nota, setNota] = useState(evento.nota ?? "");
  const [estado, setEstado] = useState(evento.estado ?? "pendiente");
  const [asignadoA, setAsignadoA] = useState(evento.asignado_a ?? "");
  const [ocupado, setOcupado] = useState(false);
  const editar = !!evento.id;

  // ---- Cliente (para reflejar la tarea en JurisConecta) ----
  const [clienteTexto, setClienteTexto] = useState(evento.cliente_nombre ?? "");
  const [clienteSel, setClienteSel] = useState<ClienteJC | null>(null);
  const [sugerencias, setSugerencias] = useState<ClienteJC[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [mostrarSug, setMostrarSug] = useState(false);
  useEffect(() => {
    if (clienteSel && clienteTexto === clienteSel.nombre) { setSugerencias([]); return; }
    const q = clienteTexto.trim();
    if (q.length < 3) { setSugerencias([]); return; }
    const t = setTimeout(() => {
      setBuscandoCliente(true);
      buscarClientesJC(q).then(setSugerencias).finally(() => setBuscandoCliente(false));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteTexto]);
  const elegirCliente = (c: ClienteJC) => { setClienteSel(c); setClienteTexto(c.nombre || ""); setSugerencias([]); setMostrarSug(false); };

  // ---- Estado de la solicitud (si este evento quedó pendiente de vincular en JurisConecta) ----
  const [solEstado, setSolEstado] = useState<"pendiente" | "vinculada" | "creada" | "descartada" | null>(evento.cliente_estado === "no_encontrado" ? "pendiente" : null);
  useEffect(() => {
    if (!evento.jc_solicitud_id) return;
    estadoSolicitudJF(evento.jc_solicitud_id).then((r) => { if (r) setSolEstado(r.estado); });
  }, [evento.jc_solicitud_id]);
  const [menuSol, setMenuSol] = useState(false);
  const [vinculandoOtro, setVinculandoOtro] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);

  const resolverVincular = async (c: ClienteJC) => {
    if (!evento.jc_solicitud_id) return;
    setResolviendo(true);
    const correo = await correoActual();
    const r = await vincularSolicitudJF(evento.jc_solicitud_id, c, {
      tipo, titulo: titulo.trim(), detalle: nota || null, fecha: fecha || null,
      asignadoCorreo: asignadoA, asignadoNombre: colabs.find((x) => x.correo === asignadoA)?.nombre || null,
      autorCorreo: correo || null,
    }, correo || "JusticiaFácil");
    if (r.ok) {
      await actualizarEvento(evento.id!, { cliente_estado: "vinculado", cliente_jc_id: c.id });
      setSolEstado("vinculada");
    }
    setResolviendo(false); setVinculandoOtro(false); setMenuSol(false);
  };
  const resolverDescartar = async () => {
    if (!evento.jc_solicitud_id) return;
    setResolviendo(true);
    const correo = await correoActual();
    const ok = await descartarSolicitudJF(evento.jc_solicitud_id, correo || "JusticiaFácil");
    if (ok) { await actualizarEvento(evento.id!, { cliente_estado: null }); setSolEstado("descartada"); }
    setResolviendo(false); setMenuSol(false);
  };

  const guardar = async () => {
    if (!titulo.trim() || !fecha) return;
    setOcupado(true);
    const asignado = asignadoA || null;
    const correo = await correoActual();
    const clienteNombreVal = clienteTexto.trim() || null;
    const campos = { titulo: titulo.trim(), tipo, fecha, hora: hora || null, nota: nota || null, estado: tipo === "tarea" ? estado : null, asignado_a: asignado, cliente_nombre: clienteNombreVal };

    let eventoId = evento.id || null;
    if (editar) {
      await actualizarEvento(evento.id!, campos);
    } else {
      const r = await crearEvento({ ...campos, creado_por: correo || null });
      eventoId = r.id || null;
    }

    // Aviso (campanita, JusticiaFácil) al asignado, si no soy yo mismo y cambió el asignado.
    if (asignado && asignado !== correo && asignado !== (evento.asignado_a ?? null)) {
      await crearNotificacion({
        para: asignado,
        texto: `Te asignaron ${tipo === "tarea" ? "una tarea" : "un evento"}: "${titulo.trim()}" para el ${fecha}.`,
        enlace: "/calendario",
      });
    }

    // ---- Espejo hacia JurisConecta: solo si hay cliente + asignado, y es nuevo o cambió ----
    const cambioVinculo = clienteNombreVal !== (evento.cliente_nombre ?? null) || asignado !== (evento.asignado_a ?? null) || !evento.cliente_estado;
    if (eventoId && clienteNombreVal && asignado && cambioVinculo) {
      const asignadoNombre = colabs.find((x) => x.correo === asignado)?.nombre || null;
      const datos = { tipo, titulo: titulo.trim(), detalle: nota || null, fecha: fecha || null, asignadoCorreo: asignado, asignadoNombre, autorCorreo: correo || null };
      const match = clienteSel && clienteSel.nombre === clienteNombreVal ? clienteSel : await clienteJCPorNombre(clienteNombreVal);
      if (match) {
        const espejo = await crearTareaEspejoJC(match, datos);
        await actualizarEvento(eventoId, { cliente_estado: "vinculado", cliente_jc_id: match.id, jc_tarea_id: espejo.tareaId || null });
      } else {
        const sol = await crearSolicitudClienteJF({ ...datos, nombreCliente: clienteNombreVal, jfEventoId: eventoId });
        await actualizarEvento(eventoId, { cliente_estado: "no_encontrado", jc_solicitud_id: sol.solicitudId || null });
      }
    }

    setOcupado(false);
    onGuardado();
  };

  const borrar = async () => {
    if (!evento.id) return;
    if (!window.confirm("¿Eliminar este evento?")) return;
    setOcupado(true);
    await eliminarEvento(evento.id);
    setOcupado(false);
    onGuardado();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onCerrar}>
      <div className="my-10 w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-bold text-[#0B1E3A]">{editar ? "Editar" : "Nuevo"} en la agenda</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Audiencia de pruebas"
              className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Tipo</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {TIPOS_EVENTO.map((t) => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${tipo === t ? `${ESTILO_EVENTO[t].bg} ${ESTILO_EVENTO[t].text} ring-1 ring-current` : "bg-muted text-muted-foreground"}`}>
                  {ESTILO_EVENTO[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Hora (opcional)</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nota (opcional)</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
              className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="relative">
            <label className="text-[11px] font-medium text-muted-foreground">Cliente (opcional — para que se refleje en JurisConecta)</label>
            <div className="relative mt-0.5">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={clienteTexto}
                onChange={(e) => { setClienteTexto(e.target.value); setClienteSel(null); setMostrarSug(true); }}
                onFocus={() => setMostrarSug(true)}
                placeholder="Nombre del cliente…"
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm"
              />
              {buscandoCliente && <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            {mostrarSug && sugerencias.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-input bg-white shadow-lg">
                {sugerencias.map((c) => (
                  <button key={c.id} onClick={() => elegirCliente(c)} className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted">
                    {c.nombre} {c.codigo && <span className="text-[10px] text-muted-foreground">· {c.codigo}</span>}
                  </button>
                ))}
              </div>
            )}
            {clienteSel && <p className="mt-1 text-[11px] text-emerald-700">✓ Vinculado con este cliente en JurisConecta</p>}
            {!clienteSel && clienteTexto.trim() && evento.cliente_estado === "vinculado" && clienteTexto === evento.cliente_nombre && (
              <p className="mt-1 text-[11px] text-emerald-700">✓ Ya vinculado en JurisConecta</p>
            )}
          </div>

          {/* Solicitud pendiente: el cliente no se encontró en JurisConecta al guardar */}
          {evento.jc_solicitud_id && solEstado === "pendiente" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No se encontró "{evento.cliente_nombre}" en JurisConecta. Queda pendiente de resolver (aquí o allá).</p>
                <div className="relative shrink-0">
                  <button onClick={() => setMenuSol((v) => !v)} className="rounded-md p-1 hover:bg-amber-100"><MoreVertical className="h-4 w-4" /></button>
                  {menuSol && (
                    <div className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-input bg-white py-1 text-foreground shadow-lg">
                      <button onClick={() => { setVinculandoOtro(true); setMenuSol(false); }} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-muted">🔗 Vincular con otro cliente</button>
                      <button disabled className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground/60">✓ Conservar (crear nuevo) — hazlo desde JurisConecta</button>
                      <button onClick={resolverDescartar} disabled={resolviendo} className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">🗑 Eliminar solicitud</button>
                    </div>
                  )}
                </div>
              </div>
              {vinculandoOtro && (
                <div className="mt-2 space-y-1.5 border-t border-amber-200 pt-2">
                  <BuscadorClienteJC onElegir={resolverVincular} ocupado={resolviendo} />
                </div>
              )}
            </div>
          )}
          {solEstado === "vinculada" && <p className="text-[11px] text-emerald-700">✓ La solicitud ya se vinculó con un cliente en JurisConecta.</p>}
          {solEstado === "creada" && <p className="text-[11px] text-emerald-700">✓ Se creó el cliente en JurisConecta a partir de esta solicitud.</p>}
          {solEstado === "descartada" && <p className="text-[11px] text-muted-foreground">Esta solicitud fue descartada.</p>}

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Asignar a (opcional)</label>
            <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}
              className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— Sin asignar —</option>
              {colabs.map((c) => (
                <option key={c.correo} value={c.correo}>{c.nombre}{c.rol ? ` (${c.rol})` : ""}</option>
              ))}
            </select>
          </div>
          {tipo === "tarea" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={estado === "hecho"} onChange={(e) => setEstado(e.target.checked ? "hecho" : "pendiente")} />
              Marcar como hecha
            </label>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          {editar ? (
            <Button variant="outline" size="sm" onClick={borrar} disabled={ocupado} className="text-red-600"><Trash2 className="h-4 w-4 mr-1.5" /> Eliminar</Button>
          ) : <span />}
          <Button onClick={guardar} disabled={ocupado || !titulo.trim() || !fecha} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <Check className="h-4 w-4 mr-1.5" /> {ocupado ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Buscador chiquito para "Vincular con otro cliente" (dentro de la solicitud pendiente).
function BuscadorClienteJC({ onElegir, ocupado }: { onElegir: (c: ClienteJC) => void; ocupado: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ClienteJC[]>([]);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 3) { setRes([]); return; }
    const t = setTimeout(() => { setBuscando(true); buscarClientesJC(texto).then(setRes).finally(() => setBuscando(false)); }, 350);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-1.5">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente en JurisConecta…"
        className="h-8 w-full rounded-md border border-input bg-white px-2.5 text-xs" autoFocus />
      {buscando && <p className="text-[11px] text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Buscando…</p>}
      {res.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-md border border-input bg-white">
          {res.map((c) => (
            <button key={c.id} disabled={ocupado} onClick={() => onElegir(c)} className="block w-full truncate px-2.5 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50">
              {c.nombre} {c.codigo && <span className="text-[10px] text-muted-foreground">· {c.codigo}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

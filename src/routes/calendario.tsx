import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Check } from "lucide-react";
import { correoActual } from "@/lib/auth";
import {
  listarEventosMes, crearEvento, actualizarEvento, eliminarEvento,
  listarColaboradores,
  TIPOS_EVENTO, ESTILO_EVENTO, type Evento, type Colaborador,
} from "@/lib/evento-agenda";

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

  // Mapa correo -> nombre corto (para mostrar a quién está asignada cada tarea).
  const nombrePorCorreo = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of colabs) if (c.correo) m[c.correo] = (c.nombre || c.correo).split(" ")[0];
    return m;
  }, [colabs]);

  const recargar = () => { listarEventosMes(anio, mes).then(setEventos); };
  useEffect(recargar, [anio, mes]); // eslint-disable-line

  const hoyStr = fechaStr(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

  // Eventos agrupados por día.
  const porDia = useMemo(() => {
    const m: Record<string, Evento[]> = {};
    for (const e of eventos) if (e.fecha) (m[e.fecha] ??= []).push(e);
    return m;
  }, [eventos]);

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
          {TIPOS_EVENTO.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ESTILO_EVENTO[t].dot }} /> {ESTILO_EVENTO[t].label}
            </span>
          ))}
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
                        {e.hora && <span className="font-mono text-[10px] opacity-80">{e.hora}</span>}
                        <span className="truncate">{e.titulo || "(sin título)"}</span>
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

  const guardar = async () => {
    if (!titulo.trim() || !fecha) return;
    setOcupado(true);
    const asignado = asignadoA || null;
    if (editar) {
      await actualizarEvento(evento.id!, { titulo: titulo.trim(), tipo, fecha, hora: hora || null, nota: nota || null, estado: tipo === "tarea" ? estado : null, asignado_a: asignado });
    } else {
      const correo = await correoActual();
      await crearEvento({ titulo: titulo.trim(), tipo, fecha, hora: hora || null, nota: nota || null, estado: tipo === "tarea" ? estado : null, asignado_a: asignado, creado_por: correo || null });
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

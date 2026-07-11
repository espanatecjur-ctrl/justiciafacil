import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Loader2, Send, Paperclip, Plus, Search, X, Users2, MessageCircle, Phone, Video } from "lucide-react";
import { nombreActual } from "@/lib/auth";
import { listarColaboradores } from "@/lib/evento-agenda";
import { listarColaboradoresJC, plataformaDeAreaJC } from "@/lib/tareas-jc";
import { GrabadorVoz } from "@/components/grabador-voz";
import { LlamadaChat } from "@/components/llamada-chat";
import {
  fetchCanales, crearCanal, buscarOCrearDirecto, fetchUltimosMensajes,
  fetchMensajes, enviarMensaje, subirArchivoChat, suscribirCanalPolling,
  marcarLeidoServidor, fetchConteosNoLeidos,
  type Canal, type Mensaje, type UltimoMsg,
} from "@/lib/chat-jc";

export const Route = createFileRoute("/chat")({
  component: ChatInterno,
});

type Persona = { nombre: string; correo: string; area?: string | null };

function fechaHora(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  return esHoy
    ? d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function ChatInterno() {
  const [yo, setYo] = useState<Persona | null>(null);
  const [canales, setCanales] = useState<Canal[]>([]);
  const [ultimos, setUltimos] = useState<Record<string, UltimoMsg>>({});
  const [noLeidos, setNoLeidos] = useState<Record<string, number>>({});
  const [canalSel, setCanalSel] = useState<Canal | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargandoMsgs, setCargandoMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [nuevoAbierto, setNuevoAbierto] = useState<"" | "grupo" | "directo">("");
  const fileRef = useRef<HTMLInputElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  // Identidad + directorio (para "nuevo directo") combinando JusticiaFácil y JurisConecta.
  const [directorio, setDirectorio] = useState<Persona[]>([]);
  useEffect(() => {
    nombreActual().then(setYo);
    Promise.all([listarColaboradores(), listarColaboradoresJC()]).then(([jf, jc]) => {
      const porCorreo = new Map<string, Persona>();
      for (const c of jc) if (c.correo) porCorreo.set(c.correo.toLowerCase(), { nombre: c.nombre, correo: c.correo, area: c.area });
      for (const c of jf) if (c.correo && !porCorreo.has(c.correo.toLowerCase())) porCorreo.set(c.correo.toLowerCase(), { nombre: c.nombre, correo: c.correo });
      setDirectorio(Array.from(porCorreo.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });
  }, []);

  const cargarLista = async () => {
    const [cs, ult] = await Promise.all([fetchCanales(), fetchUltimosMensajes()]);
    setCanales(cs);
    setUltimos(ult);
    if (yo) fetchConteosNoLeidos(yo.nombre).then(setNoLeidos);
  };
  useEffect(() => { cargarLista(); const t = setInterval(cargarLista, 15000); return () => clearInterval(t); }, [yo?.nombre]);

  // Mis canales: grupos siempre, directos solo los míos.
  const misCanales = useMemo(() => {
    if (!yo) return canales.filter((c) => c.tipo === "grupo");
    return canales.filter((c) => c.tipo === "grupo" || c.dm_a === yo.nombre || c.dm_b === yo.nombre);
  }, [canales, yo]);
  const listaFiltrada = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const base = misCanales.slice().sort((a, b) => {
      const fa = ultimos[a.id]?.created_at || "";
      const fb = ultimos[b.id]?.created_at || "";
      return fb.localeCompare(fa);
    });
    if (!q) return base;
    return base.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [misCanales, ultimos, buscar]);

  // Abrir un canal: cargar mensajes + suscribir + marcar leído.
  useEffect(() => {
    if (!canalSel) return;
    let vivo = true;
    setCargandoMsgs(true);
    fetchMensajes(canalSel.id).then((m) => { if (vivo) { setMensajes(m); setCargandoMsgs(false); } });
    if (yo) marcarLeidoServidor(canalSel.id, yo.nombre).then(() => setNoLeidos((p) => ({ ...p, [canalSel.id]: 0 })));
    const desuscribir = suscribirCanalPolling(canalSel.id, (m) => setMensajes((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])));
    return () => { vivo = false; desuscribir(); };
  }, [canalSel?.id]);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes.length]);

  const mandar = async () => {
    if (!yo || !canalSel || (!texto.trim() && enviando)) return;
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    setTexto("");
    await enviarMensaje({ canalId: canalSel.id, autorNombre: yo.nombre, autorArea: yo.area, texto: t });
    setEnviando(false);
    cargarLista();
  };

  const adjuntar = async (file: File) => {
    if (!yo || !canalSel) return;
    setEnviando(true);
    const subido = await subirArchivoChat(file);
    if (subido) await enviarMensaje({ canalId: canalSel.id, autorNombre: yo.nombre, autorArea: yo.area, archivoUrl: subido.url, archivoTipo: subido.tipo, archivoNombre: subido.nombre });
    setEnviando(false);
    cargarLista();
  };

  const onAudioGrabado = async (blob: Blob) => {
    if (!yo || !canalSel) return;
    if (blob.size > 10 * 1024 * 1024) { alert("La nota de voz es muy larga."); return; }
    setEnviando(true);
    const file = new File([blob], `nota-voz-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
    const subido = await subirArchivoChat(file);
    if (subido) await enviarMensaje({ canalId: canalSel.id, autorNombre: yo.nombre, autorArea: yo.area, texto: "", archivoUrl: subido.url, archivoTipo: "audio", archivoNombre: "Nota de voz" });
    else alert("No se pudo enviar la nota de voz.");
    setEnviando(false);
    cargarLista();
  };

  const abrirDirecto = async (p: Persona) => {
    if (!yo) return;
    setNuevoAbierto("");
    const c = await buscarOCrearDirecto(yo.correo, yo.nombre, p.correo, p.nombre);
    if (c) { await cargarLista(); setCanalSel(c); }
  };

  // ===== Llamada de voz/video (misma sala que JurisConecta: "JurisConecta-"+canalId) =====
  const [llamada, setLlamada] = useState<{ sala: string; soloAudio: boolean } | null>(null);
  const llamar = async (video: boolean) => {
    if (!yo || !canalSel) return;
    const sala = `JurisConecta-${canalSel.id}`;
    const etiqueta = video ? "🎥 Videollamada" : "📞 Llamada de voz";
    await enviarMensaje({ canalId: canalSel.id, autorNombre: yo.nombre, autorArea: yo.area, texto: etiqueta });
    cargarLista();
    setLlamada({ sala, soloAudio: !video });
  };

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col">
      <PageHeader eyebrow="Núcleo" title="Chat interno" description="Conectado con JurisConecta: los grupos y chats directos son los mismos de los dos lados." />
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {/* ===== Lista de canales ===== */}
        <div className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/30">
          <div className="flex items-center gap-1.5 border-b border-border p-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…"
                className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs" />
            </div>
            <button onClick={() => setNuevoAbierto(nuevoAbierto ? "" : "directo")} title="Nuevo chat"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--teal)] text-white hover:bg-[color:var(--teal)]/90"><Plus className="h-4 w-4" /></button>
          </div>

          {nuevoAbierto === "directo" && (
            <div className="max-h-52 overflow-y-auto border-b border-border bg-background p-1.5">
              <button onClick={() => setNuevoAbierto("grupo")} className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[color:var(--teal)] hover:bg-muted"><Users2 className="h-3.5 w-3.5" /> Crear grupo nuevo…</button>
              {directorio.filter((p) => p.correo !== yo?.correo).map((p) => (
                <button key={p.correo} onClick={() => abrirDirecto(p)} className="flex w-full items-center justify-between gap-2 truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted">
                  <span className="truncate">{p.nombre}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{plataformaDeAreaJC(p.area)}</span>
                </button>
              ))}
            </div>
          )}
          {nuevoAbierto === "grupo" && <NuevoGrupo onCerrar={() => setNuevoAbierto("")} onCreado={(c) => { setNuevoAbierto(""); cargarLista(); setCanalSel(c); }} />}

          <div className="flex-1 overflow-y-auto">
            {listaFiltrada.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Sin chats todavía.</p>}
            {listaFiltrada.map((c) => {
              const u = ultimos[c.id];
              const badge = noLeidos[c.id] || 0;
              return (
                <button key={c.id} onClick={() => setCanalSel(c)}
                  className={"flex w-full items-start gap-2 border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted " + (canalSel?.id === c.id ? "bg-muted" : "")}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: (c.color || "#64748B") + "22" }}>{c.emoji || "💬"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">{c.nombre}</p>
                      {u && <span className="shrink-0 text-[10px] text-muted-foreground">{fechaHora(u.created_at)}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[11px] text-muted-foreground">{u ? (u.archivo_tipo === "audio" ? "🎤 Nota de voz" : u.archivo_tipo ? "📎 Archivo" : u.texto) : "Sin mensajes"}</p>
                      {badge > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===== Conversación ===== */}
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          {!canalSel ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageCircle className="h-10 w-10 opacity-30" />
              <p className="text-sm">Elige un chat o inicia uno nuevo.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm" style={{ background: (canalSel.color || "#64748B") + "22" }}>{canalSel.emoji || "💬"}</div>
                <p className="flex-1 text-sm font-semibold">{canalSel.nombre}</p>
                <button onClick={() => llamar(false)} title="Llamada de voz" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Phone className="h-4 w-4" /></button>
                <button onClick={() => llamar(true)} title="Videollamada" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><Video className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {cargandoMsgs ? (
                  <p className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Cargando…</p>
                ) : mensajes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Sin mensajes todavía. Manda el primero. 👋</p>
                ) : mensajes.map((m) => {
                  const esYo = m.autor_nombre === yo?.nombre;
                  return (
                    <div key={m.id} className={"flex " + (esYo ? "justify-end" : "justify-start")}>
                      <div className={"max-w-[70%] rounded-2xl px-3 py-2 text-sm " + (esYo ? "bg-[color:var(--teal)] text-white" : "bg-muted text-foreground")}>
                        {!esYo && canalSel.tipo === "grupo" && <p className="mb-0.5 text-[11px] font-semibold opacity-80">{m.autor_nombre}</p>}
                        {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                        {m.archivo_url && m.archivo_tipo === "audio" && (
                          <audio controls src={m.archivo_url} className="mt-1 h-9 max-w-[220px]" style={{ filter: esYo ? "invert(1) hue-rotate(180deg)" : undefined }} />
                        )}
                        {m.archivo_url && m.archivo_tipo === "imagen" && <img src={m.archivo_url} alt={m.archivo_nombre || "imagen"} className="mt-1 max-h-52 rounded-lg" />}
                        {m.archivo_url && m.archivo_tipo !== "imagen" && m.archivo_tipo !== "audio" && (
                          <a href={m.archivo_url} target="_blank" rel="noreferrer" className={"mt-1 flex items-center gap-1 text-xs underline " + (esYo ? "text-white/90" : "text-[color:var(--teal)]")}>
                            <Paperclip className="h-3 w-3" /> {m.archivo_nombre || "Archivo"}
                          </a>
                        )}
                        <p className={"mt-0.5 text-right text-[10px] " + (esYo ? "text-white/70" : "text-muted-foreground")}>{fechaHora(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={finRef} />
              </div>
              <div className="flex items-center gap-1.5 border-t border-border p-2.5">
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) adjuntar(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} disabled={enviando} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted disabled:opacity-50"><Paperclip className="h-4 w-4" /></button>
                <GrabadorVoz onAudio={onAudioGrabado} disabled={enviando} />
                <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
                  placeholder="Escribe un mensaje…" disabled={enviando}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
                <button onClick={mandar} disabled={enviando || !texto.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color:var(--teal)] text-white hover:bg-[color:var(--teal)]/90 disabled:opacity-50"><Send className="h-4 w-4" /></button>
              </div>
            </>
          )}
        </div>
      </div>
      {llamada && yo && <LlamadaChat sala={llamada.sala} nombre={yo.nombre} soloAudio={llamada.soloAudio} onCerrar={() => setLlamada(null)} />}
    </div>
  );
}

function NuevoGrupo({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (c: Canal) => void }) {
  const [nombre, setNombre] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [color, setColor] = useState("#0C5C46");
  const [ocupado, setOcupado] = useState(false);
  const crear = async () => {
    if (!nombre.trim()) return;
    setOcupado(true);
    const c = await crearCanal({ nombre: nombre.trim(), emoji, color });
    setOcupado(false);
    if (c) onCreado(c);
  };
  return (
    <div className="space-y-2 border-b border-border bg-background p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Nuevo grupo</p>
        <button onClick={onCerrar}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
      </div>
      <div className="flex gap-1.5">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} className="h-8 w-10 rounded-md border border-input bg-background text-center text-sm" />
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del grupo" autoFocus className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 rounded-md border border-input p-0.5" />
      </div>
      <button onClick={crear} disabled={ocupado || !nombre.trim()} className="h-7 w-full rounded-md bg-[color:var(--teal)] text-xs font-semibold text-white disabled:opacity-50">{ocupado ? "Creando…" : "Crear grupo"}</button>
    </div>
  );
}

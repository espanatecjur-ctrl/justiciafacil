import { useEffect, useMemo, useRef, useState } from "react";
import { sbSelect, type CasoJuridico, SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import type { AcuerdoJudicial } from "@/components/robot-boletines";
import { Search, FileText, Clock, Bell, Plus, Check, CheckCheck, X, Loader2, MapPin } from "lucide-react";
import { ConfigBoletinModal } from "@/components/config-boletin";

const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const TIPOS_ACUERDO = ["Boletín", "Amparo", "Exhorto", "Edicto", "Almoneda", "RPP", "Otro"];

// Semáforo de frescura: 🟢 <7 días · 🟡 7-20 · 🔴 >20 · gris sin movimientos
function frescura(dias: number | null) {
  if (dias === null) return { color: "#9CA3AF", label: "Sin movimientos", chip: "bg-muted text-muted-foreground" };
  if (dias < 7) return { color: "#0C5C46", label: `Hace ${dias} día${dias === 1 ? "" : "s"}`, chip: "bg-emerald-100 text-emerald-800" };
  if (dias <= 20) return { color: "#C2A24C", label: `Hace ${dias} días`, chip: "bg-amber-100 text-amber-800" };
  return { color: "#DC2626", label: `Hace ${dias} días`, chip: "bg-red-100 text-red-700" };
}
// Lee una fecha "YYYY-MM-DD" como fecha LOCAL (sin brincar de día por zona horaria)
const parseLocal = (fecha?: string | null): Date | null => {
  if (!fecha) return null;
  const m = String(fecha).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(fecha);
};
const fmtFecha = (fecha?: string | null) => {
  const d = parseLocal(fecha);
  return d ? d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};
const diasDesde = (fecha?: string | null) => { const d = parseLocal(fecha); return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null; };
const esHoy = (fecha?: string | null) => { const d = parseLocal(fecha); return !!d && d.toDateString() === new Date().toDateString(); };

const TIPO_COLOR: Record<string, string> = {
  Boletín: "bg-blue-100 text-blue-700", Amparo: "bg-purple-100 text-purple-700", Exhorto: "bg-cyan-100 text-cyan-700",
  Edicto: "bg-orange-100 text-orange-700", Almoneda: "bg-rose-100 text-rose-700", RPP: "bg-teal-100 text-teal-700",
};

export function BuzonExpedientes({ casos }: { casos: CasoJuridico[] }) {
  const [acuerdos, setAcuerdos] = useState<AcuerdoJudicial[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [agregar, setAgregar] = useState(false);
  const [configBoletin, setConfigBoletin] = useState<CasoJuridico | null>(null);
  const [patches, setPatches] = useState<Record<string, Partial<CasoJuridico>>>({});
  const [fColor, setFColor] = useState<"todos" | "verde" | "amarillo" | "rojo" | "sin">("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [soloNoLeidos, setSoloNoLeidos] = useState(false);
  const [orden, setOrden] = useState<"urgencia" | "reciente">("urgencia");
  const [pagina, setPagina] = useState(0);
  useEffect(() => { setPagina(0); }, [q, fColor, fTipo, soloNoLeidos, orden]);
  const [ultimaCorrida, setUltimaCorrida] = useState<{ corrida_at: string; total_expedientes: number | null; fuente: string | null } | null>(null);
  useEffect(() => {
    sbSelect<any>("robot_log", "select=corrida_at,total_expedientes,fuente&order=corrida_at.desc&limit=1").then((d) => setUltimaCorrida(d?.[0] ?? null)).catch(() => {});
  }, []);

  const cargar = () => sbSelect<AcuerdoJudicial>("acuerdo_judicial", "select=*&order=fecha_acuerdo.desc&limit=1000").then(setAcuerdos).catch(() => setAcuerdos([]));
  useEffect(() => { cargar(); }, []);

  const marcarLeido = async (id: string) => {
    await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?id=eq.${id}`, { method: "PATCH", headers: wHeaders, body: JSON.stringify({ leido: true }) });
    setAcuerdos((p) => p.map((a) => a.id === id ? { ...a, leido: true } : a));
  };
  const marcarTodosLeidos = async (exp: string) => {
    await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?expediente=eq.${encodeURIComponent(exp)}&leido=eq.false`, { method: "PATCH", headers: wHeaders, body: JSON.stringify({ leido: true }) });
    setAcuerdos((p) => p.map((a) => (a.expediente || "").trim() === exp ? { ...a, leido: true } : a));
  };

  // acuerdos por expediente
  const porExp = useMemo(() => {
    const m: Record<string, AcuerdoJudicial[]> = {};
    for (const a of acuerdos) { const k = (a.expediente || "").trim(); if (!k) continue; (m[k] ||= []).push(a); }
    return m;
  }, [acuerdos]);

  const filas = useMemo(() => {
    const arr = casos.map((c0) => {
      const c = patches[c0.id] ? { ...c0, ...patches[c0.id] } : c0;
      const exp = (c.expediente || "").trim();
      const acs = porExp[exp] || [];
      const ultima = acs[0]?.fecha_acuerdo ?? null;
      const dias = diasDesde(ultima);
      return { c, exp, acs, ultima, dias, hoy: acs.some((a) => esHoy(a.fecha_acuerdo)), noLeidos: acs.filter((a) => a.leido === false).length };
    });
    const colorDe = (d: number | null) => d === null ? "sin" : d < 7 ? "verde" : d <= 20 ? "amarillo" : "rojo";
    const t = q.trim().toLowerCase();
    let f = arr.filter((x) => {
      if (t && !`${x.exp} ${x.c.cliente_nombre || ""} ${x.c.juzgado || ""} ${x.c.materia || ""} ${x.c.actor || ""} ${x.c.demandado || ""}`.toLowerCase().includes(t)) return false;
      if (fColor !== "todos" && colorDe(x.dias) !== fColor) return false;
      if (soloNoLeidos && x.noLeidos === 0) return false;
      if (fTipo !== "todos" && !x.acs.some((a) => a.tipo_acuerdo === fTipo)) return false;
      return true;
    });
    if (orden === "urgencia") f = f.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
    else f = f.sort((a, b) => (parseLocal(b.ultima)?.getTime() ?? 0) - (parseLocal(a.ultima)?.getTime() ?? 0));
    return f;
  }, [casos, porExp, q, fColor, fTipo, soloNoLeidos, orden, patches]);

  const conteo = useMemo(() => {
    let v = 0, am = 0, r = 0, s = 0, hoy = 0;
    for (const c of casos) {
      const acs = porExp[(c.expediente || "").trim()] || [];
      const d = diasDesde(acs[0]?.fecha_acuerdo ?? null);
      if (d === null) s++; else if (d < 7) v++; else if (d <= 20) am++; else r++;
      if (acs.some((a) => esHoy(a.fecha_acuerdo))) hoy++;
    }
    return { v, am, r, s, hoy };
  }, [casos, porExp]);

  const selExp = filas.find((f) => f.c.id === sel);

  // En celular: al entrar a un expediente, llevar la vista al detalle (los acuerdos).
  const detalleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sel && typeof window !== "undefined" && window.innerWidth < 1024) {
      detalleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [sel]);

  const porPagina = 20;
  const totalPag = Math.max(1, Math.ceil(filas.length / porPagina));
  const pag = Math.min(pagina, totalPag - 1);
  const filasPag = filas.slice(pag * porPagina, pag * porPagina + porPagina);

  return (
    <div className="space-y-3">
      {ultimaCorrida && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          🤖 Última revisión del robot: <b className="text-foreground">{new Date(ultimaCorrida.corrida_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</b>
          {ultimaCorrida.fuente === "PRUEBA" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">modo prueba</span>}
          {ultimaCorrida.total_expedientes != null && <span>· {ultimaCorrida.total_expedientes} expedientes revisados</span>}
        </div>
      )}
      {/* Mini dashboard de salud (clicable) */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {([["todos", "Todos", "bg-muted text-foreground", filas.length], ["verde", `🟢 ${conteo.v} al día`, "bg-emerald-100 text-emerald-800", conteo.v], ["amarillo", `🟡 ${conteo.am} por revisar`, "bg-amber-100 text-amber-800", conteo.am], ["rojo", `🔴 ${conteo.r} sin avance`, "bg-red-100 text-red-700", conteo.r], ["sin", `⚪ ${conteo.s} sin movimientos`, "bg-muted text-muted-foreground", conteo.s]] as const).map(([k, label, cls]) => (
          <button key={k} onClick={() => setFColor(k as any)} className={`rounded-full px-3 py-1 font-medium transition-all ${cls} ${fColor === k ? "ring-2 ring-[color:var(--teal)] ring-offset-1" : "opacity-80 hover:opacity-100"}`}>{label}</button>
        ))}
        {conteo.hoy > 0 && <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700"><Bell className="mr-1 inline h-3 w-3" />{conteo.hoy} hoy</span>}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
          <option value="todos">Todos los tipos</option>
          {TIPOS_ACUERDO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => setSoloNoLeidos((v) => !v)} className={`rounded-md border px-3 py-1.5 text-xs ${soloNoLeidos ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>Solo con no leídos</button>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          Orden:
          <button onClick={() => setOrden("urgencia")} className={`rounded-md border px-2.5 py-1.5 ${orden === "urgencia" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>Por urgencia</button>
          <button onClick={() => setOrden("reciente")} className={`rounded-md border px-2.5 py-1.5 ${orden === "reciente" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>Reciente</button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        {/* Lista izquierda */}
        <div className={`rounded-xl border border-border bg-card ${sel ? "hidden lg:block" : "block"}`}>
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar expediente…" className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" />
            </div>
          </div>
          <div className="max-h-[560px] overflow-auto p-2">
            {filas.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Sin expedientes.</p> : filasPag.map((f) => {
              const fr = frescura(f.dias);
              const activo = f.c.id === sel;
              return (
                <button key={f.c.id} onClick={() => setSel(f.c.id)} className={`mb-1 flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors ${activo ? "bg-[color:var(--teal)]/10 ring-1 ring-[color:var(--teal)]/30" : "hover:bg-muted/50"}`}>
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fr.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-[color:var(--teal)]">{f.exp || "— sin expediente —"}</p>
                      {f.hoy && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">HOY</span>}
                      {f.noLeidos > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{f.noLeidos}</span>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{f.c.materia || "—"} · {f.c.juzgado || "—"}</p>
                    {(f.c.actor || f.c.demandado) && <p className="truncate text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{f.c.actor || "—"}</span> vs. <span className="font-medium text-foreground">{f.c.demandado || "—"}</span></p>}
                    <p className="mt-0.5 text-[11px]" style={{ color: fr.color }}>{fr.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {filas.length > porPagina && (
            <div className="flex items-center justify-between gap-2 border-t border-border p-2 text-xs">
              <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pag === 0} className="rounded-md border border-input px-2.5 py-1.5 disabled:opacity-40 hover:bg-muted">← Anterior</button>
              <span className="text-muted-foreground">Página {pag + 1} de {totalPag} · {filas.length} exp.</span>
              <button onClick={() => setPagina((p) => Math.min(totalPag - 1, p + 1))} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-2.5 py-1.5 disabled:opacity-40 hover:bg-muted">Siguiente →</button>
            </div>
          )}
        </div>
        <div ref={detalleRef} className={`rounded-xl border border-border bg-card ${sel ? "block" : "hidden lg:block"}`}>
          {!selExp ? (
            <div className="grid h-full min-h-[300px] place-items-center p-8 text-center text-sm text-muted-foreground">
              <div><FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />Elige un expediente para ver su boletín e histórico.</div>
            </div>
          ) : (
            <div className="p-4">
              <button onClick={() => setSel(null)} className="lg:hidden mb-3 flex items-center gap-1 text-sm font-medium text-[color:var(--teal)]">← Volver a expedientes</button>
              <div className="mb-3 border-b border-border pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-[color:var(--teal)]">{selExp.exp}</p>
                    {(selExp.c.actor || selExp.c.demandado) && <p className="mt-0.5 text-sm"><span className="font-semibold text-foreground">{selExp.c.actor || "—"}</span> <span className="text-muted-foreground">vs.</span> <span className="font-semibold text-foreground">{selExp.c.demandado || "—"}</span></p>}
                    <p className="text-sm text-muted-foreground">{selExp.c.cliente_nombre || ""}{selExp.c.cliente_nombre ? " · " : ""}{selExp.c.materia || ""} · {selExp.c.juzgado || ""}</p>
                    {selExp.c.nombre_juzgado && <p className="mt-0.5 text-xs text-[color:var(--teal)]"><MapPin className="mr-1 inline h-3 w-3" />Boletín: {selExp.c.nombre_juzgado} (distrito {selExp.c.cve_distrito}, juzgado {selExp.c.cve_juzgado})</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => setConfigBoletin(selExp.c)} className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs hover:bg-muted"><MapPin className="h-3.5 w-3.5" /> {selExp.c.cve_juzgado ? "Juzgado ✓" : "Asignar juzgado"}</button>
                    <button onClick={() => setAgregar(true)} className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-white" style={{ background: "#0C5C46" }}><Plus className="h-3.5 w-3.5" /> Agregar acuerdo</button>
                    {selExp.noLeidos > 0 && <button onClick={() => marcarTodosLeidos(selExp.exp)} className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs hover:bg-muted"><CheckCheck className="h-3.5 w-3.5" /> Marcar todos leídos</button>}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${frescura(selExp.dias).chip}`}><Clock className="mr-1 inline h-3 w-3" />{frescura(selExp.dias).label}</span>
                  {selExp.dias !== null && selExp.dias > 20 && <span className="text-xs font-medium text-red-700">⚠ Sin avance: conviene presentar promoción impulsora.</span>}
                </div>
              </div>

              {selExp.acs.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Sin acuerdos registrados todavía.<br />El robot (9 AM) o el buzón manual los irán llenando.</div>
              ) : (
                <div className="space-y-2">
                  {selExp.acs.map((a) => (
                    <div key={a.id} className={`rounded-lg border p-3 ${a.leido === false ? "border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5" : "border-border"}`}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {a.tipo_acuerdo && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIPO_COLOR[a.tipo_acuerdo] || "bg-muted text-muted-foreground"}`}>{a.tipo_acuerdo}</span>}
                          {a.urgente && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">URGENTE</span>}
                          {a.leido === false && <span className="rounded-full bg-[color:var(--teal)] px-2 py-0.5 text-[10px] font-semibold text-white">NUEVO</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{fmtFecha(a.fecha_acuerdo)}</span>
                      </div>
                      <p className="text-sm">{a.texto || "(sin texto)"}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{a.origen === "robot" ? "🤖 robot" : "✍️ manual"}</span>
                        {a.leido === false && <button onClick={() => marcarLeido(a.id)} className="flex items-center gap-1 text-[11px] text-[color:var(--teal)] hover:underline"><Check className="h-3 w-3" /> Marcar leído</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {agregar && selExp && <AgregarAcuerdoModal expediente={selExp.exp} juzgado={selExp.c.juzgado} entidad={selExp.c.entidad} onClose={() => setAgregar(false)} onGuardado={() => { setAgregar(false); cargar(); }} />}
      {configBoletin && <ConfigBoletinModal caso={configBoletin} onClose={() => setConfigBoletin(null)} onGuardado={() => { const id = configBoletin.id; setConfigBoletin(null); sbSelect<CasoJuridico>("caso_juridico", `select=cve_distrito,cve_juzgado,nombre_juzgado&id=eq.${id}`).then((d) => { if (d?.[0]) setPatches((p) => ({ ...p, [id]: d[0] })); }).catch(() => {}); }} />}
    </div>
  );
}

function AgregarAcuerdoModal({ expediente, juzgado, entidad, onClose, onGuardado }: { expediente: string; juzgado?: string | null; entidad?: string | null; onClose: () => void; onGuardado: () => void }) {
  const [tipo, setTipo] = useState("Boletín");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [texto, setTexto] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!texto.trim()) { setError("Escribe el texto del acuerdo."); return; }
    setGuardando(true); setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial`, {
        method: "POST", headers: wHeaders,
        body: JSON.stringify({ expediente, juzgado: juzgado || null, entidad: entidad || "Sinaloa", fecha_acuerdo: fecha || null, tipo_acuerdo: tipo, texto: texto.trim(), urgente, leido: false, origen: "manual" }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onGuardado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="font-semibold">Agregar acuerdo · {expediente}</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          {error && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
              <select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS_ACUERDO.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Fecha del acuerdo</label>
              <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Texto del acuerdo</label>
            <textarea rows={4} className={inp} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Se admite la promoción y se señala fecha para…" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} /> Marcar como urgente</label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {guardando ? "Guardando…" : "Guardar acuerdo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

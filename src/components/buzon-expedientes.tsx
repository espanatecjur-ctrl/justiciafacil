import { useEffect, useMemo, useState } from "react";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import type { AcuerdoJudicial } from "@/components/robot-boletines";
import { Search, FileText, Clock, Bot, Hand, Bell } from "lucide-react";

// Semáforo de frescura: 🟢 <7 días · 🟡 7-20 · 🔴 >20 · gris sin movimientos
function frescura(dias: number | null) {
  if (dias === null) return { color: "#9CA3AF", label: "Sin movimientos", chip: "bg-muted text-muted-foreground" };
  if (dias < 7) return { color: "#0C5C46", label: `Hace ${dias} día${dias === 1 ? "" : "s"}`, chip: "bg-emerald-100 text-emerald-800" };
  if (dias <= 20) return { color: "#C2A24C", label: `Hace ${dias} días`, chip: "bg-amber-100 text-amber-800" };
  return { color: "#DC2626", label: `Hace ${dias} días`, chip: "bg-red-100 text-red-700" };
}
const diasDesde = (fecha?: string | null) => fecha ? Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000) : null;
const esHoy = (fecha?: string | null) => !!fecha && new Date(fecha).toDateString() === new Date().toDateString();

const TIPO_COLOR: Record<string, string> = {
  Boletín: "bg-blue-100 text-blue-700", Amparo: "bg-purple-100 text-purple-700", Exhorto: "bg-cyan-100 text-cyan-700",
  Edicto: "bg-orange-100 text-orange-700", Almoneda: "bg-rose-100 text-rose-700", RPP: "bg-teal-100 text-teal-700",
};

export function BuzonExpedientes({ casos }: { casos: CasoJuridico[] }) {
  const [acuerdos, setAcuerdos] = useState<AcuerdoJudicial[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    sbSelect<AcuerdoJudicial>("acuerdo_judicial", "select=*&order=fecha_acuerdo.desc&limit=1000")
      .then(setAcuerdos).catch(() => setAcuerdos([]));
  }, []);

  // acuerdos por expediente
  const porExp = useMemo(() => {
    const m: Record<string, AcuerdoJudicial[]> = {};
    for (const a of acuerdos) { const k = (a.expediente || "").trim(); if (!k) continue; (m[k] ||= []).push(a); }
    return m;
  }, [acuerdos]);

  const filas = useMemo(() => {
    const arr = casos.map((c) => {
      const exp = (c.expediente || "").trim();
      const acs = porExp[exp] || [];
      const ultima = acs[0]?.fecha_acuerdo ?? null;
      const dias = diasDesde(ultima);
      return { c, exp, acs, ultima, dias, hoy: acs.some((a) => esHoy(a.fecha_acuerdo)), noLeidos: acs.filter((a) => a.leido === false).length };
    });
    const t = q.trim().toLowerCase();
    const f = t ? arr.filter((x) => `${x.exp} ${x.c.cliente_nombre || ""} ${x.c.juzgado || ""} ${x.c.materia || ""}`.toLowerCase().includes(t)) : arr;
    // orden por urgencia: más días sin moverse arriba; sin movimientos al final
    return f.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  }, [casos, porExp, q]);

  const conteo = useMemo(() => {
    let v = 0, am = 0, r = 0, s = 0;
    for (const f of filas) { if (f.dias === null) s++; else if (f.dias < 7) v++; else if (f.dias <= 20) am++; else r++; }
    return { v, am, r, s, hoy: filas.filter((f) => f.hoy).length };
  }, [filas]);

  const selExp = filas.find((f) => f.c.id === sel);

  return (
    <div className="space-y-3">
      {/* Mini dashboard de salud */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">🟢 {conteo.v} al día</span>
        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">🟡 {conteo.am} por revisar</span>
        <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">🔴 {conteo.r} sin avance</span>
        <span className="rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground">⚪ {conteo.s} sin movimientos</span>
        {conteo.hoy > 0 && <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700"><Bell className="mr-1 inline h-3 w-3" />{conteo.hoy} con movimiento hoy</span>}
      </div>

      <div className="grid gap-3 lg:grid-cols-[360px_1fr]">
        {/* Lista izquierda */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar expediente…" className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" />
            </div>
          </div>
          <div className="max-h-[560px] overflow-auto p-2">
            {filas.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">Sin expedientes.</p> : filas.map((f) => {
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
                    <p className="mt-0.5 text-[11px]" style={{ color: fr.color }}>{fr.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Histórico derecha */}
        <div className="rounded-xl border border-border bg-card">
          {!selExp ? (
            <div className="grid h-full min-h-[300px] place-items-center p-8 text-center text-sm text-muted-foreground">
              <div><FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />Elige un expediente para ver su boletín e histórico.</div>
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-3 border-b border-border pb-3">
                <p className="text-base font-bold text-[color:var(--teal)]">{selExp.exp}</p>
                <p className="text-sm text-muted-foreground">{selExp.c.cliente_nombre || ""}{selExp.c.cliente_nombre ? " · " : ""}{selExp.c.materia || ""} · {selExp.c.juzgado || ""}</p>
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
                        <span className="text-xs text-muted-foreground">{a.fecha_acuerdo ? new Date(a.fecha_acuerdo).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                      </div>
                      <p className="text-sm">{a.texto || "(sin texto)"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

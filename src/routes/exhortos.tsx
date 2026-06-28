import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { NuevoExhortoModal } from "@/components/nuevo-exhorto";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FilaAcciones } from "@/components/fila-acciones";
import { Search, Send, AlertTriangle, Plus, Archive } from "lucide-react";

export const Route = createFileRoute("/exhortos")({
  head: () => ({ meta: [{ title: "Exhortos — JusticiaFácil" }] }),
  component: ExhortosPage,
});

const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

const tono: Record<string, string> = {
  GIRADO: "bg-blue-100 text-blue-900",
  RECIBIDO: "bg-cyan-100 text-cyan-900",
  DILIGENCIADO: "bg-amber-100 text-amber-900",
  DEVUELTO: "bg-slate-200 text-slate-800",
  CUMPLIMENTADO: "bg-emerald-100 text-emerald-900",
};
function leFalta(c: CasoJuridico): boolean {
  const sinJuzgado = !(c.nombre_juzgado || c.cve_juzgado || c.juzgado);
  return sinJuzgado || !c.expediente;
}
const fmt = (s: string | null | undefined) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

function ExhortosPage() {
  const navigate = useNavigate();
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState("todas");
  const [verArchivados, setVerArchivados] = useState(false);

  const cargar = () => {
    setCargando(true);
    sbSelect<CasoJuridico>("caso_juridico", "select=*&tipo_registro=eq.exhorto&order=prioridad.asc")
      .then((d) => setCasos(d)).catch((e) => setError(e.message)).finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []);

  const abrirFicha = (c: CasoJuridico) => { navigate({ to: "/expediente", search: { id: c.id, nueva: false } }); };
  const irEvidencia = (c: CasoJuridico) => { navigate({ to: "/expediente", search: { id: c.id, nueva: true } }); };
  const archivar = async (c: CasoJuridico) => {
    const nuevo = !c.archivado;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, { method: "PATCH", headers: wHeaders, body: JSON.stringify({ archivado: nuevo }) });
      if (!r.ok) throw new Error(String(r.status));
      setCasos((p) => p.map((x) => (x.id === c.id ? { ...x, archivado: nuevo } : x)));
    } catch (e: any) { alert("No se pudo archivar: " + e.message); }
  };
  const borrar = async (c: CasoJuridico) => {
    if (!confirm(`¿Borrar el exhorto ${c.folio || c.expediente || "(sin folio)"}?`)) return;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, { method: "DELETE", headers: wHeaders });
      if (!r.ok) throw new Error(String(r.status));
      setCasos((p) => p.filter((x) => x.id !== c.id));
    } catch (e: any) { alert("No se pudo borrar: " + e.message); }
  };

  const filtrados = useMemo(() => {
    return casos.filter((c) => {
      if (verArchivados ? !c.archivado : !!c.archivado) return false;
      if (entidad !== "todas" && (c.entidad || "") !== entidad) return false;
      if (!q) return true;
      const blob = `${c.folio || ""} ${c.expediente || ""} ${c.expediente_origen || ""} ${c.diligencia || ""} ${c.juzgado_origen || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [casos, q, entidad, verArchivados]);

  const PAGE = 20;
  const [pagina, setPagina] = useState(0);
  useEffect(() => { setPagina(0); }, [q, entidad, verArchivados]);
  const totalPag = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const paginados = filtrados.slice(pag * PAGE, pag * PAGE + PAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Exhortos"
        description={cargando ? "Cargando exhortos…" : `${filtrados.length} de ${casos.length} exhortos.`}
        actions={
          <button onClick={() => setNuevoOpen(true)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "#0C5C46" }}>
            <Plus className="h-4 w-4" /> Nuevo exhorto
          </button>
        }
      />

      {nuevoOpen && <NuevoExhortoModal onClose={() => setNuevoOpen(false)} onCreado={() => { setNuevoOpen(false); cargar(); }} />}

      <Card className="legal-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Folio, expediente, diligencia…" className="pl-8" />
          </div>
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Todos los estados</option>
            <option value="Sinaloa">Sinaloa</option>
            <option value="CDMX">CDMX</option>
            <option value="BCS">BCS</option>
            <option value="Jalisco">Jalisco</option>
          </select>
        </div>
        <button onClick={() => setVerArchivados((v) => !v)} className={`mt-2 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${verArchivados ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-input text-muted-foreground"}`}>
          <Archive className="h-3.5 w-3.5" /> {verArchivados ? "Viendo archivados — volver a activos" : "Ver archivados"}
        </button>
      </Card>

      {error && <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudieron cargar los exhortos: {error}</Card>}

      <Card className="legal-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Folio / Exp. exhortado</th>
                <th className="text-left px-4 py-2.5">Origen → Exhortado</th>
                <th className="text-left px-4 py-2.5">Diligencia</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Vence</th>
                <th className="px-2 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginados.map((c) => (
                <tr key={c.id} onClick={() => abrirFicha(c)} className="cursor-pointer hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-semibold text-[color:var(--teal)]">
                      {leFalta(c) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                      {c.folio || "— sin folio —"}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.expediente || ""}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="max-w-[220px] truncate" title={c.juzgado_origen || ""}>{c.juzgado_origen || "—"}</p>
                    <p className="max-w-[220px] truncate text-muted-foreground" title={c.juzgado || ""}>→ {c.juzgado || "—"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
                  </td>
                  <td className="px-4 py-3"><p className="max-w-[200px] truncate" title={c.diligencia || ""}>{c.diligencia || "—"}</p></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tono[(c.estatus_general || "").toUpperCase()] || "bg-muted text-muted-foreground"}`}>{c.estatus_general || "—"}</span></td>
                  <td className="px-4 py-3 tabular-nums">{fmt(c.fecha_vence)}</td>
                  <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <FilaAcciones archivado={!!c.archivado} onEvidencia={() => irEvidencia(c)} onArchivar={() => archivar(c)} onBorrar={() => borrar(c)} />
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin exhortos. Usa "Nuevo exhorto".</td></tr>}
              {cargando && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tarjetas (celular) */}
      <div className="space-y-2 md:hidden">
        {cargando ? (
          <Card className="legal-card p-6 text-center text-sm text-muted-foreground">Cargando…</Card>
        ) : filtrados.length === 0 ? (
          <Card className="legal-card p-6 text-center text-sm text-muted-foreground">Sin exhortos.</Card>
        ) : (
          paginados.map((c) => (
            <Card key={c.id} onClick={() => abrirFicha(c)} className="legal-card cursor-pointer p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-[color:var(--teal)]">
                  {leFalta(c) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                  <span className="truncate">{c.folio || c.expediente || "— sin folio —"}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tono[(c.estatus_general || "").toUpperCase()] || "bg-muted text-muted-foreground"}`}>{c.estatus_general || "—"}</span>
                  <FilaAcciones archivado={!!c.archivado} onEvidencia={() => irEvidencia(c)} onArchivar={() => archivar(c)} onBorrar={() => borrar(c)} />
                </div>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.juzgado_origen || "—"} → {c.juzgado || "—"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
              {c.diligencia && <p className="mt-0.5 text-xs">Diligencia: {c.diligencia}</p>}
              {c.fecha_vence && <p className="mt-0.5 text-xs text-muted-foreground">Vence: {fmt(c.fecha_vence)}</p>}
            </Card>
          ))
        )}
      </div>

      {filtrados.length > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtrados.length} exhortos · pág. {pag + 1} de {totalPag}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(pag - 1)} disabled={pag === 0} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button>
            <button onClick={() => setPagina(pag + 1)} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

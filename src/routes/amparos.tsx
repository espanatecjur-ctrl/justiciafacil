import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { NuevoAmparoModal } from "@/components/nuevo-amparo";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FilaAcciones } from "@/components/fila-acciones";
import { Search, Shield, AlertTriangle, ShieldPlus, Archive } from "lucide-react";

export const Route = createFileRoute("/amparos")({
  head: () => ({ meta: [{ title: "Amparos — JusticiaFácil" }] }),
  component: AmparosPage,
});

const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

function prioridadClase(p: string | null) {
  const v = (p || "").toUpperCase();
  if (v === "ALTA") return "bg-red-100 text-red-700";
  if (v === "MEDIA") return "bg-amber-100 text-amber-800";
  if (v === "BAJA") return "bg-emerald-100 text-emerald-800";
  return "bg-muted text-muted-foreground";
}

// ⚠️ rojo si le falta lo mínimo para que el robot lo siga
function leFalta(c: CasoJuridico): boolean {
  const sinJuzgado = !(c.nombre_juzgado || c.cve_juzgado || c.juzgado);
  return sinJuzgado || !c.expediente;
}

function AmparosPage() {
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
    sbSelect<CasoJuridico>("caso_juridico", "select=*&tipo_registro=eq.amparo&order=prioridad.asc")
      .then((d) => setCasos(d))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
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
    if (!confirm(`¿Borrar el amparo ${c.expediente || "(sin número)"}? Esta acción no se puede deshacer.`)) return;
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
      const blob = `${c.expediente || ""} ${c.quejoso || ""} ${c.autoridad_responsable || ""} ${c.acto_reclamado || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [casos, q, entidad, verArchivados]);

  const PAGE = 20;
  const [pagina, setPagina] = useState(0);
  useEffect(() => { setPagina(0); }, [q, entidad, verArchivados]);
  const totalPag = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const paginados = filtrados.slice(pag * PAGE, pag * PAGE + PAGE);

  const directos = casos.filter((c) => (c.tipo_amparo || "").toUpperCase() === "DIRECTO").length;
  const indirectos = casos.filter((c) => (c.tipo_amparo || "").toUpperCase() === "INDIRECTO").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Amparos"
        description={cargando ? "Cargando amparos…" : `${filtrados.length} de ${casos.length} amparos.`}
        actions={
          <button onClick={() => setNuevoOpen(true)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "#0C5C46" }}>
            <ShieldPlus className="h-4 w-4" /> Nuevo amparo
          </button>
        }
      />

      {nuevoOpen && <NuevoAmparoModal onClose={() => setNuevoOpen(false)} onCreado={() => { setNuevoOpen(false); cargar(); }} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)]"><Shield className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{casos.length}</p><p className="text-xs text-muted-foreground">Amparos totales</p></div>
        </Card>
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-100 text-blue-700"><Shield className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{indirectos}</p><p className="text-xs text-muted-foreground">Indirectos</p></div>
        </Card>
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-cyan-100 text-cyan-700"><Shield className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{directos}</p><p className="text-xs text-muted-foreground">Directos</p></div>
        </Card>
      </div>

      <Card className="legal-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Amparo, quejoso, autoridad, acto…" className="pl-8" />
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

      {error && <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudieron cargar los amparos: {error}</Card>}

      <Card className="legal-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Amparo / Quejoso</th>
                <th className="text-left px-4 py-2.5">Tipo</th>
                <th className="text-left px-4 py-2.5">Autoridad responsable</th>
                <th className="text-left px-4 py-2.5">Acto reclamado</th>
                <th className="text-left px-4 py-2.5">Juzgado</th>
                <th className="text-left px-4 py-2.5">Prioridad</th>
                <th className="px-2 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginados.map((c) => (
                <tr key={c.id} onClick={() => abrirFicha(c)} className="cursor-pointer hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-semibold text-[color:var(--teal)]">
                      {leFalta(c) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                      {c.expediente || "— sin número —"}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.quejoso || ""}</p>
                  </td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.tipo_amparo || "—"}</span></td>
                  <td className="px-4 py-3"><p className="max-w-[220px] truncate" title={c.autoridad_responsable || ""}>{c.autoridad_responsable || "—"}</p></td>
                  <td className="px-4 py-3"><p className="max-w-[220px] truncate" title={c.acto_reclamado || ""}>{c.acto_reclamado || "—"}</p></td>
                  <td className="px-4 py-3"><p className="max-w-[220px] truncate" title={c.juzgado || ""}>{c.juzgado || "—"}</p><p className="text-xs text-muted-foreground">{c.entidad || ""}</p></td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadClase(c.prioridad)}`}>{c.prioridad || "—"}</span></td>
                  <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <FilaAcciones archivado={!!c.archivado} onEvidencia={() => irEvidencia(c)} onArchivar={() => archivar(c)} onBorrar={() => borrar(c)} />
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin amparos. Usa "Nuevo amparo".</td></tr>}
              {cargando && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tarjetas (celular) */}
      <div className="space-y-2 md:hidden">
        {cargando ? (
          <Card className="legal-card p-6 text-center text-sm text-muted-foreground">Cargando…</Card>
        ) : filtrados.length === 0 ? (
          <Card className="legal-card p-6 text-center text-sm text-muted-foreground">Sin amparos.</Card>
        ) : (
          paginados.map((c) => (
            <Card key={c.id} onClick={() => abrirFicha(c)} className="legal-card cursor-pointer p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-[color:var(--teal)]">
                  {leFalta(c) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                  <span className="truncate">{c.expediente || "— sin número —"}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadClase(c.prioridad)}`}>{c.prioridad || "—"}</span>
                  <FilaAcciones archivado={!!c.archivado} onEvidencia={() => irEvidencia(c)} onArchivar={() => archivar(c)} onBorrar={() => borrar(c)} />
                </div>
              </div>
              {c.quejoso && <p className="truncate text-xs text-muted-foreground">Quejoso: {c.quejoso}</p>}
              <p className="mt-0.5 text-xs"><span className="font-medium">{c.tipo_amparo || "—"}</span>{c.entidad ? ` · ${c.entidad}` : ""}{c.juzgado ? ` · ${c.juzgado}` : ""}</p>
              {c.acto_reclamado && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">Acto: {c.acto_reclamado}</p>}
            </Card>
          ))
        )}
      </div>

      {filtrados.length > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtrados.length} amparos · pág. {pag + 1} de {totalPag}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(pag - 1)} disabled={pag === 0} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button>
            <button onClick={() => setPagina(pag + 1)} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

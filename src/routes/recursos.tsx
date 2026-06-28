import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { NuevoRecursoModal } from "@/components/nuevo-recurso";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Layers, AlertTriangle, Plus, MoreVertical, FileSearch, ClipboardPlus, Archive, Trash2 } from "lucide-react";

export const Route = createFileRoute("/recursos")({
  head: () => ({ meta: [{ title: "Recursos — JusticiaFácil" }] }),
  component: RecursosPage,
});

const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

function prioridadClase(p: string | null) {
  const v = (p || "").toUpperCase();
  if (v === "ALTA") return "bg-red-100 text-red-700";
  if (v === "MEDIA") return "bg-amber-100 text-amber-800";
  if (v === "BAJA") return "bg-emerald-100 text-emerald-800";
  return "bg-muted text-muted-foreground";
}
function leFalta(c: CasoJuridico): boolean {
  const sinJuzgado = !(c.nombre_juzgado || c.cve_juzgado || c.juzgado);
  return sinJuzgado || !c.expediente;
}
const fmt = (s: string | null | undefined) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

function RowMenu({ abierto, archivado, onToggle, onAbrir, onEvidencia, onArchivar, onBorrar }: { abierto: boolean; archivado: boolean; onToggle: () => void; onAbrir: () => void; onEvidencia: () => void; onArchivar: () => void; onBorrar: () => void }) {
  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted" title="Acciones">
        <MoreVertical className="h-4 w-4" />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onToggle()} />
          <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <button onClick={onAbrir} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><FileSearch className="h-4 w-4 text-[color:var(--teal)]" /> Abrir ficha</button>
            <button onClick={onEvidencia} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><ClipboardPlus className="h-4 w-4 text-[color:var(--teal)]" /> Agregar evidencia</button>
            <button onClick={onArchivar} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><Archive className="h-4 w-4" /> {archivado ? "Desarchivar" : "Archivar"}</button>
            <div className="border-t border-border" />
            <button onClick={onBorrar} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Borrar</button>
          </div>
        </>
      )}
    </div>
  );
}

function RecursosPage() {
  const navigate = useNavigate();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState("todas");
  const [verArchivados, setVerArchivados] = useState(false);

  const cargar = () => {
    setCargando(true);
    sbSelect<CasoJuridico>("caso_juridico", "select=*&tipo_registro=eq.recurso&order=prioridad.asc")
      .then((d) => setCasos(d)).catch((e) => setError(e.message)).finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, []);

  const abrirFicha = (c: CasoJuridico) => { setMenuId(null); navigate({ to: "/expediente", search: { id: c.id, nueva: false } }); };
  const irEvidencia = (c: CasoJuridico) => { setMenuId(null); navigate({ to: "/expediente", search: { id: c.id, nueva: true } }); };
  const archivar = async (c: CasoJuridico) => {
    setMenuId(null);
    const nuevo = !c.archivado;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, { method: "PATCH", headers: wHeaders, body: JSON.stringify({ archivado: nuevo }) });
      if (!r.ok) throw new Error(String(r.status));
      setCasos((p) => p.map((x) => (x.id === c.id ? { ...x, archivado: nuevo } : x)));
    } catch (e: any) { alert("No se pudo archivar: " + e.message); }
  };
  const borrar = async (c: CasoJuridico) => {
    setMenuId(null);
    if (!confirm(`¿Borrar el recurso ${c.expediente || "(sin número)"}?`)) return;
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
      const blob = `${c.expediente || ""} ${c.promovente || ""} ${c.tipo_recurso || ""} ${c.resolucion || ""}`.toLowerCase();
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
        title="Recursos"
        description={cargando ? "Cargando recursos…" : `${filtrados.length} de ${casos.length} recursos.`}
        actions={
          <button onClick={() => setNuevoOpen(true)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "#0C5C46" }}>
            <Plus className="h-4 w-4" /> Nuevo recurso
          </button>
        }
      />

      {nuevoOpen && <NuevoRecursoModal onClose={() => setNuevoOpen(false)} onCreado={() => { setNuevoOpen(false); cargar(); }} />}

      <Card className="legal-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Expediente, promovente, tipo…" className="pl-8" />
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

      {error && <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudieron cargar los recursos: {error}</Card>}

      <Card className="legal-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Tipo / Expediente</th>
                <th className="text-left px-4 py-2.5">Promovente</th>
                <th className="text-left px-4 py-2.5">Interpuesto</th>
                <th className="text-left px-4 py-2.5">Juzgado</th>
                <th className="text-left px-4 py-2.5">Resolución</th>
                <th className="text-left px-4 py-2.5">Prioridad</th>
                <th className="px-2 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginados.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-semibold text-[color:var(--teal)]">
                      {leFalta(c) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                      {c.tipo_recurso || "Recurso"}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.expediente || "— sin número —"}</p>
                  </td>
                  <td className="px-4 py-3"><p className="max-w-[200px] truncate" title={c.promovente || ""}>{c.promovente || "—"}</p></td>
                  <td className="px-4 py-3 tabular-nums">{fmt(c.fecha_interposicion)}</td>
                  <td className="px-4 py-3"><p className="max-w-[200px] truncate" title={c.juzgado || ""}>{c.juzgado || "—"}</p><p className="text-xs text-muted-foreground">{c.entidad || ""}</p></td>
                  <td className="px-4 py-3 text-muted-foreground"><p className="max-w-[180px] truncate" title={c.resolucion || ""}>{c.resolucion || "—"}</p></td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadClase(c.prioridad)}`}>{c.prioridad || "—"}</span></td>
                  <td className="px-2 py-3 text-right">
                    <RowMenu abierto={menuId === c.id} archivado={!!c.archivado} onToggle={() => setMenuId(menuId === c.id ? null : c.id)} onAbrir={() => abrirFicha(c)} onEvidencia={() => irEvidencia(c)} onArchivar={() => archivar(c)} onBorrar={() => borrar(c)} />
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin recursos. Usa "Nuevo recurso".</td></tr>}
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
          <Card className="legal-card p-6 text-center text-sm text-muted-foreground">Sin recursos.</Card>
        ) : (
          paginados.map((c) => (
            <Card key={c.id} className="legal-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-[color:var(--teal)]">
                  {leFalta(c) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                  <span className="truncate">{c.tipo_recurso || "Recurso"} · {c.expediente || "—"}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadClase(c.prioridad)}`}>{c.prioridad || "—"}</span>
                  <RowMenu abierto={menuId === c.id} archivado={!!c.archivado} onToggle={() => setMenuId(menuId === c.id ? null : c.id)} onAbrir={() => abrirFicha(c)} onEvidencia={() => irEvidencia(c)} onArchivar={() => archivar(c)} onBorrar={() => borrar(c)} />
                </div>
              </div>
              {c.promovente && <p className="truncate text-xs text-muted-foreground">Promovente: {c.promovente}</p>}
              <p className="mt-0.5 text-xs">{c.entidad ? `${c.entidad}` : ""}{c.juzgado ? ` · ${c.juzgado}` : ""}{c.fecha_interposicion ? ` · ${fmt(c.fecha_interposicion)}` : ""}</p>
              {c.resolucion && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">Resolución: {c.resolucion}</p>}
            </Card>
          ))
        )}
      </div>

      {filtrados.length > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtrados.length} recursos · pág. {pag + 1} de {totalPag}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(pag - 1)} disabled={pag === 0} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button>
            <button onClick={() => setPagina(pag + 1)} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

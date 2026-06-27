import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import { RobotBoletines } from "@/components/robot-boletines";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Scale, AlertTriangle, Gavel } from "lucide-react";

export const Route = createFileRoute("/ucm")({
  head: () => ({ meta: [{ title: "UCM · Seguimiento a juicios — JusticiaFácil" }] }),
  component: UcmPage,
});

function prioridadClase(p: string | null) {
  const v = (p || "").toUpperCase();
  if (v === "ALTA") return "bg-red-100 text-red-700";
  if (v === "MEDIA") return "bg-amber-100 text-amber-800";
  if (v === "BAJA") return "bg-emerald-100 text-emerald-800";
  return "bg-muted text-muted-foreground";
}

function UcmPage() {
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState("todas");
  const [prioridad, setPrioridad] = useState("todas");

  useEffect(() => {
    sbSelect<CasoJuridico>("caso_juridico", "select=*&order=prioridad.asc")
      .then((d) => setCasos(d))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    return casos.filter((c) => {
      if (entidad !== "todas" && (c.entidad || "") !== entidad) return false;
      if (prioridad !== "todas" && (c.prioridad || "").toUpperCase() !== prioridad) return false;
      if (!q) return true;
      const blob = `${c.expediente || ""} ${c.cliente_nombre || ""} ${c.juzgado || ""} ${c.proveedor || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [casos, q, entidad, prioridad]);

  // paginación: máximo 20 por página (web y cel)
  const PAGE = 20;
  const [pagina, setPagina] = useState(0);
  useEffect(() => { setPagina(0); }, [q, entidad, prioridad]);
  const totalPag = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const paginados = filtrados.slice(pag * PAGE, pag * PAGE + PAGE);

  const alta = casos.filter((c) => (c.prioridad || "").toUpperCase() === "ALTA").length;
  const conExpediente = casos.filter((c) => (c.expediente || "").match(/\d+\/\d+/)).length;
  const expedientes = casos.map((c) => c.expediente);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unidad Civil y Mercantil"
        title="UCM · Seguimiento a juicios"
        description={cargando ? "Cargando juicios…" : `${filtrados.length} de ${casos.length} juicios de la unidad.`}
      />

      {/* Barra del robot (indicador central de avance) */}
      <RobotBoletines expedientes={expedientes} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)]"><Gavel className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{casos.length}</p><p className="text-xs text-muted-foreground">Juicios totales</p></div>
        </Card>
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-100 text-emerald-700"><Scale className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{conExpediente}</p><p className="text-xs text-muted-foreground">Con expediente</p></div>
        </Card>
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-red-100 text-red-700"><AlertTriangle className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{alta}</p><p className="text-xs text-muted-foreground">Prioridad alta</p></div>
        </Card>
      </div>

      <Card className="legal-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Expediente, cliente, juzgado…" className="pl-8" />
          </div>
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Todos los estados</option>
            <option value="Sinaloa">Sinaloa</option>
            <option value="CDMX">CDMX</option>
            <option value="BCS">BCS</option>
            <option value="Jalisco">Jalisco</option>
          </select>
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Toda prioridad</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>
      </Card>

      {error && (
        <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudieron cargar los juicios: {error}</Card>
      )}

      <Card className="legal-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Expediente / Cliente</th>
                <th className="text-left px-4 py-2.5">Juzgado</th>
                <th className="text-left px-4 py-2.5">Materia / Vía</th>
                <th className="text-left px-4 py-2.5">Etapa actual</th>
                <th className="text-left px-4 py-2.5">Prioridad</th>
                <th className="text-left px-4 py-2.5">Seguimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginados.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[color:var(--teal)]">{c.expediente || "— sin expediente —"}</p>
                    <p className="text-xs text-muted-foreground">{c.cliente_nombre || c.tiene_cliente || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[260px] truncate" title={c.juzgado || ""}>{c.juzgado || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.distrito_judicial || ""}{c.entidad ? ` · ${c.entidad}` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.materia || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.via_procesal || ""}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.etapa_actual || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadClase(c.prioridad)}`}>{c.prioridad || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p className="max-w-[260px] truncate" title={c.nota_adicional || ""}>{c.nota_adicional || "—"}</p>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin resultados con esos filtros.</td></tr>
              )}
              {cargando && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tarjetas (celular) */}
      <div className="space-y-2 md:hidden">
        {cargando ? (
          <Card className="legal-card p-6 text-center text-sm text-muted-foreground">Cargando…</Card>
        ) : filtrados.length === 0 ? (
          <Card className="legal-card p-6 text-center text-sm text-muted-foreground">Sin resultados con esos filtros.</Card>
        ) : (
          paginados.map((c) => (
            <Card key={c.id} className="legal-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-semibold text-[color:var(--teal)]">{c.expediente || "— sin expediente —"}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadClase(c.prioridad)}`}>{c.prioridad || "—"}</span>
              </div>
              {c.cliente_nombre && <p className="truncate text-xs text-muted-foreground">{c.cliente_nombre}</p>}
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.juzgado || "—"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
              <p className="mt-0.5 text-xs"><span className="font-medium">{c.materia || "—"}</span>{c.via_procesal ? ` · ${c.via_procesal}` : ""}{c.etapa_actual ? ` · ${c.etapa_actual}` : ""}</p>
              {c.nota_adicional && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.nota_adicional}</p>}
            </Card>
          ))
        )}
      </div>

      {/* Paginación (web y cel): máximo 20 por página */}
      {filtrados.length > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtrados.length} juicios · pág. {pag + 1} de {totalPag}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(pag - 1)} disabled={pag === 0} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button>
            <button onClick={() => setPagina(pag + 1)} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

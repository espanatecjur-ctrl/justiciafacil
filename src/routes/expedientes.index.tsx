import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import { RobotBoletines } from "@/components/robot-boletines";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";

export const Route = createFileRoute("/expedientes/")({
  head: () => ({ meta: [{ title: "Expedientes — JusticiaFácil" }] }),
  component: ExpedientesPage,
});

function prioridadClase(p: string | null) {
  const v = (p || "").toUpperCase();
  if (v === "ALTA") return "bg-red-100 text-red-700";
  if (v === "MEDIA") return "bg-amber-100 text-amber-800";
  if (v === "BAJA") return "bg-emerald-100 text-emerald-800";
  return "bg-muted text-muted-foreground";
}

function ExpedientesPage() {
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState("todas");
  const [prioridad, setPrioridad] = useState("todas");

  useEffect(() => {
    sbSelect<CasoJuridico>("caso_juridico", "select=*&order=created_at.asc")
      .then((d) => setCasos(d))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    return casos.filter((c) => {
      if (entidad !== "todas" && (c.entidad || "") !== entidad) return false;
      if (prioridad !== "todas" && (c.prioridad || "").toUpperCase() !== prioridad) return false;
      if (!q) return true;
      const blob = `${c.expediente || ""} ${c.cliente_nombre || ""} ${c.juzgado || ""} ${c.gar_id || ""} ${c.proveedor || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [casos, q, entidad, prioridad]);

  const expedientes = casos.map((c) => c.expediente);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Núcleo procesal"
        title="Expedientes"
        description={cargando ? "Cargando tus casos…" : `${filtrados.length} de ${casos.length} casos de tu cartera.`}
      />

      {/* Barra del robot */}
      <RobotBoletines expedientes={expedientes} />

      <Card className="legal-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Expediente, cliente, juzgado, proveedor…" className="pl-8" />
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
        <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudieron cargar los casos: {error}</Card>
      )}

      <Card className="legal-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Expediente</th>
                <th className="text-left px-4 py-2.5">Materia / Vía</th>
                <th className="text-left px-4 py-2.5">Juzgado</th>
                <th className="text-left px-4 py-2.5">Etapa</th>
                <th className="text-left px-4 py-2.5">Prioridad</th>
                <th className="text-left px-4 py-2.5">Unidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[color:var(--teal)]">{c.expediente || "— sin expediente —"}</p>
                    <p className="text-xs text-muted-foreground">{c.cliente_nombre || c.tiene_cliente || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.materia || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.via_procesal || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[280px] truncate" title={c.juzgado || ""}>{c.juzgado || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.distrito_judicial || ""}{c.entidad ? ` · ${c.entidad}` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.etapa_actual || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${prioridadClase(c.prioridad)}`}>{c.prioridad || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.unidad || "—"}</td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {casos.length === 0 ? "Aún no hay casos cargados (o falta permitir la lectura)." : "Sin resultados con esos filtros."}
                </td></tr>
              )}
              {cargando && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

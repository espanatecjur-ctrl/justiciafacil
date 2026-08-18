import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import { RobotBoletines } from "@/components/robot-boletines";
import { BuzonExpedientes } from "@/components/buzon-expedientes";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { detectarUbicacion, estadosDisponibles, ciudadesDeEstado } from "@/lib/ciudad-judicial";

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
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroCiudad, setFiltroCiudad] = useState("todas");
  const ciudadesDelEstado = useMemo(() => (filtroEstado === "todas" ? [] : ciudadesDeEstado(filtroEstado)), [filtroEstado]);
  const [prioridad, setPrioridad] = useState("todas");

  useEffect(() => {
    sbSelect<CasoJuridico>("caso_juridico", "select=*&order=created_at.asc")
      .then((d) => setCasos(d))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    return casos.filter((c) => {
      if (filtroEstado !== "todas") {
        const u = detectarUbicacion(c);
        if (!u || u.estado !== filtroEstado) return false;
        if (filtroCiudad !== "todas" && u.ciudad !== filtroCiudad) return false;
      }
      if (prioridad !== "todas" && (c.prioridad || "").toUpperCase() !== prioridad) return false;
      if (!q) return true;
      const blob = `${c.expediente || ""} ${c.cliente_nombre || ""} ${c.juzgado || ""} ${c.gar_id || ""} ${c.proveedor || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [casos, q, filtroEstado, filtroCiudad, prioridad]);

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
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Expediente, cliente, juzgado, proveedor…" className="pl-8" />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setFiltroCiudad("todas"); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="todas">Todos los estados</option>
            {estadosDisponibles().map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={filtroCiudad}
            onChange={(e) => setFiltroCiudad(e.target.value)}
            disabled={filtroEstado === "todas"}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="todas">{filtroEstado === "todas" ? "Elige un estado primero" : "Todas las ciudades"}</option>
            {ciudadesDelEstado.map((c) => <option key={c} value={c}>{c}</option>)}
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

      <BuzonExpedientes casos={filtrados} />
    </div>
  );
}

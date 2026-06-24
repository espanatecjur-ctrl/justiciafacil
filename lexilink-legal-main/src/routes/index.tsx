import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatTile } from "@/components/page-header";
import { EstadoBadge, RiesgoBadge } from "@/components/legal-badges";
import { expedientes, boletines, tramites, dictamenes } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, AlertTriangle, Calendar } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Tablero — SIGA-DIIPA" }] }),
  component: Dashboard,
});

function Dashboard() {
  const activos = expedientes.filter((e) => !["concluido", "archivado"].includes(e.estado));
  const criticos = expedientes.filter((e) => e.riesgo === "critico" || e.riesgo === "alto");
  const proxAudiencias = expedientes
    .flatMap((e) => e.hitos.filter((h) => h.critico).map((h) => ({ ...h, exp: e })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 5);
  const tramitesPend = tramites.filter((t) => t.estado !== "completado");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Panel general"
        title="Despacho — Vista del día"
        description="Estado consolidado de juicios, hitos críticos, dictamen IA y trámites en curso."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Expedientes activos" value={activos.length} hint={`${expedientes.length} totales`} tone="teal" />
        <StatTile label="En riesgo alto / crítico" value={criticos.length} tone="legal" />
        <StatTile label="Audiencias 30 días" value={proxAudiencias.length} tone="warning" />
        <StatTile label="Trámites pendientes" value={tramitesPend.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 legal-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-lg">Expedientes activos</CardTitle>
            <Link to="/expedientes" className="text-xs text-[color:var(--teal)] hover:underline inline-flex items-center gap-1">
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {activos.map((e) => (
                <Link
                  key={e.id}
                  to="/expedientes/$id"
                  params={{ id: e.id }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{e.numero} · {e.tipoJuicio}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.juzgado} — {e.entidad}</p>
                  </div>
                  <EstadoBadge estado={e.estado} />
                  <RiesgoBadge riesgo={e.riesgo} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="legal-card">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[color:var(--teal)]" /> Próximos hitos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {proxAudiencias.map((h) => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <div className="w-14 shrink-0 rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)] py-1 text-center">
                    <p className="text-[10px] uppercase">{new Date(h.fecha).toLocaleDateString("es-MX", { month: "short" })}</p>
                    <p className="font-display text-lg font-bold leading-none">{new Date(h.fecha).getDate()}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{h.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">{h.exp.numero} · {h.exp.juzgado}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="legal-card border-[color:var(--legal)]/30">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[color:var(--legal)]" /> Dictamen IA reciente
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {dictamenes.slice(0, 1).map((d) => (
                <div key={d.id}>
                  <p className="text-muted-foreground">Probabilidad de éxito</p>
                  <p className="font-display text-3xl font-bold text-[color:var(--teal)]">{d.probabilidadExito}%</p>
                  <p className="text-xs leading-relaxed">{d.resumen.slice(0, 140)}…</p>
                </div>
              ))}
              <Link to="/dictamen-ia" className="text-xs text-[color:var(--teal)] hover:underline">Abrir robot →</Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="legal-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Boletín judicial — últimas publicaciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {boletines.slice(0, 5).map((b) => (
              <div key={b.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{b.expediente} — {b.tipoAcuerdo}</p>
                  <span className="text-xs text-muted-foreground">{b.fecha}</span>
                </div>
                <p className="text-xs text-muted-foreground">{b.juzgado} · {b.entidad}</p>
                <p className="mt-1">{b.sintesis}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

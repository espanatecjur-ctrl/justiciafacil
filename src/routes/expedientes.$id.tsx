import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getExpediente } from "@/lib/mock-data";
import type { Expediente } from "@/lib/legal-types";
import { PageHeader } from "@/components/page-header";
import { EstadoBadge, RiesgoBadge } from "@/components/legal-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, FileText } from "lucide-react";

export const Route = createFileRoute("/expedientes/$id")({
  head: ({ params }) => ({ meta: [{ title: `Expediente ${params.id} — SIGA-DIIPA` }] }),
  loader: ({ params }) => {
    const exp = getExpediente(params.id);
    if (!exp) throw notFound();
    return exp;
  },
  component: ExpedienteDetalle,
  notFoundComponent: () => (
    <div className="p-8 text-center text-muted-foreground">Expediente no encontrado.</div>
  ),
});

function ExpedienteDetalle() {
  const e = Route.useLoaderData() as Expediente;

  return (
    <div className="space-y-6">
      <Link to="/expedientes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a expedientes
      </Link>

      <PageHeader
        eyebrow={`${e.fuero.toUpperCase()} · ${e.entidad}`}
        title={`Exp. ${e.numero}`}
        description={e.tipoJuicio}
        actions={
          <div className="flex items-center gap-2">
            <EstadoBadge estado={e.estado} />
            <RiesgoBadge riesgo={e.riesgo} />
            <Link to="/urrj">
              <Button variant="outline" className="border-[color:var(--legal)]/40 text-[color:var(--legal)] hover:bg-[color:var(--legal)]/10">
                <Bot className="h-4 w-4 mr-1.5" /> Pre-dictaminar
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="legal-card lg:col-span-2">
          <CardHeader><CardTitle className="font-display text-lg">Línea de tiempo procesal</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative border-l-2 border-[color:var(--teal)]/30 pl-5 space-y-5">
              {e.hitos.map((h) => (
                <li key={h.id} className="relative">
                  <span className={`absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full ${h.critico ? "bg-[color:var(--legal)]" : "bg-[color:var(--teal)]"} ring-4 ring-background`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{h.titulo}</p>
                    <time className="text-xs text-muted-foreground tabular-nums">{h.fecha}</time>
                  </div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{h.tipo}</p>
                  {h.descripcion && <p className="mt-1 text-sm">{h.descripcion}</p>}
                  {h.critico && <span className="legal-stamp mt-2">Crítico</span>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="legal-card">
            <CardHeader><CardTitle className="font-display text-lg">Resumen</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <p>{e.resumen}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <dt className="text-muted-foreground">Juzgado</dt><dd>{e.juzgado}</dd>
                <dt className="text-muted-foreground">Inicio</dt><dd>{e.fechaInicio}</dd>
                <dt className="text-muted-foreground">Cuantía</dt><dd>{e.cuantia ? `$ ${e.cuantia.toLocaleString("es-MX")}` : "—"}</dd>
                <dt className="text-muted-foreground">Última actuación</dt><dd>{e.ultimaActuacion}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card className="legal-card">
            <CardHeader><CardTitle className="font-display text-lg">Partes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {e.partes.map((p) => (
                <div key={p.id} className="border-l-2 border-[color:var(--teal)]/40 pl-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{p.nombre}</p>
                    <Badge variant="outline" className="text-[10px] uppercase">{p.caracter}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.rfc ?? p.curp ?? ""}{p.apoderado && ` · Ap. ${p.apoderado}`}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="legal-card">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><FileText className="h-4 w-4" /> Documentos</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Demanda, contestación, acuerdos y pruebas (módulo de adjuntos próximamente).
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

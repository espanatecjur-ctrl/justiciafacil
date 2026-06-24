import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { expedientes } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/hitos")({
  head: () => ({ meta: [{ title: "Hitos & Agenda — SIGA-DIIPA" }] }),
  component: Hitos,
});

function Hitos() {
  const todos = expedientes
    .flatMap((e) => e.hitos.map((h) => ({ ...h, exp: e })))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const hoy = new Date().toISOString().slice(0, 10);
  const futuros = todos.filter((h) => h.fecha >= hoy);
  const pasados = todos.filter((h) => h.fecha < hoy).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agenda procesal"
        title="Hitos & Vencimientos"
        description="Audiencias, plazos y notificaciones consolidadas de todos los expedientes."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="legal-card">
          <CardHeader><CardTitle className="font-display text-lg">Próximos</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {futuros.map((h) => (
              <div key={h.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-14 shrink-0 rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)] py-1 text-center">
                  <p className="text-[10px] uppercase">{new Date(h.fecha).toLocaleDateString("es-MX", { month: "short" })}</p>
                  <p className="font-display text-lg font-bold leading-none">{new Date(h.fecha).getDate()}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{h.titulo} {h.critico && <span className="legal-stamp ml-1">Crítico</span>}</p>
                  <p className="text-xs text-muted-foreground">{h.exp.numero} · {h.exp.juzgado}</p>
                </div>
              </div>
            ))}
            {futuros.length === 0 && <p className="p-5 text-sm text-muted-foreground">Sin hitos próximos.</p>}
          </CardContent>
        </Card>

        <Card className="legal-card">
          <CardHeader><CardTitle className="font-display text-lg text-muted-foreground">Histórico</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {pasados.slice(0, 12).map((h) => (
              <div key={h.id} className="flex items-start gap-3 px-5 py-3 opacity-80">
                <time className="w-20 text-xs text-muted-foreground tabular-nums">{h.fecha}</time>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{h.titulo}</p>
                  <p className="text-xs text-muted-foreground">{h.exp.numero}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

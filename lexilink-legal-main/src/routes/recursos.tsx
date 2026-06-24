import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { recursos } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/recursos")({
  head: () => ({ meta: [{ title: "Recursos — SIGA-DIIPA" }] }),
  component: Recursos,
});

function Recursos() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Recursos"
        description="Apelaciones, revisiones, quejas, revocaciones y reposiciones — control de instancias."
      />
      <Card className="legal-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-left px-4 py-2.5">Expediente</th>
              <th className="text-left px-4 py-2.5">Promovente</th>
              <th className="text-left px-4 py-2.5">Interpuesto</th>
              <th className="text-left px-4 py-2.5">Estado</th>
              <th className="text-left px-4 py-2.5">Resolución</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recursos.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 capitalize font-medium">{r.tipo}</td>
                <td className="px-4 py-3">{r.expediente}</td>
                <td className="px-4 py-3">{r.promovente}</td>
                <td className="px-4 py-3 tabular-nums">{r.fechaInterposicion}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{r.estado}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{r.resolucion ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

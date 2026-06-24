import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { exhortos } from "@/lib/mock-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/exhortos")({
  head: () => ({ meta: [{ title: "Exhortos — SIGA-DIIPA" }] }),
  component: Exhortos,
});

const tono: Record<string, string> = {
  girado: "bg-blue-100 text-blue-900",
  recibido: "bg-cyan-100 text-cyan-900",
  diligenciado: "bg-amber-100 text-amber-900",
  devuelto: "bg-slate-200 text-slate-800",
  cumplimentado: "bg-emerald-100 text-emerald-900",
};

function Exhortos() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Exhortos"
        description="Diligencias enviadas y recibidas entre juzgados — seguimiento de cumplimentación."
      />
      <Card className="legal-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Folio</th>
                <th className="text-left px-4 py-2.5">Expediente</th>
                <th className="text-left px-4 py-2.5">Origen → Exhortado</th>
                <th className="text-left px-4 py-2.5">Diligencia</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Vence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {exhortos.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold text-[color:var(--teal)]">{e.folio}</td>
                  <td className="px-4 py-3">{e.expedienteOrigen}</td>
                  <td className="px-4 py-3 text-xs">
                    {e.juzgadoOrigen}<br /><span className="text-muted-foreground">→ {e.juzgadoExhortado}</span>
                  </td>
                  <td className="px-4 py-3">{e.diligencia}</td>
                  <td className="px-4 py-3"><Badge className={`capitalize ${tono[e.estado]}`}>{e.estado}</Badge></td>
                  <td className="px-4 py-3 tabular-nums">{e.vencimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

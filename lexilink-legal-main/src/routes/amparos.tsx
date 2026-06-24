import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { amparos } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/amparos")({
  head: () => ({ meta: [{ title: "Amparos — SIGA-DIIPA" }] }),
  component: Amparos,
});

function Amparos() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Amparos"
        description="Juicios de amparo directo e indirecto — quejosos, autoridades responsables y actos reclamados."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {amparos.map((a) => (
          <Card key={a.id} className="legal-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[color:var(--legal)]" />
                  <p className="font-display text-base font-bold">{a.numero}</p>
                </div>
                <Badge className="bg-[color:var(--legal)]/10 text-[color:var(--legal)] capitalize">{a.tipo}</Badge>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <dt className="text-muted-foreground">Quejoso</dt><dd className="col-span-2 font-medium">{a.quejoso}</dd>
                <dt className="text-muted-foreground">Autoridad</dt><dd className="col-span-2">{a.autoridadResponsable}</dd>
                <dt className="text-muted-foreground">Acto reclamado</dt><dd className="col-span-2">{a.actoReclamado}</dd>
                <dt className="text-muted-foreground">Órgano</dt><dd className="col-span-2">{a.juzgadoDistrito ?? a.tribunalColegiado}</dd>
                <dt className="text-muted-foreground">Promoción</dt><dd className="col-span-2 tabular-nums">{a.fechaPromocion}</dd>
              </dl>
              <Badge variant="outline" className="capitalize">{a.estado}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

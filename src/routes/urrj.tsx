import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Gavel, FileText, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/urrj")({
  head: () => ({ meta: [{ title: "URRJ — SIGA-DIIPA" }] }),
  component: URRJ,
});

function URRJ() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trámites"
        title="URRJ — Unidad de Responsabilidades y Régimen Jurídico"
        description="Procedimientos de responsabilidad administrativa, opinión jurídica y normatividad institucional."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Scale, label: "Procedimientos PRA", value: 9 },
          { icon: Gavel, label: "Resoluciones emitidas", value: 21 },
          { icon: AlertCircle, label: "Faltas graves", value: 2 },
          { icon: FileText, label: "Opiniones jurídicas", value: 38 },
        ].map((s) => (
          <Card key={s.label} className="legal-card">
            <CardContent className="p-4">
              <s.icon className="h-5 w-5 text-[color:var(--legal)] mb-2" />
              <p className="font-display text-3xl font-bold">{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="legal-card">
          <CardHeader><CardTitle className="font-display text-lg">Documentos URRJ</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {[
                "Ley General de Responsabilidades Administrativas (vigente)",
                "Código de Ética y Conducta Institucional",
                "Lineamientos URRJ-2026",
                "Formato de denuncia URRJ-DN-01",
                "Plantilla de Opinión Jurídica URRJ-OJ",
              ].map((d) => (
                <li key={d} className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-[color:var(--legal)]" /> {d}</span>
                  <button className="text-xs text-[color:var(--teal)] hover:underline">Abrir</button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="legal-card">
          <CardHeader><CardTitle className="font-display text-lg">Procedimientos recientes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { id: "PRA-114/2026", asunto: "Omisión de presentación de declaración patrimonial", estado: "audiencia inicial" },
              { id: "PRA-098/2026", asunto: "Conflicto de interés", estado: "alegatos" },
              { id: "PRA-072/2025", asunto: "Uso indebido de bienes", estado: "resolución" },
            ].map((p) => (
              <div key={p.id} className="border-l-2 border-[color:var(--legal)]/50 pl-3">
                <p className="font-medium">{p.id}</p>
                <p className="text-xs">{p.asunto}</p>
                <p className="text-xs text-muted-foreground capitalize">Etapa: {p.estado}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

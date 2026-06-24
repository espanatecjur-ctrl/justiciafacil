import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, FileText, Users, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/ucp")({
  head: () => ({ meta: [{ title: "UCP — SIGA-DIIPA" }] }),
  component: UCP,
});

function UCP() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trámites"
        title="UCP — Unidad de Control y Procedimientos"
        description="Procedimientos administrativos internos, control documental y cumplimiento normativo."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Building2, label: "Procedimientos abiertos", value: 14 },
          { icon: ClipboardList, label: "Auditorías en curso", value: 3 },
          { icon: Users, label: "Servidores notificados", value: 27 },
          { icon: FileText, label: "Resoluciones pendientes", value: 6 },
        ].map((s) => (
          <Card key={s.label} className="legal-card">
            <CardContent className="p-4">
              <s.icon className="h-5 w-5 text-[color:var(--teal)] mb-2" />
              <p className="font-display text-3xl font-bold">{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="legal-card">
        <CardHeader><CardTitle className="font-display text-lg">Documentos UCP existentes</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {[
              "Manual de Organización UCP — v3.2",
              "Reglamento Interno de Sustanciación",
              "Lineamientos de Control Interno 2026",
              "Formato Único de Notificación UCP-01",
              "Acta circunstanciada modelo UCP-AC",
              "Resolución administrativa modelo UCP-RA",
            ].map((d) => (
              <li key={d} className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-[color:var(--teal)]" /> {d}</span>
                <button className="text-xs text-[color:var(--teal)] hover:underline">Abrir</button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

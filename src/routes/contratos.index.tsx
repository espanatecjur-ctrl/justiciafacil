import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { contratos } from "@/lib/mock-data";
import { plantillas } from "@/lib/contract-templates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { SolicitudesContratoTabla } from "@/components/solicitudes-contrato-tabla";

export const Route = createFileRoute("/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — SIGA-DIIPA" }] }),
  component: ContratosIndex,
});

const estadoTono: Record<string, string> = {
  borrador: "bg-slate-100 text-slate-800",
  revision: "bg-amber-100 text-amber-900",
  firmado: "bg-emerald-100 text-emerald-900",
  rescindido: "bg-red-100 text-red-900",
  vencido: "bg-zinc-200 text-zinc-700",
};

function ContratosIndex() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Contratos"
        description="Repositorio de contratos firmados, en revisión y plantillas auto-llenables."
        actions={
          <Link to="/contratos/editor">
            <Button className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Nuevo contrato
            </Button>
          </Link>
        }
      />

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Plantillas disponibles</h2>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {plantillas.map((p) => (
            <Link
              key={p.tipo}
              to="/contratos/editor"
              search={{ tipo: p.tipo }}
              className="legal-card group p-4 transition hover:border-[color:var(--teal)] hover:shadow-md"
            >
              <FileText className="h-6 w-6 text-[color:var(--teal)] mb-2" />
              <p className="font-display font-bold text-sm leading-tight group-hover:text-[color:var(--teal)]">{p.nombre}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descripcion}</p>
            </Link>
          ))}
        </div>
      </div>

      <SolicitudesContratoTabla />

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Contratos existentes</h2>
        <Card className="legal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Título</th>
                  <th className="text-left px-4 py-2.5">Tipo</th>
                  <th className="text-left px-4 py-2.5">Partes</th>
                  <th className="text-left px-4 py-2.5">Firma</th>
                  <th className="text-left px-4 py-2.5">Cuantía</th>
                  <th className="text-left px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contratos.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{c.titulo}</td>
                    <td className="px-4 py-3 capitalize">{c.tipo.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-xs">{c.partes.join(" · ")}</td>
                    <td className="px-4 py-3 tabular-nums">{c.fechaFirma}</td>
                    <td className="px-4 py-3 tabular-nums">{c.cuantia ? `$ ${c.cuantia.toLocaleString("es-MX")}` : "—"}</td>
                    <td className="px-4 py-3"><Badge className={`capitalize ${estadoTono[c.estado]}`}>{c.estado}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

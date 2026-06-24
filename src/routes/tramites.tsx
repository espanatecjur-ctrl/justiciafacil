import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { tramites } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus, FileText } from "lucide-react";

export const Route = createFileRoute("/tramites")({
  head: () => ({ meta: [{ title: "Trámites — SIGA-DIIPA" }] }),
  component: Tramites,
});

const catalogo = [
  { tipo: "curp", nombre: "CURP", desc: "Clave Única de Registro de Población", portal: "https://www.gob.mx/curp/" },
  { tipo: "rfc", nombre: "RFC", desc: "Registro Federal de Contribuyentes", portal: "https://www.sat.gob.mx/" },
  { tipo: "acta_nacimiento", nombre: "Acta de Nacimiento", desc: "Copia certificada en línea", portal: "https://www.gob.mx/ActasNacimiento" },
  { tipo: "acta_matrimonio", nombre: "Acta de Matrimonio", desc: "Copia certificada (algunos estados)", portal: "https://www.gob.mx/" },
  { tipo: "acta_defuncion", nombre: "Acta de Defunción", desc: "Copia certificada", portal: "https://www.gob.mx/" },
  { tipo: "infonavit", nombre: "Estado de cuenta Infonavit", desc: "Saldo, descuentos y avalúo", portal: "https://micuenta.infonavit.org.mx/" },
  { tipo: "imss", nombre: "Constancia IMSS", desc: "Semanas cotizadas, NSS", portal: "https://www.imss.gob.mx/" },
  { tipo: "antecedentes", nombre: "Carta de no antecedentes", desc: "Por entidad", portal: "" },
  { tipo: "constancia_situacion_fiscal", nombre: "Constancia Situación Fiscal", desc: "Vigente, opinión positiva", portal: "https://www.sat.gob.mx/" },
] as const;

const estadoTono: Record<string, string> = {
  solicitado: "bg-blue-100 text-blue-900",
  en_proceso: "bg-amber-100 text-amber-900",
  documentos_pendientes: "bg-orange-100 text-orange-900",
  completado: "bg-emerald-100 text-emerald-900",
  rechazado: "bg-red-100 text-red-900",
};

function Tramites() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trámites de gobierno"
        title="Documentos oficiales"
        description="Gestión interna + acceso a portales oficiales: CURP, RFC, actas, Infonavit, IMSS, SAT."
        actions={
          <Button className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Nueva solicitud
          </Button>
        }
      />

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Catálogo de trámites</h2>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-3">
          {catalogo.map((c) => (
            <Card key={c.tipo} className="legal-card">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-[color:var(--teal)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button size="sm" variant="outline">Solicitar interno</Button>
                  {c.portal && (
                    <a href={c.portal} target="_blank" rel="noopener noreferrer" className="text-xs text-[color:var(--teal)] hover:underline inline-flex items-center gap-1">
                      Portal oficial <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Seguimiento</h2>
        <Card className="legal-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Tipo</th>
                <th className="text-left px-4 py-2.5">Solicitante</th>
                <th className="text-left px-4 py-2.5">Solicitado</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tramites.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 capitalize font-medium">{t.tipo.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">{t.solicitante}</td>
                  <td className="px-4 py-3 tabular-nums">{t.fechaSolicitud}</td>
                  <td className="px-4 py-3"><Badge className={`capitalize ${estadoTono[t.estado]}`}>{t.estado.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.notas ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { plantillas } from "@/lib/contract-templates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Loader2 } from "lucide-react";
import { SolicitudesContratoTabla } from "@/components/solicitudes-contrato-tabla";
import { listarContratos, type ContratoGenerado } from "@/lib/contrato-generado";

export const Route = createFileRoute("/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — SIGA-DIIPA" }] }),
  component: ContratosIndex,
});

const estadoTono: Record<string, string> = {
  generado: "bg-emerald-100 text-emerald-900",
  archivado: "bg-slate-100 text-slate-800",
  papelera: "bg-red-100 text-red-900",
};

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function ContratosIndex() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Contratos"
        description="Repositorio de contratos generados, guardados y plantillas auto-llenables."
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

      <ContratosExistentes />
    </div>
  );
}

function ContratosExistentes() {
  const [lista, setLista] = useState<ContratoGenerado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    listarContratos("generado").then(setLista).finally(() => setCargando(false));
  }, []);

  return (
    <div>
      <h2 className="font-display text-lg font-bold mb-3">Contratos existentes</h2>
      <Card className="legal-card overflow-hidden">
        {cargando ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : lista.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Aún no hay contratos guardados. Genera uno en el Editor y pícale “Guardar”.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Folio</th>
                  <th className="text-left px-4 py-2.5">Documento</th>
                  <th className="text-left px-4 py-2.5">Cliente</th>
                  <th className="text-left px-4 py-2.5">Firma (apoderado)</th>
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-4 py-2.5">Cuantía</th>
                  <th className="text-left px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{c.folio || "—"}</td>
                    <td className="px-4 py-3">{c.nombre_documento || "—"}</td>
                    <td className="px-4 py-3">{c.nombre_cliente || "—"}</td>
                    <td className="px-4 py-3 text-xs">{c.apoderado || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{fmtFecha(c.fecha_generado || c.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{c.cuantia ? `$ ${Number(c.cuantia).toLocaleString("es-MX")}` : "—"}</td>
                    <td className="px-4 py-3"><Badge className={`capitalize ${estadoTono[c.estado || "generado"] || ""}`}>{c.estado || "generado"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

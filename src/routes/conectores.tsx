import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { conectores } from "@/lib/conectores";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plug } from "lucide-react";

export const Route = createFileRoute("/conectores")({
  head: () => ({ meta: [{ title: "Conectores Juzgados — SIGA-DIIPA" }] }),
  component: Conectores,
});

const estadoTono: Record<string, string> = {
  operativo: "bg-emerald-100 text-emerald-900",
  intermitente: "bg-amber-100 text-amber-900",
  no_disponible: "bg-red-100 text-red-900",
  en_desarrollo: "bg-blue-100 text-blue-900",
};

function Conectores() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operación"
        title="Conectores — Juzgados México"
        description="Adaptadores configurables a sistemas de los Poderes Judiciales (PJF, TSJ estatales y proveedores como Búho Legal)."
      />

      <Card className="legal-card p-4 bg-[color:var(--teal)]/5 border-[color:var(--teal)]/30">
        <p className="text-sm">
          <strong>Nota:</strong> México no cuenta con una API pública unificada de los poderes judiciales.
          Cada conector usa scraping configurable, API privada (cuando existe) o RPA.
          Para conectar <strong>Búho Legal</strong> u otro proveedor comercial, agrega la API key desde Configuración → Conectores.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {conectores.map((c) => (
          <Card key={c.id} className="legal-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display font-bold leading-tight">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{c.fuero} · {c.entidad}</p>
                </div>
                <Badge className={`shrink-0 capitalize ${estadoTono[c.estado]}`}>{c.estado.replace(/_/g, " ")}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.capacidades.map((cap) => (
                  <span key={cap} className="text-[10px] bg-muted px-1.5 py-0.5 rounded capitalize">{cap.replace(/_/g, " ")}</span>
                ))}
              </div>

              <p className="mt-3 text-xs"><span className="text-muted-foreground">Método:</span> <span className="font-medium uppercase">{c.metodo}</span></p>
              {c.notas && <p className="mt-2 text-xs text-muted-foreground italic">{c.notas}</p>}

              <div className="mt-4 flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" className="border-[color:var(--teal)]/40 text-[color:var(--teal)]">
                  <Plug className="h-3.5 w-3.5 mr-1" /> Configurar
                </Button>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-[color:var(--teal)] inline-flex items-center gap-1">
                  Portal <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

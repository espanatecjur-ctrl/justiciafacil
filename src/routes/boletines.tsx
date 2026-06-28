import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { BuscadorBoletin } from "@/components/buscador-boletin";

export const Route = createFileRoute("/boletines")({
  head: () => ({ meta: [{ title: "Boletín Judicial — SIGA-DIIPA" }] }),
  component: Boletines,
});

function Boletines() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Boletín Judicial"
        description="Consulta cualquier expediente en vivo en los boletines de Sinaloa, Baja California Sur (La Paz) y Jalisco (Zona Metropolitana y Foráneos). Solo consulta lo que pidas; no vigila nada."
      />
      <BuscadorBoletin />
    </div>
  );
}

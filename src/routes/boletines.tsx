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
        description="Busca cualquier expediente en el boletín del Tribunal de Sinaloa, en vivo. No vigila nada: solo consulta lo que pidas."
      />
      <BuscadorBoletin />
    </div>
  );
}

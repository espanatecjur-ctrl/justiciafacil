import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { LiquidacionIntereses } from "@/components/liquidacion-intereses";

export const Route = createFileRoute("/liquidacion")({
  head: () => ({ meta: [{ title: "Liquidación de Intereses — SIGA-DIIPA" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inteligencia"
        title="Liquidación de Intereses"
        description="Calculadora del incidente de liquidación de intereses (método flat y método real)."
      />
      <LiquidacionIntereses />
    </div>
  );
}

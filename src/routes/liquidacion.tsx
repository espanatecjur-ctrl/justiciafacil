import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { LiquidacionIntereses } from "@/components/liquidacion-intereses";

export const Route = createFileRoute("/liquidacion")({
  head: () => ({ meta: [{ title: "Liquidación de Intereses — SIGA-DIIPA" }] }),
  component: Pagina,
});

function Pagina() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Inteligencia"
        title="Liquidación de Intereses"
        description="Calculadora del incidente de liquidación de intereses. Fase 1: método flat (estimado rápido)."
      />
      <LiquidacionIntereses />
    </div>
  );
}

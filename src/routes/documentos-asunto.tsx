import { createFileRoute, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Link2, FolderOpen } from "lucide-react";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import { PanelDocumentosAsunto } from "@/components/panel-documentos-asunto";
import { RegistrarDocumentoFisico } from "@/components/registrar-documento-fisico";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";

const searchSchema = z.object({
  unidad: z.enum(["UCM", "UCP", "UDP", "UFC"]),
  id: z.string(),
});

export const Route = createFileRoute("/documentos-asunto")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Ficha de documentos — JusticiaFácil" }] }),
  component: DocumentosAsuntoPage,
});

// Ficha propia y dedicada de documentos para UN asunto — su propio espacio, que se va
// alimentando con lo que se sube o se relaciona (digital, físico, copiado del Drive).
function DocumentosAsuntoPage() {
  const { unidad, id } = useSearch({ from: "/documentos-asunto" });
  const router = useRouter();
  const volver = () => { if (window.history.length > 1) router.history.back(); else router.navigate({ to: "/documentos-excel" }); };

  const [caso, setCaso] = useState<CasoJuridico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [relacionarOpen, setRelacionarOpen] = useState(false);

  useEffect(() => {
    setCargando(true);
    sbSelect<CasoJuridico>("caso_juridico", `select=*&id=eq.${id}`)
      .then((d) => setCaso(d[0] || null))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;
  if (!caso) return <div className="p-8 text-sm text-muted-foreground">No se encontró el asunto. <button onClick={volver} className="underline">Volver</button></div>;

  const asunto: AsuntoUnificado = {
    id: caso.id!,
    unidad,
    cliente: caso.cliente_nombre ?? null,
    expediente: caso.expediente ?? null,
    no_credito: (caso as any).no_credito ?? null,
    direccion: caso.direccion_garantia ?? null,
    detalle: (caso as any).etapa_actual ?? null,
    casoJuridicoId: caso.id!,
  };

  return (
    <div className="space-y-4">
      <button onClick={volver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Volver</button>

      <PageHeader
        eyebrow={`${unidad} · Ficha de documentos`}
        title={caso.cliente_nombre || "Sin nombre"}
        description={`${caso.expediente ? `Exp. ${caso.expediente}` : "Sin expediente"}${(caso as any).folio ? ` · Folio ${(caso as any).folio}` : ""}${caso.direccion_garantia ? ` · ${caso.direccion_garantia}` : ""}`}
        actions={
          <button onClick={() => setRelacionarOpen(true)} className="flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">
            <Link2 className="h-4 w-4" /> Relacionar físico o fijo
          </button>
        }
      />

      <Card className="legal-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-[color:var(--teal)]" />
          <h3 className="text-sm font-semibold">Inventario completo de este asunto</h3>
        </div>
        <PanelDocumentosAsunto asunto={asunto} />
      </Card>

      {relacionarOpen && (
        <RegistrarDocumentoFisico asunto={asunto} onClose={() => setRelacionarOpen(false)} />
      )}
    </div>
  );
}

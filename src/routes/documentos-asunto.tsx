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
import { devolucionJC, type DevolucionJC } from "@/lib/juris-clientes";

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
  const [devolucion, setDevolucion] = useState<DevolucionJC | null>(null);

  useEffect(() => {
    setCargando(true);
    sbSelect<CasoJuridico>("caso_juridico", `select=*&id=eq.${id}`)
      .then((d) => {
        const c = d[0] || null;
        setCaso(c);
        const jcId = (c as any)?.cliente_jc_id;
        if (jcId) devolucionJC(String(jcId)).then(setDevolucion);
      })
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

      {devolucion && (devolucion.fechaVencimiento || devolucion.fechaVencimientoCliente || devolucion.modalidad) && (
        <Card className="legal-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Datos de devolución {devolucion.modalidad ? `(${devolucion.modalidad.toUpperCase()})` : ""} — JurisConecta
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md bg-muted/50 p-2.5">
              <p className="text-[11px] text-muted-foreground">Vencimiento</p>
              <p className="text-sm font-medium">{devolucion.fechaVencimiento || devolucion.fechaVencimientoCliente || "—"}</p>
            </div>
            <div className={`rounded-md p-2.5 ${devolucion.tieneDictamenJuridico ? "bg-emerald-50" : "bg-amber-50"}`}>
              <p className={`text-[11px] ${devolucion.tieneDictamenJuridico ? "text-emerald-700" : "text-amber-700"}`}>Dictamen jurídico</p>
              <p className={`text-sm font-medium ${devolucion.tieneDictamenJuridico ? "text-emerald-800" : "text-amber-800"}`}>
                {devolucion.tieneDictamenJuridico ? `Sí · ${devolucion.fechaDictamenJuridico || "—"}` : "Pendiente"}
              </p>
            </div>
            <div className={`rounded-md p-2.5 ${devolucion.tieneDictamenRegistral ? "bg-emerald-50" : "bg-amber-50"}`}>
              <p className={`text-[11px] ${devolucion.tieneDictamenRegistral ? "text-emerald-700" : "text-amber-700"}`}>Dictamen registral</p>
              <p className={`text-sm font-medium ${devolucion.tieneDictamenRegistral ? "text-emerald-800" : "text-amber-800"}`}>
                {devolucion.tieneDictamenRegistral ? `Sí · ${devolucion.fechaDictamenRegistral || "—"}` : "Pendiente"}
              </p>
            </div>
            <div className={`rounded-md p-2.5 ${devolucion.tieneClg ? "bg-emerald-50" : "bg-amber-50"}`}>
              <p className={`text-[11px] ${devolucion.tieneClg ? "text-emerald-700" : "text-amber-700"}`}>CLG</p>
              <p className={`text-sm font-medium ${devolucion.tieneClg ? "text-emerald-800" : "text-amber-800"}`}>
                {devolucion.tieneClg ? `Sí · ${devolucion.fechaClg || "—"}` : "Pendiente"}
              </p>
            </div>
          </div>
          {devolucion.fechaCierreReal && (
            <p className="mt-2 text-xs text-muted-foreground">Cierre real (último pago de la devolución): {devolucion.fechaCierreReal}</p>
          )}
        </Card>
      )}

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

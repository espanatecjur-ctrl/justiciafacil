import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { FichaGarantia, type Fila } from "@/components/historial-predictamen";
import { ArrowLeft, Loader2 } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export const Route = createFileRoute("/ficha")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Ficha de garantía — JusticiaFácil" }] }),
  component: FichaPage,
});

function FichaPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [fila, setFila] = useState<Fila | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&id=eq.${id}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setFila(d?.[0] ?? null))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [id]);

  const volver = () => navigate({ to: "/urrj" });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="URRJ · Pre-dictamen" title="Ficha de garantía" description="Expediente completo del pre-dictamen." />
      {cargando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…</div>
      ) : !fila ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No se encontró la ficha.</p>
          <button onClick={volver} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver al historial</button>
        </div>
      ) : (
        <FichaGarantia f={fila} onVolver={volver} />
      )}
    </div>
  );
}

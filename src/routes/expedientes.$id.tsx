// ============================================================
// /expedientes/$id — antes mostraba una ficha de datos de PRUEBA
// (mock-data), no la garantía real. Ahora es un redirector: busca
// la garantía real en Supabase y manda a su ficha de verdad, según
// en qué unidad esté (UCM, UCP o URRJ) — así "Juicios atrasados",
// "Mis tareas" y cualquier otro link con el id de la garantía sí
// llevan a la pantalla donde de verdad se puede trabajar el caso.
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

export const Route = createFileRoute("/expedientes/$id")({
  component: RedirectorFicha,
});

function RedirectorFicha() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,unidad,expediente&id=eq.${id}&limit=1`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const rows = r.ok ? await r.json() : [];
        const caso = rows?.[0];
        if (!vivo) return;
        if (!caso) { setError("No se encontró esa garantía/expediente en el sistema."); return; }
        if (caso.unidad === "UCP") {
          navigate({ to: "/ucp-ficha", search: { id: caso.id } as any });
        } else if (caso.unidad === "URRJ") {
          navigate({ to: "/urrj", search: { ficha: caso.expediente || caso.id } as any });
        } else {
          // UCM (o sin unidad definida): la ficha de UCM es la más completa,
          // sirve de destino por defecto.
          navigate({ to: "/ucm-ficha", search: { id: caso.id } as any });
        }
      } catch {
        if (vivo) setError("No se pudo abrir la ficha — intenta de nuevo.");
      }
    })();
    return () => { vivo = false; };
  }, [id, navigate]);

  if (error) return (
    <div className="grid min-h-[40vh] place-items-center text-center">
      <div>
        <p className="text-sm font-medium text-red-700">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">id: {id}</p>
      </div>
    </div>
  );

  return (
    <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

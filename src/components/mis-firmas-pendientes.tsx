import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, FileSignature, ChevronRight } from "lucide-react";
import { correoActual } from "@/lib/auth";
import { misValidacionesPendientes, type ValidacionPendiente } from "@/lib/firma-solicitud";
import { SLOT_LABEL } from "@/lib/cadena-firmas-dashboard";

function hace(fechaISO: string): string {
  const dias = Math.floor((Date.now() - new Date(fechaISO).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  return `hace ${dias} días`;
}

const COLOR_SLOT: Record<string, string> = {
  elabora: "bg-slate-100 text-slate-700",
  dil: "bg-blue-100 text-blue-800",
  ucm: "bg-purple-100 text-purple-800",
  dge: "bg-amber-100 text-amber-800",
  precio: "bg-emerald-100 text-emerald-800",
  gad: "bg-slate-100 text-slate-700",
  dgc: "bg-slate-100 text-slate-700",
};

export function MisFirmasPendientes() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<ValidacionPendiente[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    correoActual()
      .then((c) => misValidacionesPendientes(c || ""))
      .then(setLista)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-[color:var(--teal)]" />
        <h3 className="text-sm font-semibold">Cadena de firmas</h3>
        {!cargando && <span className="ml-auto rounded-full bg-[color:var(--teal)]/10 px-2 py-0.5 text-xs font-semibold text-[color:var(--teal)]">{lista.length}</span>}
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">Elabora · DIL · UCM · Precio (Contabilidad) · DGE — solo lo que te toca firmar a ti</p>

      {cargando ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : lista.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">No tienes firmas ni validaciones pendientes.</p>
      ) : (
        <div className="space-y-2">
          {lista.slice(0, 12).map((v) => (
            <button
              key={v.token}
              onClick={() => navigate({ to: "/firmar", search: { token: v.token } as any })}
              className="flex w-full items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-muted/30"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLOR_SLOT[v.slot] || "bg-slate-100 text-slate-700"}`}>{SLOT_LABEL[v.slot] || v.slot}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{v.area}</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium">{v.cliente_nombre || v.direccion_garantia || "—"}</p>
                <p className="text-[11px] text-muted-foreground">Exp. {v.expediente || "—"} · {hace(v.created_at)}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
          {lista.length > 12 && <p className="pt-1 text-center text-[11px] text-muted-foreground">y {lista.length - 12} más…</p>}
        </div>
      )}
    </div>
  );
}

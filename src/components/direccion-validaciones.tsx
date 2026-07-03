import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Loader2, Eye, FileSearch, FileText, ArrowRight } from "lucide-react";
import { listarValidacionesPositivas, type Validacion } from "@/lib/direccion-validaciones";

// Nota: algunos íconos no existen en lucide con ese nombre; los mapeamos abajo.
export function DireccionValidaciones({ onPasarFaseB }: { onPasarFaseB: (v: Validacion) => void }) {
  const [lista, setLista] = useState<Validacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { listarValidacionesPositivas().then(setLista).finally(() => setCargando(false)); }, []);

  return (
    <Card className="legal-card p-5">
      <div className="flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 text-[color:var(--teal)]" />
        <h3 className="font-display text-base font-semibold">Validaciones positivas</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Dictámenes positivos de UCP, listos para pasar a compra (Fase B).</p>

      {cargando ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : lista.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Aún no hay dictámenes positivos de UCP.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {lista.map((v) => (
            <div key={v.id} className="rounded-lg border border-emerald-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Exp. {v.expediente || "—"}{v.cliente ? <span className="font-normal text-muted-foreground"> · {v.cliente}</span> : null}</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">Dictamen positivo</span>
              </div>
              {v.garantia && <p className="mt-1 text-xs text-muted-foreground">Garantía: {v.garantia}</p>}
              <p className="mt-2 text-[13px] leading-relaxed text-foreground/80"><span className="font-medium">Por qué pasó:</span> {v.resumen}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {v.caso_id && (
                  <Link to="/expedientes/$id" params={{ id: v.caso_id }} className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs hover:bg-muted/70">
                    <Eye className="h-3.5 w-3.5" /> Vista previa
                  </Link>
                )}
                {v.caso_id && (
                  <Link to="/expedientes/$id" params={{ id: v.caso_id }} className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs hover:bg-muted/70">
                    <FileSearch className="h-3.5 w-3.5" /> Análisis
                  </Link>
                )}
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" /> Ficha resumen
                </span>
                <span className="flex-1" />
                <Button size="sm" onClick={() => onPasarFaseB(v)} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
                  Preparar pase a Fase B <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

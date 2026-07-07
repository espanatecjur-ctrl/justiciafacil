// ============================================================
//  Solicitudes pendientes de URRJ (gate de entrada al dictamen)
// ------------------------------------------------------------
//  El abogado NO dictamina en el aire: parte de una solicitud que
//  la Dirección ya envió (documentos + "están completos"). Cada
//  solicitud dice a qué dictamen va: Jurídico o Registral.
// ============================================================
import { useEffect, useState } from "react";
import { Inbox, Paperclip, FileText, ArrowRight, RefreshCw } from "lucide-react";
import { listarSolicitudesPredictamen, type SolicitudPredictamen } from "@/lib/solicitud-predictamen";

export function SolicitudesURRJ({ onDictaminar }: { onDictaminar: (sol: SolicitudPredictamen) => void }) {
  const [lista, setLista] = useState<SolicitudPredictamen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [verTodas, setVerTodas] = useState(false);
  const visibles = verTodas ? lista : lista.slice(0, 3);

  const cargar = () => {
    setCargando(true);
    listarSolicitudesPredictamen("pendiente")
      .then((l) => setLista(l.filter((s) => s.area === "URRJ")))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-[color:var(--teal)]" />
        <h3 className="font-display text-base font-semibold">Solicitudes de URRJ para dictaminar</h3>
        <button onClick={cargar} className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Estas son las garantías que la Dirección ya envió con sus documentos. Elige una para dictaminar.</p>

      {cargando ? (
        <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          No hay solicitudes pendientes para URRJ. La Dirección debe enviar los documentos desde “Documentos → pre-dictamen”.
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {visibles.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Exp. {s.expediente || "—"}{s.cliente ? <span className="font-normal text-muted-foreground"> · {s.cliente}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  <Paperclip className="mr-1 inline h-3 w-3" />{s.documentos?.length || 0} documento(s){s.juzgado ? ` · ${s.juzgado}` : ""}
                </p>
                {s.nota && <p className="mt-0.5 text-xs italic text-muted-foreground">“{s.nota}”</p>}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.tipo_dictamen === "Registral" ? "bg-amber-100 text-amber-800" : "bg-[color:var(--teal)]/10 text-[color:var(--teal)]"}`}>
                  Dictamen {s.tipo_dictamen || "Jurídico"}
                </span>
              </div>
              <button
                onClick={() => onDictaminar(s)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ background: "#0C5C46" }}
              >
                <FileText className="h-4 w-4" /> Dictaminar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
          {lista.length > 3 && (
            <button onClick={() => setVerTodas((v) => !v)} className="w-full py-2 text-center text-xs font-medium text-[color:var(--teal)] hover:underline">
              {verTodas ? "Ver menos" : `Ver todas (${lista.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

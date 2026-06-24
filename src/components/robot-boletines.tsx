import { useEffect, useState } from "react";
import { sbSelect } from "@/lib/supabase";
import { Bot, ChevronRight, AlertTriangle } from "lucide-react";

const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";

export interface AcuerdoJudicial {
  id: string;
  expediente: string | null;
  juzgado: string | null;
  fecha_acuerdo: string | null;
  tipo_acuerdo: string | null;
  texto: string | null;
  urgente: boolean | null;
  leido: boolean | null;
}

/**
 * Barra del robot. Muestra los acuerdos que el robot encontró,
 * filtrados a los expedientes de ESTE módulo (se le pasan en `expedientes`).
 * Si no se pasa lista, muestra todos los recientes.
 */
export function RobotBoletines({
  expedientes,
  titulo = "Avance automático del robot",
}: {
  expedientes?: (string | null)[];
  titulo?: string;
}) {
  const [acuerdos, setAcuerdos] = useState<AcuerdoJudicial[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    sbSelect<AcuerdoJudicial>("acuerdo_judicial", "select=*&order=fecha_acuerdo.desc&limit=50")
      .then((d) => setAcuerdos(d))
      .catch(() => setAcuerdos([]))
      .finally(() => setCargando(false));
  }, []);

  // Filtra a los expedientes del módulo (si se pasó la lista)
  const set = expedientes
    ? new Set(expedientes.filter(Boolean).map((e) => (e as string).trim()))
    : null;
  const propios = set
    ? acuerdos.filter((a) => a.expediente && set.has(a.expediente.trim()))
    : acuerdos;

  const total = propios.length;
  const urgentes = propios.filter((a) => a.urgente).length;

  return (
    <div
      className="relative overflow-hidden rounded-xl p-4 text-white shadow-sm"
      style={{ background: `linear-gradient(120deg, ${NAVY} 0%, #103A3A 55%, #0C5C46 100%)` }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: GOLD }} />
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/12"
          style={{ boxShadow: `0 0 0 1.5px ${GOLD}` }}
        >
          <Bot className="h-6 w-6" style={{ color: GOLD }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: GOLD }}>{titulo}</p>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] border border-white/15">Boletín · hoy</span>
          </div>

          {cargando ? (
            <p className="mt-1 text-sm text-white/70">Consultando el boletín…</p>
          ) : total === 0 ? (
            <p className="mt-1 text-sm text-white/75">
              Sin movimientos nuevos en los expedientes de este módulo. El robot avisará en cuanto el boletín publique algo.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-white/90">
                El robot encontró <b>{total}</b> movimiento{total !== 1 ? "s" : ""}
                {urgentes > 0 && (
                  <> · <span className="text-amber-300">{urgentes} urgente{urgentes !== 1 ? "s" : ""}</span></>
                )} en tus expedientes.
              </p>
              <div className="mt-2 space-y-1.5">
                {propios.slice(0, 3).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: a.urgente ? "#f87171" : "#34d399" }}
                    />
                    {a.urgente && <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
                    <span className="font-mono text-xs text-white/80">Exp. {a.expediente}</span>
                    <span className="truncate text-white/85">{a.tipo_acuerdo || a.texto || a.juzgado}</span>
                  </div>
                ))}
              </div>
              {total > 3 && (
                <button className="mt-2 inline-flex items-center gap-1 text-xs text-white/80 hover:text-white">
                  Ver los {total} movimientos <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

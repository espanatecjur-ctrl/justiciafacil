import { useEffect, useState } from "react";
import { Check, CircleDot, Circle } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { tipoJuicioPorClave } from "@/lib/etapas-juicio";
import { obtenerSeguimiento, type SeguimientoJuicio } from "@/lib/seguimiento-juicio";

const TEAL = "#0C5C46";
const NAVY = "#0B1E3A";

// Línea del tiempo compacta de las etapas del juicio (dónde vamos y qué sigue).
// Lee lo que marcaste en el modal; el boletín se usa como referencia en el propio modal.
export function LineaTiempoJuicio({ caso, onAbrir }: { caso: CasoJuridico; onAbrir?: () => void }) {
  const [seg, setSeg] = useState<SeguimientoJuicio | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerSeguimiento(caso).then(setSeg).finally(() => setCargando(false));
  }, [caso.id]);

  if (cargando) return null;

  const tipoDef = tipoJuicioPorClave(seg?.tipo_juicio);

  // sin configurar todavía
  if (!seg || !tipoDef) {
    return (
      <button onClick={onAbrir} className="w-full rounded-xl border border-dashed border-border bg-muted/30 p-3 text-left text-xs text-muted-foreground hover:bg-muted/50">
        Aún no has configurado el <b>seguimiento del juicio</b>. Toca aquí o el botón "Seguimiento del juicio" para elegir el tipo y marcar las etapas.
      </button>
    );
  }

  const etapas = tipoDef.etapas;
  const hechas = new Set(seg.etapas_hechas || []);
  const actualIdx = etapas.findIndex((e) => e.clave === seg.etapa_actual);
  const actual = actualIdx >= 0 ? etapas[actualIdx] : null;
  const siguiente = actualIdx >= 0 && actualIdx + 1 < etapas.length ? etapas[actualIdx + 1] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold" style={{ color: NAVY }}>
          Línea del tiempo · <span className="font-normal text-muted-foreground">{tipoDef.tipo} · {tipoDef.via === "oral" ? "Oral" : "Escrito"}{seg.posicion ? ` · ${seg.posicion}` : ""}</span>
        </p>
        {onAbrir && <button onClick={onAbrir} className="text-[11px] font-medium text-[color:var(--teal)] hover:underline">Ver / editar</button>}
      </div>

      {/* línea horizontal de puntos */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {etapas.map((e, i) => {
          const esActual = e.clave === seg.etapa_actual;
          const esHecha = hechas.has(e.clave);
          const ultimo = i === etapas.length - 1;
          return (
            <div key={e.clave} className="flex min-w-[70px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : esHecha || esActual ? "bg-[color:var(--teal)]" : "bg-border"}`} />
                {esActual ? <CircleDot className="h-4 w-4 shrink-0" style={{ color: TEAL }} /> : esHecha ? <Check className="h-4 w-4 shrink-0 text-[color:var(--teal)]" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <div className={`h-0.5 flex-1 ${ultimo ? "opacity-0" : esHecha ? "bg-[color:var(--teal)]" : "bg-border"}`} />
              </div>
              <span className={`mt-1 text-center text-[9px] leading-tight ${esActual ? "font-semibold text-foreground" : esHecha ? "text-foreground" : "text-muted-foreground"}`}>{e.nombre}</span>
            </div>
          );
        })}
      </div>

      {/* dónde vamos / qué sigue */}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-[color:var(--teal)]/5 p-2 text-xs">
          <span className="text-[10px] font-semibold text-[color:var(--teal)]">DÓNDE VAMOS</span>
          <p>{actual ? actual.nombre : "Sin etapa marcada"}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <span className="text-[10px] font-semibold text-muted-foreground">QUÉ SIGUE (aprox.)</span>
          <p>{siguiente ? siguiente.nombre : actual ? "Última etapa / cierre" : "—"}</p>
        </div>
      </div>
    </div>
  );
}

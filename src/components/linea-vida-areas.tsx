import { useEffect, useState } from "react";
import { Check, X as XIcon, Clock, Circle, ChevronDown } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import { AREAS_LINEA, COLOR_ESTADO, obtenerRecorrido, marcarArea, type PasoRecorrido, type EstadoArea } from "@/lib/recorrido";

const NAVY = "#0B1E3A";

// Línea de Vida: por cuáles ÁREAS ha pasado el expediente y con qué resultado.
// verde=positivo · rojo=negativo · naranja=espera · gris=no aplica todavía.
// Cada área se marca por decisión humana (menú al tocar el punto).
export function LineaVidaAreas({ caso }: { caso: CasoJuridico }) {
  const [pasos, setPasos] = useState<Record<string, PasoRecorrido>>({});
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  const cargar = () => { obtenerRecorrido(caso).then(setPasos).finally(() => setCargando(false)); };
  useEffect(cargar, [caso.id]);

  const marcar = async (area: string, estado: EstadoArea) => {
    let email: string | null = null;
    try { const a = await getAuth(); const { data } = await a.auth.getSession(); email = data.session?.user?.email ?? null; } catch { /* opcional */ }
    const ok = await marcarArea(caso, area, estado, nota || null, email);
    if (ok) { setAbierta(null); setNota(""); cargar(); }
  };

  const iconoEstado = (estado: string | undefined) => {
    if (estado === "positivo") return <Check className="h-4 w-4" style={{ color: COLOR_ESTADO.positivo.color }} />;
    if (estado === "negativo") return <XIcon className="h-4 w-4" style={{ color: COLOR_ESTADO.negativo.color }} />;
    if (estado === "espera") return <Clock className="h-4 w-4" style={{ color: COLOR_ESTADO.espera.color }} />;
    return <Circle className="h-3.5 w-3.5" style={{ color: COLOR_ESTADO.gris.color }} />;
  };

  if (cargando) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold" style={{ color: NAVY }}>Línea de vida · recorrido por áreas</p>

      {/* fila de áreas */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {AREAS_LINEA.map((area, i) => {
          const paso = pasos[area];
          const esSVT = area === "SVT"; // por ahora SVT no se usa → gris
          const estado = esSVT ? undefined : paso?.estado;
          const col = COLOR_ESTADO[estado || "gris"];
          const ultimo = i === AREAS_LINEA.length - 1;
          return (
            <div key={area} className="flex min-w-[64px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : ""}`} style={{ background: i === 0 ? "transparent" : "#e5e7eb" }} />
                <button
                  onClick={() => !esSVT && setAbierta(abierta === area ? null : area)}
                  disabled={esSVT}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2"
                  style={{ borderColor: col.color, background: col.bg }}
                  title={esSVT ? "SVT — no aplica todavía" : `${area}: ${col.texto} (toca para cambiar)`}
                >
                  {iconoEstado(estado)}
                </button>
                <div className={`h-0.5 flex-1 ${ultimo ? "opacity-0" : ""}`} style={{ background: ultimo ? "transparent" : "#e5e7eb" }} />
              </div>
              <span className="mt-1 text-center text-[10px] font-medium" style={{ color: col.color }}>{area}</span>
              {!esSVT && <span className="text-center text-[8px] text-muted-foreground">{col.texto}</span>}
              {esSVT && <span className="text-center text-[8px] text-muted-foreground">no aplica aún</span>}
            </div>
          );
        })}
      </div>

      {/* menú para marcar el área abierta */}
      {abierta && (
        <div className="mt-2 rounded-md border border-border bg-muted/20 p-2.5">
          <p className="mb-1.5 text-[11px] font-semibold" style={{ color: NAVY }}>Marcar <b>{abierta}</b>:</p>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)…" className="mb-2 w-full rounded border border-input bg-background px-2 py-1 text-xs" />
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => marcar(abierta, "positivo")} className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white" style={{ background: COLOR_ESTADO.positivo.color }}>✓ Sí pasa (positivo)</button>
            <button onClick={() => marcar(abierta, "negativo")} className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white" style={{ background: COLOR_ESTADO.negativo.color }}>✗ No pasa (negativo)</button>
            <button onClick={() => marcar(abierta, "espera")} className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white" style={{ background: COLOR_ESTADO.espera.color }}>⏳ En espera</button>
            <button onClick={() => { setAbierta(null); setNota(""); }} className="rounded-md border border-input px-2.5 py-1 text-[11px]">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

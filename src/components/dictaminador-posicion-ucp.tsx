// ============================================================
// DictaminadorPosicionUCP · Selector de posición + recorrido (COMPARTIDO)
// ------------------------------------------------------------
// Junta en un solo lugar:
//   1) la pantalla "¿Cuál es la posición?" (los 5 botones), y
//   2) el despliegue del recorrido correcto según la posición.
// Se usa en JUFA (routes/urrj.tsx) y, a partir de la Parte 3, también
// dentro de la ficha UCP. Es "controlado": quien lo usa le pasa la vista
// actual (`vista`) y recibe los cambios (`onVista`), para no duplicar la
// lógica de soloRegistro / re-dictaminar.
// ============================================================
import { useState } from "react";
import { type Precarga } from "@/lib/predictamen-guardar";
import { Scale, Bot } from "lucide-react";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { RecorridoActorUCP, type ResultadosActorUCP } from "@/components/recorrido-actor-ucp";
import { RecorridoDemandadoUCP } from "@/components/recorrido-demandado-ucp";
import { RecorridoSucesorioUCP } from "@/components/recorrido-sucesorio-ucp";
import { RecorridoContingenciaUCP } from "@/components/recorrido-contingencia-ucp";
import { RecorridoTramitesUCP } from "@/components/recorrido-tramites-ucp";

export type VistaPosicionUCP = "elegir" | "Actor" | "Demandado" | "Sucesorio" | "Contingencia" | "Tramites";

interface Props {
  casos: any[];
  vista: VistaPosicionUCP;
  onVista: (v: VistaPosicionUCP) => void;
  precargar?: Precarga | null;
  onVolver: () => void;
  puedeElaborar?: boolean;
  puedeFirmarElabora?: boolean;
  puedeValidar?: boolean;
  puedeAdmin?: boolean;
  puedePrecioPiso?: boolean;
  titulo?: string;
  subtitulo?: string;
  /** Si se pasa, se reciben los resultados de motor del recorrido Actor
   *  (lo usa la ficha UCP para reflejarlos en sus hitos). */
  onResultados?: (r: ResultadosActorUCP) => void;
  /** En la ficha UCP: el recorrido Actor oculta su propio dictamen/firmas. */
  modoFicha?: boolean;
  /** Si se pasa, se muestra EN LUGAR del selector cuando vista === "elegir"
   *  (JUFA lo usa para mostrar el historial en modo soloRegistro). */
  pantallaElegir?: React.ReactNode;
}

export function DictaminadorPosicionUCP({
  casos, vista, onVista, precargar, onVolver,
  puedeElaborar = true, puedeFirmarElabora = true, puedeValidar = true, puedeAdmin = false, puedePrecioPiso = false,
  titulo = "¿Cuál es la posición de DIIPA en este caso?",
  subtitulo = "Cada posición tiene su propio recorrido de pre-dictamen.",
  onResultados,
  modoFicha = false,
  pantallaElegir,
}: Props) {
  // robot al inicio: expediente + partes + hallazgos que se llevarán al recorrido
  const [expedienteIni, setExpedienteIni] = useState("");
  const [deudorIni, setDeudorIni] = useState("");
  const [juzgadoIni, setJuzgadoIni] = useState("");
  const [hallazgosIni, setHallazgosIni] = useState<string[]>([]);
  const [mostrarRobotIni, setMostrarRobotIni] = useState(false);
  const agregarHallazgoIni = (nota: string) => {
    const marca = nota.split("\n")[0];
    setHallazgosIni((prev) => prev.some((h) => h.includes(marca)) ? prev : [...prev, nota]);
  };
  const capturarBoletin = (d: { expediente?: string; actor?: string; demandado?: string; juzgado?: string }) => {
    if (d.expediente) setExpedienteIni(d.expediente);
    if (d.demandado) setDeudorIni(d.demandado); // en Actor, el deudor es el demandado del boletín
    if (d.juzgado) setJuzgadoIni(d.juzgado);
  };

  // intento de abrir una posición (respeta el candado de elaborar)
  const abrir = (v: VistaPosicionUCP) => {
    if (!puedeElaborar) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; }
    onVista(v);
  };

  if (vista === "elegir") {
    if (pantallaElegir) return <>{pantallaElegir}</>;
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-base font-semibold">{titulo}</p>
        <p className="mb-4 text-sm text-muted-foreground">{subtitulo}</p>

        {/* Paso 1: robot al inicio (buscar el expediente antes de elegir posición) */}
        <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
          <button type="button" onClick={() => setMostrarRobotIni((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            <Bot className="h-3.5 w-3.5" /> {mostrarRobotIni ? "Ocultar robot de búsqueda" : "1) Buscar el expediente en el boletín (robot)"}
          </button>
          {hallazgosIni.length > 0 && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{hallazgosIni.length} hallazgo(s) guardado(s) — se llevarán al pre-dictamen</span>}
          {mostrarRobotIni && (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-muted-foreground">Busca el expediente en el boletín (elige estado, jurisdicción y juzgado abajo). Al <b>guardar los hallazgos</b>, se toma ese expediente y sus partes para el pre-dictamen.</p>
              <BuscadorBoletin resaltarAmparo onHallazgoAmparo={agregarHallazgoIni} onGuardarHallazgos={agregarHallazgoIni} onDatosBoletin={capturarBoletin} />
              {expedienteIni && <p className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-3 py-1.5 text-[11px] text-[color:var(--teal)]">Se usará del boletín → Exp. <b>{expedienteIni}</b>{juzgadoIni ? ` · ${juzgadoIni}` : ""}{deudorIni ? ` · Deudor: ${deudorIni}` : ""}. Luego elige la posición.</p>}
            </div>
          )}
        </div>

        {!puedeElaborar && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">🔒 Tu rol no puede elaborar pre-dictámenes nuevos. Puedes consultar el historial.</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={() => abrir("Actor")} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
            <Scale className="mb-2 h-6 w-6" style={{ color: "#0C5C46" }} />
            <p className="font-semibold">Actor</p>
            <p className="text-xs text-muted-foreground">DIIPA demanda / recupera (cesión hipotecaria). 8 fases.</p>
          </button>
          <button onClick={() => abrir("Demandado")} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
            <Scale className="mb-2 h-6 w-6" style={{ color: "#0B1E3A" }} />
            <p className="font-semibold">Demandado</p>
            <p className="text-xs text-muted-foreground">DIIPA compra los derechos del demandado-vendedor. 6 fases.</p>
          </button>
          <button onClick={() => abrir("Sucesorio")} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
            <Scale className="mb-2 h-6 w-6" style={{ color: "#C2A24C" }} />
            <p className="font-semibold">Sucesorio</p>
            <p className="text-xs text-muted-foreground">Vía herencia / posesión. Veredicto cruzado. 6 fases.</p>
          </button>
        </div>
        <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Otros saneamientos</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button onClick={() => abrir("Contingencia")} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
            <Scale className="mb-2 h-6 w-6" style={{ color: "#0C5C46" }} />
            <p className="font-semibold">Contingencia inmobiliaria</p>
            <p className="text-xs text-muted-foreground">Defectos registrales, posesión, copropiedad, doble inscripción, traslapes. 6 fases.</p>
          </button>
          <button onClick={() => abrir("Tramites")} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
            <Scale className="mb-2 h-6 w-6" style={{ color: "#0B1E3A" }} />
            <p className="font-semibold">Trámites administrativos</p>
            <p className="text-xs text-muted-foreground">Amparo, contencioso TFJA, laboral, créditos fiscales. Cuenta el plazo. 6 fases.</p>
          </button>
        </div>
      </div>
    );
  }

  // ---- despliegue del recorrido según la posición ----
  if (vista === "Actor") return <RecorridoActorUCP casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedeAdmin={puedeAdmin} puedePrecioPiso={puedePrecioPiso} onResultados={onResultados} modoFicha={modoFicha} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} />;
  if (vista === "Demandado") return <RecorridoDemandadoUCP casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedeAdmin={puedeAdmin} puedePrecioPiso={puedePrecioPiso} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} />;
  if (vista === "Sucesorio") return <RecorridoSucesorioUCP casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedePrecioPiso={puedePrecioPiso} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} />;
  if (vista === "Contingencia") return <RecorridoContingenciaUCP casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} />;
  if (vista === "Tramites") return <RecorridoTramitesUCP casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} />;
  return null;
}

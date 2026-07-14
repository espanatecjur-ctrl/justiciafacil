// ============================================================
// DictaminadorPosicion · Selector de posición + recorrido (COMPARTIDO)
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
import { Link } from "@tanstack/react-router";
import { type Precarga, type PredictamenExistente, buscarPredictamenPorCredito, guardarBorrador, descartarBorrador } from "@/lib/predictamen-guardar";
import { Scale, Bot } from "lucide-react";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { RecorridoActor, type ResultadosActor } from "@/components/recorrido-actor";
import { RecorridoDemandado } from "@/components/recorrido-demandado";
import { RecorridoSucesorio } from "@/components/recorrido-sucesorio";
import { RecorridoContingencia } from "@/components/recorrido-contingencia";
import { RecorridoTramites } from "@/components/recorrido-tramites";

export type VistaPosicion = "elegir" | "Actor" | "Demandado" | "Sucesorio" | "Contingencia" | "Tramites";

interface Props {
  casos: any[];
  vista: VistaPosicion;
  onVista: (v: VistaPosicion) => void;
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
  onResultados?: (r: ResultadosActor) => void;
  /** En la ficha UCP: el recorrido Actor oculta su propio dictamen/firmas. */
  modoFicha?: boolean;
  /** Si se pasa, se muestra EN LUGAR del selector cuando vista === "elegir"
   *  (JUFA lo usa para mostrar el historial en modo soloRegistro). */
  pantallaElegir?: React.ReactNode;
}

export function DictaminadorPosicion({
  casos, vista, onVista, precargar, onVolver,
  puedeElaborar = true, puedeFirmarElabora = true, puedeValidar = true, puedeAdmin = false, puedePrecioPiso = false,
  titulo = "¿Cuál es la posición de DIIPA en este caso?",
  subtitulo = "Cada posición tiene su propio recorrido de pre-dictamen.",
  onResultados,
  modoFicha = false,
  pantallaElegir,
}: Props) {
  // Datos básicos (manuales, antes de elegir posición)
  const [administradoraIni, setAdministradoraIni] = useState("");
  const [numeroCreditoIni, setNumeroCreditoIni] = useState("");
  const [direccionIni, setDireccionIni] = useState("");
  const [yaExisteCredito, setYaExisteCredito] = useState<PredictamenExistente | null>(null);
  const [revisandoCredito, setRevisandoCredito] = useState(false);
  const [borradorId, setBorradorId] = useState<string | null>(null);
  const [borradorGuardado, setBorradorGuardado] = useState(false);
  const revisarCredito = async () => {
    if (!numeroCreditoIni.trim()) { setYaExisteCredito(null); return; }
    setRevisandoCredito(true);
    const ex = await buscarPredictamenPorCredito(numeroCreditoIni);
    setYaExisteCredito(ex);
    setRevisandoCredito(false);
    // Checkpoint: en cuanto el crédito quede validado como único, se guarda un
    // borrador "Pendiente" en el historial — así no se pierde nada si no se
    // termina el dictamen ahorita. Solo se crea una vez por sesión.
    if (!ex && !borradorId) {
      const id = await guardarBorrador({ numeroCredito: numeroCreditoIni, administradora: administradoraIni, direccion: direccionIni, expediente: expedienteIni });
      if (id) { setBorradorId(id); setBorradorGuardado(true); }
    }
  };

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

  // intento de abrir una posición (respeta el candado de elaborar y el crédito duplicado)
  const abrir = (v: VistaPosicion) => {
    if (!puedeElaborar) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; }
    if (yaExisteCredito) { alert("Ese número de crédito ya tiene una garantía registrada. Revísala antes de seguir (folio " + (yaExisteCredito.folio || "—") + ")."); return; }
    onVista(v);
  };

  if (vista === "elegir") {
    if (pantallaElegir) return <>{pantallaElegir}</>;
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-base font-semibold">{titulo}</p>
        <p className="mb-4 text-sm text-muted-foreground">{subtitulo}</p>

        {/* Paso 1: datos básicos manuales (administradora, número de crédito, dirección) */}
        <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">1) Datos básicos de la garantía</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Administradora / banco</label>
              <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={administradoraIni} onChange={(e) => setAdministradoraIni(e.target.value)} placeholder="Ej. Pendulum, Zendere…" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Número de crédito</label>
              <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={numeroCreditoIni} onChange={(e) => setNumeroCreditoIni(e.target.value)} onBlur={revisarCredito} placeholder="No es el expediente" />
              {revisandoCredito && <p className="mt-1 text-[11px] text-muted-foreground">Revisando si ya existe…</p>}
              {borradorGuardado && !yaExisteCredito && <p className="mt-1 text-[11px] font-medium text-amber-700">● Guardado como <b>Pendiente</b> en el historial.</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Dirección de la garantía</label>
              <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={direccionIni} onChange={(e) => setDireccionIni(e.target.value)} />
            </div>
          </div>
          {yaExisteCredito && (
            <div className="mt-3 space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <p className="font-semibold">Ese número de crédito ya está registrado{yaExisteCredito.folio ? ` (folio ${yaExisteCredito.folio})` : ""}.</p>
              <p className="text-[13px]">No se puede agregar de nuevo. Mejor revisa o continúa ese dictamen.</p>
              <div className="flex flex-wrap gap-2">
                {yaExisteCredito.caso_id && (
                  <Link to="/expediente" search={{ id: yaExisteCredito.caso_id, origen: "urrj" } as any} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">Ver ficha (cronología / cambios)</Link>
                )}
                <button onClick={() => { setNumeroCreditoIni(""); setYaExisteCredito(null); setBorradorId(null); setBorradorGuardado(false); }} className="text-xs font-medium text-muted-foreground underline">Borrar y capturar otro crédito</button>
              </div>
            </div>
          )}
        </div>

        {/* Paso 2: robot al inicio (buscar el expediente antes de elegir posición) */}
        <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
          <button type="button" onClick={() => setMostrarRobotIni((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            <Bot className="h-3.5 w-3.5" /> {mostrarRobotIni ? "Ocultar robot de búsqueda" : "2) Buscar el expediente en el boletín (robot)"}
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
  if (vista === "Actor") return <RecorridoActor casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedeAdmin={puedeAdmin} puedePrecioPiso={puedePrecioPiso} onResultados={onResultados} modoFicha={modoFicha} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} administradoraInicial={administradoraIni} numeroCreditoInicial={numeroCreditoIni} direccionInicial={direccionIni} borradorId={borradorId} />;
  if (vista === "Demandado") return <RecorridoDemandado casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedeAdmin={puedeAdmin} puedePrecioPiso={puedePrecioPiso} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} administradoraInicial={administradoraIni} numeroCreditoInicial={numeroCreditoIni} direccionInicial={direccionIni} borradorId={borradorId} />;
  if (vista === "Sucesorio") return <RecorridoSucesorio casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedePrecioPiso={puedePrecioPiso} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} numeroCreditoInicial={numeroCreditoIni} direccionInicial={direccionIni} borradorId={borradorId} />;
  if (vista === "Contingencia") return <RecorridoContingencia casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} />;
  if (vista === "Tramites") return <RecorridoTramites casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} />;
  return null;
}

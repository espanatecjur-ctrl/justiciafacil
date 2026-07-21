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
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { type Precarga, type PredictamenExistente, buscarPredictamenPorCredito, guardarBorrador, actualizarBorrador, descartarBorrador, sincronizarSolicitud, guardarDatosBasicos } from "@/lib/predictamen-guardar";
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
  /** Datos generales que la IA detectó al resumir los documentos de la
   *  solicitud (administradora, crédito, dirección, deudor, juzgado,
   *  expediente) — se usan para autollenar "Datos básicos" sin pisar lo
   *  que la persona ya haya escrito. */
  datosDetectadosIA?: { administradora?: string | null; numero_credito?: string | null; direccion?: string | null; deudor?: string | null; juzgado?: string | null; expediente?: string | null } | null;
}

export function DictaminadorPosicion({
  casos, vista, onVista, precargar, onVolver,
  puedeElaborar = true, puedeFirmarElabora = true, puedeValidar = true, puedeAdmin = false, puedePrecioPiso = false,
  titulo = "¿Cuál es la posición de DIIPA en este caso?",
  subtitulo = "Cada posición tiene su propio recorrido de pre-dictamen.",
  onResultados,
  modoFicha = false,
  pantallaElegir,
  datosDetectadosIA,
}: Props) {
  // Datos básicos (manuales, antes de elegir posición)
  const [administradoraIni, setAdministradoraIni] = useState("");
  const [numeroCreditoIni, setNumeroCreditoIni] = useState("");
  const [direccionIni, setDireccionIni] = useState("");
  const [yaExisteCredito, setYaExisteCredito] = useState<PredictamenExistente | null>(null);
  const [revisandoCredito, setRevisandoCredito] = useState(false);
  const [borradorId, setBorradorId] = useState<string | null>(null);
  const [borradorGuardado, setBorradorGuardado] = useState(false);
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [datosGuardadosEn, setDatosGuardadosEn] = useState<number | null>(null);

  // Guarda (o corrige) los 3 campos de "Datos básicos" — se puede llamar las
  // veces que haga falta (al perder el foco de cualquier campo, cuando la IA
  // autollena, o con el botón manual). Nunca depende de que sea "la primera
  // vez": si ya hay borrador, lo actualiza; si no, lo crea.
  const guardarDatos = async () => {
    if (!numeroCreditoIni.trim() && !administradoraIni.trim() && !direccionIni.trim()) return;
    setGuardandoDatos(true);
    const r = await guardarDatosBasicos(borradorId, {
      numeroCredito: numeroCreditoIni, administradora: administradoraIni, direccion: direccionIni,
      expediente: expedienteIni, deudor: deudorIni, juzgado: juzgadoIni, hallazgos: hallazgosIni,
      ultimaActuacion: ultimaActuacionIni, ultimaActuacionTexto: ultimaActuacionTextoIni,
    }, precargar?.solicitudId);
    if (r.borradorId) { setBorradorId(r.borradorId); setBorradorGuardado(true); }
    setGuardandoDatos(false);
    if (r.ok) setDatosGuardadosEn(Date.now());
  };

  const revisarCredito = async () => {
    if (!numeroCreditoIni.trim()) { setYaExisteCredito(null); return; }
    setRevisandoCredito(true);
    const ex = await buscarPredictamenPorCredito(numeroCreditoIni);
    setYaExisteCredito(ex);
    setRevisandoCredito(false);
    // Si el crédito no está repetido, se guarda (crea o corrige) de una vez —
    // así no se pierde nada aunque no se termine el dictamen ahorita.
    if (!ex) await guardarDatos();
  };

  // robot al inicio: expediente + partes + hallazgos que se llevarán al recorrido
  const [expedienteIni, setExpedienteIni] = useState("");
  const [deudorIni, setDeudorIni] = useState("");
  const [juzgadoIni, setJuzgadoIni] = useState("");
  const [ultimaActuacionIni, setUltimaActuacionIni] = useState("");
  const [ultimaActuacionTextoIni, setUltimaActuacionTextoIni] = useState("");
  const [hallazgosIni, setHallazgosIni] = useState<string[]>([]);
  const [mostrarRobotIni, setMostrarRobotIni] = useState(false);
  const agregarHallazgoIni = (nota: string) => {
    const marca = nota.split("\n")[0];
    setHallazgosIni((prev) => prev.some((h) => h.includes(marca)) ? prev : [...prev, nota]);
  };
  const capturarBoletin = (d: { expediente?: string; actor?: string; demandado?: string; juzgado?: string; ultimaActuacionFecha?: string; ultimaActuacionTexto?: string }) => {
    if (d.expediente) setExpedienteIni(d.expediente);
    if (d.demandado) setDeudorIni(d.demandado); // en Actor, el deudor es el demandado del boletín
    if (d.juzgado) setJuzgadoIni(d.juzgado);
    if (d.ultimaActuacionFecha) setUltimaActuacionIni(d.ultimaActuacionFecha);
    if (d.ultimaActuacionTexto) setUltimaActuacionTextoIni(d.ultimaActuacionTexto);
  };

  // En cuanto se guardan hallazgos del boletín, se actualiza el borrador que
  // YA EXISTE (si se capturó el crédito primero). Ojo: aquí NUNCA se crea un
  // borrador nuevo — eso solo lo hace revisarCredito(), que sí checa
  // duplicados antes de crear. Si esto creara uno por su cuenta, se corre el
  // riesgo de dejar dos borradores del mismo crédito (repetidos).
  useEffect(() => {
    if (!borradorId) return;
    if (!expedienteIni && !hallazgosIni.length) return;
    actualizarBorrador(borradorId, { expediente: expedienteIni, deudor: deudorIni, juzgado: juzgadoIni, hallazgos: hallazgosIni, ultimaActuacion: ultimaActuacionIni, ultimaActuacionTexto: ultimaActuacionTextoIni });
    if (expedienteIni) sincronizarSolicitud(precargar?.solicitudId, { numero_credito: numeroCreditoIni, expediente: expedienteIni });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hallazgosIni, expedienteIni, deudorIni, juzgadoIni, ultimaActuacionIni, borradorId]);

  // El crédito ya tiene un borrador "Pendiente" guardado de antes (esto es lo
  // más común: la misma persona, otra sesión). Se elige cuál es el bueno:
  //  - "Usar el guardado" → trae ESE al formulario (pisa lo de esta pantalla).
  //  - "Usar lo de aquí" → manda el guardado a la papelera y guarda esto.
  const usarGuardadoYDescartarActual = async () => {
    if (!yaExisteCredito) return;
    // por si ya se alcanzó a crear un borrador para esta sesión antes de
    // toparse con el duplicado, para no dejar dos.
    if (borradorId && borradorId !== yaExisteCredito.id) await descartarBorrador(borradorId);
    const dg = yaExisteCredito.datos || {};
    setBorradorId(yaExisteCredito.id);
    setBorradorGuardado(true);
    setAdministradoraIni(dg.quienCede || "");
    setDireccionIni(dg.ubicacion || "");
    setExpedienteIni(yaExisteCredito.expediente || "");
    setDeudorIni(dg.deudor || "");
    setUltimaActuacionIni(dg.ultimaActuacion || "");
    setUltimaActuacionTextoIni(dg.ultimaActuacionTexto || "");
    setHallazgosIni(Array.isArray(dg.hallazgos) ? dg.hallazgos : []);
    setYaExisteCredito(null);
  };
  const usarActualYDescartarGuardado = async () => {
    if (!yaExisteCredito) return;
    await descartarBorrador(yaExisteCredito.id); // a papelera — recuperable, no se pierde
    const id = await guardarBorrador({
      numeroCredito: numeroCreditoIni, administradora: administradoraIni, direccion: direccionIni,
      expediente: expedienteIni, deudor: deudorIni, juzgado: juzgadoIni, hallazgos: hallazgosIni,
      ultimaActuacion: ultimaActuacionIni, ultimaActuacionTexto: ultimaActuacionTextoIni,
    });
    if (id) { setBorradorId(id); setBorradorGuardado(true); }
    await sincronizarSolicitud(precargar?.solicitudId, { numero_credito: numeroCreditoIni, expediente: expedienteIni });
    setYaExisteCredito(null);
  };

  // Autollenado con lo que la IA detectó al leer los documentos — solo
  // rellena los campos que sigan VACÍOS (nunca pisa lo que ya se escribió).
  useEffect(() => {
    if (!datosDetectadosIA) return;
    // Valores finales que van a quedar (lo ya escrito manda; si está vacío,
    // se usa lo que detectó la IA) — se calculan aparte del estado porque
    // React no aplica los setState de abajo sino hasta el siguiente render,
    // y el guardado necesita los valores YA correctos, no los viejos.
    const admFinal = administradoraIni || datosDetectadosIA.administradora || "";
    const credFinal = numeroCreditoIni || datosDetectadosIA.numero_credito || "";
    const dirFinal = direccionIni || datosDetectadosIA.direccion || "";
    const expFinal = expedienteIni || datosDetectadosIA.expediente || "";
    const huboCambio = admFinal !== administradoraIni || credFinal !== numeroCreditoIni || dirFinal !== direccionIni || expFinal !== expedienteIni;
    if (admFinal !== administradoraIni) setAdministradoraIni(admFinal);
    if (credFinal !== numeroCreditoIni) setNumeroCreditoIni(credFinal);
    if (dirFinal !== direccionIni) setDireccionIni(dirFinal);
    if (expFinal !== expedienteIni) setExpedienteIni(expFinal);
    if (!deudorIni && datosDetectadosIA.deudor) setDeudorIni(datosDetectadosIA.deudor);
    if (!juzgadoIni && datosDetectadosIA.juzgado) setJuzgadoIni(datosDetectadosIA.juzgado);
    // El autollenado de la IA no dispara onBlur (no lo escribió una persona) —
    // por eso aquí se guarda solo, con los valores correctos, para no
    // depender de que alguien le dé clic manualmente al campo.
    if (huboCambio) {
      (async () => {
        setGuardandoDatos(true);
        const r = await guardarDatosBasicos(borradorId, {
          numeroCredito: credFinal, administradora: admFinal, direccion: dirFinal, expediente: expFinal,
          deudor: deudorIni || datosDetectadosIA.deudor || "", juzgado: juzgadoIni || datosDetectadosIA.juzgado || "",
          hallazgos: hallazgosIni, ultimaActuacion: ultimaActuacionIni, ultimaActuacionTexto: ultimaActuacionTextoIni,
        }, precargar?.solicitudId);
        if (r.borradorId) { setBorradorId(r.borradorId); setBorradorGuardado(true); }
        setGuardandoDatos(false);
        if (r.ok) setDatosGuardadosEn(Date.now());
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datosDetectadosIA]);

  // Trae lo que YA se guardó antes (desde la Solicitud, o de un pre-dictamen
  // anterior) para que la ficha no se vea vacía cuando en realidad ya hay
  // datos capturados en otro lado. Nunca pisa lo que la persona ya escribió
  // aquí, y NO vuelve a guardar solo (ya está guardado) — solo lo muestra.
  // Si viene con antecedenteId, se usa ese id como borradorId para que, si
  // luego se corrige algo, se actualice el mismo registro y no se cree uno
  // nuevo "Pendiente" duplicado.
  useEffect(() => {
    const dp = precargar?.datos;
    if (!dp) return;
    if (!administradoraIni && dp.quienCede) setAdministradoraIni(dp.quienCede);
    if (!numeroCreditoIni && dp.numeroCredito) setNumeroCreditoIni(dp.numeroCredito);
    if (!direccionIni && dp.ubicacion) setDireccionIni(dp.ubicacion);
    if (!expedienteIni && dp.expediente) setExpedienteIni(dp.expediente);
    if (!deudorIni && dp.deudor) setDeudorIni(dp.deudor);
    if (!juzgadoIni && dp.juzgado) setJuzgadoIni(dp.juzgado);
    if (!borradorId && precargar?.antecedenteId) { setBorradorId(precargar.antecedenteId); setBorradorGuardado(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precargar?.datos, precargar?.antecedenteId]);

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
          {datosDetectadosIA && <p className="mb-2 text-[11px] font-medium text-purple-700">✨ Autollenado con lo que la IA leyó en los documentos — revisa y corrige si hace falta.</p>}
          {!datosDetectadosIA && !!precargar?.datos && (precargar.datos.numeroCredito || precargar.datos.quienCede || precargar.datos.ubicacion) && (
            <p className="mb-2 text-[11px] font-medium text-[color:var(--teal)]">🔄 Recuperado de lo que ya se había guardado antes — revisa y valida.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Administradora / banco</label>
              <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={administradoraIni} onChange={(e) => setAdministradoraIni(e.target.value)} onBlur={guardarDatos} placeholder="Ej. Pendulum, Zendere…" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Número de crédito</label>
              <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={numeroCreditoIni} onChange={(e) => setNumeroCreditoIni(e.target.value)} onBlur={revisarCredito} placeholder="No es el expediente" />
              {revisandoCredito && <p className="mt-1 text-[11px] text-muted-foreground">Revisando si ya existe…</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Dirección de la garantía</label>
              <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={direccionIni} onChange={(e) => setDireccionIni(e.target.value)} onBlur={guardarDatos} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={guardarDatos} disabled={guardandoDatos}
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {guardandoDatos ? "Guardando…" : borradorGuardado ? "✏️ Editar y validar datos" : "💾 Guardar datos básicos"}
            </button>
            {!guardandoDatos && datosGuardadosEn && (
              <span className="text-[11px] font-medium text-emerald-700">✓ Guardado {borradorGuardado ? "como Pendiente en el historial" : ""}</span>
            )}
          </div>
          {yaExisteCredito && (
            <div className="mt-3 space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <p className="font-semibold">
                {yaExisteCredito.esBorrador
                  ? "Ese número de crédito ya tiene un borrador \"Pendiente\" guardado — probablemente eres tú misma, de otra sesión. Elige cuál es el bueno para no dejar dos:"
                  : `Ese número de crédito ya está registrado${yaExisteCredito.folio ? ` (folio ${yaExisteCredito.folio})` : ""}.`}
              </p>
              {yaExisteCredito.esBorrador && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-red-200 bg-white p-2 text-[12px]">
                    <p className="font-semibold text-red-900">Lo guardado antes:</p>
                    <p>Exp. {yaExisteCredito.expediente || "—"}{yaExisteCredito.datos?.deudor ? ` · Deudor: ${yaExisteCredito.datos.deudor}` : ""}</p>
                    <p>Hallazgos del boletín: {Array.isArray(yaExisteCredito.datos?.hallazgos) ? yaExisteCredito.datos.hallazgos.length : 0}{yaExisteCredito.datos?.ultimaActuacion ? ` · Última actuación: ${yaExisteCredito.datos.ultimaActuacion}` : ""}</p>
                  </div>
                  <div className="rounded-md border border-red-200 bg-white p-2 text-[12px]">
                    <p className="font-semibold text-red-900">Lo que tienes aquí ahorita:</p>
                    <p>Exp. {expedienteIni || "—"}{deudorIni ? ` · Deudor: ${deudorIni}` : ""}</p>
                    <p>Hallazgos del boletín: {hallazgosIni.length}{ultimaActuacionIni ? ` · Última actuación: ${ultimaActuacionIni}` : ""}</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {yaExisteCredito.esBorrador && (
                  <>
                    <button onClick={usarGuardadoYDescartarActual} className="rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white">✓ El guardado es el real — usar ese</button>
                    <button onClick={usarActualYDescartarGuardado} className="rounded-md border border-red-400 bg-white px-3 py-1.5 text-xs font-semibold text-red-700">✓ Lo de aquí es el real — mandar el guardado a la papelera</button>
                  </>
                )}
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
              <p className="text-[11px] text-muted-foreground">Busca el expediente en el boletín (elige estado, jurisdicción y juzgado abajo). Al <b>guardar los hallazgos</b>, se toma ese expediente, sus partes y la <b>fecha de última actuación</b> para el pre-dictamen.</p>
              <BuscadorBoletin resaltarAmparo onHallazgoAmparo={agregarHallazgoIni} onGuardarHallazgos={agregarHallazgoIni} onDatosBoletin={capturarBoletin} />
              {expedienteIni && <p className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-3 py-1.5 text-[11px] text-[color:var(--teal)]">Se usará del boletín → Exp. <b>{expedienteIni}</b>{juzgadoIni ? ` · ${juzgadoIni}` : ""}{deudorIni ? ` · Deudor: ${deudorIni}` : ""}{ultimaActuacionIni ? ` · Última actuación: ${ultimaActuacionIni}` : ""}. Luego elige la posición.</p>}
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
  if (vista === "Actor") return <RecorridoActor casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedeAdmin={puedeAdmin} puedePrecioPiso={puedePrecioPiso} onResultados={onResultados} modoFicha={modoFicha} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} ultimaActuacionInicial={ultimaActuacionIni} ultimaActuacionTextoInicial={ultimaActuacionTextoIni} administradoraInicial={administradoraIni} numeroCreditoInicial={numeroCreditoIni} direccionInicial={direccionIni} borradorId={borradorId} />;
  if (vista === "Demandado") return <RecorridoDemandado casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedeAdmin={puedeAdmin} puedePrecioPiso={puedePrecioPiso} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} ultimaActuacionInicial={ultimaActuacionIni} ultimaActuacionTextoInicial={ultimaActuacionTextoIni} administradoraInicial={administradoraIni} numeroCreditoInicial={numeroCreditoIni} direccionInicial={direccionIni} borradorId={borradorId} />;
  if (vista === "Sucesorio") return <RecorridoSucesorio casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} puedePrecioPiso={puedePrecioPiso} hallazgosIniciales={hallazgosIni} expedienteInicial={expedienteIni} deudorInicial={deudorIni} juzgadoInicial={juzgadoIni} numeroCreditoInicial={numeroCreditoIni} direccionInicial={direccionIni} borradorId={borradorId} />;
  if (vista === "Contingencia") return <RecorridoContingencia casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} />;
  if (vista === "Tramites") return <RecorridoTramites casos={casos} onVolver={onVolver} precargar={precargar} puedeFirmarElabora={puedeFirmarElabora} puedeValidar={puedeValidar} />;
  return null;
}

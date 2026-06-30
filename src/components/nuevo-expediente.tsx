import { useEffect, useMemo, useState } from "react";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { type BoletinJuzgado } from "@/components/config-boletin";
import { cargarJuzgadosJalisco, nombreJuzgadoJAL, ROBOT, type JuzgadoJAL } from "@/lib/jalisco-juzgados";
import { X, Loader2, Check, FilePlus, Scale, Landmark, UserCheck, MapPin, Search, AlertTriangle, CheckCircle2 } from "lucide-react";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";

// Órganos de La Paz, Baja California Sur
const BCS_ORGANOS = [
  "Juzgado Primero de Primera Instancia en el Ramo Civil",
  "Juzgado Segundo de Primera Instancia en el Ramo Civil",
  "Juzgado Primero de Primera Instancia en el Ramo Mercantil",
  "Juzgado Segundo de Primera Instancia en el Ramo Mercantil",
  "Juzgado Tercero de Primera Instancia en el Ramo Mercantil",
  "Juzgado Primero de Primera Instancia en el Ramo Familiar",
  "Juzgado Segundo de Primera Instancia en el Ramo Familiar",
  "Juzgado Tercero de Primera Instancia en el Ramo Familiar",
  "Juzgado Cuarto de Primera Instancia en el Ramo Familiar",
];
const VEN_TODO = ["DGE", "Super_Admin"];
interface Colab { id: string; nombre: string; rol: string | null; especialidad: string | null; activo: boolean; }

type ResBuscar = { ok: boolean; n?: number; exp_origen?: string | null; actor?: string | null; demandado?: string | null; acuerdos?: { fecha: string | null; texto: string; actor?: string | null; demandado?: string | null }[]; error?: string };

const fmt = (s: string | null | undefined) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function coincideMateria(esp: string | null, materia: string) {
  if (!esp || !materia) return false;
  const e = norm(esp), m = norm(materia);
  if (e.includes(m) || m.includes(e)) return true;
  return e.split(/\s+/).filter((w) => w.length >= 4).some((w) => m.includes(w));
}

export function NuevoExpedienteModal({ onClose, onCreado, caso }: { onClose: () => void; onCreado: () => void; caso?: CasoJuridico }) {
  const esEdicion = !!caso;
  // datos del juicio
  const [expediente, setExpediente] = useState(caso?.expediente || "");
  const [entidad, setEntidad] = useState(caso?.entidad || "Sinaloa");
  const [materia, setMateria] = useState(caso?.materia || "");
  const [via, setVia] = useState(caso?.via_procesal || "");
  const [actor, setActor] = useState(caso?.actor || "");
  const [demandado, setDemandado] = useState(caso?.demandado || "");
  // garantía
  const [cliente, setCliente] = useState(caso?.cliente_nombre || "");
  const [proveedor, setProveedor] = useState(caso?.proveedor || "");
  const [noCredito, setNoCredito] = useState(caso?.no_credito || "");
  const [direccion, setDireccion] = useState(caso?.direccion_garantia || "");
  // estatus
  const [etapa, setEtapa] = useState(caso?.etapa_actual || "");
  const [estatus, setEstatus] = useState(caso?.estatus_general || "");
  const [prioridad, setPrioridad] = useState(caso?.prioridad || "");
  const [nota, setNota] = useState(caso?.nota_adicional || "");
  // abogado
  const [abogadoId, setAbogadoId] = useState("");
  // juzgado
  const [cat, setCat] = useState<BoletinJuzgado[]>([]);
  const [distrito, setDistrito] = useState("");
  const [juzgadoId, setJuzgadoId] = useState("");
  const [orgBCS, setOrgBCS] = useState(BCS_ORGANOS[1]);
  const [jalJudges, setJalJudges] = useState<JuzgadoJAL[]>([]);
  const [jalCode, setJalCode] = useState("");
  // abogados
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [rolesElaboran, setRolesElaboran] = useState<string[]>([]);

  // búsqueda en el boletín (Paso 1)
  const [buscando, setBuscando] = useState(false);
  const [res, setRes] = useState<ResBuscar | null>(null);
  const [errBuscar, setErrBuscar] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [manual, setManual] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sbSelect<BoletinJuzgado>("boletin_juzgado", "select=*&order=nombre_distrito,nombre_juzgado&limit=2000").then((d) => setCat(d || [])).catch(() => {});
    cargarJuzgadosJalisco().then(setJalJudges).catch(() => {});
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=id,nombre,rol,especialidad,activo&activo=eq.true&order=nombre`, { headers: wHeaders }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/urrj_permisos?select=config&id=eq.1`, { headers: wHeaders }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([cs, cfg]) => {
      setColabs(cs || []);
      const config = cfg?.[0]?.config ?? {};
      const roles = Object.keys(config).filter((r) => (config[r] || []).includes("elaborar"));
      setRolesElaboran([...new Set([...roles, ...VEN_TODO])]);
    }).catch(() => {});
  }, []);

  // En modo edición: pre-selecciona el juzgado que ya trae el registro
  useEffect(() => {
    if (!caso || cat.length === 0) return;
    if ((caso.entidad || "") === "Sinaloa") {
      const j = cat.find((x) =>
        (caso.cve_juzgado && x.cve_juzgado === caso.cve_juzgado && (!caso.cve_distrito || x.cve_distrito === caso.cve_distrito)) ||
        (caso.nombre_juzgado && x.nombre_juzgado === caso.nombre_juzgado));
      if (j) { setDistrito(j.nombre_distrito); setJuzgadoId(j.id); }
    }
  }, [caso, cat]);
  useEffect(() => {
    if (!caso || jalJudges.length === 0) return;
    if ((caso.entidad || "") === "Jalisco") {
      const m = (caso.nombre_juzgado || "").match(/\[([^\]]+)\]/);
      if (m && jalJudges.some((j) => j.code === m[1])) setJalCode(m[1]);
    }
  }, [caso, jalJudges]);
  useEffect(() => {
    if (!caso) return;
    if ((caso.entidad || "") === "BCS" && caso.nombre_juzgado) {
      const found = BCS_ORGANOS.find((o) => (caso.nombre_juzgado || "").startsWith(o));
      if (found) setOrgBCS(found);
    }
  }, [caso]);

  const distritos = useMemo(() => Array.from(new Set(cat.map((c) => c.nombre_distrito))).sort(), [cat]);
  const juzgadosDeDistrito = useMemo(() => cat.filter((c) => c.nombre_distrito === distrito), [cat, distrito]);

  const abogados = useMemo(() => {
    const elab = colabs.filter((c) => c.rol && rolesElaboran.includes(c.rol));
    return elab.map((c) => ({ ...c, sugerido: coincideMateria(c.especialidad, materia) }))
      .sort((a, b) => (b.sugerido ? 1 : 0) - (a.sugerido ? 1 : 0) || a.nombre.localeCompare(b.nombre));
  }, [colabs, rolesElaboran, materia]);

  // ¿se eligió juzgado? (para buscar y para que el robot lo siga)
  const juzgadoElegido = (entidad === "Sinaloa" && !!juzgadoId) || entidad === "BCS" || (entidad === "Jalisco" && !!jalCode);

  // arma los campos del juzgado según la entidad (igual que el alta de exhorto)
  function camposJuzgado(): Record<string, any> {
    if (entidad === "Sinaloa" && juzgadoId) {
      const j = cat.find((x) => x.id === juzgadoId);
      if (j) return { cve_distrito: j.cve_distrito, cve_juzgado: j.cve_juzgado, nombre_juzgado: j.nombre_juzgado, juzgado: j.nombre_juzgado, distrito_judicial: j.nombre_distrito };
    } else if (entidad === "BCS") {
      return { nombre_juzgado: `${orgBCS}, La Paz, BCS`, juzgado: orgBCS };
    } else if (entidad === "Jalisco" && jalCode) {
      const jj = jalJudges.find((j) => j.code === jalCode);
      return { nombre_juzgado: jj ? nombreJuzgadoJAL(jj) : `Juzgado [${jalCode}], Jalisco`, juzgado: jj ? jj.name : null };
    }
    return {};
  }

  // Paso 1: lee el expediente EN VIVO con el robot
  async function buscar() {
    if (!expediente.trim()) { setErrBuscar("Escribe el número de expediente."); return; }
    if (!juzgadoElegido) { setErrBuscar("Elige primero el juzgado."); return; }
    setBuscando(true); setErrBuscar(null); setRes(null); setConfirmado(false);
    try {
      let url = "";
      const exp = encodeURIComponent(expediente.trim());
      if (entidad === "Jalisco") {
        const jj = jalJudges.find((j) => j.code === jalCode);
        url = `${ROBOT}/buscar?entidad=Jalisco&code=${jalCode}&foraneo=${jj?.foraneo ? 1 : 0}&exp=${exp}`;
      } else if (entidad === "BCS") {
        url = `${ROBOT}/buscar?entidad=BCS&exp=${exp}`;
      } else if (entidad === "Sinaloa") {
        const j = cat.find((x) => x.id === juzgadoId);
        url = `${ROBOT}/buscar?entidad=Sinaloa&distrito=${encodeURIComponent(j?.nombre_distrito || "")}&juzgado=${encodeURIComponent((j?.nombre_juzgado || "").split(",")[0])}&exp=${exp}`;
      } else { setErrBuscar("CDMX no tiene robot; llénalo a mano abajo."); setBuscando(false); return; }

      const r = await fetch(url);
      const data: ResBuscar = await r.json();
      if (!data.ok) { setErrBuscar(data.error || "El robot no encontró nada."); setRes(null); }
      else { setRes(data); }
    } catch (e: any) { setErrBuscar("No se pudo conectar con el robot. " + (e.message || "")); }
    finally { setBuscando(false); }
  }

  // al confirmar, copia los datos del robot al formulario
  function usarDatos() {
    if (res?.actor) setActor(res.actor);
    if (res?.demandado) setDemandado(res.demandado);
    setConfirmado(true);
  }

  const guardar = async () => {
    if (!expediente.trim()) { setError("Escribe el número de expediente."); return; }
    setGuardando(true); setError(null);
    try {
      const jz = camposJuzgado();
      const abg = abogados.find((a) => a.id === abogadoId);
      const exp = expediente.trim();
      const payload = {
        expediente: exp,
        entidad,
        materia: materia.trim() || null,
        via_procesal: via.trim() || null,
        actor: actor.trim() || null,
        demandado: demandado.trim() || null,
        cliente_nombre: cliente.trim() || null,
        proveedor: proveedor.trim() || null,
        no_credito: noCredito.trim() || null,
        direccion_garantia: direccion.trim() || null,
        etapa_actual: etapa.trim() || null,
        estatus_general: estatus.trim() || null,
        prioridad: prioridad || null,
        nota_adicional: nota.trim() || null,
        abogado_id: abg ? abg.id : null,
        abogado_nombre: abg ? abg.nombre : null,
        unidad: esEdicion ? (caso!.unidad || "UCM") : "UCM",
        ...(esEdicion ? {} : { archivado: false }),
        ...jz,
      };
      const url = esEdicion ? `${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${caso!.id}` : `${SUPABASE_URL}/rest/v1/caso_juridico`;
      const r = await fetch(url, { method: esEdicion ? "PATCH" : "POST", headers: { ...wHeaders, Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("No se pudo guardar (" + r.status + ").");

      // solo al CREAR (y si confirmamos el robot) guardamos sus actuaciones; al editar el robot ya las trae
      if (!esEdicion && confirmado && res?.acuerdos?.length) {
        const filas = res.acuerdos.map((a) => ({
          expediente: exp, juzgado: jz.nombre_juzgado || "", fecha_acuerdo: a.fecha, tipo_acuerdo: "Boletín",
          entidad, texto: a.texto, urgente: false, leido: false, origen: "robot",
        }));
        await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial`, { method: "POST", headers: { ...wHeaders, Prefer: "return=minimal" }, body: JSON.stringify(filas) }).catch(() => {});
      }
      onCreado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  // ¿quedará listo para el robot?
  const robotListo = juzgadoElegido;
  // ¿mostramos ya el formulario? (tras confirmar, o a mano, o CDMX, o si no hubo resultados)
  const mostrarForm = esEdicion || confirmado || manual || entidad === "CDMX" || (res !== null && res.n === 0);

  // selector de juzgado según entidad (se usa en el Paso 1)
  const SelectorJuzgado = () => (
    entidad === "Sinaloa" ? (
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className={lbl}>Distrito</label>
          <select className={inp} value={distrito} onChange={(e) => { setDistrito(e.target.value); setJuzgadoId(""); setRes(null); setConfirmado(false); }}>
            <option value="">Selecciona…</option>
            {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Juzgado</label>
          <select className={inp} value={juzgadoId} onChange={(e) => { setJuzgadoId(e.target.value); setRes(null); setConfirmado(false); }} disabled={!distrito}>
            <option value="">Selecciona…</option>
            {juzgadosDeDistrito.map((j) => <option key={j.id} value={j.id}>{j.nombre_juzgado}</option>)}
          </select>
        </div>
      </div>
    ) : entidad === "BCS" ? (
      <div><label className={lbl}>Juzgado / Órgano (La Paz)</label>
        <select className={inp} value={orgBCS} onChange={(e) => { setOrgBCS(e.target.value); setRes(null); setConfirmado(false); }}>
          {BCS_ORGANOS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    ) : entidad === "Jalisco" ? (
      <div><label className={lbl}>Juzgado (Jalisco · ZMG / Foráneos)</label>
        <select className={inp} value={jalCode} onChange={(e) => { setJalCode(e.target.value); setRes(null); setConfirmado(false); }} disabled={!jalJudges.length}>
          <option value="">{jalJudges.length ? "Selecciona…" : "Cargando…"}</option>
          <optgroup label="Zona Metropolitana (Guadalajara)">
            {jalJudges.filter((j) => !j.foraneo).map((j) => <option key={j.code} value={j.code}>{j.name} [{j.code}]</option>)}
          </optgroup>
          <optgroup label="Foráneos (municipios)">
            {jalJudges.filter((j) => j.foraneo).map((j) => <option key={j.code} value={j.code}>{j.name} [{j.code}]</option>)}
          </optgroup>
        </select>
      </div>
    ) : (
      <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">CDMX no tiene robot (su boletín es de pago). Llena los datos a mano abajo.</p>
    )
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><FilePlus className="h-4 w-4" /> {esEdicion ? "Validar / editar expediente" : "Nuevo expediente"}</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          {/* PASO 1 — Buscar en el boletín */}
          <section className="rounded-lg border border-border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Search className="h-4 w-4" style={{ color: TEAL }} /> 1. Busca el expediente en el boletín</p>
            <p className="mb-2 text-[11px] text-muted-foreground">Elige el juzgado y escribe el expediente. El robot lo lee en vivo para que verifiques que es el correcto y se llene la ficha solo.</p>
            <div className="mb-2"><label className={lbl}>Entidad</label>
              <select className={inp} value={entidad} onChange={(e) => { setEntidad(e.target.value); setRes(null); setConfirmado(false); setManual(false); }}>
                <option value="Sinaloa">Sinaloa</option>
                <option value="Jalisco">Jalisco</option>
                <option value="BCS">Baja California Sur</option>
                <option value="CDMX">CDMX (sin robot)</option>
              </select>
            </div>
            <SelectorJuzgado />
            <div className="mt-2 flex gap-2">
              <input className={inp} value={expediente} onChange={(e) => { setExpediente(e.target.value); setRes(null); setConfirmado(false); }} placeholder="Expediente (ej. 575/2022)" />
              {entidad !== "CDMX" && (
                <button onClick={buscar} disabled={buscando} className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
                </button>
              )}
            </div>
            {errBuscar && <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {errBuscar}</p>}
          </section>

          {/* Resultado del robot */}
          {res && res.ok && (
            <section className="rounded-lg border-2 border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
              <p className="mb-2 text-sm font-semibold" style={{ color: TEAL }}>Esto encontró el robot — ¿es tu expediente?</p>
              {res.n === 0 ? (
                <p className="text-sm text-amber-700">No hay actuaciones para ese expediente en ese juzgado. Revisa el número/juzgado, o llénalo a mano abajo.</p>
              ) : (
                <>
                  <div className="grid gap-1 text-xs sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Actor:</span> <b>{res.actor || "—"}</b></p>
                    <p><span className="text-muted-foreground">Demandado:</span> <b>{res.demandado || "—"}</b></p>
                    {res.exp_origen && <p className="sm:col-span-2"><span className="text-muted-foreground">Expediente de origen:</span> <b>{res.exp_origen}</b></p>}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {res.acuerdos?.slice(0, 5).map((a, i) => (
                      <div key={i} className="rounded-md bg-card p-2 text-xs">
                        <span className="font-medium text-[color:var(--teal)]">{fmt(a.fecha)}</span> — {a.texto}
                      </div>
                    ))}
                  </div>
                  {!confirmado ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={usarDatos} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: TEAL }}><CheckCircle2 className="h-4 w-4" /> Sí, usar estos datos</button>
                      <button onClick={() => { setRes(null); setConfirmado(false); }} className="rounded-md border border-input px-3 py-2 text-sm">Ajustar búsqueda</button>
                    </div>
                  ) : (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[color:var(--teal)]"><Check className="h-3.5 w-3.5" /> Confirmado. Completa lo de abajo y créalo.</p>
                  )}
                </>
              )}
            </section>
          )}

          {/* botón llenar a mano (cuando aún no se muestra el formulario) */}
          {!mostrarForm && entidad !== "CDMX" && (
            <button onClick={() => setManual(true)} className="w-full rounded-md border border-dashed border-input py-2 text-xs text-muted-foreground hover:bg-muted">…o llenar a mano sin buscar</button>
          )}

          {/* PASO 2 — Formulario (pre-llenado) */}
          {mostrarForm && (
            <>
              <section>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Scale className="h-4 w-4" style={{ color: TEAL }} /> 2. Datos del juicio</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><label className={lbl}>Materia</label><input className={inp} value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Mercantil / Civil…" /></div>
                  <div><label className={lbl}>Vía procesal</label><input className={inp} value={via} onChange={(e) => setVia(e.target.value)} placeholder="Ejecutivo mercantil…" /></div>
                  <div><label className={lbl}>Actor</label><input className={inp} value={actor} onChange={(e) => setActor(e.target.value)} /></div>
                  <div><label className={lbl}>Demandado</label><input className={inp} value={demandado} onChange={(e) => setDemandado(e.target.value)} /></div>
                </div>
              </section>

              {/* Garantía */}
              <section>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Landmark className="h-4 w-4" style={{ color: TEAL }} /> Garantía</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><label className={lbl}>Cliente</label><input className={inp} value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
                  <div><label className={lbl}>Proveedor / Administradora</label><input className={inp} value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></div>
                  <div><label className={lbl}>No. de crédito</label><input className={inp} value={noCredito} onChange={(e) => setNoCredito(e.target.value)} /></div>
                  <div><label className={lbl}>Dirección de la garantía</label><input className={inp} value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
                </div>
              </section>

              {/* Estatus */}
              <section>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Scale className="h-4 w-4" style={{ color: TEAL }} /> Estatus</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><label className={lbl}>Etapa actual</label><input className={inp} value={etapa} onChange={(e) => setEtapa(e.target.value)} /></div>
                  <div><label className={lbl}>Estatus general</label><input className={inp} value={estatus} onChange={(e) => setEstatus(e.target.value)} /></div>
                  <div><label className={lbl}>Prioridad</label>
                    <select className={inp} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                      <option value="">— sin prioridad —</option>
                      <option value="ALTA">Alta</option>
                      <option value="MEDIA">Media</option>
                      <option value="BAJA">Baja</option>
                    </select>
                  </div>
                  <div><label className={lbl}>Nota</label><input className={inp} value={nota} onChange={(e) => setNota(e.target.value)} /></div>
                </div>
              </section>

              {/* Abogado */}
              <section>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><UserCheck className="h-4 w-4" style={{ color: TEAL }} /> Abogado asignado</p>
                <select className={inp} value={abogadoId} onChange={(e) => setAbogadoId(e.target.value)}>
                  <option value="">— sin asignar —</option>
                  {abogados.map((a) => <option key={a.id} value={a.id}>{a.sugerido ? "★ " : ""}{a.nombre}{a.especialidad ? ` · ${a.especialidad}` : ""}</option>)}
                </select>
                {materia && <p className="mt-1 text-[11px] text-muted-foreground">★ = sugerido por coincidir con la materia "{materia}".</p>}
              </section>

              {/* resumen del juzgado elegido en el Paso 1 + aviso del robot */}
              <section>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><MapPin className="h-4 w-4" style={{ color: TEAL }} /> Juzgado (elegido arriba)</p>
                <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  <b>Expediente:</b> {expediente || "—"} · <b>Entidad:</b> {entidad}
                  {camposJuzgado().nombre_juzgado ? <> · <b>Juzgado:</b> {camposJuzgado().nombre_juzgado}</> : null}
                </div>
                <div className={`mt-2 rounded-md p-2 text-xs ${robotListo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  {robotListo ? "✓ Quedará listo para que el robot lo audite en automático." : "⚠️ Sin juzgado, el robot no podrá seguirlo. Regresa arriba y elígelo."}
                </div>
              </section>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                  {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : <><Check className="h-4 w-4" /> {esEdicion ? "Guardar cambios" : "Crear expediente"}</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

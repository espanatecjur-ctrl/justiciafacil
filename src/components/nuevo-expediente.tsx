import { useEffect, useMemo, useState } from "react";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { type BoletinJuzgado } from "@/components/config-boletin";
import { cargarJuzgadosJalisco, nombreJuzgadoJAL, ROBOT, type JuzgadoJAL } from "@/lib/jalisco-juzgados";
import { X, Loader2, Check, Send, Landmark, Search, AlertTriangle, CheckCircle2 } from "lucide-react";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";

const BCS_ORGANOS = [
  "Juzgado Primero de Primera Instancia en el Ramo Civil",
  "Juzgado Segundo de Primera Instancia en el Ramo Civil",
  "Juzgado Primero de Primera Instancia en el Ramo Mercantil",
  "Juzgado Segundo de Primera Instancia en el Ramo Mercantil",
  "Juzgado Tercero de Primera Instancia en el Ramo Mercantil",
  "Juzgado Primero de Primera Instancia en el Ramo Familiar",
  "Juzgado Segundo de Primera Instancia en el Ramo Familiar",
];
const ESTADOS = ["Girado", "Recibido", "Diligenciado", "Devuelto", "Cumplimentado"];

type ResBuscar = { ok: boolean; n?: number; exp_origen?: string | null; actor?: string | null; demandado?: string | null; acuerdos?: { fecha: string | null; texto: string; actor?: string | null; demandado?: string | null }[]; error?: string };

const fmt = (s: string | null | undefined) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

export function NuevoExhortoModal({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [entidad, setEntidad] = useState("Jalisco");
  const [expediente, setExpediente] = useState("");
  const [cat, setCat] = useState<BoletinJuzgado[]>([]);
  const [distrito, setDistrito] = useState("");
  const [juzgadoId, setJuzgadoId] = useState("");
  const [orgBCS, setOrgBCS] = useState(BCS_ORGANOS[1]);
  const [jalJudges, setJalJudges] = useState<JuzgadoJAL[]>([]);
  const [jalCode, setJalCode] = useState("");

  const [buscando, setBuscando] = useState(false);
  const [res, setRes] = useState<ResBuscar | null>(null);
  const [errBuscar, setErrBuscar] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);

  const [folio, setFolio] = useState("");
  const [expedienteOrigen, setExpedienteOrigen] = useState("");
  const [juzgadoOrigen, setJuzgadoOrigen] = useState("");
  const [diligencia, setDiligencia] = useState("");
  const [estado, setEstado] = useState("Recibido");
  const [prioridad, setPrioridad] = useState("");
  const [vence, setVence] = useState("");
  const [nota, setNota] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sbSelect<BoletinJuzgado>("boletin_juzgado", "select=*&order=nombre_distrito,nombre_juzgado&limit=2000").then((d) => setCat(d || [])).catch(() => {});
    cargarJuzgadosJalisco().then(setJalJudges).catch(() => {});
  }, []);

  const distritos = useMemo(() => Array.from(new Set(cat.map((c) => c.nombre_distrito))).sort(), [cat]);
  const juzgadosDeDistrito = useMemo(() => cat.filter((c) => c.nombre_distrito === distrito), [cat, distrito]);
  const juzgadoElegido = (entidad === "Sinaloa" && !!juzgadoId) || entidad === "BCS" || (entidad === "Jalisco" && !!jalCode);

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

  async function buscar() {
    if (!expediente.trim()) { setErrBuscar("Escribe el expediente que busca el juzgado exhortado."); return; }
    if (!juzgadoElegido) { setErrBuscar("Elige primero el juzgado exhortado."); return; }
    setBuscando(true); setErrBuscar(null); setRes(null); setConfirmado(false);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 40000); // 40s máximo, para que no se quede colgado
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
      } else { setErrBuscar("CDMX no tiene robot; agrégalo a mano abajo."); clearTimeout(t); setBuscando(false); return; }

      const r = await fetch(url, { signal: ctrl.signal });
      const data: ResBuscar = await r.json();
      if (!data.ok) { setErrBuscar(data.error || "El robot no encontró nada."); setRes(null); }
      else {
        setRes(data);
        if (data.exp_origen) setExpedienteOrigen(data.exp_origen);
        setEstado("Recibido");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") setErrBuscar("El robot tardó demasiado (a veces tarda en 'despertar'). Intenta otra vez en un momento, o agrégalo a mano abajo.");
      else setErrBuscar("No se pudo conectar con el robot. " + (e?.message || ""));
    }
    finally { clearTimeout(t); setBuscando(false); }
  }

  async function agregar() {
    if (!expediente.trim()) { setError("Falta el expediente exhortado."); return; }
    setGuardando(true); setError(null);
    try {
      const jz = camposJuzgado();
      const exp = expediente.trim();
      const payload = {
        tipo_registro: "exhorto", expediente: exp, entidad,
        folio: folio.trim() || null, expediente_origen: expedienteOrigen.trim() || null,
        juzgado_origen: juzgadoOrigen.trim() || null, diligencia: diligencia.trim() || null,
        materia: "Exhorto", estatus_general: estado || null, prioridad: prioridad || null,
        fecha_vence: vence || null, nota_adicional: nota.trim() || null,
        actor: res?.actor || null, demandado: res?.demandado || null,
        unidad: "Exhortos", archivado: false, ...jz,
      };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico`, { method: "POST", headers: { ...wHeaders, Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("No se pudo crear (" + r.status + ").");

      if (res?.acuerdos?.length) {
        const filas = res.acuerdos.map((a) => ({
          expediente: exp, juzgado: jz.nombre_juzgado || "", fecha_acuerdo: a.fecha, tipo_acuerdo: "Boletín",
          entidad, texto: a.texto, urgente: false, leido: false, origen: "robot",
        }));
        await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial`, { method: "POST", headers: { ...wHeaders, Prefer: "return=minimal" }, body: JSON.stringify(filas) }).catch(() => {});
      }
      onCreado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4" /> Nuevo exhorto</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          <section className="rounded-lg border border-border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Search className="h-4 w-4" style={{ color: TEAL }} /> 1. Busca el exhorto en el boletín</p>
            <p className="mb-2 text-[11px] text-muted-foreground">Pon el juzgado <b>que recibe</b> el exhorto y el <b>expediente</b> que le asignaron. El robot lo lee en vivo para que verifiques que es el correcto antes de agregarlo.</p>
            <div className="mb-2"><label className={lbl}>Entidad</label>
              <select className={inp} value={entidad} onChange={(e) => { setEntidad(e.target.value); setRes(null); setConfirmado(false); }}>
                <option value="Jalisco">Jalisco</option>
                <option value="Sinaloa">Sinaloa</option>
                <option value="BCS">Baja California Sur</option>
                <option value="CDMX">CDMX (sin robot)</option>
              </select>
            </div>
            {entidad === "Sinaloa" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div><label className={lbl}>Distrito</label>
                  <select className={inp} value={distrito} onChange={(e) => { setDistrito(e.target.value); setJuzgadoId(""); }}>
                    <option value="">Selecciona…</option>
                    {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Juzgado</label>
                  <select className={inp} value={juzgadoId} onChange={(e) => setJuzgadoId(e.target.value)} disabled={!distrito}>
                    <option value="">Selecciona…</option>
                    {juzgadosDeDistrito.map((j) => <option key={j.id} value={j.id}>{j.nombre_juzgado}</option>)}
                  </select>
                </div>
              </div>
            ) : entidad === "BCS" ? (
              <select className={inp} value={orgBCS} onChange={(e) => setOrgBCS(e.target.value)}>
                {BCS_ORGANOS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : entidad === "Jalisco" ? (
              <select className={inp} value={jalCode} onChange={(e) => setJalCode(e.target.value)} disabled={!jalJudges.length}>
                <option value="">{jalJudges.length ? "Selecciona juzgado…" : "Cargando…"}</option>
                <optgroup label="Zona Metropolitana (Guadalajara)">
                  {jalJudges.filter((j) => !j.foraneo).map((j) => <option key={j.code} value={j.code}>{j.name} [{j.code}]</option>)}
                </optgroup>
                <optgroup label="Foráneos (municipios)">
                  {jalJudges.filter((j) => j.foraneo).map((j) => <option key={j.code} value={j.code}>{j.name} [{j.code}]</option>)}
                </optgroup>
              </select>
            ) : (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">CDMX no tiene robot. Llena los datos a mano abajo y agrégalo.</p>
            )}

            <div className="mt-2 flex gap-2">
              <input className={inp} value={expediente} onChange={(e) => { setExpediente(e.target.value); setRes(null); setConfirmado(false); }} placeholder="Expediente en el juzgado exhortado (ej. 82/2026)" />
              {entidad !== "CDMX" && (
                <button onClick={buscar} disabled={buscando} className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
                </button>
              )}
            </div>
            {errBuscar && <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {errBuscar}</p>}
          </section>

          {res && res.ok && (
            <section className="rounded-lg border-2 border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
              <p className="mb-2 text-sm font-semibold" style={{ color: TEAL }}>Esto encontró el robot — ¿es tu exhorto?</p>
              {res.n === 0 ? (
                <p className="text-sm text-amber-700">No hay actuaciones para ese expediente en ese juzgado. Revisa el número/juzgado, o agrégalo a mano abajo.</p>
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
                      <button onClick={() => setConfirmado(true)} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: TEAL }}><CheckCircle2 className="h-4 w-4" /> Sí, es este — usar estos datos</button>
                      <button onClick={() => { setRes(null); setConfirmado(false); }} className="rounded-md border border-input px-3 py-2 text-sm">No, ajustar búsqueda</button>
                    </div>
                  ) : (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-[color:var(--teal)]"><Check className="h-3.5 w-3.5" /> Confirmado. Completa lo de abajo y agrégalo.</p>
                  )}
                </>
              )}
            </section>
          )}

          {(confirmado || entidad === "CDMX" || (res && res.n === 0)) && (
            <>
              <section>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Send className="h-4 w-4" style={{ color: TEAL }} /> 2. Datos del exhorto</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><label className={lbl}>Folio del exhorto</label><input className={inp} value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="ej. EXH-123/2025" /></div>
                  <div><label className={lbl}>Estado</label>
                    <select className={inp} value={estado} onChange={(e) => setEstado(e.target.value)}>{ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                  </div>
                  <div><label className={lbl}>Expediente de origen</label><input className={inp} value={expedienteOrigen} onChange={(e) => setExpedienteOrigen(e.target.value)} placeholder="del juicio que lo gira" /></div>
                  <div><label className={lbl}>Juzgado de origen</label><input className={inp} value={juzgadoOrigen} onChange={(e) => setJuzgadoOrigen(e.target.value)} /></div>
                  <div className="sm:col-span-2"><label className={lbl}>Diligencia</label><input className={inp} value={diligencia} onChange={(e) => setDiligencia(e.target.value)} placeholder="ej. Emplazamiento / Notificación / Embargo" /></div>
                </div>
              </section>
              <section>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Landmark className="h-4 w-4" style={{ color: TEAL }} /> Seguimiento</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><label className={lbl}>Prioridad</label>
                    <select className={inp} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                      <option value="">— sin prioridad —</option>
                      <option value="ALTA">Alta</option><option value="MEDIA">Media</option><option value="BAJA">Baja</option>
                    </select>
                  </div>
                  <div><label className={lbl}>Vence</label><input type="date" className={inp} value={vence} onChange={(e) => setVence(e.target.value)} /></div>
                  <div className="sm:col-span-2"><label className={lbl}>Nota</label><input className={inp} value={nota} onChange={(e) => setNota(e.target.value)} /></div>
                </div>
              </section>

              {entidad !== "CDMX" && (
                <div className={`rounded-md p-2 text-xs ${juzgadoElegido ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  {juzgadoElegido ? "✓ El robot seguirá este exhorto en automático cada día." : "⚠️ Elige el juzgado arriba para que el robot lo siga."}
                </div>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
                <button onClick={agregar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                  {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Agregando…</> : <><Check className="h-4 w-4" /> Agregar exhorto</>}
                </button>
              </div>
            </>
          )}

          {!confirmado && entidad !== "CDMX" && !(res && res.n === 0) && (
            <button onClick={() => setConfirmado(true)} className="w-full rounded-md border border-dashed border-input py-2 text-xs text-muted-foreground hover:bg-muted">…o agregar a mano sin buscar</button>
          )}
        </div>
      </div>
    </div>
  );
}

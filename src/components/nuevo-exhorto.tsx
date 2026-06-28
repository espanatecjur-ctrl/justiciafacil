import { useEffect, useMemo, useState } from "react";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { type BoletinJuzgado } from "@/components/config-boletin";
import { cargarJuzgadosJalisco, nombreJuzgadoJAL, type JuzgadoJAL } from "@/lib/jalisco-juzgados";
import { X, Loader2, Check, Send, Landmark, MapPin, Link2 } from "lucide-react";

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

export function NuevoExhortoModal({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [folio, setFolio] = useState("");
  const [expediente, setExpediente] = useState("");        // expediente en el juzgado EXHORTADO (lo sigue el robot)
  const [expedienteOrigen, setExpedienteOrigen] = useState("");
  const [juzgadoOrigen, setJuzgadoOrigen] = useState("");
  const [diligencia, setDiligencia] = useState("");
  const [estado, setEstado] = useState("Girado");
  const [entidad, setEntidad] = useState("Sinaloa");
  const [prioridad, setPrioridad] = useState("");
  const [vence, setVence] = useState("");
  const [nota, setNota] = useState("");
  const [padreId, setPadreId] = useState("");
  const [juicios, setJuicios] = useState<CasoJuridico[]>([]);
  const [cat, setCat] = useState<BoletinJuzgado[]>([]);
  const [distrito, setDistrito] = useState("");
  const [juzgadoId, setJuzgadoId] = useState("");
  const [orgBCS, setOrgBCS] = useState(BCS_ORGANOS[1]);
  const [jalJudges, setJalJudges] = useState<JuzgadoJAL[]>([]);
  const [jalCode, setJalCode] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sbSelect<BoletinJuzgado>("boletin_juzgado", "select=*&order=nombre_distrito,nombre_juzgado&limit=2000").then((d) => setCat(d || [])).catch(() => {});
    cargarJuzgadosJalisco().then(setJalJudges).catch(() => {});
    fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,cliente_nombre,entidad&or=(tipo_registro.is.null,tipo_registro.eq.juicio)&order=expediente.asc&limit=500`, { headers: wHeaders })
      .then((r) => (r.ok ? r.json() : [])).then(setJuicios).catch(() => {});
  }, []);

  const distritos = useMemo(() => Array.from(new Set(cat.map((c) => c.nombre_distrito))).sort(), [cat]);
  const juzgadosDeDistrito = useMemo(() => cat.filter((c) => c.nombre_distrito === distrito), [cat, distrito]);

  const elegirPadre = (id: string) => {
    setPadreId(id);
    const p = juicios.find((x) => x.id === id);
    if (p?.expediente && !expedienteOrigen) setExpedienteOrigen(p.expediente);
  };

  const guardar = async () => {
    if (!folio.trim() && !expediente.trim()) { setError("Pon al menos el folio o el expediente del exhorto."); return; }
    setGuardando(true); setError(null);
    try {
      let jz: Record<string, any> = {};
      if (entidad === "Sinaloa" && juzgadoId) {
        const j = cat.find((x) => x.id === juzgadoId);
        if (j) jz = { cve_distrito: j.cve_distrito, cve_juzgado: j.cve_juzgado, nombre_juzgado: j.nombre_juzgado, juzgado: j.nombre_juzgado, distrito_judicial: j.nombre_distrito };
      } else if (entidad === "BCS") {
        jz = { nombre_juzgado: `${orgBCS}, La Paz, BCS`, juzgado: orgBCS };
      } else if (entidad === "Jalisco" && jalCode) {
        const jj = jalJudges.find((j) => j.code === jalCode);
        jz = { nombre_juzgado: jj ? nombreJuzgadoJAL(jj) : `Juzgado [${jalCode}], Jalisco`, juzgado: jj ? jj.name : null };
      }
      const payload = {
        tipo_registro: "exhorto",
        folio: folio.trim() || null,
        expediente: expediente.trim() || folio.trim() || null,
        expediente_origen: expedienteOrigen.trim() || null,
        juzgado_origen: juzgadoOrigen.trim() || null,
        diligencia: diligencia.trim() || null,
        entidad,
        materia: "Exhorto",
        estatus_general: estado || null,
        prioridad: prioridad || null,
        fecha_vence: vence || null,
        nota_adicional: nota.trim() || null,
        caso_padre_id: padreId || null,
        unidad: "Exhortos",
        archivado: false,
        ...jz,
      };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico`, { method: "POST", headers: { ...wHeaders, Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("No se pudo crear (" + r.status + ").");
      onCreado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  const robotListo = (entidad === "Sinaloa" && !!juzgadoId) || entidad === "BCS" || (entidad === "Jalisco" && !!jalCode);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><Send className="h-4 w-4" /> Nuevo exhorto</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Send className="h-4 w-4" style={{ color: TEAL }} /> Datos del exhorto</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className={lbl}>Folio del exhorto</label><input className={inp} value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="ej. EXH-123/2025" /></div>
              <div><label className={lbl}>Estado</label>
                <select className={inp} value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Expediente origen</label><input className={inp} value={expedienteOrigen} onChange={(e) => setExpedienteOrigen(e.target.value)} placeholder="del juicio que lo gira" /></div>
              <div><label className={lbl}>Juzgado origen</label><input className={inp} value={juzgadoOrigen} onChange={(e) => setJuzgadoOrigen(e.target.value)} placeholder="quién lo envía" /></div>
              <div className="sm:col-span-2"><label className={lbl}>Diligencia</label><input className={inp} value={diligencia} onChange={(e) => setDiligencia(e.target.value)} placeholder="ej. Emplazamiento / Notificación / Embargo" /></div>
            </div>
          </section>

          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Link2 className="h-4 w-4" style={{ color: TEAL }} /> Expediente relacionado (opcional)</p>
            <select className={inp} value={padreId} onChange={(e) => elegirPadre(e.target.value)}>
              <option value="">— sin ligar (exhorto independiente) —</option>
              {juicios.map((j) => <option key={j.id} value={j.id}>{j.expediente}{j.cliente_nombre ? ` · ${j.cliente_nombre}` : ""}{j.entidad ? ` · ${j.entidad}` : ""}</option>)}
            </select>
          </section>

          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Landmark className="h-4 w-4" style={{ color: TEAL }} /> Seguimiento</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className={lbl}>Prioridad</label>
                <select className={inp} value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                  <option value="">— sin prioridad —</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Media</option>
                  <option value="BAJA">Baja</option>
                </select>
              </div>
              <div><label className={lbl}>Vence</label><input type="date" className={inp} value={vence} onChange={(e) => setVence(e.target.value)} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Nota</label><input className={inp} value={nota} onChange={(e) => setNota(e.target.value)} /></div>
            </div>
          </section>

          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><MapPin className="h-4 w-4" style={{ color: TEAL }} /> Juzgado exhortado (lo sigue el robot)</p>
            <p className="mb-2 text-[11px] text-muted-foreground">Es el juzgado <b>que recibe</b> el exhorto. El robot busca ahí el <b>expediente exhortado</b>.</p>
            <div className="mb-2"><label className={lbl}>Expediente en el juzgado exhortado</label><input className={inp} value={expediente} onChange={(e) => setExpediente(e.target.value)} placeholder="número que le asignó el juzgado que recibe" /></div>
            <div className="mb-2"><label className={lbl}>Entidad</label>
              <select className={inp} value={entidad} onChange={(e) => setEntidad(e.target.value)}>
                <option value="Sinaloa">Sinaloa</option>
                <option value="CDMX">CDMX</option>
                <option value="BCS">Baja California Sur</option>
                <option value="Jalisco">Jalisco</option>
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
                <option value="">{jalJudges.length ? "Selecciona…" : "Cargando…"}</option>
                <optgroup label="Zona Metropolitana (Guadalajara)">
                  {jalJudges.filter((j) => !j.foraneo).map((j) => <option key={j.code} value={j.code}>{j.name} [{j.code}]</option>)}
                </optgroup>
                <optgroup label="Foráneos (municipios)">
                  {jalJudges.filter((j) => j.foraneo).map((j) => <option key={j.code} value={j.code}>{j.name} [{j.code}]</option>)}
                </optgroup>
              </select>
            ) : (
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">CDMX no tiene robot. El exhorto se crea, pero su seguimiento se lleva a mano.</p>
            )}
            <div className={`mt-2 rounded-md p-2 text-xs ${robotListo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {robotListo ? "✓ Quedará listo para que el robot lo audite en automático." : "⚠️ Sin juzgado exhortado, el robot no podrá seguirlo. Puedes asignarlo aquí o después."}
            </div>
          </section>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><Check className="h-4 w-4" /> Crear exhorto</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

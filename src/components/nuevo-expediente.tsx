import { useEffect, useMemo, useState } from "react";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { type BoletinJuzgado } from "@/components/config-boletin";
import { cargarJuzgadosJalisco, nombreJuzgadoJAL, type JuzgadoJAL } from "@/lib/jalisco-juzgados";
import { X, Loader2, Check, FilePlus, Scale, Landmark, UserCheck, MapPin } from "lucide-react";

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

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function coincideMateria(esp: string | null, materia: string) {
  if (!esp || !materia) return false;
  const e = norm(esp), m = norm(materia);
  if (e.includes(m) || m.includes(e)) return true;
  return e.split(/\s+/).filter((w) => w.length >= 4).some((w) => m.includes(w));
}

export function NuevoExpedienteModal({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  // datos del juicio
  const [expediente, setExpediente] = useState("");
  const [entidad, setEntidad] = useState("Sinaloa");
  const [materia, setMateria] = useState("");
  const [via, setVia] = useState("");
  const [actor, setActor] = useState("");
  const [demandado, setDemandado] = useState("");
  // garantía
  const [cliente, setCliente] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [noCredito, setNoCredito] = useState("");
  const [direccion, setDireccion] = useState("");
  // estatus
  const [etapa, setEtapa] = useState("");
  const [estatus, setEstatus] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [nota, setNota] = useState("");
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

  const distritos = useMemo(() => Array.from(new Set(cat.map((c) => c.nombre_distrito))).sort(), [cat]);
  const juzgadosDeDistrito = useMemo(() => cat.filter((c) => c.nombre_distrito === distrito), [cat, distrito]);

  const abogados = useMemo(() => {
    const elab = colabs.filter((c) => c.rol && rolesElaboran.includes(c.rol));
    return elab.map((c) => ({ ...c, sugerido: coincideMateria(c.especialidad, materia) }))
      .sort((a, b) => (b.sugerido ? 1 : 0) - (a.sugerido ? 1 : 0) || a.nombre.localeCompare(b.nombre));
  }, [colabs, rolesElaboran, materia]);

  const guardar = async () => {
    if (!expediente.trim()) { setError("Escribe el número de expediente."); return; }
    setGuardando(true); setError(null);
    try {
      // armar campos de juzgado según entidad
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

      const abg = abogados.find((a) => a.id === abogadoId);
      const payload = {
        expediente: expediente.trim(),
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
        unidad: "UCM",
        archivado: false,
        ...jz,
      };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico`, { method: "POST", headers: { ...wHeaders, Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("No se pudo crear (" + r.status + ").");
      onCreado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  // ¿quedará listo para el robot?
  const robotListo = (entidad === "Sinaloa" && !!juzgadoId) || entidad === "BCS" || (entidad === "Jalisco" && !!jalCode);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><FilePlus className="h-4 w-4" /> Nuevo expediente</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-4">
          {/* Datos del juicio */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><Scale className="h-4 w-4" style={{ color: TEAL }} /> Datos del juicio</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className={lbl}>Expediente *</label><input className={inp} value={expediente} onChange={(e) => setExpediente(e.target.value)} placeholder="ej. 575/2022" /></div>
              <div><label className={lbl}>Entidad *</label>
                <select className={inp} value={entidad} onChange={(e) => setEntidad(e.target.value)}>
                  <option value="Sinaloa">Sinaloa</option>
                  <option value="CDMX">CDMX</option>
                  <option value="BCS">Baja California Sur</option>
                  <option value="Jalisco">Jalisco</option>
                </select>
              </div>
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

          {/* Juzgado según entidad */}
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}><MapPin className="h-4 w-4" style={{ color: TEAL }} /> Juzgado (para que el robot lo siga)</p>
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
              <div><label className={lbl}>Juzgado / Órgano (La Paz)</label>
                <select className={inp} value={orgBCS} onChange={(e) => setOrgBCS(e.target.value)}>
                  {BCS_ORGANOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : entidad === "Jalisco" ? (
              <div><label className={lbl}>Juzgado (Jalisco · ZMG)</label>
                <select className={inp} value={jalCode} onChange={(e) => setJalCode(e.target.value)} disabled={!jalJudges.length}>
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
              <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">CDMX no tiene robot (su boletín es de pago). El expediente se crea, pero su seguimiento del boletín se lleva a mano.</p>
            )}
            <div className={`mt-2 rounded-md p-2 text-xs ${robotListo ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
              {robotListo ? "✓ Quedará listo para que el robot lo audite en automático." : "⚠️ Sin juzgado, el robot no podrá seguirlo. Puedes asignarlo aquí o después con el ⋮ → Abrir ficha."}
            </div>
          </section>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><Check className="h-4 w-4" /> Crear expediente</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

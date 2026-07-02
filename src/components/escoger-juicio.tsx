import { useEffect, useMemo, useState } from "react";
import { X, Search, Loader2, Scale, FileX2, PencilLine, CheckCircle2 } from "lucide-react";
import { sbSelect } from "@/lib/supabase";
import { ROBOT, cargarJuzgadosJalisco, type JuzgadoJAL } from "@/lib/jalisco-juzgados";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";

interface BoletinJuzgado { nombre_distrito: string; nombre_juzgado: string; }
type Modo = "menu" | "boletin" | "manual";

// Resultado que devuelve el modal al escoger.
export interface JuicioElegido {
  expediente: string | null;
  juzgado: string | null;
  distrito: string | null;
  sinJuicio: boolean;
  motivoSinJuicio?: string | null;
}

const BCS_ORGANOS = ["Primero Civil", "Segundo Civil", "Tercero Civil"];

// Modal para escoger el juicio ANTES de pre-dictaminar.
// 3 caminos: buscar en el boletín (robot) · sin juicio · captura manual.
export function EscogerJuicioModal({ onClose, onElegido }: {
  onClose: () => void; onElegido: (j: JuicioElegido) => void;
}) {
  const [modo, setModo] = useState<Modo>("menu");

  // catálogos boletín
  const [estado, setEstado] = useState<"sinaloa" | "bcs" | "jalisco">("sinaloa");
  const [cat, setCat] = useState<BoletinJuzgado[]>([]);
  const [distrito, setDistrito] = useState("");
  const [juzgado, setJuzgado] = useState("");
  const [orgBCS, setOrgBCS] = useState(BCS_ORGANOS[1]);
  const [jalJudges, setJalJudges] = useState<JuzgadoJAL[]>([]);
  const [jalCode, setJalCode] = useState("");
  const [exp, setExp] = useState("");
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  // manual
  const [mExp, setMExp] = useState(""); const [mJuz, setMJuz] = useState(""); const [mDist, setMDist] = useState("");
  // sin juicio
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    sbSelect<BoletinJuzgado>("boletin_juzgado", "select=*&order=nombre_distrito,nombre_juzgado&limit=2000").then((d) => setCat(d || [])).catch(() => {});
    cargarJuzgadosJalisco().then(setJalJudges).catch(() => {});
  }, []);

  const distritos = useMemo(() => Array.from(new Set(cat.map((c) => c.nombre_distrito))).sort(), [cat]);
  const juzgados = useMemo(() => cat.filter((c) => c.nombre_distrito === distrito), [cat, distrito]);

  const buscar = async () => {
    if (!exp.trim()) { setErr("Escribe el número de expediente (ej. 448/2024)."); return; }
    let url = "";
    if (estado === "sinaloa") {
      if (!distrito || !juzgado) { setErr("Completa jurisdicción y juzgado."); return; }
      url = `${ROBOT}/probar?exp=${encodeURIComponent(exp.trim())}&distrito=${encodeURIComponent(distrito)}&juzgado=${encodeURIComponent(juzgado.split(",")[0])}`;
    } else if (estado === "bcs") {
      url = `${ROBOT}/bcs-buscar?exp=${encodeURIComponent(exp.trim())}&juzgado=${encodeURIComponent(orgBCS)}`;
    } else {
      if (!jalCode) { setErr("Elige el juzgado de Jalisco."); return; }
      const esForaneo = jalJudges.find((j) => j.code === jalCode)?.foraneo;
      url = `${ROBOT}/${esForaneo ? "jalf-leer" : "jal-leer"}?exp=${encodeURIComponent(exp.trim())}&judged=${encodeURIComponent(jalCode)}`;
    }
    setErr(null); setCargando(true); setRes(null);
    try { const r = await fetch(url); setRes(await r.json()); }
    catch { setErr("No se pudo conectar con el robot. Intenta de nuevo."); }
    finally { setCargando(false); }
  };

  const elegirDelBoletin = () => {
    const juzNombre = estado === "sinaloa" ? juzgado.split(",")[0] : estado === "bcs" ? orgBCS : (jalJudges.find((j) => j.code === jalCode)?.name || "");
    onElegido({ expediente: exp.trim(), juzgado: juzNombre || null, distrito: distrito || null, sinJuicio: false });
  };

  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><Scale className="h-4 w-4" /> Escoger el juicio</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {/* menú de 3 opciones */}
          {modo === "menu" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Antes de pre-dictaminar, elige el juicio de esta garantía:</p>
              <button onClick={() => setModo("boletin")} className="flex w-full items-center gap-3 rounded-lg border border-input p-3 text-left hover:bg-muted/40">
                <Search className="h-5 w-5 text-[color:var(--teal)]" />
                <span><b className="block text-sm">Buscar en el boletín</b><span className="text-xs text-muted-foreground">Consulta el robot por expediente y juzgado</span></span>
              </button>
              <button onClick={() => setModo("manual")} className="flex w-full items-center gap-3 rounded-lg border border-input p-3 text-left hover:bg-muted/40">
                <PencilLine className="h-5 w-5 text-[color:var(--teal)]" />
                <span><b className="block text-sm">Capturar manual</b><span className="text-xs text-muted-foreground">Si no lo encuentras en el boletín</span></span>
              </button>
              <button onClick={() => setModo("boletin")} className="hidden" />
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-900"><FileX2 className="h-5 w-5" /> No tiene juicio / expediente</p>
                <input className={`${inp} mt-2`} placeholder="¿Por qué no tiene? (motivo)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <button onClick={() => onElegido({ expediente: null, juzgado: null, distrito: null, sinJuicio: true, motivoSinJuicio: motivo || null })} className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: "#B26B00" }}>Marcar sin juicio y continuar</button>
              </div>
            </div>
          )}

          {/* buscar en boletín */}
          {modo === "boletin" && (
            <div className="space-y-3">
              <button onClick={() => { setModo("menu"); setRes(null); }} className="text-xs text-muted-foreground hover:underline">← Volver</button>
              <div className="flex gap-1.5">
                {(["sinaloa", "bcs", "jalisco"] as const).map((s) => (
                  <button key={s} onClick={() => setEstado(s)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${estado === s ? "text-white" : ""}`} style={estado === s ? { background: TEAL, borderColor: TEAL } : {}}>{s === "sinaloa" ? "Sinaloa" : s === "bcs" ? "La Paz BCS" : "Jalisco"}</button>
                ))}
              </div>
              {estado === "sinaloa" && (<>
                <div><label className={lbl}>Distrito</label><select className={inp} value={distrito} onChange={(e) => { setDistrito(e.target.value); setJuzgado(""); }}><option value="">Elige…</option>{distritos.map((d) => <option key={d}>{d}</option>)}</select></div>
                <div><label className={lbl}>Juzgado</label><select className={inp} value={juzgado} onChange={(e) => setJuzgado(e.target.value)}><option value="">Elige…</option>{juzgados.map((j, i) => <option key={i} value={j.nombre_juzgado}>{j.nombre_juzgado}</option>)}</select></div>
              </>)}
              {estado === "bcs" && (<div><label className={lbl}>Juzgado (La Paz)</label><select className={inp} value={orgBCS} onChange={(e) => setOrgBCS(e.target.value)}>{BCS_ORGANOS.map((o) => <option key={o}>{o}</option>)}</select></div>)}
              {estado === "jalisco" && (<div><label className={lbl}>Juzgado (Jalisco)</label><select className={inp} value={jalCode} onChange={(e) => setJalCode(e.target.value)}><option value="">Elige…</option>{jalJudges.map((j) => <option key={j.code} value={j.code}>{j.name}</option>)}</select></div>)}
              <div><label className={lbl}>Expediente</label><input className={inp} value={exp} onChange={(e) => setExp(e.target.value)} placeholder="448/2024" /></div>
              <button onClick={buscar} disabled={cargando} className="w-full rounded-md py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>{cargando ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Buscar en el boletín"}</button>
              {err && <p className="text-xs text-red-600">{err}</p>}
              {res && (
                <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
                  {res.acuerdos?.length > 0 ? (<>
                    <p className="font-semibold text-[color:var(--teal)]">✓ Encontrado: {res.acuerdos[0]?.expediente} · {res.acuerdos.length} acuerdos</p>
                    <button onClick={elegirDelBoletin} className="mt-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: TEAL }}><CheckCircle2 className="h-4 w-4" /> Usar este juicio</button>
                  </>) : (<>
                    <p className="text-muted-foreground">No se encontraron acuerdos{res.motivo ? ` (${res.motivo})` : ""}. Puedes usarlo igual o capturarlo manual.</p>
                    <button onClick={elegirDelBoletin} className="mt-2 rounded-md border border-input px-3 py-1.5 text-xs">Usar de todas formas</button>
                  </>)}
                </div>
              )}
            </div>
          )}

          {/* captura manual */}
          {modo === "manual" && (
            <div className="space-y-3">
              <button onClick={() => setModo("menu")} className="text-xs text-muted-foreground hover:underline">← Volver</button>
              <div><label className={lbl}>Expediente</label><input className={inp} value={mExp} onChange={(e) => setMExp(e.target.value)} placeholder="448/2024" /></div>
              <div><label className={lbl}>Juzgado</label><input className={inp} value={mJuz} onChange={(e) => setMJuz(e.target.value)} /></div>
              <div><label className={lbl}>Distrito judicial</label><input className={inp} value={mDist} onChange={(e) => setMDist(e.target.value)} /></div>
              <button onClick={() => onElegido({ expediente: mExp.trim() || null, juzgado: mJuz.trim() || null, distrito: mDist.trim() || null, sinJuicio: false })} disabled={!mExp.trim()} className="w-full rounded-md py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: TEAL }}>Usar este juicio</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

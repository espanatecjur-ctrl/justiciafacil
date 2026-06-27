import { useEffect, useMemo, useState } from "react";
import { sbSelect } from "@/lib/supabase";
import { type BoletinJuzgado } from "@/components/config-boletin";
import { Search, Loader2 } from "lucide-react";

// URL del robot en Google Cloud Run (consulta en vivo el boletín, NO guarda nada)
const ROBOT = "https://robot-boletin-699470444450.us-central1.run.app";
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type Acuerdo = { fecha: string; expediente: string; actor?: string; demandado?: string; etapa?: string; notificacion?: string; acuerdo: string };
type Resp = { ok: boolean; acuerdos?: Acuerdo[]; motivo?: string };

export function BuscadorBoletin() {
  const [cat, setCat] = useState<BoletinJuzgado[]>([]);
  const [distrito, setDistrito] = useState("");
  const [juzgado, setJuzgado] = useState("");
  const [exp, setExp] = useState("");
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    sbSelect<BoletinJuzgado>("boletin_juzgado", "select=*&order=nombre_distrito,nombre_juzgado&limit=2000")
      .then((d) => setCat(d || [])).catch(() => {});
  }, []);

  const distritos = useMemo(() => Array.from(new Set(cat.map((c) => c.nombre_distrito))).sort(), [cat]);
  const juzgados = useMemo(() => cat.filter((c) => c.nombre_distrito === distrito), [cat, distrito]);

  const buscar = async () => {
    if (!distrito || !juzgado || !exp.trim()) { setErr("Completa jurisdicción, juzgado y número de expediente."); return; }
    setErr(null); setCargando(true); setRes(null);
    try {
      const jz = juzgado.split(",")[0];
      const url = `${ROBOT}/probar?exp=${encodeURIComponent(exp.trim())}&distrito=${encodeURIComponent(distrito)}&juzgado=${encodeURIComponent(jz)}`;
      const r = await fetch(url);
      setRes(await r.json());
    } catch {
      setErr("No se pudo conectar con el robot. Intenta de nuevo en un momento.");
    } finally {
      setCargando(false);
    }
  };

  const acuerdos = res?.acuerdos || [];
  const party = acuerdos[0];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Consulta cualquier expediente en el boletín del Tribunal de Sinaloa (búsqueda en vivo, no guarda nada).
          El Tribunal solo permite buscar por número de expediente dentro de un juzgado; el nombre del actor y demandado aparece en los resultados.
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Jurisdicción</label>
            <select className={inp} value={distrito} onChange={(e) => { setDistrito(e.target.value); setJuzgado(""); }}>
              <option value="">Selecciona…</option>
              {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Juzgado</label>
            <select className={inp} value={juzgado} onChange={(e) => setJuzgado(e.target.value)} disabled={!distrito}>
              <option value="">Selecciona…</option>
              {juzgados.map((j) => <option key={j.cve_juzgado} value={j.nombre_juzgado}>{j.nombre_juzgado}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">N° de expediente</label>
            <input className={inp} value={exp} onChange={(e) => setExp(e.target.value)} placeholder="ej. 575/2022" onKeyDown={(e) => { if (e.key === "Enter") buscar(); }} />
          </div>
        </div>

        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

        <button onClick={buscar} disabled={cargando} className="mt-3 flex items-center gap-2 rounded-md bg-[color:var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {cargando ? <><Loader2 className="h-4 w-4 animate-spin" /> Buscando en el boletín…</> : <><Search className="h-4 w-4" /> Buscar</>}
        </button>
      </div>

      {res && (
        <div className="rounded-xl border border-border bg-card p-4">
          {acuerdos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron acuerdos para ese expediente en ese juzgado{res.motivo ? ` (${res.motivo})` : ""}.
              Verifica el número, el juzgado y la jurisdicción.
            </p>
          ) : (
            <>
              <div className="mb-3 border-b border-border pb-2">
                <p className="text-base font-bold text-[color:var(--teal)]">{party?.expediente} · {acuerdos.length} acuerdos</p>
                {(party?.actor || party?.demandado) && (
                  <p className="text-sm"><span className="font-semibold">{party?.actor || "—"}</span> <span className="text-muted-foreground">vs.</span> <span className="font-semibold">{party?.demandado || "—"}</span></p>
                )}
              </div>
              <div className="space-y-2">
                {acuerdos.map((a, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{a.etapa || "—"}</span>
                      <span className="text-xs text-muted-foreground">{a.fecha}</span>
                    </div>
                    <p className="text-sm">{a.acuerdo}</p>
                    {a.notificacion && <p className="mt-0.5 text-[11px] text-muted-foreground">Notificación: {a.notificacion}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

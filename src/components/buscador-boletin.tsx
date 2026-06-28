import { useEffect, useMemo, useState } from "react";
import { sbSelect } from "@/lib/supabase";
import { type BoletinJuzgado } from "@/components/config-boletin";
import { Search, Loader2 } from "lucide-react";

// URL del robot en Google Cloud Run (consulta en vivo el boletín, NO guarda nada)
const ROBOT = "https://robot-boletin-699470444450.us-central1.run.app";
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

// Órganos de La Paz, Baja California Sur (boletín del PJEBCS)
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
  "Primera Sala Unitaria en Materia Civil",
  "Segunda Sala Unitaria en Materia Civil",
  "Tercera Sala Unitaria Civil y de Justicia Administrativa (Materia Civil)",
];

type Acuerdo = { fecha: string; expediente: string; actor?: string; demandado?: string; etapa?: string; notificacion?: string; acuerdo: string };
type Resp = { ok: boolean; acuerdos?: Acuerdo[]; motivo?: string };

// Muestra "2026-03-19" como "19/03/2026" sin brincar de día por zona horaria
const fmt = (s?: string) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

export function BuscadorBoletin() {
  const [estado, setEstado] = useState<"sinaloa" | "bcs">("sinaloa");
  const [cat, setCat] = useState<BoletinJuzgado[]>([]);
  const [distrito, setDistrito] = useState("");
  const [juzgado, setJuzgado] = useState("");
  const [orgBCS, setOrgBCS] = useState(BCS_ORGANOS[1]); // Segundo Civil por defecto
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
    if (!exp.trim()) { setErr("Escribe el número de expediente (ej. 448/2024)."); return; }
    let url = "";
    if (estado === "sinaloa") {
      if (!distrito || !juzgado) { setErr("Completa jurisdicción y juzgado."); return; }
      const jz = juzgado.split(",")[0];
      url = `${ROBOT}/probar?exp=${encodeURIComponent(exp.trim())}&distrito=${encodeURIComponent(distrito)}&juzgado=${encodeURIComponent(jz)}`;
    } else {
      if (!orgBCS) { setErr("Elige el juzgado de La Paz."); return; }
      url = `${ROBOT}/bcs-buscar?exp=${encodeURIComponent(exp.trim())}&juzgado=${encodeURIComponent(orgBCS)}`;
    }
    setErr(null); setCargando(true); setRes(null);
    try {
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
          Consulta cualquier expediente en el boletín del Tribunal (búsqueda en vivo, no guarda nada).
          Se busca por número de expediente dentro de un juzgado; el actor y demandado aparecen en los resultados.
        </p>

        {/* Selector de estado */}
        <div className="mb-3 inline-flex rounded-lg border border-border p-0.5">
          <button
            onClick={() => { setEstado("sinaloa"); setRes(null); setErr(null); }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${estado === "sinaloa" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground"}`}
          >Sinaloa</button>
          <button
            onClick={() => { setEstado("bcs"); setRes(null); setErr(null); }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${estado === "bcs" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground"}`}
          >Baja California Sur (La Paz)</button>
        </div>

        {estado === "sinaloa" ? (
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
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Juzgado / Órgano (La Paz)</label>
              <select className={inp} value={orgBCS} onChange={(e) => setOrgBCS(e.target.value)}>
                {BCS_ORGANOS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">N° de expediente</label>
              <input className={inp} value={exp} onChange={(e) => setExp(e.target.value)} placeholder="ej. 448/2024" onKeyDown={(e) => { if (e.key === "Enter") buscar(); }} />
            </div>
          </div>
        )}

        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

        <button onClick={buscar} disabled={cargando} className="mt-3 flex items-center gap-2 rounded-md bg-[color:var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {cargando ? <><Loader2 className="h-4 w-4 animate-spin" /> Consultando el boletín del Tribunal…</> : <><Search className="h-4 w-4" /> Buscar</>}
        </button>
        {cargando && <p className="mt-2 text-xs text-muted-foreground">El robot está abriendo el boletín y leyendo el expediente. Suele tardar entre 15 y 50 segundos — déjalo trabajar, no recargues la página.</p>}
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
                      {a.etapa ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{a.etapa}</span> : <span />}
                      <span className="text-xs text-muted-foreground">{fmt(a.fecha)}</span>
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

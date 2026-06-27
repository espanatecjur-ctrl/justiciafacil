import { useEffect, useMemo, useState } from "react";
import { sbSelect, SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { X, Loader2, MapPin, Check } from "lucide-react";

const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export interface BoletinJuzgado {
  id: string; cve_distrito: string; nombre_distrito: string; cve_juzgado: string; nombre_juzgado: string; fuente?: string;
}

// El boletín manda el expediente sin diagonal: 00341/2017 -> 003412017
export const folioAsunto = (expediente?: string | null) => (expediente || "").replace(/\D/g, "");

export function ConfigBoletinModal({ caso, onClose, onGuardado }: { caso: CasoJuridico; onClose: () => void; onGuardado: () => void }) {
  const [cat, setCat] = useState<BoletinJuzgado[]>([]);
  const [distrito, setDistrito] = useState(caso.cve_distrito || "");
  const [juzgadoId, setJuzgadoId] = useState("");
  const [otro, setOtro] = useState(false);
  const [nd, setNd] = useState(""); const [cd, setCd] = useState("");
  const [nj, setNj] = useState(""); const [cj, setCj] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sbSelect<BoletinJuzgado>("boletin_juzgado", "select=*&order=nombre_distrito,nombre_juzgado&limit=2000")
      .then((d) => {
        setCat(d || []);
        // preseleccionar si el expediente ya tiene juzgado
        if (caso.cve_distrito && caso.cve_juzgado) {
          const match = (d || []).find((x) => x.cve_distrito === caso.cve_distrito && x.cve_juzgado === caso.cve_juzgado);
          if (match) { setDistrito(match.cve_distrito); setJuzgadoId(match.id); }
        }
      }).catch(() => setCat([]));
  }, []);

  const distritos = useMemo(() => {
    const m = new Map<string, string>();
    for (const j of cat) m.set(j.cve_distrito, j.nombre_distrito);
    return [...m.entries()].map(([cve, nombre]) => ({ cve, nombre }));
  }, [cat]);

  const juzgadosDeDistrito = useMemo(() => cat.filter((j) => j.cve_distrito === distrito), [cat, distrito]);

  const guardar = async () => {
    setGuardando(true); setError(null);
    try {
      let payloadCve = { cve_distrito: "", cve_juzgado: "", nombre_juzgado: "" };

      if (otro) {
        if (!nd.trim() || !cd.trim() || !nj.trim() || !cj.trim()) { setError("Llena distrito, juzgado y sus dos claves."); setGuardando(false); return; }
        // 1) agregar al catálogo (para la próxima)
        await fetch(`${SUPABASE_URL}/rest/v1/boletin_juzgado`, {
          method: "POST", headers: wHeaders,
          body: JSON.stringify({ cve_distrito: cd.trim(), nombre_distrito: nd.trim(), cve_juzgado: cj.trim(), nombre_juzgado: nj.trim(), fuente: "manual" }),
        }).catch(() => {});
        payloadCve = { cve_distrito: cd.trim(), cve_juzgado: cj.trim(), nombre_juzgado: nj.trim() };
      } else {
        const j = cat.find((x) => x.id === juzgadoId);
        if (!j) { setError("Elige el juzgado de la lista (o usa “otro”)."); setGuardando(false); return; }
        payloadCve = { cve_distrito: j.cve_distrito, cve_juzgado: j.cve_juzgado, nombre_juzgado: j.nombre_juzgado };
      }

      // 2) guardar en el expediente
      const res = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${caso.id}`, {
        method: "PATCH", headers: wHeaders, body: JSON.stringify(payloadCve),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onGuardado();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4" /> Domicilio judicial · {caso.expediente}</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Asigna el <b>distrito</b> y <b>juzgado</b> para que el robot sepa dónde buscar este expediente en el boletín.</p>
          {error && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}

          {!otro ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Distrito judicial</label>
                <select className={inp} value={distrito} onChange={(e) => { setDistrito(e.target.value); setJuzgadoId(""); }}>
                  <option value="">— elige distrito —</option>
                  {distritos.map((d) => <option key={d.cve} value={d.cve}>{d.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Juzgado</label>
                <select className={inp} value={juzgadoId} onChange={(e) => setJuzgadoId(e.target.value)} disabled={!distrito}>
                  <option value="">— elige juzgado —</option>
                  {juzgadosDeDistrito.map((j) => <option key={j.id} value={j.id}>{j.nombre_juzgado}</option>)}
                </select>
              </div>
              <button onClick={() => setOtro(true)} className="text-xs text-[color:var(--teal)] hover:underline">¿No aparece tu juzgado? Agrégalo al catálogo →</button>
            </>
          ) : (
            <>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Estás agregando un juzgado nuevo al catálogo. Las <b>claves</b> son los números que usa el boletín (ej. distrito 06, juzgado 13). Si no las sabes, el robot las completará después.
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Nombre del distrito</label><input className={inp} value={nd} onChange={(e) => setNd(e.target.value)} placeholder="Culiacán" /></div>
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Clave</label><input className={inp} value={cd} onChange={(e) => setCd(e.target.value)} placeholder="06" /></div>
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Nombre del juzgado</label><input className={inp} value={nj} onChange={(e) => setNj(e.target.value)} placeholder="Juzgado Tercero Civil, Culiacán" /></div>
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Clave</label><input className={inp} value={cj} onChange={(e) => setCj(e.target.value)} placeholder="13" /></div>
              </div>
              <button onClick={() => setOtro(false)} className="text-xs text-[color:var(--teal)] hover:underline">← Volver a la lista</button>
            </>
          )}

          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            El robot buscará con: <b>FolioAsunto = {folioAsunto(caso.expediente) || "—"}</b> (tu expediente sin la diagonal).
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SelectorGarantia · Cargar una garantía existente en el pre-dictaminador
// ------------------------------------------------------------
// Permite escoger desde JUFA una garantía que YA está:
//   - en URRJ  (un pre-dictamen guardado, tabla `predictamen`), o
//   - en UCP   (una garantía en consolidación, tabla `dictamen`)
// y precargar sus datos en el recorrido de la posición correcta.
// No cambia nada de lo que ya hay: es un atajo opcional arriba del selector.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { type Precarga } from "@/lib/predictamen-guardar";
import { type VistaPosicion } from "@/components/dictaminador-posicion";
import { Search, FolderInput, Loader2 } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

const mapPos = (p?: string | null): VistaPosicion => {
  const m: Record<string, VistaPosicion> = {
    Actor: "Actor", Demandado: "Demandado", Sucesorio: "Sucesorio",
    Contingencia: "Contingencia", "Trámite administrativo": "Tramites", Tramites: "Tramites",
  };
  return m[p || ""] || "Actor";
};

interface PredRow { id: string; caso_id: string | null; posicion: string | null; dictamen_final: string | null; datos: any; version?: number; }
interface DictRow { id: string; caso_id: string | null; predictamen_id: string | null; veredicto: string | null; }
interface CasoRow { id: string; expediente?: string; juzgado?: string; cliente_nombre?: string; direccion_garantia?: string; }

export function SelectorGarantia({ onCargar }: { onCargar: (precarga: Precarga, posicion: VistaPosicion) => void }) {
  const [fuente, setFuente] = useState<"URRJ" | "UCP">("URRJ");
  const [preds, setPreds] = useState<PredRow[]>([]);
  const [dicts, setDicts] = useState<DictRow[]>([]);
  const [casos, setCasos] = useState<CasoRow[]>([]);
  const [busca, setBusca] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&en_papelera=eq.false&vigente=eq.true&order=created_at.desc&limit=500`, { headers })
        .then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=id,caso_id,predictamen_id,veredicto&vigente=eq.true&limit=500`, { headers })
        .then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,juzgado,cliente_nombre,direccion_garantia&order=expediente.asc&limit=1000`, { headers })
        .then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, d, c]) => { setPreds(p); setDicts(d); setCasos(c); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const casoPorId = useMemo(() => { const m: Record<string, CasoRow> = {}; for (const c of casos) m[c.id] = c; return m; }, [casos]);
  const predPorId = useMemo(() => { const m: Record<string, PredRow> = {}; for (const p of preds) m[p.id] = p; return m; }, [preds]);

  const etiqueta = (casoId: string | null, datos?: any) => {
    const c = casoId ? casoPorId[casoId] : undefined;
    const exp = c?.expediente || datos?.expediente || "Sin expediente";
    const juz = c?.juzgado || datos?.juzgado || "";
    const cli = c?.cliente_nombre || datos?.deudor || "";
    return { exp, juz, cli };
  };

  const q = busca.trim().toLowerCase();
  const coincide = (e: { exp: string; juz: string; cli: string }) =>
    !q || [e.exp, e.juz, e.cli].some((v) => (v || "").toLowerCase().includes(q));

  const filasURRJ = preds
    .map((p) => ({ p, e: etiqueta(p.caso_id, p.datos) }))
    .filter(({ e }) => coincide(e));

  const filasUCP = dicts
    .map((d) => ({ d, pred: d.predictamen_id ? predPorId[d.predictamen_id] : undefined, e: etiqueta(d.caso_id) }))
    .filter(({ e }) => coincide(e));

  const cargarURRJ = (p: PredRow) =>
    onCargar({ datos: p.datos || {}, antecedenteId: p.id, version: p.version || 1 }, mapPos(p.posicion));

  const cargarUCP = (d: DictRow, pred?: PredRow) =>
    onCargar({ datos: pred?.datos || {}, antecedenteId: pred?.id, version: pred?.version || 1 }, mapPos(pred?.posicion));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FolderInput className="h-4 w-4 text-[color:var(--teal)]" />
        <p className="text-sm font-semibold">Cargar una garantía que ya existe</p>
        <span className="text-xs text-muted-foreground">(opcional · precarga el recorrido)</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-input p-0.5">
          {(["URRJ", "UCP"] as const).map((f) => (
            <button key={f} onClick={() => setFuente(f)}
              className={`rounded px-3 py-1 text-xs font-medium ${fuente === f ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground"}`}>
              {f === "URRJ" ? "De URRJ (pre-dictámenes)" : "De UCP (en consolidación)"}
            </button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por expediente, juzgado o deudor…"
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" />
        </div>
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando garantías…</div>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {fuente === "URRJ" && filasURRJ.length === 0 && <p className="p-3 text-sm text-muted-foreground">No hay pre-dictámenes que coincidan.</p>}
          {fuente === "UCP" && filasUCP.length === 0 && <p className="p-3 text-sm text-muted-foreground">No hay garantías de UCP que coincidan.</p>}

          {fuente === "URRJ" && filasURRJ.map(({ p, e }) => (
            <button key={p.id} onClick={() => cargarURRJ(p)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <span className="min-w-0">
                <span className="block truncate font-medium">{e.exp}</span>
                <span className="block truncate text-xs text-muted-foreground">{e.juz}{e.cli ? ` · ${e.cli}` : ""}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{p.posicion || "Actor"}{p.dictamen_final ? ` · ${p.dictamen_final}` : ""}</span>
            </button>
          ))}

          {fuente === "UCP" && filasUCP.map(({ d, pred, e }) => (
            <button key={d.id} onClick={() => cargarUCP(d, pred)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <span className="min-w-0">
                <span className="block truncate font-medium">{e.exp}</span>
                <span className="block truncate text-xs text-muted-foreground">{e.juz}{e.cli ? ` · ${e.cli}` : ""}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{pred?.posicion || "Actor"}{d.veredicto ? ` · ${d.veredicto}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

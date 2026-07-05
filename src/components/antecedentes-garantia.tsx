// ============================================================
// AntecedentesGarantia · historial de SOLO LECTURA de una garantía
// ------------------------------------------------------------
// Junta en una línea de tiempo todo lo que ya existe de la MISMA
// garantía, sin importar el módulo donde estés:
//   · Pre-dictámenes URRJ   (tabla predictamen)
//   · Dictámenes UCP/UCM     (tabla dictamen; estado etapa_b = UCM)
//   · Actuaciones del boletín (tabla acuerdo_judicial, por expediente)
//   · Evidencias subidas      (tabla tarea, tipo evidencia)
// No se edita aquí: es mostrario, para no duplicar el trabajo.
// Cada renglón trae un "ojito" que lleva a la ficha de esa área
// SOLO si el usuario tiene permiso de ver ese módulo.
// Se amarra por caso_id (id de la garantía) y, para el boletín,
// por número de expediente.
// ============================================================
import { useEffect, useState } from "react";
import { BotonVerDoc } from "@/components/visor-documento";
import { useNavigate } from "@tanstack/react-router";
import { sbSelect } from "@/lib/supabase";
import { cargarModulosVisibles, puedeVerModulo } from "@/lib/permisos-modulos";
import type { ModuloClave } from "@/lib/roles";
import { History, Lock, Eye, Info } from "lucide-react";

type Area = "urrj" | "ucp" | "ucm" | "boletin" | "evidencia";

interface Item {
  key: string;
  fecha: string | null;
  area: Area;
  etiqueta: string;
  titulo: string;
  estado?: string | null;
  firmas?: number;
  url?: string | null;
  meta?: string | null;
  modulo?: ModuloClave;
  ruta?: "/urrj" | "/ucp" | "/ucm" | "/boletines";
}

// colores por área: [fondo chip, texto chip, riel]
const COLOR: Record<Area, [string, string, string]> = {
  urrj: ["#E1F5EE", "#0F6E56", "#1D9E75"],
  ucp: ["#E6F1FB", "#0C447C", "#378ADD"],
  ucm: ["#EEEDFE", "#3C3489", "#7F77DD"],
  boletin: ["#FAEEDA", "#854F0B", "#EF9F27"],
  evidencia: ["#F1EFE8", "#444441", "#888780"],
};

const fmt = (f?: string | null) => {
  if (!f) return "—";
  const d = new Date(String(f).slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

const contarFirmas = (obj: any): number => {
  if (!obj || typeof obj !== "object") return 0;
  return Object.values(obj).filter((v: any) => v && (v.fecha || v === true || typeof v === "string")).length;
};

const chipEstado = (estado?: string | null): [string, string] | null => {
  if (!estado) return null;
  const e = estado.toUpperCase();
  if (e.includes("POSITIV")) return ["#EAF3DE", "#3B6D11"];
  if (e.includes("NEGATIV")) return ["#FCEBEB", "#A32D2D"];
  return ["#F1EFE8", "#444441"];
};

export function AntecedentesGarantia({ casoId, expediente }: { casoId?: string | null; expediente?: string | null }) {
  const exp = (expediente || "").trim();
  const [items, setItems] = useState<Item[]>([]);
  const [visibles, setVisibles] = useState<Set<ModuloClave> | null>(null);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      const v = await cargarModulosVisibles();
      if (vivo) setVisibles(v);

      const porCaso = casoId ? `caso_id=eq.${casoId}` : exp ? `expediente=eq.${encodeURIComponent(exp)}` : null;
      const lista: Item[] = [];

      try {
        // Pre-dictámenes URRJ
        if (porCaso) {
          const preds = await sbSelect<any>("predictamen", `select=id,folio,dictamen_final,resultados,created_at&en_papelera=eq.false&vigente=eq.true&${porCaso}`).catch(() => []);
          for (const p of preds || []) {
            lista.push({
              key: "pred-" + p.id, fecha: p.created_at, area: "urrj",
              etiqueta: "Pre-dictamen URRJ",
              titulo: p.folio ? `Folio ${p.folio}` : "Pre-dictamen",
              estado: p.dictamen_final, firmas: contarFirmas(p?.resultados?.firmas),
              modulo: "urrj", ruta: "/urrj",
            });
          }
          // Dictámenes UCP / UCM
          const dicts = await sbSelect<any>("dictamen", `select=id,estado,veredicto,firmas,created_at&en_papelera=eq.false&vigente=eq.true&${porCaso}`).catch(() => []);
          for (const d of dicts || []) {
            const esUCM = String(d.estado || "").toLowerCase() === "etapa_b";
            lista.push({
              key: "dict-" + d.id, fecha: d.created_at, area: esUCM ? "ucm" : "ucp",
              etiqueta: esUCM ? "Dictamen UCM" : "Dictamen UCP",
              titulo: esUCM ? "Seguimiento a juicio" : "Viabilidad",
              estado: d.veredicto, firmas: contarFirmas(d.firmas),
              modulo: esUCM ? "ucm" : "ucp", ruta: esUCM ? "/ucm" : "/ucp",
            });
          }
          // Evidencias subidas
          const evs = await sbSelect<any>("tarea", `select=id,titulo,evidencia_url,created_at&tipo=eq.evidencia&${porCaso}`).catch(() => []);
          for (const e of evs || []) {
            lista.push({
              key: "evi-" + e.id, fecha: e.created_at, area: "evidencia",
              etiqueta: "Evidencia", titulo: e.titulo || "Archivo", url: e.evidencia_url,
            });
          }
        }
        // Actuaciones del boletín (por expediente)
        if (exp) {
          const acts = await sbSelect<any>("acuerdo_judicial", `select=id,fecha_acuerdo,texto,origen&expediente=eq.${encodeURIComponent(exp)}&order=fecha_acuerdo.desc&limit=30`).catch(() => []);
          for (const a of acts || []) {
            lista.push({
              key: "act-" + a.id, fecha: a.fecha_acuerdo, area: "boletin",
              etiqueta: "Actuación · boletín", titulo: a.texto || "(sin texto)",
              meta: a.origen === "robot" ? "robot" : "manual",
              modulo: "boletines", ruta: "/boletines",
            });
          }
        }
      } catch { /* lo que se pueda */ }

      // orden cronológico (lo más viejo arriba = por dónde pasó)
      lista.sort((x, y) => (x.fecha || "").localeCompare(y.fecha || ""));
      if (vivo) { setItems(lista); setCargando(false); }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId, exp]);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Antecedentes de la garantía</span>
        <span className="ml-auto flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" /> solo lectura</span>
      </div>

      <div className="px-4 py-2">
        {cargando ? (
          <p className="py-3 text-xs text-muted-foreground">Cargando antecedentes…</p>
        ) : items.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">Aún no hay antecedentes de esta garantía. Se irán sumando solos conforme avancen los procesos.</p>
        ) : (
          items.map((it, i) => {
            const [bg, tx, riel] = COLOR[it.area];
            const ce = chipEstado(it.estado);
            const verOjito = it.modulo && it.ruta && puedeVerModulo(visibles, it.modulo);
            return (
              <div key={it.key} className={`flex gap-2.5 py-2.5 ${i < items.length - 1 ? "border-b border-border" : ""}`}>
                <div className="w-1.5 shrink-0 rounded-sm" style={{ background: riel }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: bg, color: tx }}>{it.etiqueta}</span>
                    {ce && <span className="rounded-md px-2 py-0.5 text-[11px]" style={{ background: ce[0], color: ce[1] }}>{it.estado}</span>}
                  </div>
                  <p className="mt-1 text-sm">{it.titulo}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {fmt(it.fecha)}
                    {typeof it.firmas === "number" && it.firmas > 0 ? ` · ${it.firmas} firma${it.firmas === 1 ? "" : "s"}` : ""}
                    {it.meta ? ` · ${it.meta}` : ""}
                    {it.url ? <> · <BotonVerDoc url={it.url} nombre={it.titulo} label="ver archivo" /></> : null}
                  </p>
                </div>
                {verOjito && (
                  <button
                    onClick={() => navigate({ to: it.ruta! })}
                    className="mt-0.5 shrink-0 self-start rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-[color:var(--teal)]"
                    title="Ir a la ficha de esta área"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-start gap-2 border-t border-border bg-muted/40 px-4 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">Esto no se edita aquí. Es el mismo historial en UCP, UCM, UDP y UCO de esta garantía. El ojito te lleva al módulo del proceso si tienes permiso.</p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Search, ArrowUpDown, FileText } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

interface Fila {
  id: string; folio: string | null; posicion: string | null; tipo_juicio: string | null;
  expediente: string | null; juzgado: string | null; estado: string | null;
  dictamen_sugerido: string | null; dictamen_final: string | null; created_at: string;
  datos: any;
}

const POS_COLOR: Record<string, string> = {
  Actor: "bg-emerald-100 text-emerald-800", Demandado: "bg-blue-100 text-blue-800", Sucesorio: "bg-amber-100 text-amber-800",
};
function dicColor(d?: string | null) {
  if (!d) return "text-muted-foreground";
  if (d.includes("POSITIVO") || d.includes("RECUPERABLE") && !d.includes("NO")) return "text-emerald-700";
  if (d.includes("NEGATIVO") || d.includes("NO LITIGABLE")) return "text-red-700";
  return "text-amber-700";
}

export function HistorialPredictamen({ onAbrir }: { onAbrir?: (f: Fila) => void }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<{ col: string; asc: boolean }>({ col: "created_at", asc: false });

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&order=created_at.desc&limit=500`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setFilas).catch(() => {}).finally(() => setCargando(false));
  }, []);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    let arr = filas;
    if (t) {
      arr = filas.filter((f) => {
        const txt = [f.folio, f.posicion, f.tipo_juicio, f.expediente, f.juzgado, f.estado, f.dictamen_sugerido, f.dictamen_final,
          f.datos?.ubicacion, f.datos?.deudor, f.datos?.deCujus, f.datos?.heredero, f.datos?.acreedor].filter(Boolean).join(" ").toLowerCase();
        return txt.includes(t);
      });
    }
    const c = orden.col;
    arr = [...arr].sort((a: any, b: any) => {
      const va = (a[c] ?? "").toString(); const vb = (b[c] ?? "").toString();
      return orden.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return arr;
  }, [filas, q, orden]);

  const dir = (f: Fila) => f.datos?.ubicacion || "—";
  const garantia = (f: Fila) => f.datos?.caso_id ? `#${f.datos.caso_id}` : (f.expediente || "—");
  const fecha = (s: string) => new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

  const Th = ({ col, children, w }: { col: string; children: React.ReactNode; w?: string }) => (
    <th className={`sticky top-0 z-10 cursor-pointer select-none border-b border-border bg-muted/70 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${w || ""}`}
      onClick={() => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : true }))}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown className="h-3 w-3 opacity-40" /></span>
    </th>
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Historial de pre-dictámenes</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{filtradas.length}</span>
        </div>
        <div className="relative w-48 sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cualquier cosa…" className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" />
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th col="folio">Folio</Th>
              <Th col="posicion">Posición</Th>
              <Th col="ubicacion">Garantía / dirección</Th>
              <Th col="expediente">Expediente</Th>
              <Th col="estado">Estado</Th>
              <Th col="dictamen_sugerido">Dictamen</Th>
              <Th col="dictamen_final">Decisión</Th>
              <Th col="created_at">Fecha</Th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{q ? "Sin resultados para tu búsqueda." : "Aún no hay pre-dictámenes guardados."}</td></tr>
            ) : filtradas.map((f) => (
              <tr key={f.id} onClick={() => onAbrir?.(f)} className="cursor-pointer border-b border-border/60 hover:bg-muted/40">
                <td className="px-3 py-2 font-mono text-[12px] font-medium">{f.folio || "—"}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${POS_COLOR[f.posicion || ""] || "bg-muted"}`}>{f.posicion || "—"}</span></td>
                <td className="px-3 py-2 max-w-[220px] truncate">{dir(f)}</td>
                <td className="px-3 py-2">{f.expediente || "—"}</td>
                <td className="px-3 py-2">{f.estado || "—"}</td>
                <td className={`px-3 py-2 text-[12px] font-medium ${dicColor(f.dictamen_sugerido)}`}>{f.dictamen_sugerido || "—"}</td>
                <td className="px-3 py-2 text-[12px]">{f.dictamen_final || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fecha(f.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

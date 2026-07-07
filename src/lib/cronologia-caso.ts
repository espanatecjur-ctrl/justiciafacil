import { useEffect, useState } from "react";
import { Loader2, History, FileText, PenLine, Stamp, Megaphone, StickyNote, GitBranch } from "lucide-react";
import { leerCronologia, type EventoCaso, type TipoEventoCaso } from "@/lib/cronologia-caso";

const AREA_COLOR: Record<string, string> = {
  UCP: "#0C447C", UCM: "#0C5C46", UDP: "#7A4FB0", UFC: "#B26B00", URRJ: "#2563EB",
};
const TIPO_INFO: Record<TipoEventoCaso, { label: string; icon: any }> = {
  cambio: { label: "Cambio", icon: PenLine },
  documento: { label: "Documento", icon: FileText },
  dictamen: { label: "Dictamen", icon: Stamp },
  actuacion: { label: "Actuación", icon: Megaphone },
  nota: { label: "Nota", icon: StickyNote },
  coincidencia: { label: "Coincidencia", icon: GitBranch },
};
const fmt = (s?: string) => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export function CronologiaCaso({ casoId, expediente, recargaId }: { casoId?: string | null; expediente?: string | null; recargaId?: number }) {
  const [eventos, setEventos] = useState<EventoCaso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [area, setArea] = useState<string>("todas");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    leerCronologia(casoId, expediente).then((e) => { if (vivo) { setEventos(e); setCargando(false); } });
    return () => { vivo = false; };
  }, [casoId, expediente, recargaId]);

  const areas = Array.from(new Set(eventos.map((e) => (e.area || "").toUpperCase()).filter(Boolean)));
  const lista = area === "todas" ? eventos : eventos.filter((e) => (e.area || "").toUpperCase() === area);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" /> Cronología del expediente</p>
        {areas.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setArea("todas")} className={`rounded-full border px-2 py-0.5 text-[11px] ${area === "todas" ? "bg-muted font-semibold" : "text-muted-foreground"}`}>Todas</button>
            {areas.map((a) => (
              <button key={a} onClick={() => setArea(a)} className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={area === a ? { background: AREA_COLOR[a] || "#555", color: "white", borderColor: AREA_COLOR[a] || "#555" } : { color: AREA_COLOR[a] || "#555" }}>{a}</button>
            ))}
          </div>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando cronología…</div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos todavía. Aquí se irán registrando los cambios, documentos y dictámenes de todas las áreas.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-4">
          {lista.map((e) => {
            const ti = TIPO_INFO[(e.tipo as TipoEventoCaso)] || TIPO_INFO.nota;
            const Ic = ti.icon;
            const col = AREA_COLOR[(e.area || "").toUpperCase()] || "#64748b";
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-0.5 grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: col }}><Ic className="h-2.5 w-2.5" /></span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {e.area && <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ background: col }}>{(e.area || "").toUpperCase()}</span>}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{ti.label}</span>
                  <span className="text-[10px] text-muted-foreground">{fmt(e.created_at)}</span>
                  {e.autor && <span className="text-[10px] text-muted-foreground">· {e.autor}</span>}
                </div>
                <p className="mt-0.5 text-sm">{e.texto}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

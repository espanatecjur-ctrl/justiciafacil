// ============================================================
// CronologiaURRJ · línea de tiempo de una garantía: dictámenes
// firmados (jurídico/registral) y correos preparados, con vista
// previa. Lee la tabla cronologia_urrj por caso_id o expediente.
// ============================================================
import { useEffect, useState } from "react";
import { leerCronologia, type EventoCronologia, type TipoEvento } from "@/lib/cronologia-urrj";
import { Scale, Landmark, Mail, ChevronRight, ChevronDown, History } from "lucide-react";

const META: Record<TipoEvento, { icon: typeof Scale; etiqueta: string; cls: string }> = {
  dictamen_juridico:  { icon: Scale,    etiqueta: "Dictamen jurídico firmado",  cls: "bg-emerald-50 text-emerald-700" },
  dictamen_registral: { icon: Landmark, etiqueta: "Dictamen registral firmado", cls: "bg-emerald-50 text-emerald-700" },
  correo_juridico:    { icon: Mail,     etiqueta: "Correo jurídico preparado",  cls: "bg-[color:var(--teal)]/10 text-[color:var(--teal)]" },
  correo_registral:   { icon: Mail,     etiqueta: "Correo registral preparado", cls: "bg-[color:var(--teal)]/10 text-[color:var(--teal)]" },
};

function fecha(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

export function CronologiaURRJ({ casoId, expediente }: { casoId?: string | null; expediente?: string | null }) {
  const [eventos, setEventos] = useState<EventoCronologia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    leerCronologia(casoId, expediente).then((e) => { if (vivo) { setEventos(e); setCargando(false); } });
    return () => { vivo = false; };
  }, [casoId, expediente]);

  if (cargando) return <p className="text-sm text-muted-foreground">Cargando cronología…</p>;
  if (eventos.length === 0) return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      <History className="h-4 w-4" /> Sin movimientos todavía. Aquí se irán registrando los dictámenes firmados y los correos preparados.
    </div>
  );

  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium"><History className="h-4 w-4" /> Cronología del expediente</p>
      <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
        {eventos.map((ev) => {
          const m = META[ev.tipo] || META.dictamen_juridico;
          const Icon = m.icon;
          const esCorreo = ev.tipo === "correo_juridico" || ev.tipo === "correo_registral";
          const abiertoEste = abierto === ev.id;
          return (
            <div key={ev.id || Math.random()}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{fecha(ev.created_at)}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}><Icon className="h-3 w-3" /> {m.etiqueta}</span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {ev.resultado ? <b className="text-foreground">{ev.resultado}</b> : null}
                {ev.detalle ? `${ev.resultado ? " · " : ""}${ev.detalle}` : ""}
                {ev.firma_elabora ? ` · Elabora: ${ev.firma_elabora}` : ""}
                {ev.firma_valida ? ` · Valida: ${ev.firma_valida}` : ""}
              </p>
              {esCorreo && ev.vista_previa && (
                <>
                  <button onClick={() => setAbierto(abiertoEste ? null : (ev.id || null))} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--teal)] hover:underline">
                    {abiertoEste ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} {abiertoEste ? "Ocultar vista previa" : "Ver vista previa"}
                  </button>
                  {abiertoEste && (
                    <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground">{ev.vista_previa}</pre>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

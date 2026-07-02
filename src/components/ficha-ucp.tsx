import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ScrollText, Landmark, CheckCircle2, XCircle, Clock, PenLine } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { DocumentosGarantia } from "@/components/documentos-garantia";

export const Route = createFileRoute("/ucp-ficha")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Ficha UCP — JusticiaFácil" }] }),
  component: UCPFicha,
});

const NAVY = "#0B1E3A";
const AZUL = "#0C447C"; // color de UCP

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

function UCPFicha() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [c, setC] = useState<CasoJuridico | null>(null);
  const [dict, setDict] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=*&caso_id=eq.${id}&vigente=eq.true&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cs, ds]) => { setC(cs?.[0] || null); setDict(ds?.[0] || null); })
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…</div>;
  if (!c) return <div className="p-8 text-sm text-muted-foreground">No se encontró el caso. <button onClick={() => navigate({ to: "/ucp" })} className="underline">Volver a UCP</button></div>;

  return (
    <div className="space-y-4">
      {/* barra superior */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate({ to: "/ucp" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Volver a UCP</button>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: AZUL }}>UCP</span>
      </div>

      {/* encabezado */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${AZUL})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Ficha UCP · Consolidación Patrimonial</p>
        <p className="text-2xl font-bold">{c.expediente || "Sin expediente"}</p>
        <p className="text-sm text-white/80">{c.direccion_garantia || c.cliente_nombre || "—"}</p>
        <p className="mt-1 text-xs text-white/70">{c.juzgado || "Juzgado sin asignar"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
      </div>

      {/* dictámenes divididos: jurídico + registral, cada uno con su proceso y firmas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <BloqueDictamen
          titulo="Dictamen jurídico"
          icon={<ScrollText className="h-4 w-4" style={{ color: AZUL }} />}
          veredicto={dict?.juridico?.veredicto || dict?.veredicto || null}
          firmas={dict?.firmas}
          claveFirma="juridico"
          onAbrir={() => navigate({ to: "/ucp" })}
        />
        <BloqueDictamen
          titulo="Dictamen registral (RPPC)"
          icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />}
          veredicto={typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : (dict?.rppc ? "registrado" : null)}
          firmas={dict?.firmas}
          claveFirma="registral"
          onAbrir={() => navigate({ to: "/ucp" })}
        />
      </div>

      {/* Documentos y movimientos (reusa el módulo existente: actuaciones, evidencias, tareas, docs) */}
      <DocumentosGarantia area="UCP" caso={c} />
    </div>
  );
}

// Bloque resumen de un dictamen (jurídico o registral) con su veredicto y firma.
function BloqueDictamen({ titulo, icon, veredicto, firmas, claveFirma, onAbrir }: {
  titulo: string; icon: React.ReactNode; veredicto: string | null;
  firmas: any; claveFirma: string; onAbrir: () => void;
}) {
  // color del veredicto
  const v = (veredicto || "").toLowerCase();
  const positivo = v.includes("positiv") || v.includes("proceden") || v.includes("registrad") || v.includes("favorable");
  const negativo = v.includes("negativ") || v.includes("improcedent") || v.includes("desfavorable");
  const Icono = positivo ? CheckCircle2 : negativo ? XCircle : Clock;
  const color = positivo ? "#0C5C46" : negativo ? "#A32D2D" : "#B26B00";

  // ¿hay firma para este dictamen?
  const firma = firmas && typeof firmas === "object" ? (firmas[claveFirma] || firmas[`${claveFirma}_firma`]) : null;
  const firmado = !!firma;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
        <button onClick={onAbrir} className="rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>Abrir proceso</button>
      </div>

      {/* veredicto */}
      <div className="mt-3 flex items-center gap-2">
        <Icono className="h-5 w-5" style={{ color }} />
        <span className="text-sm font-medium" style={{ color }}>{veredicto ? veredicto : "Sin dictaminar"}</span>
      </div>

      {/* firma */}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs">
        <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
        {firmado
          ? <span className="text-[color:var(--teal)]">Firmado{typeof firma === "string" ? `: ${firma}` : (firma?.nombre ? `: ${firma.nombre}` : "")}</span>
          : <span className="text-muted-foreground">Sin firma</span>}
      </div>
    </div>
  );
}

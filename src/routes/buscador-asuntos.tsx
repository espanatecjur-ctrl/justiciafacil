import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Loader2, MapPin, Gavel, Building2, ShieldHalf, FileSignature, ArrowRight, Eye, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { buscarAsuntos, type AsuntoUnificado, type UnidadAsunto } from "@/lib/asuntos-busqueda";
import { BotonVerDoc } from "@/components/visor-documento";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

export const Route = createFileRoute("/buscador-asuntos")({
  head: () => ({ meta: [{ title: "Buscador de Asuntos — JusticiaFácil" }] }),
  component: BuscadorAsuntosPage,
});

const UNIDAD_UI: Record<UnidadAsunto, { label: string; icon: typeof Gavel; cls: string }> = {
  UCM: { label: "UCM", icon: Gavel, cls: "bg-[color:var(--teal)]/10 text-[color:var(--teal)] border-[color:var(--teal)]/30" },
  UCP: { label: "UCP", icon: Building2, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  UDP: { label: "UDP", icon: ShieldHalf, cls: "bg-red-50 text-red-700 border-red-200" },
  UFC: { label: "UFC", icon: FileSignature, cls: "bg-amber-50 text-amber-800 border-amber-200" },
};

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

interface DocAsunto {
  id: string;
  nombre: string | null;
  link: string | null;
  drive_id: string | null;
  fuente: "digital" | "fisico";
}

// Trae los documentos ya existentes de un asunto — digitales (documento_garantia, vía
// caso_id) y físicos sin digitalizar (documento_fisico). Solo para VER, no para subir.
async function documentosDe(a: AsuntoUnificado): Promise<DocAsunto[]> {
  const resultado: DocAsunto[] = [];
  if (a.casoJuridicoId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=id,nombre,link,drive_id&caso_id=eq.${a.casoJuridicoId}&en_papelera=eq.false&order=created_at.desc`, { headers });
    const d = r.ok ? await r.json() : [];
    for (const x of d) resultado.push({ ...x, fuente: "digital" });
  }
  const campoId = a.unidad === "UDP" ? "caso_udp_id" : a.unidad === "UFC" ? "formalizacion_id" : "caso_juridico_id";
  const rf = await fetch(`${SUPABASE_URL}/rest/v1/documento_fisico?select=id,nombre_documento,documento_garantia_id&${campoId}=eq.${a.id}&digitalizado=eq.false`, { headers });
  const df = rf.ok ? await rf.json() : [];
  for (const x of df) resultado.push({ id: x.id, nombre: x.nombre_documento, link: null, drive_id: null, fuente: "fisico" });
  return resultado;
}
// A dónde navegar al tocar un resultado. UDP no tiene ficha individual todavía,
// así que manda a la lista general de UDP (ahí se puede buscar por cliente/folio).
function rutaDe(a: AsuntoUnificado): { to: string; search: Record<string, unknown> } {
  if (a.unidad === "UCM") return { to: "/ucm-ficha", search: { id: a.id } };
  if (a.unidad === "UCP") return { to: "/ucp-ficha", search: { id: a.id } };
  if (a.unidad === "UFC") return { to: "/ufc-ficha", search: { id: a.id } };
  return { to: "/udp", search: {} };
}

function BuscadorAsuntosPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<AsuntoUnificado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscadoAlgunaVez, setBuscadoAlgunaVez] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null); // "unidad-id" del asunto con panel de documentos abierto
  const [docsCache, setDocsCache] = useState<Record<string, DocAsunto[]>>({});
  const [cargandoDocs, setCargandoDocs] = useState<string | null>(null);

  const toggleDocs = (a: AsuntoUnificado) => {
    const clave = `${a.unidad}-${a.id}`;
    if (expandido === clave) { setExpandido(null); return; }
    setExpandido(clave);
    if (!docsCache[clave]) {
      setCargandoDocs(clave);
      documentosDe(a).then((d) => setDocsCache((p) => ({ ...p, [clave]: d }))).finally(() => setCargandoDocs(null));
    }
  };

  // Búsqueda con debounce — espera 350ms de pausa antes de consultar, para no
  // disparar una consulta por cada letra que se escribe.
  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 2) {
      setResultados([]);
      setBuscadoAlgunaVez(false);
      return;
    }
    setBuscando(true);
    setError(null);
    const t = setTimeout(() => {
      buscarAsuntos(termino)
        .then((r) => { setResultados(r); setBuscadoAlgunaVez(true); })
        .catch((e) => setError(e.message || "No se pudo buscar."))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  // Agrupa por asunto real: mismo cliente + misma dirección → una sola tarjeta con
  // varias "unidades" (así se ve de un vistazo si el mismo asunto ya está en UCM y en UFC).
  const agrupados = useMemo(() => {
    const m = new Map<string, { cliente: string | null; direccion: string | null; no_credito: string | null; items: AsuntoUnificado[] }>();
    for (const r of resultados) {
      const clave = `${(r.cliente || "").toLowerCase()}·${(r.direccion || "").toLowerCase()}` || r.id;
      if (!m.has(clave)) m.set(clave, { cliente: r.cliente, direccion: r.direccion, no_credito: r.no_credito, items: [] });
      const g = m.get(clave)!;
      g.items.push(r);
      if (!g.no_credito && r.no_credito) g.no_credito = r.no_credito;
    }
    return [...m.values()];
  }, [resultados]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Núcleo procesal"
        title="Buscador de Asuntos"
        description="Busca por número de crédito, expediente, dirección de la garantía o nombre del cliente — a la vez en UCM, UCP, UDP y UFC."
      />

      <Card className="legal-card p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Crédito, expediente, dirección o nombre del cliente…"
            className="pl-8"
          />
          {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </Card>

      {error && (
        <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudo buscar: {error}</Card>
      )}

      {q.trim().length > 0 && q.trim().length < 2 && (
        <p className="text-center text-sm text-muted-foreground">Escribe al menos 2 caracteres…</p>
      )}

      {buscadoAlgunaVez && !buscando && agrupados.length === 0 && (
        <Card className="legal-card p-8 text-center text-sm text-muted-foreground">
          Sin resultados para "{q}" en ninguna de las 4 unidades.
        </Card>
      )}

      <div className="space-y-3">
        {agrupados.map((g, i) => (
          <Card key={i} className="legal-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[color:var(--teal)]">{g.cliente || "— sin nombre —"}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {g.direccion && <><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{g.direccion}</span></>}
                </p>
                {g.no_credito && <p className="mt-0.5 text-xs text-muted-foreground">Crédito: <span className="font-mono">{g.no_credito}</span></p>}
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              {g.items.map((a) => {
                const ui = UNIDAD_UI[a.unidad];
                const ruta = rutaDe(a);
                const clave = `${a.unidad}-${a.id}`;
                const abierto = expandido === clave;
                return (
                  <div key={clave}>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(ruta as any)}
                        className="flex flex-1 items-center justify-between gap-2 rounded-md border border-border p-2 text-left text-sm hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ui.cls}`}>
                            <ui.icon className="h-3 w-3" /> {ui.label}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {a.expediente ? `Exp. ${a.expediente}` : "Sin expediente"}
                            {a.detalle ? ` · ${a.detalle}` : ""}
                          </span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => toggleDocs(a)}
                        title="Ver documentos de este asunto"
                        className="shrink-0 rounded-md border border-input p-2 text-muted-foreground hover:bg-muted"
                      >
                        {abierto ? <ChevronUp className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {abierto && (
                      <div className="ml-1 mt-1 space-y-1 border-l-2 border-border pl-3">
                        {cargandoDocs === clave ? (
                          <p className="flex items-center gap-1.5 py-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando documentos…</p>
                        ) : (docsCache[clave]?.length ?? 0) === 0 ? (
                          <p className="py-1.5 text-xs text-muted-foreground">Sin documentos registrados para este asunto todavía.</p>
                        ) : (
                          docsCache[clave].map((d) => (
                            <div key={d.id} className="flex items-center justify-between gap-2 py-1 text-xs">
                              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                                <FileText className="h-3 w-3 shrink-0" /> {d.nombre || "(sin nombre)"}
                                {d.fuente === "fisico" && <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">solo físico</span>}
                              </span>
                              {d.fuente === "digital" ? (
                                <BotonVerDoc url={d.link} driveId={d.drive_id} nombre={d.nombre} label="Ver" className="shrink-0 inline-flex items-center gap-1 text-[color:var(--teal)] hover:underline" />
                              ) : (
                                <span className="shrink-0 text-muted-foreground">sin digitalizar</span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

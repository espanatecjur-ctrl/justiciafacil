import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { SolicitarFormalizacion } from "@/components/solicitar-formalizacion";
import { ClienteFichaPanel } from "@/components/cliente-ficha-panel";
import { CarpetasCliente } from "@/components/carpetas-cliente";
import { GarantiasModuloCliente } from "@/components/garantias-modulo-cliente";
import type { ClienteJuicio } from "@/components/clientes-juicio";
import { ArrowLeft, Loader2, MapPin, Gavel, FileSignature, Check, Eye, Home, FolderOpen, LayoutGrid, Users } from "lucide-react";

export const Route = createFileRoute("/cliente")({
  validateSearch: (s: Record<string, unknown>) => ({ nombre: typeof s.nombre === "string" ? s.nombre : "" }),
  head: () => ({ meta: [{ title: "Ficha de cliente — JusticiaFácil" }] }),
  component: ClientePage,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*$/, "").replace(/\s+/g, " ").trim();

interface Cli extends ClienteJuicio {
  caso_juridico?: { id: string; expediente: string | null } | null;
  formalizacion_solicitada?: boolean | null; formalizacion_tipo?: string | null;
}
const DOCS: (keyof ClienteJuicio)[] = ["doc_ine", "doc_comprobante", "doc_acta_nac", "doc_curp", "doc_csf", "doc_acta_matri"];
const nDocs = (c: Cli) => DOCS.filter((k) => c[k]).length;
const sem = (c: Cli) => { const n = nDocs(c); return n >= 6 ? { cls: "bg-emerald-100 text-emerald-800 border-emerald-200", txt: "Completo" } : n >= 1 ? { cls: "bg-amber-100 text-amber-800 border-amber-200", txt: "En proceso" } : { cls: "bg-red-100 text-red-800 border-red-200", txt: "Sin documentos" }; };

function ClientePage() {
  const navigate = useNavigate();
  const { nombre } = Route.useSearch();
  const [gars, setGars] = useState<Cli[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [solicitar, setSolicitar] = useState<Cli | null>(null);
  const [modulo, setModulo] = useState<"general" | "documentos" | "urrj" | "ucp" | "ucm" | "udp">("general");

  // Búsqueda tolerante: exacto -> amplio por el primer nombre + comparación normalizada
  // (ignora acentos y la anotación "(Cambio a...)"), para que la encuentre venga de donde venga.
  const cargar = async () => {
    if (!nombre) { setCargando(false); return; }
    const base = `cliente_juicio?select=*,caso_juridico(id,expediente)&en_papelera=eq.false&order=folio.asc`;
    const q = (filtro: string) => fetch(`${SUPABASE_URL}/rest/v1/${base}&${filtro}`, { headers }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    try {
      let rows: Cli[] = await q(`nombre=eq.${encodeURIComponent(nombre)}`);
      if (rows.length === 0) {
        const tok = nombre.split(/\s+/)[0] || nombre;
        const cand: Cli[] = await q(`nombre=ilike.*${encodeURIComponent(tok)}*`);
        const objetivo = norm(nombre);
        rows = cand.filter((r) => { const n = norm(r.nombre || ""); return n === objetivo || n.startsWith(objetivo) || objetivo.startsWith(n); });
      }
      setGars(rows);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { setCargando(true); cargar(); }, [nombre]);

  const totalValor = useMemo(() => gars.reduce((a, c) => a + (Number(c.total) || 0), 0), [gars]);
  const totalSaldo = useMemo(() => gars.reduce((a, c) => a + (Number(c.saldo) || 0), 0), [gars]);
  const juicio = gars[0]?.caso_juridico;

  // Conteo de garantías contratadas por tipo, cruzando URRJ + UCP + UCM (por nombre, igual que las pestañas).
  const [porTipo, setPorTipo] = useState<{ total: number; tipos: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!nombre) return;
    const tok = nombre.split(/\s+/)[0] || nombre;
    const objetivo = norm(nombre);
    Promise.all(["URRJ", "UCP", "UCM"].map((u) =>
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,cliente_nombre,demandado,tipo_garantia&unidad=eq.${u}&or=(cliente_nombre.ilike.*${encodeURIComponent(tok)}*,demandado.ilike.*${encodeURIComponent(tok)}*)`, { headers })
        .then((r) => (r.ok ? r.json() : [])).catch(() => [])
    )).then((listas) => {
      const todos = listas.flat().filter((c: any) => {
        const n1 = norm(c.cliente_nombre || ""); const n2 = norm(c.demandado || "");
        return (n1 && (n1 === objetivo || n1.startsWith(objetivo) || objetivo.startsWith(n1))) || (n2 && (n2 === objetivo || n2.startsWith(objetivo) || objetivo.startsWith(n2)));
      });
      const tipos: Record<string, number> = {};
      for (const c of todos) { const t = c.tipo_garantia || "Sin clasificar"; tipos[t] = (tipos[t] || 0) + 1; }
      setPorTipo({ total: todos.length, tipos });
    });
  }, [nombre]);

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/clientes" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a Clientes</button>

      <PageHeader title={nombre || "Cliente"} description="Ficha del cliente con la relación de sus garantías. Manda a formalizar cada una desde aquí." />

      {cargando ? (
        <Card className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
      ) : gars.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No se encontró este cliente en el CRM.</p>
          <p className="mt-1 text-xs">El nombre no coincide con ninguna garantía registrada (puede venir de UFC u otro juicio, o tener el nombre distinto). Búscalo en <button onClick={() => navigate({ to: "/clientes" })} className="font-medium text-[color:var(--teal)] hover:underline">Clientes</button>.</p>
        </Card>
      ) : (
        <>
          {/* Resumen del cliente */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4"><p className="text-2xl font-bold text-[color:var(--teal)]">{gars.length}</p><p className="text-xs text-muted-foreground">Garantías (UCM)</p></Card>
            <Card className="p-4"><p className="text-lg font-bold">{fmtMXN(totalValor)}</p><p className="text-xs text-muted-foreground">Valor total</p></Card>
            <Card className="p-4"><p className="text-lg font-bold text-[color:var(--teal)]">{fmtMXN(totalSaldo)}</p><p className="text-xs text-muted-foreground">Saldo total</p></Card>
            {juicio?.expediente && (
              <Card className="flex items-center justify-center p-4">
                <button onClick={() => navigate({ to: "/ucm-ficha", search: { id: juicio.id } as any })} className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--teal)] hover:underline"><Gavel className="h-4 w-4" /> Juicio {juicio.expediente}</button>
              </Card>
            )}
          </div>

          {porTipo && porTipo.total > 0 && (
            <Card className="p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Garantías contratadas en total (URRJ + UCP + UCM): <b className="text-foreground">{porTipo.total}</b></p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(porTipo.tipos).map(([t, n]) => (
                  <span key={t} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] text-foreground">{t}: <b>{n}</b></span>
                ))}
              </div>
            </Card>
          )}

          {/* pestañas */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
            <button onClick={() => setModulo("general")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${modulo === "general" ? "text-white" : "text-muted-foreground hover:bg-muted"}`} style={modulo === "general" ? { background: "var(--teal)" } : undefined}>
              <LayoutGrid className="h-4 w-4" /> General
            </button>
            <button onClick={() => setModulo("documentos")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${modulo === "documentos" ? "text-white" : "text-muted-foreground hover:bg-muted"}`} style={modulo === "documentos" ? { background: "var(--teal)" } : undefined}>
              <FolderOpen className="h-4 w-4" /> Documentos
            </button>
            {([
              { id: "urrj" as const, label: "URRJ" },
              { id: "ucp" as const, label: "UCP" },
              { id: "ucm" as const, label: "UCM" },
              { id: "udp" as const, label: "UDP" },
            ]).map((t) => (
              <button key={t.id} onClick={() => setModulo(t.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${modulo === t.id ? "text-white" : "text-muted-foreground hover:bg-muted"}`} style={modulo === t.id ? { background: "var(--teal)" } : undefined}>
                <Gavel className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* ============ GENERAL ============ */}
          {modulo === "general" && (
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5"><Home className="h-4 w-4 text-[color:var(--teal)]" /><h3 className="text-sm font-semibold">Relación de garantías ({gars.length})</h3></div>
            <div className="divide-y divide-border">
              {gars.map((c) => {
                const s = sem(c);
                const open = abierto === c.id;
                return (
                  <div key={c.id} className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-start gap-1 break-words text-sm font-medium"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {c.domicilio_garantia || "—"}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Folio {c.folio} · Valor {fmtMXN(c.total)} · Saldo <b className="text-[color:var(--teal)]">{fmtMXN(c.saldo)}</b></p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>Docs {nDocs(c)}/6 · {s.txt}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {c.formalizacion_solicitada ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"><Check className="h-3 w-3" /> Formalización solicitada{c.formalizacion_tipo ? ` · ${c.formalizacion_tipo}` : ""}</span>
                        ) : c.caso_juridico?.id ? (
                          <button onClick={() => setSolicitar(c)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: "var(--teal)" }}><FileSignature className="h-3.5 w-3.5" /> Mandar a formalizar</button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Sin juicio ligado</span>
                        )}
                        <button onClick={() => setAbierto(open ? null : c.id)} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted"><Eye className="h-3 w-3" /> {open ? "Ocultar" : "Ver detalle"}</button>
                      </div>
                    </div>
                    {open && <ClienteFichaPanel cliente={c} juicio={{ id: c.caso_juridico?.id, expediente: c.caso_juridico?.expediente }} onUpdated={cargar} onCerrar={() => setAbierto(null)} />}
                  </div>
                );
              })}
            </div>
          </Card>
          )}

          {/* ============ DOCUMENTOS ============ */}
          {modulo === "documentos" && (
            juicio?.id ? (
              <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                  <Users className="h-4 w-4 text-[color:var(--teal)]" />
                  <h3 className="text-sm font-semibold">Documentos del cliente (carpetas de Drive)</h3>
                </div>
                <CarpetasCliente casoId={juicio.id} clienteNombre={nombre} expediente={juicio.expediente} />
              </Card>
            ) : (
              <Card className="p-6 text-center text-sm text-muted-foreground">Este cliente todavía no tiene un juicio vinculado — sin eso no se puede guardar la carpeta de documentos.</Card>
            )
          )}
          {/* ============ URRJ / UCP / UCM (datos reales por nombre) ============ */}
          {modulo === "urrj" && <GarantiasModuloCliente nombreCliente={nombre} unidad="URRJ" color="#5B3A9E" />}
          {modulo === "ucp" && <GarantiasModuloCliente nombreCliente={nombre} unidad="UCP" color="#0B6FA8" />}
          {modulo === "ucm" && <GarantiasModuloCliente nombreCliente={nombre} unidad="UCM" color="#0F6E56" />}

          {/* ============ UDP — en construcción, todavía no tiene su ficha propia ============ */}
          {modulo === "udp" && (
            <Card className="p-8 text-center">
              <Gavel className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">UDP · En construcción</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Aquí se va a ver la información de UDP de este cliente — todavía no está conectada. Lo armamos en un siguiente paso.</p>
            </Card>
          )}
        </>
      )}

      {solicitar && solicitar.caso_juridico?.id && (
        <SolicitarFormalizacion cliente={solicitar} casoId={solicitar.caso_juridico.id} onClose={() => setSolicitar(null)} onHecho={() => { setSolicitar(null); cargar(); }} />
      )}
    </div>
  );
}

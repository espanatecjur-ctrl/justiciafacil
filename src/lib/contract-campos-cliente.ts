import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { SolicitarFormalizacion } from "@/components/solicitar-formalizacion";
import { ClienteFichaPanel } from "@/components/cliente-ficha-panel";
import { ContratosCliente } from "@/components/contratos-cliente";
import type { ClienteJuicio } from "@/components/clientes-juicio";
import { ArrowLeft, Loader2, MapPin, Gavel, FileSignature, Check, Eye, Home } from "lucide-react";

export const Route = createFileRoute("/cliente")({
  validateSearch: (s: Record<string, unknown>) => ({ nombre: typeof s.nombre === "string" ? s.nombre : "" }),
  head: () => ({ meta: [{ title: "Ficha de cliente — JusticiaFácil" }] }),
  component: ClientePage,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);

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

  const cargar = () => {
    if (!nombre) { setCargando(false); return; }
    fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=*,caso_juridico(id,expediente)&nombre=eq.${encodeURIComponent(nombre)}&en_papelera=eq.false&order=folio.asc`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setGars).catch(() => {}).finally(() => setCargando(false));
  };
  useEffect(() => { setCargando(true); cargar(); }, [nombre]);

  const totalValor = useMemo(() => gars.reduce((a, c) => a + (Number(c.total) || 0), 0), [gars]);
  const totalSaldo = useMemo(() => gars.reduce((a, c) => a + (Number(c.saldo) || 0), 0), [gars]);
  const juicio = gars[0]?.caso_juridico;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/clientes" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Volver a Clientes</button>

      <PageHeader title={nombre || "Cliente"} description="Ficha del cliente con la relación de sus garantías. Manda a formalizar cada una desde aquí." />

      {cargando ? (
        <Card className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
      ) : gars.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No se encontró información de este cliente.</Card>
      ) : (
        <>
          {/* Resumen del cliente */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="p-4"><p className="text-2xl font-bold text-[color:var(--teal)]">{gars.length}</p><p className="text-xs text-muted-foreground">Garantías</p></Card>
            <Card className="p-4"><p className="text-lg font-bold">{fmtMXN(totalValor)}</p><p className="text-xs text-muted-foreground">Valor total</p></Card>
            <Card className="p-4"><p className="text-lg font-bold text-[color:var(--teal)]">{fmtMXN(totalSaldo)}</p><p className="text-xs text-muted-foreground">Saldo total</p></Card>
            {juicio?.expediente && (
              <Card className="flex items-center justify-center p-4">
                <button onClick={() => navigate({ to: "/ucm-ficha", search: { id: juicio.id } as any })} className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--teal)] hover:underline"><Gavel className="h-4 w-4" /> Juicio {juicio.expediente}</button>
              </Card>
            )}
          </div>

          {/* Relación de garantías */}
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
                    {open && <ClienteFichaPanel cliente={c} juicio={{ id: c.caso_juridico?.id, expediente: c.caso_juridico?.expediente }} onUpdated={cargar} />}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Contratos y documentos del cliente (con su validación) */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5"><FileSignature className="h-4 w-4 text-[color:var(--teal)]" /><h3 className="text-sm font-semibold">Contratos y documentos</h3></div>
            <ContratosCliente clienteIds={gars.map((g) => g.id)} clienteNombre={nombre} />
          </Card>
        </>
      )}

      {solicitar && solicitar.caso_juridico?.id && (
        <SolicitarFormalizacion cliente={solicitar} casoId={solicitar.caso_juridico.id} onClose={() => setSolicitar(null)} onHecho={() => { setSolicitar(null); cargar(); }} />
      )}
    </div>
  );
}

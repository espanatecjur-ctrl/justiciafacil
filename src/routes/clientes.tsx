import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Search, Users, Loader2, Gavel, ChevronRight, Home } from "lucide-react";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — JusticiaFácil" }] }),
  component: ClientesCRM,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);

interface Cli {
  id: string; nombre: string | null; domicilio_garantia: string | null; folio: string | null;
  total: number | null; saldo: number | null; estado: string | null;
  doc_ine: boolean | null; doc_comprobante: boolean | null; doc_acta_nac: boolean | null;
  doc_curp: boolean | null; doc_csf: boolean | null; doc_acta_matri: boolean | null;
  formalizacion_solicitada: boolean | null;
  caso_juridico?: { id: string; expediente: string | null } | null;
}
const DOCS: (keyof Cli)[] = ["doc_ine", "doc_comprobante", "doc_acta_nac", "doc_curp", "doc_csf", "doc_acta_matri"];
const nDocs = (c: Cli) => DOCS.filter((k) => c[k]).length;

function ClientesCRM() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cli[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=*,caso_juridico(id,expediente)&en_papelera=eq.false&order=nombre.asc`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setClientes).catch(() => {}).finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter((c) => [c.nombre, c.domicilio_garantia, c.folio, c.caso_juridico?.expediente].some((v) => (v || "").toLowerCase().includes(t)));
  }, [clientes, q]);

  // Agrupar: por juicio -> por cliente (un renglón por cliente, con cuántas garantías)
  const grupos = useMemo(() => {
    const byJ = new Map<string, { key: string; id?: string; expediente: string; clientes: Map<string, { nombre: string; nGar: number; valor: number; saldo: number; docsMin: number; formalizadas: number }>; saldo: number }>();
    for (const c of filtrados) {
      const jk = c.caso_juridico?.id || "sin";
      if (!byJ.has(jk)) byJ.set(jk, { key: jk, id: c.caso_juridico?.id, expediente: c.caso_juridico?.expediente || "Sin juicio ligado", clientes: new Map(), saldo: 0 });
      const g = byJ.get(jk)!;
      const nk = (c.nombre || "—").toLowerCase().trim();
      if (!g.clientes.has(nk)) g.clientes.set(nk, { nombre: c.nombre || "—", nGar: 0, valor: 0, saldo: 0, docsMin: 6, formalizadas: 0 });
      const cl = g.clientes.get(nk)!;
      cl.nGar += 1; cl.valor += Number(c.total) || 0; cl.saldo += Number(c.saldo) || 0;
      cl.docsMin = Math.min(cl.docsMin, nDocs(c));
      if (c.formalizacion_solicitada) cl.formalizadas += 1;
      g.saldo += Number(c.saldo) || 0;
    }
    return [...byJ.values()].map((g) => ({ ...g, clientes: [...g.clientes.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)) }));
  }, [filtrados]);

  const totalClientes = useMemo(() => new Set(filtrados.map((c) => (c.nombre || "").toLowerCase().trim())).size, [filtrados]);
  const saldoTotal = filtrados.reduce((a, c) => a + (Number(c.saldo) || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Clientes" description="Cada cliente con cuántas garantías tiene. Entra a su ficha para ver la relación y mandar a formalizar." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-2xl font-bold text-[color:var(--teal)]">{totalClientes}</p><p className="text-xs text-muted-foreground">Clientes</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold">{filtrados.length}</p><p className="text-xs text-muted-foreground">Garantías</p></Card>
        <Card className="p-4"><p className="text-lg font-bold text-[color:var(--teal)]">{fmtMXN(saldoTotal)}</p><p className="text-xs text-muted-foreground">Saldo total</p></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente, domicilio, folio o expediente…" className="pl-9" />
      </div>

      {cargando ? (
        <Card className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
      ) : filtrados.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{clientes.length === 0 ? "Aún no hay clientes cargados." : "Sin resultados con esa búsqueda."}</Card>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <Card key={g.key} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-muted/40 px-3 py-2">
                {g.id ? (
                  <button onClick={() => navigate({ to: "/ucm-ficha", search: { id: g.id } as any })} className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--teal)] hover:underline"><Gavel className="h-4 w-4" /> Juicio {g.expediente}</button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"><Gavel className="h-4 w-4" /> {g.expediente}</span>
                )}
                <span className="text-xs text-muted-foreground">· {g.clientes.length} clientes · saldo {fmtMXN(g.saldo)}</span>
              </div>
              <div className="divide-y divide-border">
                {g.clientes.map((cl) => (
                  <button key={cl.nombre} onClick={() => navigate({ to: "/cliente", search: { nombre: cl.nombre } as any })}
                    className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{cl.nombre}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-medium text-[color:var(--teal)]"><Home className="h-3 w-3" /> {cl.nGar} {cl.nGar === 1 ? "garantía" : "garantías"}</span>
                        <span>Saldo: <b className="text-[color:var(--teal)]">{fmtMXN(cl.saldo)}</b></span>
                        {cl.docsMin < 6 && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-800">Faltan documentos</span>}
                        {cl.formalizadas > 0 && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{cl.formalizadas} en formalización</span>}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Search, Users, Loader2, Eye, Check, Gavel, FileSignature } from "lucide-react";
import { SolicitarFormalizacion } from "@/components/solicitar-formalizacion";
import { ClienteFichaPanel } from "@/components/cliente-ficha-panel";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — JusticiaFácil" }] }),
  component: ClientesCRM,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);

interface Cli {
  id: string; folio: string | null; nombre: string | null; domicilio_garantia: string | null;
  valor_inmueble: number | null; firmo_cambio: boolean | null;
  doc_ine: boolean | null; doc_comprobante: boolean | null; doc_acta_nac: boolean | null;
  doc_curp: boolean | null; doc_csf: boolean | null; doc_acta_matri: boolean | null;
  apartado_monto: number | null; apartado_fecha: string | null;
  pago35_monto: number | null; pago35_fecha: string | null;
  pago50_monto: number | null; pago50_fecha: string | null;
  finiquito_monto: number | null; finiquito_fecha: string | null;
  total: number | null; pagado: number | null; saldo: number | null; estado: string | null;
  formalizacion_solicitada?: boolean | null; formalizacion_tipo?: string | null; formalizacion_id?: string | null;
  caso_juridico?: { id: string; expediente: string | null; folio: string | null } | null;
}

const DOCS: { k: keyof Cli; label: string }[] = [
  { k: "doc_ine", label: "INE" }, { k: "doc_comprobante", label: "Comprobante" }, { k: "doc_acta_nac", label: "Acta nac." },
  { k: "doc_curp", label: "CURP" }, { k: "doc_csf", label: "CSF" }, { k: "doc_acta_matri", label: "Acta matri." },
];
const nDocs = (c: Cli) => DOCS.filter((d) => c[d.k]).length;
const semaforo = (c: Cli) => {
  const e = c.estado || (nDocs(c) >= 6 ? "completo" : nDocs(c) >= 1 ? "proceso" : "sin_docs");
  if (e === "completo") return { cls: "bg-emerald-100 text-emerald-800 border-emerald-200", txt: "Completo" };
  if (e === "sin_docs") return { cls: "bg-red-100 text-red-800 border-red-200", txt: "Sin documentos" };
  return { cls: "bg-amber-100 text-amber-800 border-amber-200", txt: "En proceso" };
};

function ClientesCRM() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cli[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [solicitar, setSolicitar] = useState<Cli | null>(null);

  const cargar = () => fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=*,caso_juridico(id,expediente,folio)&en_papelera=eq.false&order=nombre.asc`, { headers })
    .then((r) => (r.ok ? r.json() : [])).then(setClientes).catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter((c) => [c.nombre, c.domicilio_garantia, c.folio, c.caso_juridico?.expediente].some((v) => (v || "").toLowerCase().includes(t)));
  }, [clientes, q]);

  const saldoTotal = filtrados.reduce((a, c) => a + (Number(c.saldo) || 0), 0);
  const valorTotal = filtrados.reduce((a, c) => a + (Number(c.total) || 0), 0);
  const listos = filtrados.filter((c) => (c.estado || "") === "completo").length;

  // Agrupar por juicio para que no estén regados
  const grupos = useMemo(() => {
    const m = new Map<string, { key: string; id?: string; expediente: string; clientes: Cli[]; saldo: number }>();
    for (const c of filtrados) {
      const key = c.caso_juridico?.id || "sin";
      if (!m.has(key)) m.set(key, { key, id: c.caso_juridico?.id, expediente: c.caso_juridico?.expediente || "Sin juicio ligado", clientes: [], saldo: 0 });
      const g = m.get(key)!; g.clientes.push(c); g.saldo += Number(c.saldo) || 0;
    }
    return [...m.values()];
  }, [filtrados]);

  const botonFormalizar = (c: Cli) => (
    c.formalizacion_solicitada ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"><Check className="h-3 w-3" /> Formalización solicitada{c.formalizacion_tipo ? ` · ${c.formalizacion_tipo}` : ""}</span>
    ) : c.caso_juridico?.id ? (
      <button onClick={() => setSolicitar(c)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: "var(--teal)" }}><FileSignature className="h-3.5 w-3.5" /> Solicitar formalización</button>
    ) : (
      <span className="text-[11px] text-muted-foreground">Sin juicio ligado — no se puede formalizar todavía.</span>
    )
  );

  const filaCliente = (c: Cli) => {
    const s = semaforo(c);
    const open = abierto === c.id;
    return (
      <Fragment key={c.id}>
        <tr onClick={() => setAbierto(open ? null : c.id)} className="cursor-pointer border-b border-border hover:bg-muted/30">
          <td className="whitespace-nowrap px-3 py-2 font-medium text-[color:var(--teal)]">{c.folio || "—"}</td>
          <td className="px-3 py-2">{c.nombre || "—"}</td>
          <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground" title={c.domicilio_garantia || ""}>{c.domicilio_garantia || "—"}</td>
          <td className="px-3 py-2 text-center">{nDocs(c)}/6</td>
          <td className="whitespace-nowrap px-3 py-2 text-right">{fmtMXN(c.total)}</td>
          <td className="whitespace-nowrap px-3 py-2 text-right text-emerald-700">{fmtMXN(c.pagado)}</td>
          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-[color:var(--teal)]">{fmtMXN(c.saldo)}</td>
          <td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.txt}</span></td>
          <td className="px-2 py-2 text-right"><Eye className="inline h-4 w-4 text-muted-foreground" /></td>
        </tr>
        {open && (
          <tr className="border-b border-border bg-muted/10">
            <td colSpan={9} className="px-3 pb-3">
              <ClienteFichaPanel cliente={c} juicio={c.caso_juridico?.expediente} onUpdated={cargar} />
              <div className="mt-2">{botonFormalizar(c)}</div>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Clientes" description="Clientes vinculados a juicios y garantías. Aquí ves sus documentos, pagos y saldo para elegir a quién formalizar." />

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4"><p className="text-2xl font-bold text-[color:var(--teal)]">{filtrados.length}</p><p className="text-xs text-muted-foreground">Clientes</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-emerald-700">{listos}</p><p className="text-xs text-muted-foreground">Listos (docs completos)</p></Card>
        <Card className="p-4"><p className="text-lg font-bold">{fmtMXN(valorTotal)}</p><p className="text-xs text-muted-foreground">Valor total</p></Card>
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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Folio</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Garantía</th>
                  <th className="px-3 py-2 text-center">Docs</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-right">Pagado</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <Fragment key={g.key}>
                    <tr className="bg-[color:var(--teal)]/5">
                      <td colSpan={9} className="px-3 py-1.5">
                        {g.id ? (
                          <button onClick={() => navigate({ to: "/ucm-ficha", search: { id: g.id } as any })} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[color:var(--teal)] hover:underline"><Gavel className="h-3.5 w-3.5" /> Juicio {g.expediente}</button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground"><Gavel className="h-3.5 w-3.5" /> {g.expediente}</span>
                        )}
                        <span className="ml-2 text-[11px] text-muted-foreground">{g.clientes.length} clientes · saldo {fmtMXN(g.saldo)}</span>
                      </td>
                    </tr>
                    {g.clientes.map((c) => filaCliente(c))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {solicitar && solicitar.caso_juridico?.id && (
        <SolicitarFormalizacion cliente={solicitar} casoId={solicitar.caso_juridico.id} onClose={() => setSolicitar(null)} onHecho={cargar} />
      )}
    </div>
  );
}

import { useEffect, useState, Fragment } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Users, Loader2, Eye, FileSignature, Check } from "lucide-react";
import { ClienteFichaPanel } from "@/components/cliente-ficha-panel";
import { Card } from "@/components/ui/card";
import { SolicitarFormalizacion } from "@/components/solicitar-formalizacion";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);

export interface ClienteJuicio {
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
}

const DOCS: { k: keyof ClienteJuicio; label: string }[] = [
  { k: "doc_ine", label: "INE" }, { k: "doc_comprobante", label: "Comprobante" }, { k: "doc_acta_nac", label: "Acta nac." },
  { k: "doc_curp", label: "CURP" }, { k: "doc_csf", label: "CSF" }, { k: "doc_acta_matri", label: "Acta matri." },
];
const nDocs = (c: ClienteJuicio) => DOCS.filter((d) => c[d.k]).length;
const semaforo = (c: ClienteJuicio) => {
  const e = c.estado || (nDocs(c) >= 6 ? "completo" : nDocs(c) >= 1 ? "proceso" : "sin_docs");
  if (e === "completo") return { cls: "bg-emerald-100 text-emerald-800 border-emerald-200", txt: "Completo" };
  if (e === "sin_docs") return { cls: "bg-red-100 text-red-800 border-red-200", txt: "Sin documentos" };
  return { cls: "bg-amber-100 text-amber-800 border-amber-200", txt: "En proceso" };
};

export function ClientesJuicio({ casoId, juicioExpediente }: { casoId: string; juicioExpediente?: string }) {
  const [clientes, setClientes] = useState<ClienteJuicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [solicitar, setSolicitar] = useState<ClienteJuicio | null>(null);
  const recargar = () => fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=*&caso_id=eq.${casoId}&en_papelera=eq.false&order=nombre.asc`, { headers }).then((r) => (r.ok ? r.json() : [])).then(setClientes).catch(() => {});

  useEffect(() => {
    if (!casoId) { setCargando(false); return; }
    fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=*&caso_id=eq.${casoId}&en_papelera=eq.false&order=nombre.asc`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setClientes).catch(() => {}).finally(() => setCargando(false));
  }, [casoId]);

  const saldoTotal = clientes.reduce((a, c) => a + (Number(c.saldo) || 0), 0);
  const valorTotal = clientes.reduce((a, c) => a + (Number(c.total) || 0), 0);
  const listos = clientes.filter((c) => (c.estado || "") === "completo").length;

  if (cargando) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando clientes…</div>;
  if (clientes.length === 0) return <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Este juicio no tiene clientes/garantías cargados todavía.</div>;

  const botonFormalizar = (c: ClienteJuicio) => (
    c.formalizacion_solicitada ? (
      <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
        <Check className="h-3 w-3" /> Formalización solicitada{c.formalizacion_tipo ? ` · ${c.formalizacion_tipo}` : ""}
      </span>
    ) : (
      <button onClick={() => setSolicitar(c)} className="mt-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: "var(--teal)" }}>
        <FileSignature className="h-3.5 w-3.5" /> Solicitar formalización
      </button>
    )
  );

  return (
    <div className="space-y-3">
      {/* resumen */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2"><Users className="h-5 w-5 text-[color:var(--teal)]" /><span className="text-sm font-semibold">{clientes.length} clientes / garantías</span></div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">{listos} listos</span>
        <div className="ml-auto text-right text-xs">
          <p className="text-muted-foreground">Valor total: <b className="text-foreground">{fmtMXN(valorTotal)}</b></p>
          <p className="text-muted-foreground">Saldo total: <b className="text-[color:var(--teal)]">{fmtMXN(saldoTotal)}</b></p>
        </div>
      </div>

      {/* lista estilo Excel */}
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
              {clientes.map((c) => {
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
                          <ClienteFichaPanel cliente={c} juicio={{ id: casoId }} onUpdated={recargar} />
                          <div className="mt-2">{botonFormalizar(c)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {solicitar && (
        <SolicitarFormalizacion cliente={solicitar} casoId={casoId} onClose={() => setSolicitar(null)} onHecho={recargar} />
      )}
    </div>
  );
}

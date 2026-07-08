import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Users, Loader2, MoreVertical, Eye, Check, X, MapPin } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const fmtFecha = (s: string | null) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : s;
};

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

export function ClientesJuicio({ casoId }: { casoId: string }) {
  const [clientes, setClientes] = useState<ClienteJuicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

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

  const ficha = (c: ClienteJuicio) => (
    <div className="mt-2 grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documentos</p>
        <div className="flex flex-wrap gap-1.5">
          {DOCS.map((d) => (
            <span key={d.k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${c[d.k] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-background text-muted-foreground"}`}>
              {c[d.k] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {d.label}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Firmó cambio de contrato: <b className="text-foreground">{c.firmo_cambio ? "Sí" : "No"}</b></p>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pagos</p>
        <table className="w-full text-[11px]">
          <tbody className="[&_td]:py-0.5">
            <tr><td className="text-muted-foreground">Apartado</td><td className="text-right font-medium">{fmtMXN(c.apartado_monto)}</td><td className="pl-2 text-right text-muted-foreground">{fmtFecha(c.apartado_fecha)}</td></tr>
            <tr><td className="text-muted-foreground">Pago 35%</td><td className="text-right font-medium">{fmtMXN(c.pago35_monto)}</td><td className="pl-2 text-right text-muted-foreground">{fmtFecha(c.pago35_fecha)}</td></tr>
            <tr><td className="text-muted-foreground">Pago 50%</td><td className="text-right font-medium">{fmtMXN(c.pago50_monto)}</td><td className="pl-2 text-right text-muted-foreground">{fmtFecha(c.pago50_fecha)}</td></tr>
            <tr><td className="text-muted-foreground">Finiquito</td><td className="text-right font-medium">{fmtMXN(c.finiquito_monto)}</td><td className="pl-2 text-right text-muted-foreground">{fmtFecha(c.finiquito_fecha)}</td></tr>
            <tr className="border-t border-border"><td className="pt-1 font-semibold">Saldo</td><td className="pt-1 text-right font-bold text-[color:var(--teal)]">{fmtMXN(c.saldo)}</td><td /></tr>
          </tbody>
        </table>
      </div>
    </div>
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

      {/* lista */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {clientes.map((c) => {
          const s = semaforo(c);
          const open = abierto === c.id;
          return (
            <div key={c.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{c.nombre || "—"}</p>
                  <p className="flex items-start gap-1 break-words text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {c.domicilio_garantia || "—"}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Folio: <span className="font-medium text-[color:var(--teal)]">{c.folio || "—"}</span></p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.txt}</span>
                  <button onClick={() => setAbierto(open ? null : c.id)} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted">
                    <Eye className="h-3 w-3" /> {open ? "Ocultar" : "Ver ficha"}
                  </button>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                <span className="text-muted-foreground">Docs: <b className="text-foreground">{nDocs(c)}/6</b></span>
                <span className="text-muted-foreground">Valor: <b className="text-foreground">{fmtMXN(c.total)}</b></span>
                <span className="text-muted-foreground">Pagado: <b className="text-foreground">{fmtMXN(c.pagado)}</b></span>
                <span className="text-muted-foreground">Saldo: <b className="text-[color:var(--teal)]">{fmtMXN(c.saldo)}</b></span>
              </div>
              {open && ficha(c)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

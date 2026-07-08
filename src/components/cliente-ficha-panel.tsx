import { useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Check, X, Pencil, Loader2, Save, FolderOpen } from "lucide-react";
import type { ClienteJuicio } from "@/components/clientes-juicio";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; };

const DOCS: { k: keyof ClienteJuicio; label: string }[] = [
  { k: "doc_ine", label: "INE" }, { k: "doc_comprobante", label: "Comprobante" }, { k: "doc_acta_nac", label: "Acta nac." },
  { k: "doc_curp", label: "CURP" }, { k: "doc_csf", label: "CSF" }, { k: "doc_acta_matri", label: "Acta matri." },
];

// Un solo panel con la información del cliente. Valores de pago editables.
export function ClienteFichaPanel({ cliente, onUpdated }: { cliente: ClienteJuicio; onUpdated?: () => void }) {
  const [edit, setEdit] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [f, setF] = useState({
    valor_inmueble: String(cliente.valor_inmueble ?? ""),
    apartado_monto: String(cliente.apartado_monto ?? ""), apartado_fecha: (cliente.apartado_fecha || "").slice(0, 10),
    pago35_monto: String(cliente.pago35_monto ?? ""), pago35_fecha: (cliente.pago35_fecha || "").slice(0, 10),
    pago50_monto: String(cliente.pago50_monto ?? ""), pago50_fecha: (cliente.pago50_fecha || "").slice(0, 10),
    finiquito_monto: String(cliente.finiquito_monto ?? ""), finiquito_fecha: (cliente.finiquito_fecha || "").slice(0, 10),
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // pagado = apartado (si tiene monto) + los que tengan fecha de pago
  const calcPagado = () => {
    let p = num(f.apartado_monto);
    if (num(f.pago35_monto) && f.pago35_fecha) p += num(f.pago35_monto);
    if (num(f.pago50_monto) && f.pago50_fecha) p += num(f.pago50_monto);
    if (num(f.finiquito_monto) && f.finiquito_fecha) p += num(f.finiquito_monto);
    return p;
  };
  const total = edit ? num(f.valor_inmueble) : Number(cliente.total) || 0;
  const pagado = edit ? calcPagado() : Number(cliente.pagado) || 0;
  const saldo = edit ? total - pagado : Number(cliente.saldo) || 0;

  const guardar = async () => {
    setGuardando(true);
    try {
      const t = num(f.valor_inmueble), pg = calcPagado();
      const body: any = {
        valor_inmueble: t, total: t, pagado: pg, saldo: t - pg,
        apartado_monto: num(f.apartado_monto), apartado_fecha: f.apartado_fecha || null,
        pago35_monto: num(f.pago35_monto), pago35_fecha: f.pago35_fecha || null,
        pago50_monto: num(f.pago50_monto), pago50_fecha: f.pago50_fecha || null,
        finiquito_monto: num(f.finiquito_monto), finiquito_fecha: f.finiquito_fecha || null,
      };
      await fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?id=eq.${cliente.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      setEdit(false); onUpdated?.();
    } finally { setGuardando(false); }
  };

  const filaPago = (label: string, mk: keyof typeof f, fk: keyof typeof f) => (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {edit ? (
        <input inputMode="decimal" value={f[mk]} onChange={(e) => set(mk, e.target.value)} className="w-24 rounded border border-input px-1.5 py-0.5 text-right" placeholder="0" />
      ) : <span className="text-right font-medium">{fmtMXN(f[mk])}</span>}
      {edit ? (
        <input type="date" value={f[fk]} onChange={(e) => set(fk, e.target.value)} className="rounded border border-input px-1.5 py-0.5 text-[11px]" />
      ) : <span className="pl-2 text-right text-muted-foreground">{f[fk] || "—"}</span>}
    </div>
  );

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      {/* Documentos */}
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Documentos</p>
        <div className="flex flex-wrap gap-1.5">
          {DOCS.map((d) => (
            <span key={d.k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cliente[d.k] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-background text-muted-foreground"}`}>
              {cliente[d.k] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Pagos (editables) */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pagos y saldo</p>
          {!edit ? (
            <button onClick={() => setEdit(true)} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 text-[11px] font-medium hover:bg-muted"><Pencil className="h-3 w-3" /> Editar</button>
          ) : (
            <div className="flex gap-1">
              <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>{guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Guardar</button>
              <button onClick={() => setEdit(false)} className="rounded-md border border-input px-2 py-0.5 text-[11px] hover:bg-muted">Cancelar</button>
            </div>
          )}
        </div>
        {edit && (
          <div className="mb-1 grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
            <span className="text-muted-foreground">Valor del inmueble</span>
            <input inputMode="decimal" value={f.valor_inmueble} onChange={(e) => set("valor_inmueble", e.target.value)} className="w-24 rounded border border-input px-1.5 py-0.5 text-right" />
          </div>
        )}
        {filaPago("Apartado", "apartado_monto", "apartado_fecha")}
        {filaPago("Pago 35%", "pago35_monto", "pago35_fecha")}
        {filaPago("Pago 50%", "pago50_monto", "pago50_fecha")}
        {filaPago("Finiquito", "finiquito_monto", "finiquito_fecha")}
        <div className="mt-1 grid grid-cols-3 gap-2 border-t border-border pt-1.5 text-xs">
          <span>Valor: <b>{fmtMXN(total)}</b></span>
          <span>Pagado: <b className="text-emerald-700">{fmtMXN(pagado)}</b></span>
          <span>Saldo: <b className="text-[color:var(--teal)]">{fmtMXN(saldo)}</b></span>
        </div>
      </div>

      {/* Documentos vinculados (todas las áreas) — se conectará con la carpeta Drive "CLIENTES" */}
      <div className="rounded-md border border-dashed border-border bg-background/60 p-2.5 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1 font-medium text-foreground"><FolderOpen className="h-3.5 w-3.5" /> Documentos del cliente (todas las áreas)</p>
        <p className="mt-0.5">Aquí se conectarán los PDFs de la carpeta Drive «CLIENTES» y la información de las demás áreas (próxima etapa).</p>
      </div>
    </div>
  );
}

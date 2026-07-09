import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Check, X, Pencil, Loader2, Save, FolderOpen, Gavel, MapPin } from "lucide-react";
import type { ClienteJuicio } from "@/components/clientes-juicio";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; };

const DOCS: { k: keyof ClienteJuicio; label: string }[] = [
  { k: "doc_ine", label: "INE" }, { k: "doc_comprobante", label: "Comprobante" }, { k: "doc_acta_nac", label: "Acta nac." },
  { k: "doc_curp", label: "CURP" }, { k: "doc_csf", label: "CSF" }, { k: "doc_acta_matri", label: "Acta matri." },
];

// Ficha del cliente en una ventana compacta: General · Garantía · Documentos · Pagos.
export function ClienteFichaPanel({ cliente, juicio, onUpdated, onCerrar }: {
  cliente: ClienteJuicio; juicio?: { id?: string | null; expediente?: string | null }; onUpdated?: () => void; onCerrar: () => void;
}) {
  const navigate = useNavigate();
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
  const nDocs = DOCS.filter((d) => cliente[d.k]).length;

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
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {edit ? <input inputMode="decimal" value={f[mk]} onChange={(e) => set(mk, e.target.value)} className="w-24 rounded-md border border-input px-2 py-1 text-right" placeholder="0" />
        : <span className="text-right font-medium">{fmtMXN(f[mk])}</span>}
      {edit ? <input type="date" value={f[fk]} onChange={(e) => set(fk, e.target.value)} className="rounded-md border border-input px-2 py-1 text-[11px]" />
        : <span className="pl-2 text-right text-[11px] text-muted-foreground">{f[fk] || "—"}</span>}
    </div>
  );

  const inicial = (cliente.nombre || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: "var(--teal)" }}>{inicial}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{cliente.nombre || "Cliente"}</p>
            <p className="text-xs text-muted-foreground">Folio <span className="font-medium text-[color:var(--teal)]">{cliente.folio || "—"}</span></p>
          </div>
          <button onClick={onCerrar} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 p-5">
          {/* Garantía vinculada */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Garantía vinculada</p>
            <p className="text-sm">{cliente.domicilio_garantia || "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Valor: <b className="text-foreground">{fmtMXN(cliente.valor_inmueble)}</b></span>
              {cliente.firmo_cambio && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Firmó cambio</span>}
              {juicio?.id && juicio?.expediente && (
                <button onClick={() => navigate({ to: "/ucm-ficha", search: { id: juicio.id } as any })} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 text-[11px] font-medium hover:bg-muted">
                  <Gavel className="h-3 w-3" /> Ver juicio {juicio.expediente}
                </button>
              )}
            </div>
          </div>

          {/* Documentos */}
          <div className="border-t border-border pt-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><FolderOpen className="h-3.5 w-3.5" /> Documentos · {nDocs}/6</p>
            <div className="flex flex-wrap gap-1.5">
              {DOCS.map((d) => (
                <span key={d.k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cliente[d.k] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted/40 text-muted-foreground"}`}>
                  {cliente[d.k] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {d.label}
                </span>
              ))}
            </div>
          </div>

          {/* Pagos y saldo */}
          <div className="border-t border-border pt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Save className="h-3.5 w-3.5" /> Pagos y saldo</p>
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
              <div className="mb-1 grid grid-cols-[1fr_auto] items-center gap-2 py-1 text-xs">
                <span className="text-muted-foreground">Valor del inmueble</span>
                <input inputMode="decimal" value={f.valor_inmueble} onChange={(e) => set("valor_inmueble", e.target.value)} className="w-24 rounded-md border border-input px-2 py-1 text-right" />
              </div>
            )}
            <div className="divide-y divide-border/60">
              {filaPago("Apartado", "apartado_monto", "apartado_fecha")}
              {filaPago("Pago 35%", "pago35_monto", "pago35_fecha")}
              {filaPago("Pago 50%", "pago50_monto", "pago50_fecha")}
              {filaPago("Finiquito", "finiquito_monto", "finiquito_fecha")}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
              <span>Valor<br /><b>{fmtMXN(total)}</b></span>
              <span>Pagado<br /><b className="text-emerald-700">{fmtMXN(pagado)}</b></span>
              <span>Saldo<br /><b className="text-[color:var(--teal)]">{fmtMXN(saldo)}</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

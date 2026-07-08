import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Check, X, Pencil, Loader2, Save, FolderOpen, Gavel, Home, MapPin } from "lucide-react";
import type { ClienteJuicio } from "@/components/clientes-juicio";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; };

const DOCS: { k: keyof ClienteJuicio; label: string }[] = [
  { k: "doc_ine", label: "INE" }, { k: "doc_comprobante", label: "Comprobante" }, { k: "doc_acta_nac", label: "Acta nac." },
  { k: "doc_curp", label: "CURP" }, { k: "doc_csf", label: "CSF" }, { k: "doc_acta_matri", label: "Acta matri." },
];
const Seccion = ({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-background p-3">
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icon} {titulo}</p>
    {children}
  </div>
);

// Ficha del cliente en UNA SOLA VISTA: General · Garantía vinculada · Documentos · Pagos.
export function ClienteFichaPanel({ cliente, juicio, onUpdated }: {
  cliente: ClienteJuicio; juicio?: { id?: string | null; expediente?: string | null }; onUpdated?: () => void;
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
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {edit ? <input inputMode="decimal" value={f[mk]} onChange={(e) => set(mk, e.target.value)} className="w-24 rounded border border-input px-1.5 py-0.5 text-right" placeholder="0" />
        : <span className="text-right font-medium">{fmtMXN(f[mk])}</span>}
      {edit ? <input type="date" value={f[fk]} onChange={(e) => set(fk, e.target.value)} className="rounded border border-input px-1.5 py-0.5 text-[11px]" />
        : <span className="pl-2 text-right text-muted-foreground">{f[fk] || "—"}</span>}
    </div>
  );

  return (
    <div className="mt-2 grid gap-2.5 rounded-lg border border-border bg-muted/20 p-3 lg:grid-cols-2">
      {/* General */}
      <Seccion icon={<Home className="h-3.5 w-3.5" />} titulo="General">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <span className="text-muted-foreground">Cliente</span><span className="font-medium">{cliente.nombre || "—"}</span>
          <span className="text-muted-foreground">Folio</span><span className="font-medium text-[color:var(--teal)]">{cliente.folio || "—"}</span>
          <span className="text-muted-foreground">Firmó cambio</span><span className="font-medium">{cliente.firmo_cambio ? "Sí" : "No"}</span>
          <span className="text-muted-foreground">Documentos</span><span className="font-medium">{nDocs}/6</span>
        </div>
      </Seccion>

      {/* Garantía vinculada */}
      <Seccion icon={<MapPin className="h-3.5 w-3.5" />} titulo="Garantía vinculada">
        <p className="text-xs">{cliente.domicilio_garantia || "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Valor: <b className="text-foreground">{fmtMXN(cliente.valor_inmueble)}</b></p>
        {juicio?.id && juicio?.expediente && (
          <button onClick={() => navigate({ to: "/ucm-ficha", search: { id: juicio.id } as any })} className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted">
            <Gavel className="h-3 w-3" /> Ver juicio {juicio.expediente}
          </button>
        )}
      </Seccion>

      {/* Documentos (módulo) */}
      <Seccion icon={<FolderOpen className="h-3.5 w-3.5" />} titulo="Documentos">
        <div className="flex flex-wrap gap-1.5">
          {DOCS.map((d) => (
            <span key={d.k} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cliente[d.k] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-background text-muted-foreground"}`}>
              {cliente[d.k] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {d.label}
            </span>
          ))}
        </div>
        <div className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">PDFs de la carpeta Drive «CLIENTES»</p>
          <p className="mt-0.5">Aquí se conectarán y copiarán los documentos del cliente (próxima etapa).</p>
        </div>
      </Seccion>

      {/* Pagos y saldo (editable) */}
      <Seccion icon={<Save className="h-3.5 w-3.5" />} titulo="Pagos y saldo">
        <div className="mb-1 flex items-center justify-end">
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
      </Seccion>
    </div>
  );
}

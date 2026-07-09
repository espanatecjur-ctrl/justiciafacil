import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Check, X, Pencil, Loader2, Save, FolderOpen, Gavel, Landmark, AlertTriangle } from "lucide-react";
import type { ClienteJuicio } from "@/components/clientes-juicio";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; };
const AZUL = "#2E6DA8";

const DOCS: { k: keyof ClienteJuicio; label: string }[] = [
  { k: "doc_ine", label: "INE" }, { k: "doc_comprobante", label: "Comprobante" }, { k: "doc_acta_nac", label: "Acta nac." },
  { k: "doc_curp", label: "CURP" }, { k: "doc_csf", label: "CSF" }, { k: "doc_acta_matri", label: "Acta matri." },
];

// Fila dato:valor — mismo patrón que la ficha de UCM (DatoUCP).
function Dato({ label, valor, importante }: { label: string; valor?: React.ReactNode; importante?: boolean }) {
  const vacio = valor === null || valor === undefined || valor === "";
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border/60 py-1 last:border-0 sm:py-1.5">
      <span className="text-[11px] text-muted-foreground sm:text-xs">{label}</span>
      <span className="text-right text-xs sm:text-sm">{vacio ? (importante ? <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> falta</span> : "—") : valor}</span>
    </div>
  );
}
function Seccion({ icon, titulo, accion, children }: { icon: React.ReactNode; titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm" style={{ color: AZUL }}>{icon} {titulo}</p>
        {accion}
      </div>
      {children}
    </div>
  );
}

// Ficha del cliente — su propio espacio en la página (NO modal), mismo formato que la ficha de UCM:
// Antecedente de la garantía + Estatus/Pagos en tarjetas, Documentos aparte.
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
    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border/60 py-1 text-[11px] last:border-0 sm:py-1.5 sm:text-xs">
      <span className="text-muted-foreground">{label}</span>
      {edit ? (
        <div className="flex items-center gap-1.5">
          <input inputMode="decimal" value={f[mk]} onChange={(e) => set(mk, e.target.value)} className="w-20 rounded-md border border-input px-1.5 py-1 text-right sm:w-24 sm:px-2" placeholder="0" />
          <input type="date" value={f[fk]} onChange={(e) => set(fk, e.target.value)} className="rounded-md border border-input px-1.5 py-1 text-[10px] sm:px-2 sm:text-[11px]" />
        </div>
      ) : (
        <span className="text-right">{fmtMXN(f[mk])} <span className="text-muted-foreground">· {f[fk] || "—"}</span></span>
      )}
    </div>
  );

  return (
    <div className="space-y-3 border-t border-border pt-3 sm:space-y-4 sm:pt-4">
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Antecedente de la garantía */}
        <Seccion icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />} titulo="Antecedente de la garantía">
          <Dato label="Cliente" valor={cliente.nombre} importante />
          <Dato label="Folio" valor={cliente.folio ? <span style={{ color: AZUL }} className="font-medium">{cliente.folio}</span> : null} />
          <Dato label="Dirección de la garantía" valor={cliente.domicilio_garantia} importante />
          <Dato label="Firmó cambio" valor={cliente.firmo_cambio ? "Sí" : "No"} />
          {juicio?.id && juicio?.expediente && (
            <div className="pt-2">
              <button onClick={() => navigate({ to: "/ucm-ficha", search: { id: juicio.id } as any })} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>
                <Gavel className="h-3 w-3" /> Ver juicio {juicio.expediente}
              </button>
            </div>
          )}
        </Seccion>

        {/* Pagos y saldo */}
        <Seccion
          icon={<Save className="h-4 w-4" style={{ color: AZUL }} />}
          titulo="Pagos y saldo"
          accion={!edit ? (
            <button onClick={() => setEdit(true)} className="inline-flex items-center gap-1 rounded-md border border-input px-1.5 py-1 text-[10px] font-medium hover:bg-muted sm:px-2 sm:text-[11px]" style={{ color: AZUL }}><Pencil className="h-3 w-3" /> Editar</button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-60 sm:px-3 sm:py-1.5 sm:text-xs" style={{ background: AZUL }}>{guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Guardar</button>
              <button onClick={() => setEdit(false)} className="rounded-md border border-input px-2.5 py-1 text-[10px] font-medium hover:bg-muted sm:px-3 sm:py-1.5 sm:text-xs">Cancelar</button>
            </div>
          )}
        >
          {edit && (
            <div className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-xs">
              <span className="text-muted-foreground">Valor del inmueble</span>
              <input inputMode="decimal" value={f.valor_inmueble} onChange={(e) => set("valor_inmueble", e.target.value)} className="w-28 rounded-md border border-input px-2 py-1 text-right" />
            </div>
          )}
          {filaPago("Apartado", "apartado_monto", "apartado_fecha")}
          {filaPago("Pago 35%", "pago35_monto", "pago35_fecha")}
          {filaPago("Pago 50%", "pago50_monto", "pago50_fecha")}
          {filaPago("Finiquito", "finiquito_monto", "finiquito_fecha")}
          <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg bg-muted/40 p-2 text-[10px] sm:gap-2 sm:p-2.5 sm:text-xs">
            <span>Valor<br /><b>{fmtMXN(total)}</b></span>
            <span>Pagado<br /><b className="text-emerald-700">{fmtMXN(pagado)}</b></span>
            <span>Saldo<br /><b style={{ color: AZUL }}>{fmtMXN(saldo)}</b></span>
          </div>
        </Seccion>
      </div>

      {/* Documentos */}
      <Seccion icon={<FolderOpen className="h-4 w-4" style={{ color: AZUL }} />} titulo={`Documentos · ${nDocs}/6`}>
        <div className="flex flex-wrap gap-1">
          {DOCS.map((d) => (
            <span key={d.k} className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px] ${cliente[d.k] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted/40 text-muted-foreground"}`}>
              {cliente[d.k] ? <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />} {d.label}
            </span>
          ))}
        </div>
      </Seccion>
    </div>
  );
}

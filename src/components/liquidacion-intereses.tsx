// ============================================================================
//  Liquidación de Intereses — FASE 1: método "flat"
//  --------------------------------------------------------------------------
//  Reproduce EXACTO el método de la tabla de la DGE (verificado con dos
//  ejemplos al centavo):
//    · Interés ordinario 1 año   = Suerte × tasaOrd
//    · Ordinario mensual         = (Suerte × tasaOrd) / 12
//    · TOTAL ordinarios          = Suerte × tasaOrd × (días / 360)
//    · Interés moratorio 1 año   = Suerte × tasaMor
//    · Moratorio mensual         = (Suerte × tasaMor) / 12
//    · TOTAL moratorios          = Suerte × tasaMor × (días / 360)
//    · Días de atraso            = días entre inicio y corte
//    · Meses de atraso           = round(días / 30)
//    · Años de atraso            = round(días / 360, 2)
//    · DEUDA TOTAL A LA FECHA    = Suerte + TOTAL ord + TOTAL mor
//  (El método "real" con saldo insoluto llega en la Fase 2, y el selector +
//   estado de cuenta imprimible en la Fase 3.)
// ============================================================================
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const fmt = (v: number) =>
  isFinite(v) ? v.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }) : "—";

function diasEntre(a: string, b: string): number {
  if (!a || !b) return 0;
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  const ms = d2.getTime() - d1.getTime();
  return ms > 0 ? Math.round(ms / 86400000) : 0;
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 ${fuerte ? "text-base font-bold" : "text-sm"}`}>
      <span className={fuerte ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

export function LiquidacionIntereses() {
  const [expediente, setExpediente] = useState("");
  const [acreditado, setAcreditado] = useState("");
  const [suerte, setSuerte] = useState("");
  const [tasaOrd, setTasaOrd] = useState("");
  const [tasaMor, setTasaMor] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaCorte, setFechaCorte] = useState("");

  const r = useMemo(() => {
    const S = parseFloat(suerte) || 0;
    const io = (parseFloat(tasaOrd) || 0) / 100;
    const im = (parseFloat(tasaMor) || 0) / 100;
    const dias = diasEntre(fechaInicio, fechaCorte);
    const factor = dias / 360;

    const ordAnual = S * io;
    const ordMensual = ordAnual / 12;
    const ordTotal = ordAnual * factor;

    const morAnual = S * im;
    const morMensual = morAnual / 12;
    const morTotal = morAnual * factor;

    const deudaTotal = S + ordTotal + morTotal;

    return {
      dias,
      meses: Math.round(dias / 30),
      anios: Math.round((dias / 360) * 100) / 100,
      ordAnual, ordMensual, ordTotal,
      morAnual, morMensual, morTotal,
      deudaTotal,
    };
  }, [suerte, tasaOrd, tasaMor, fechaInicio, fechaCorte]);

  const S = parseFloat(suerte) || 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Método */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-900">Método: Flat (rápido)</span>
        <span className="rounded-md bg-amber-100 px-2.5 py-1 font-medium text-amber-800">Método real (saldo insoluto): Fase 2</span>
      </div>

      {/* Datos del caso */}
      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 font-display text-sm font-bold">Datos del caso (opcional, para el impreso)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium">Expediente
            <input className={inp} value={expediente} onChange={(e) => setExpediente(e.target.value)} placeholder="Ej. 123/2024-C" />
          </label>
          <label className="block text-xs font-medium">Acreditado
            <input className={inp} value={acreditado} onChange={(e) => setAcreditado(e.target.value)} placeholder="Nombre del deudor" />
          </label>
        </div>
      </div>

      {/* Datos del cálculo */}
      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 font-display text-sm font-bold">Datos del cálculo</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-medium">Suerte principal (monto base)
            <input type="number" className={inp} value={suerte} onChange={(e) => setSuerte(e.target.value)} placeholder="435000" />
          </label>
          <label className="block text-xs font-medium">Tasa ordinaria anual (%)
            <input type="number" className={inp} value={tasaOrd} onChange={(e) => setTasaOrd(e.target.value)} placeholder="9" />
          </label>
          <label className="block text-xs font-medium">Tasa moratoria anual (%)
            <input type="number" className={inp} value={tasaMor} onChange={(e) => setTasaMor(e.target.value)} placeholder="13.5" />
          </label>
          <label className="block text-xs font-medium">Fecha de inicio
            <input type="date" className={inp} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </label>
          <label className="block text-xs font-medium">Fecha de corte
            <input type="date" className={inp} value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Resultados */}
      <div className="rounded-lg border border-border p-4" id="liq-impreso">
        <div className="mb-3 hidden print:block">
          <p className="text-lg font-bold">Liquidación de Intereses</p>
          <p className="text-sm">Expediente: {expediente || "—"} · Acreditado: {acreditado || "—"}</p>
          <p className="text-xs text-muted-foreground">Del {fechaInicio || "—"} al {fechaCorte || "—"}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Atraso</p>
            <Fila label="Días" valor={String(r.dias)} />
            <Fila label="Meses" valor={String(r.meses)} />
            <Fila label="Años" valor={String(r.anios)} />
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Intereses ordinarios</p>
            <Fila label="Anual (1 año)" valor={fmt(r.ordAnual)} />
            <Fila label="Mensual" valor={fmt(r.ordMensual)} />
            <Fila label="Total del período" valor={fmt(r.ordTotal)} />
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Intereses moratorios</p>
            <Fila label="Anual (1 año)" valor={fmt(r.morAnual)} />
            <Fila label="Mensual" valor={fmt(r.morMensual)} />
            <Fila label="Total del período" valor={fmt(r.morTotal)} />
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-border pt-3">
          <Fila label="Suerte principal" valor={fmt(S)} />
          <Fila label="+ Total intereses ordinarios" valor={fmt(r.ordTotal)} />
          <Fila label="+ Total intereses moratorios" valor={fmt(r.morTotal)} />
          <div className="mt-1 rounded-md bg-[color:var(--teal)]/10 px-3 py-2">
            <Fila label="DEUDA TOTAL A LA FECHA" valor={fmt(r.deudaTotal)} fuerte />
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Método flat: interés simple sobre la suerte principal, año de 360 días, sin anatocismo. Es un <b>estimado</b>;
          la liquidación formal en juicio se hace sobre el saldo insoluto (Fase 2) o con el estado de cuenta certificado
          (Art. 68 Ley de Instituciones de Crédito).
        </p>
      </div>

      <div className="flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>
    </div>
  );
}

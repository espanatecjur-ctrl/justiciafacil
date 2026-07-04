// ============================================================================
//  Liquidación de Intereses
//  --------------------------------------------------------------------------
//  FASE 1 — Método FLAT (verificado al centavo con la tabla de la DGE):
//    interés simple sobre la suerte principal, año 360, sin anatocismo.
//  FASE 2 — Método REAL (amortización francesa):
//    interés ordinario sobre el saldo insoluto que baja con cada pago, y
//    moratorio por cada mensualidad vencida desde su fecha de vencimiento
//    (como en el estado de cuenta certificado de banco). El moratorio se
//    calcula como (tasa ordinaria × factor); Santander usa factor 1.5.
//  El estado de cuenta certificado sigue siendo la prueba en juicio
//  (Art. 68 Ley de Instituciones de Crédito).
// ============================================================================
import { useMemo, useState } from "react";
import { Printer, ChevronDown } from "lucide-react";

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
function sumaMeses(iso: string, k: number): Date {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + k);
  return d;
}
function isoDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 ${fuerte ? "text-base font-bold" : "text-sm"}`}>
      <span className={fuerte ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  MÉTODO FLAT
// ---------------------------------------------------------------------------
function Flat() {
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
    const f = dias / 360;
    const ordAnual = S * io, morAnual = S * im;
    const ordTotal = ordAnual * f, morTotal = morAnual * f;
    return {
      dias, meses: Math.round(dias / 30), anios: Math.round((dias / 360) * 100) / 100,
      ordAnual, ordMensual: ordAnual / 12, ordTotal,
      morAnual, morMensual: morAnual / 12, morTotal,
      deudaTotal: S + ordTotal + morTotal,
    };
  }, [suerte, tasaOrd, tasaMor, fechaInicio, fechaCorte]);

  const S = parseFloat(suerte) || 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 font-display text-sm font-bold">Datos del cálculo</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-medium">Suerte principal
            <input type="number" className={inp} value={suerte} onChange={(e) => setSuerte(e.target.value)} placeholder="435000" /></label>
          <label className="block text-xs font-medium">Tasa ordinaria anual (%)
            <input type="number" className={inp} value={tasaOrd} onChange={(e) => setTasaOrd(e.target.value)} placeholder="9" /></label>
          <label className="block text-xs font-medium">Tasa moratoria anual (%)
            <input type="number" className={inp} value={tasaMor} onChange={(e) => setTasaMor(e.target.value)} placeholder="13.5" /></label>
          <label className="block text-xs font-medium">Fecha de inicio
            <input type="date" className={inp} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></label>
          <label className="block text-xs font-medium">Fecha de corte
            <input type="date" className={inp} value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} /></label>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Atraso</p>
            <Fila label="Días" valor={String(r.dias)} /><Fila label="Meses" valor={String(r.meses)} /><Fila label="Años" valor={String(r.anios)} />
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Intereses ordinarios</p>
            <Fila label="Anual (1 año)" valor={fmt(r.ordAnual)} /><Fila label="Mensual" valor={fmt(r.ordMensual)} /><Fila label="Total del período" valor={fmt(r.ordTotal)} />
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Intereses moratorios</p>
            <Fila label="Anual (1 año)" valor={fmt(r.morAnual)} /><Fila label="Mensual" valor={fmt(r.morMensual)} /><Fila label="Total del período" valor={fmt(r.morTotal)} />
          </div>
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-3">
          <Fila label="Suerte principal" valor={fmt(S)} />
          <Fila label="+ Total intereses ordinarios" valor={fmt(r.ordTotal)} />
          <Fila label="+ Total intereses moratorios" valor={fmt(r.morTotal)} />
          <div className="mt-1 rounded-md bg-[color:var(--teal)]/10 px-3 py-2"><Fila label="DEUDA TOTAL A LA FECHA" valor={fmt(r.deudaTotal)} fuerte /></div>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Método flat: interés simple sobre la suerte principal, año 360, sin anatocismo. Es un <b>estimado</b> (da más alto que el real).
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  MÉTODO REAL (amortización francesa)
// ---------------------------------------------------------------------------
function Real() {
  const [monto, setMonto] = useState("");
  const [tasaOrd, setTasaOrd] = useState("");
  const [factorMor, setFactorMor] = useState("1.5");
  const [plazo, setPlazo] = useState("240");
  const [seguro, setSeguro] = useState("");
  const [comision, setComision] = useState("");
  const [fechaPrimerPago, setFechaPrimerPago] = useState("");
  const [fechaMora, setFechaMora] = useState("");
  const [fechaCorte, setFechaCorte] = useState("");
  const [verTabla, setVerTabla] = useState(false);

  const r = useMemo(() => {
    const P = parseFloat(monto) || 0;
    const iAnual = (parseFloat(tasaOrd) || 0) / 100;
    const rMens = iAnual / 12;
    const n = Math.max(1, Math.round(parseFloat(plazo) || 0));
    const fMor = parseFloat(factorMor) || 0;
    const tasaMorAnual = iAnual * fMor;
    const seg = parseFloat(seguro) || 0;
    const com = parseFloat(comision) || 0;

    // cuota francesa (capital + interés)
    const cuota = rMens > 0 ? (P * rMens) / (1 - Math.pow(1 + rMens, -n)) : P / n;
    const pagoMensualTotal = cuota + seg + com;

    // genera la tabla
    type Ren = { k: number; vence: string; interes: number; capital: number; saldo: number; vencida: boolean; mora: number };
    const tabla: Ren[] = [];
    let saldo = P;
    let capitalInsoluto = P; // saldo tras las pagadas
    let vencidas = 0;
    let moratorios = 0;
    const corteIso = fechaCorte;

    if (P > 0 && fechaPrimerPago) {
      for (let k = 1; k <= n; k++) {
        const interes = saldo * rMens;
        const capital = Math.min(cuota - interes, saldo);
        const venceD = sumaMeses(fechaPrimerPago, k - 1);
        const venceIso = isoDe(venceD);
        // ¿pagada? -> vence antes de la mora
        const pagada = fechaMora ? venceIso < fechaMora : false;
        const esVencidaNoPagada = fechaMora && corteIso ? venceIso >= fechaMora && venceIso <= corteIso : false;
        let moraRen = 0;
        if (pagada) {
          capitalInsoluto -= capital;
        }
        if (esVencidaNoPagada) {
          vencidas++;
          const dm = diasEntre(venceIso, corteIso);
          moraRen = capital * tasaMorAnual * (dm / 360);
          moratorios += moraRen;
        }
        tabla.push({ k, vence: venceIso, interes, capital, saldo: saldo - capital, vencida: !!esVencidaNoPagada, mora: moraRen });
        saldo -= capital;
        if (saldo <= 0.005) break;
      }
    }

    const mensualidadesIncumplidas = vencidas * pagoMensualTotal;
    const totalAdeudo = capitalInsoluto + mensualidadesIncumplidas + moratorios;

    return { cuota, pagoMensualTotal, tasaMorAnual, capitalInsoluto, vencidas, mensualidadesIncumplidas, moratorios, totalAdeudo, tabla };
  }, [monto, tasaOrd, factorMor, plazo, seguro, comision, fechaPrimerPago, fechaMora, fechaCorte]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 font-display text-sm font-bold">Datos del crédito</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-medium">Monto del crédito
            <input type="number" className={inp} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="333290.57" /></label>
          <label className="block text-xs font-medium">Tasa ordinaria anual (%)
            <input type="number" className={inp} value={tasaOrd} onChange={(e) => setTasaOrd(e.target.value)} placeholder="10.52" /></label>
          <label className="block text-xs font-medium">Factor moratorio (× ordinaria)
            <input type="number" className={inp} value={factorMor} onChange={(e) => setFactorMor(e.target.value)} placeholder="1.5" /></label>
          <label className="block text-xs font-medium">Plazo (número de pagos)
            <input type="number" className={inp} value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="240" /></label>
          <label className="block text-xs font-medium">Prima de seguro mensual (opc.)
            <input type="number" className={inp} value={seguro} onChange={(e) => setSeguro(e.target.value)} placeholder="0" /></label>
          <label className="block text-xs font-medium">Comisión admin. mensual (opc.)
            <input type="number" className={inp} value={comision} onChange={(e) => setComision(e.target.value)} placeholder="0" /></label>
          <label className="block text-xs font-medium">Fecha del primer pago
            <input type="date" className={inp} value={fechaPrimerPago} onChange={(e) => setFechaPrimerPago(e.target.value)} /></label>
          <label className="block text-xs font-medium">Fecha del primer pago NO cubierto
            <input type="date" className={inp} value={fechaMora} onChange={(e) => setFechaMora(e.target.value)} /></label>
          <label className="block text-xs font-medium">Fecha de corte
            <input type="date" className={inp} value={fechaCorte} onChange={(e) => setFechaCorte(e.target.value)} /></label>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pago mensual</p>
            <Fila label="Cuota (capital + interés)" valor={fmt(r.cuota)} />
            <Fila label="Pago mensual total" valor={fmt(r.pagoMensualTotal)} />
            <Fila label="Tasa moratoria resultante" valor={`${(r.tasaMorAnual * 100).toFixed(2)}%`} />
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</p>
            <Fila label="Mensualidades vencidas" valor={String(r.vencidas)} />
            <Fila label="Capital insoluto" valor={fmt(r.capitalInsoluto)} />
          </div>
        </div>
        <div className="mt-4 space-y-1 border-t border-border pt-3">
          <Fila label="Capital insoluto" valor={fmt(r.capitalInsoluto)} />
          <Fila label="+ Mensualidades incumplidas" valor={fmt(r.mensualidadesIncumplidas)} />
          <Fila label="+ Intereses moratorios" valor={fmt(r.moratorios)} />
          <div className="mt-1 rounded-md bg-[color:var(--teal)]/10 px-3 py-2"><Fila label="TOTAL DE ADEUDO" valor={fmt(r.totalAdeudo)} fuerte /></div>
        </div>

        <button onClick={() => setVerTabla((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--teal)] print:hidden">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${verTabla ? "rotate-180" : ""}`} /> {verTabla ? "Ocultar" : "Ver"} tabla de amortización
        </button>
        {verTabla && r.tabla.length > 0 && (
          <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted">
                <tr className="text-left"><th className="p-1.5">#</th><th className="p-1.5">Vence</th><th className="p-1.5 text-right">Interés</th><th className="p-1.5 text-right">Capital</th><th className="p-1.5 text-right">Saldo</th><th className="p-1.5 text-right">Mora</th></tr>
              </thead>
              <tbody>
                {r.tabla.map((f) => (
                  <tr key={f.k} className={f.vencida ? "bg-orange-50" : ""}>
                    <td className="p-1.5">{f.k}</td><td className="p-1.5">{f.vence}</td>
                    <td className="p-1.5 text-right tabular-nums">{fmt(f.interes)}</td>
                    <td className="p-1.5 text-right tabular-nums">{fmt(f.capital)}</td>
                    <td className="p-1.5 text-right tabular-nums">{fmt(f.saldo)}</td>
                    <td className="p-1.5 text-right tabular-nums">{f.mora ? fmt(f.mora) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Método real: amortización francesa, interés ordinario sobre el saldo insoluto, moratorio por mensualidad vencida (año 360).
          El adeudo se arma como <b>capital insoluto + mensualidades incumplidas + moratorios</b>, igual que el estado de cuenta certificado.
          Valida contra el certificado con Contabilidad: cada contrato puede tener seguros/comisiones distintos.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Contenedor con selector de método
// ---------------------------------------------------------------------------
export function LiquidacionIntereses() {
  const [metodo, setMetodo] = useState<"flat" | "real">("flat");
  const [expediente, setExpediente] = useState("");
  const [acreditado, setAcreditado] = useState("");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Selector de método */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <button onClick={() => setMetodo("flat")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${metodo === "flat" ? "bg-foreground text-background" : "border border-input hover:bg-muted"}`}>Método flat (rápido)</button>
        <button onClick={() => setMetodo("real")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${metodo === "real" ? "bg-foreground text-background" : "border border-input hover:bg-muted"}`}>Método real (amortización)</button>
      </div>

      {/* Datos del caso */}
      <div className="rounded-lg border border-border p-4">
        <p className="mb-3 font-display text-sm font-bold">Datos del caso (opcional, para el impreso)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium">Expediente
            <input className={inp} value={expediente} onChange={(e) => setExpediente(e.target.value)} placeholder="Ej. 123/2024-C" /></label>
          <label className="block text-xs font-medium">Acreditado
            <input className={inp} value={acreditado} onChange={(e) => setAcreditado(e.target.value)} placeholder="Nombre del deudor" /></label>
        </div>
      </div>

      <div id="liq-impreso">
        <div className="mb-3 hidden print:block">
          <p className="text-lg font-bold">Liquidación de Intereses — método {metodo === "flat" ? "flat" : "real"}</p>
          <p className="text-sm">Expediente: {expediente || "—"} · Acreditado: {acreditado || "—"}</p>
        </div>
        {metodo === "flat" ? <Flat /> : <Real />}
      </div>

      <div className="flex justify-end print:hidden">
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>
    </div>
  );
}

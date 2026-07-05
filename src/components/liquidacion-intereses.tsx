// ============================================================================
//  Liquidación de Intereses
//  --------------------------------------------------------------------------
//  FASE 1 — Método FLAT: interés simple sobre la suerte principal, año 360.
//  FASE 2 — Método REAL: amortización francesa, interés sobre saldo insoluto
//    y moratorio por mensualidad vencida (como el estado de cuenta certificado).
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { BotonVerDoc } from "@/components/visor-documento";
import { ChevronDown, Save, Loader2, FileText, Archive, Trash2, Eye, X, RotateCcw, Sheet, FileDown } from "lucide-react";
import { crearEstadoCuenta, listarEstadosCuenta, actualizarEstadoCuenta, subirArchivoEC, type EstadoCuenta } from "@/lib/estado-cuenta";
import { usuarioActualEtiqueta } from "@/lib/auth";
import { casosParaSelector, type CasoOpcion } from "@/lib/solicitud-predictamen";

const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const fmt = (v: number) =>
  isFinite(v) ? v.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }) : "—";

const UNI = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE"];
const DEC = ["", "", "VEINTI", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
function centenaLetra(n: number): string {
  if (n === 100) return "CIEN";
  let t = "";
  const c = Math.floor(n / 100), resto = n % 100;
  if (c) t += CEN[c] + " ";
  if (resto <= 20) t += UNI[resto];
  else if (resto < 30) t += "VEINTI" + UNI[resto - 20];
  else { const d = Math.floor(resto / 10), u = resto % 10; t += DEC[d]; if (u) t += " Y " + UNI[u]; }
  return t.trim();
}
function numeroLetra(num: number): string {
  if (num === 0) return "CERO";
  const millones = Math.floor(num / 1000000), miles = Math.floor((num % 1000000) / 1000), cientos = num % 1000;
  let t = "";
  if (millones) t += (millones === 1 ? "UN MILLÓN" : centenaLetra(millones) + " MILLONES") + " ";
  if (miles) t += (miles === 1 ? "MIL" : centenaLetra(miles) + " MIL") + " ";
  if (cientos) t += centenaLetra(cientos);
  return t.trim();
}
function montoEnLetra(v: number): string {
  const ent = Math.floor(Math.abs(v));
  const cent = Math.round((Math.abs(v) - ent) * 100);
  return `${numeroLetra(ent)} PESOS ${String(cent).padStart(2, "0")}/100 M.N.`;
}

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
function Flat({ onDatos, inicial }: { onDatos?: (d: Record<string, unknown>) => void; inicial?: Record<string, string> }) {
  const [suerte, setSuerte] = useState(inicial?.suerte ?? "");
  const [tasaOrd, setTasaOrd] = useState(inicial?.tasaOrd ?? "");
  const [tasaMor, setTasaMor] = useState(inicial?.tasaMor ?? "");
  const [fechaInicio, setFechaInicio] = useState(inicial?.fechaInicio ?? "");
  const [fechaCorte, setFechaCorte] = useState(inicial?.fechaCorte ?? "");

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

  useEffect(() => {
    onDatos?.({ metodo: "flat", suerte, tasaOrd, tasaMor, fechaInicio, fechaCorte, dias: r.dias, meses: r.meses, anios: r.anios, ordTotal: r.ordTotal, morTotal: r.morTotal, deudaTotal: r.deudaTotal });
  }, [suerte, tasaOrd, tasaMor, fechaInicio, fechaCorte, r]); // eslint-disable-line

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
function Real({ onDatos, inicial }: { onDatos?: (d: Record<string, unknown>) => void; inicial?: Record<string, string> }) {
  const [monto, setMonto] = useState(inicial?.monto ?? "");
  const [tasaOrd, setTasaOrd] = useState(inicial?.tasaOrd ?? "");
  const [factorMor, setFactorMor] = useState(inicial?.factorMor ?? "1.5");
  const [plazo, setPlazo] = useState(inicial?.plazo ?? "240");
  const [seguro, setSeguro] = useState(inicial?.seguro ?? "");
  const [comision, setComision] = useState(inicial?.comision ?? "");
  const [fechaPrimerPago, setFechaPrimerPago] = useState(inicial?.fechaPrimerPago ?? "");
  const [fechaMora, setFechaMora] = useState(inicial?.fechaMora ?? "");
  const [fechaCorte, setFechaCorte] = useState(inicial?.fechaCorte ?? "");
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

    const cuota = rMens > 0 ? (P * rMens) / (1 - Math.pow(1 + rMens, -n)) : P / n;
    const pagoMensualTotal = cuota + seg + com;

    type Ren = { k: number; vence: string; interes: number; capital: number; saldo: number; vencida: boolean; mora: number };
    const tabla: Ren[] = [];
    let saldo = P;
    let capitalInsoluto = P;
    let vencidas = 0;
    let moratorios = 0;
    let interesesOrdVencidos = 0;
    const corteIso = fechaCorte;

    if (P > 0 && fechaPrimerPago) {
      for (let k = 1; k <= n; k++) {
        const interes = saldo * rMens;
        const capital = Math.min(cuota - interes, saldo);
        const venceD = sumaMeses(fechaPrimerPago, k - 1);
        const venceIso = isoDe(venceD);
        const pagada = fechaMora ? venceIso < fechaMora : false;
        const esVencidaNoPagada = fechaMora && corteIso ? venceIso >= fechaMora && venceIso <= corteIso : false;
        let moraRen = 0;
        if (pagada) {
          capitalInsoluto -= capital;
        }
        if (esVencidaNoPagada) {
          vencidas++;
          interesesOrdVencidos += interes;
          const dm = diasEntre(venceIso, corteIso);
          moraRen = capital * tasaMorAnual * (dm / 360);
          moratorios += moraRen;
        }
        tabla.push({ k, vence: venceIso, interes, capital, saldo: saldo - capital, vencida: !!esVencidaNoPagada, mora: moraRen });
        saldo -= capital;
        if (saldo <= 0.005) break;
      }
    }

    const comisionVencida = com * vencidas;
    const mensualidadesIncumplidas = vencidas * pagoMensualTotal;
    const totalAdeudo = capitalInsoluto + mensualidadesIncumplidas + moratorios;

    return { cuota, pagoMensualTotal, tasaMorAnual, capitalInsoluto, vencidas, interesesOrdVencidos, comisionVencida, mensualidadesIncumplidas, moratorios, totalAdeudo, tabla };
  }, [monto, tasaOrd, factorMor, plazo, seguro, comision, fechaPrimerPago, fechaMora, fechaCorte]);

  useEffect(() => {
    onDatos?.({ metodo: "real", monto, tasaOrd, factorMor, plazo, seguro, comision, fechaPrimerPago, fechaMora, fechaCorte, cuota: r.cuota, capitalInsoluto: r.capitalInsoluto, vencidas: r.vencidas, interesesOrdVencidos: r.interesesOrdVencidos, comisionVencida: r.comisionVencida, mensualidadesIncumplidas: r.mensualidadesIncumplidas, moratorios: r.moratorios, tabla: r.tabla, deudaTotal: r.totalAdeudo });
  }, [monto, tasaOrd, factorMor, plazo, seguro, comision, fechaPrimerPago, fechaMora, fechaCorte, r]); // eslint-disable-line

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
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Contenedor con selector de método
// ---------------------------------------------------------------------------
export function LiquidacionIntereses() {
  const [metodo, setMetodo] = useState<"flat" | "real" | "ambas">("flat");
  const [expediente, setExpediente] = useState("");
  const [acreditado, setAcreditado] = useState("");
  const [contador, setContador] = useState("");
  const [apoderado, setApoderado] = useState("");

  const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const btn = (m: "flat" | "real" | "ambas", txt: string) => (
    <button onClick={() => setMetodo(m)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${metodo === m ? "bg-foreground text-background" : "border border-input hover:bg-muted"}`}>{txt}</button>
  );

  const [tab, setTab] = useState<"calc" | "registro">("calc");
  const [datosFlat, setDatosFlat] = useState<Record<string, unknown> | null>(null);
  const [datosReal, setDatosReal] = useState<Record<string, unknown> | null>(null);
  const [peritoNombre, setPeritoNombre] = useState("");
  const [peritoCedula, setPeritoCedula] = useState("");
  const [tipoContrato, setTipoContrato] = useState("Contrato de Apertura de Crédito Simple con Interés y Garantía Hipotecaria");
  const [acreedorOriginal, setAcreedorOriginal] = useState("");
  const [instrumentoPublico, setInstrumentoPublico] = useState("");
  const [fechaInstrumento, setFechaInstrumento] = useState("");
  const [notario, setNotario] = useState("");
  const [cedula, setCedula] = useState<{ url: string; nombre: string } | null>(null);
  const [docPerito, setDocPerito] = useState<{ url: string; nombre: string } | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [precarga, setPrecarga] = useState<{ flat?: Record<string, string>; real?: Record<string, string> } | null>(null);
  const [recargaId, setRecargaId] = useState(0);
  const [casos, setCasos] = useState<CasoOpcion[]>([]);
  const [asunto, setAsunto] = useState("");
  useEffect(() => { casosParaSelector().then(setCasos); }, []);

  const elegirAsunto = (id: string) => {
    setAsunto(id);
    const c = casos.find((x) => x.id === id);
    if (c) { setExpediente(c.expediente || ""); setAcreditado(c.cliente_nombre || ""); }
  };

  const reelaborar = (e: EstadoCuenta) => {
    const d = (e.datos || {}) as { flat?: Record<string, string>; real?: Record<string, string>; contador?: string; apoderado?: string };
    setMetodo((e.metodo as "flat" | "real" | "ambas") || "flat");
    setExpediente(e.expediente || "");
    setAcreditado(e.acreditado || "");
    setContador(d.contador || "");
    setApoderado(d.apoderado || "");
    setPeritoNombre(e.perito_nombre || "");
    setPrecarga({ flat: d.flat, real: d.real });
    setRecargaId((n) => n + 1);
    setTab("calc");
  };

  const subir = async (file: File | undefined, cual: "cedula" | "doc") => {
    if (!file) return;
    setSubiendo(cual);
    try {
      const r = await subirArchivoEC(file, cual === "cedula" ? "cedula" : "docperito");
      if (cual === "cedula") setCedula(r); else setDocPerito(r);
    } catch (e) { setMsg(String((e as Error)?.message || e)); }
    setSubiendo(null);
  };

  const guardar = async () => {
    const activo = metodo === "real" ? datosReal : metodo === "flat" ? datosFlat : (datosReal || datosFlat);
    setGuardando(true); setMsg(null);
    const quien = await usuarioActualEtiqueta();
    const r = await crearEstadoCuenta({
      expediente: expediente || null,
      acreditado: acreditado || null,
      metodo,
      deuda_total: Number(activo?.deudaTotal) || null,
      fecha_corte: (activo?.fechaCorte as string) || null,
      datos: { flat: datosFlat, real: datosReal, contador, apoderado },
      perito_nombre: peritoNombre || null,
      perito_cedula_url: cedula?.url || null,
      perito_doc_url: docPerito?.url || null,
      creado_por: quien,
    });
    setGuardando(false);
    setMsg(r.ok ? "Guardado en el registro ✓" : "No se pudo guardar (¿corriste el SQL de estado_cuenta?)");
  };

  const exportarExcel = () => {
    const q = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const filas: (string | number)[][] = [];
    filas.push(["DIIPA — Liquidación de Intereses / Estado de cuenta"]);
    filas.push(["Expediente", expediente || ""]);
    filas.push(["Acreditado", acreditado || ""]);
    filas.push(["Perito que firma", peritoNombre || ""]);
    filas.push(["Fecha de elaboración", hoy]);
    filas.push([]);

    if ((metodo === "flat" || metodo === "ambas") && datosFlat) {
      const f = datosFlat as Record<string, unknown>;
      filas.push(["MÉTODO FLAT (estimado)"]);
      filas.push(["Suerte principal", Number(f.suerte) || 0]);
      filas.push(["Tasa ordinaria (%)", Number(f.tasaOrd) || 0]);
      filas.push(["Tasa moratoria (%)", Number(f.tasaMor) || 0]);
      filas.push(["Fecha de inicio", String(f.fechaInicio ?? "")]);
      filas.push(["Fecha de corte", String(f.fechaCorte ?? "")]);
      filas.push(["Días de atraso", Number(f.dias) || 0]);
      filas.push(["Total intereses ordinarios", Number(f.ordTotal)?.toFixed(2) as unknown as number]);
      filas.push(["Total intereses moratorios", Number(f.morTotal)?.toFixed(2) as unknown as number]);
      filas.push(["DEUDA TOTAL", Number(f.deudaTotal)?.toFixed(2) as unknown as number]);
      filas.push([]);
    }

    if ((metodo === "real" || metodo === "ambas") && datosReal) {
      const rr = datosReal as Record<string, unknown>;
      filas.push(["MÉTODO REAL (amortización)"]);
      filas.push(["Monto del crédito", Number(rr.monto) || 0]);
      filas.push(["Tasa ordinaria (%)", Number(rr.tasaOrd) || 0]);
      filas.push(["Factor moratorio", Number(rr.factorMor) || 0]);
      filas.push(["Fecha de corte", String(rr.fechaCorte ?? "")]);
      filas.push(["Cuota (capital + interés)", Number(rr.cuota)?.toFixed(2) as unknown as number]);
      filas.push(["Capital insoluto", Number(rr.capitalInsoluto)?.toFixed(2) as unknown as number]);
      filas.push(["Mensualidades vencidas", Number(rr.vencidas) || 0]);
      filas.push(["Mensualidades incumplidas", Number(rr.mensualidadesIncumplidas)?.toFixed(2) as unknown as number]);
      filas.push(["Intereses moratorios", Number(rr.moratorios)?.toFixed(2) as unknown as number]);
      filas.push(["TOTAL DE ADEUDO", Number(rr.deudaTotal)?.toFixed(2) as unknown as number]);
      filas.push([]);
      filas.push(["#", "Vence", "Interés", "Capital", "Saldo", "Mora"]);
      const tabla = (rr.tabla as { k: number; vence: string; interes: number; capital: number; saldo: number; mora: number }[]) || [];
      tabla.forEach((t) => filas.push([t.k, t.vence, t.interes.toFixed(2), t.capital.toFixed(2), t.saldo.toFixed(2), (t.mora || 0).toFixed(2)]));
    }

    const csv = "\uFEFF" + filas.map((row) => row.map(q).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EstadoCuenta_${(expediente || "liquidacion").replace(/\W+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Aísla el impreso: al imprimir solo sale el estado de cuenta, sin el menú de la app */}
      <style>{`@media print { body * { visibility: hidden; } #liq-impreso, #liq-impreso * { visibility: visible; } #liq-impreso { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; } }`}</style>

      <div className="flex flex-wrap gap-1 border-b border-border print:hidden">
        <button onClick={() => setTab("calc")} className={`border-b-2 px-3 py-2 text-sm transition ${tab === "calc" ? "border-[color:var(--teal)] font-semibold text-[color:var(--teal)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Calculadora</button>
        <button onClick={() => setTab("registro")} className={`border-b-2 px-3 py-2 text-sm transition ${tab === "registro" ? "border-[color:var(--teal)] font-semibold text-[color:var(--teal)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>Registro</button>
      </div>

      {tab === "registro" && <RegistroEstados onReelaborar={reelaborar} />}

      {tab === "calc" && (<div className="space-y-4">
      {/* Selector de método */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {btn("flat", "Método flat (rápido)")}
        {btn("real", "Método real (amortización)")}
        {btn("ambas", "Ambas")}
      </div>

      {/* Datos del caso */}
      <div className="rounded-lg border border-border p-4 print:hidden">
        <p className="mb-3 font-display text-sm font-bold">Datos del caso (para el estado de cuenta)</p>
        <div className="mb-3">
          <label className="block text-xs font-medium">Autollenar desde un asunto
            <select className={inp} value={asunto} onChange={(e) => elegirAsunto(e.target.value)}>
              <option value="">— Escoge un expediente —</option>
              {casos.map((c) => <option key={c.id} value={c.id}>{c.expediente || "s/exp"}{c.cliente_nombre ? ` · ${c.cliente_nombre}` : ""}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium">Expediente
            <input className={inp} value={expediente} onChange={(e) => setExpediente(e.target.value)} placeholder="Ej. 123/2024-C" /></label>
          <label className="block text-xs font-medium">Acreditado
            <input className={inp} value={acreditado} onChange={(e) => setAcreditado(e.target.value)} placeholder="Nombre del deudor" /></label>
          <label className="block text-xs font-medium">Aprobó · Contador
            <input className={inp} value={contador} onChange={(e) => setContador(e.target.value)} placeholder="Nombre del contador" /></label>
          <label className="block text-xs font-medium">Firma · Apoderado legal
            <input className={inp} value={apoderado} onChange={(e) => setApoderado(e.target.value)} placeholder="Nombre del apoderado" /></label>
        </div>
      </div>

      {/* Perito que firma */}
      <div className="rounded-lg border border-border p-4 print:hidden">
        <p className="mb-3 font-display text-sm font-bold">Perito que firma</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium sm:col-span-3">Nombre del perito
            <input className={inp} value={peritoNombre} onChange={(e) => setPeritoNombre(e.target.value)} placeholder="Nombre completo del perito valuador/contable" /></label>
          <label className="block text-xs font-medium sm:col-span-3">Número de cédula profesional
            <input className={inp} value={peritoCedula} onChange={(e) => setPeritoCedula(e.target.value)} placeholder="Ej. 3072863" /></label>
          <div>
            <p className="mb-1 text-xs font-medium">Cédula profesional</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40">
              {subiendo === "cedula" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {cedula ? cedula.nombre : "Subir cédula"}
              <input type="file" className="hidden" onChange={(e) => subir(e.target.files?.[0], "cedula")} />
            </label>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium">Documento (opcional)</p>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40">
              {subiendo === "doc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {docPerito ? docPerito.nombre : "Subir documento"}
              <input type="file" className="hidden" onChange={(e) => subir(e.target.files?.[0], "doc")} />
            </label>
          </div>
        </div>
      </div>

      {/* Datos del documento (para el escrito de apertura) */}
      <div className="rounded-lg border border-border p-4 print:hidden">
        <p className="mb-3 font-display text-sm font-bold">Datos del documento (para el escrito)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium sm:col-span-2">Tipo de contrato
            <input className={inp} value={tipoContrato} onChange={(e) => setTipoContrato(e.target.value)} /></label>
          <label className="block text-xs font-medium sm:col-span-2">Acreedor original (quién otorgó el crédito)
            <input className={inp} value={acreedorOriginal} onChange={(e) => setAcreedorOriginal(e.target.value)} placeholder="Ej. HIPOTECARIA SU CASITA, S.A. de C.V., SOFOL" /></label>
          <label className="block text-xs font-medium">Instrumento público No.
            <input className={inp} value={instrumentoPublico} onChange={(e) => setInstrumentoPublico(e.target.value)} placeholder="Ej. 39,088" /></label>
          <label className="block text-xs font-medium">Fecha del instrumento
            <input className={inp} value={fechaInstrumento} onChange={(e) => setFechaInstrumento(e.target.value)} placeholder="Ej. 29 de mayo de 2008" /></label>
          <label className="block text-xs font-medium sm:col-span-2">Notario (nombre, número y plaza)
            <input className={inp} value={notario} onChange={(e) => setNotario(e.target.value)} placeholder="Ej. Lic. Jorge Leoncio Álvarez Gámez, Notario Público No. 11, La Paz, B.C.S." /></label>
        </div>
      </div>

      {/* Calculadora (en pantalla; NO se imprime) */}
      <div className="print:hidden">
        {(metodo === "flat" || metodo === "ambas") && (
          <div>
            {metodo === "ambas" && <p className="mb-2 font-display text-sm font-bold text-[color:var(--teal)]">Método flat (estimado)</p>}
            <Flat key={`flat-${recargaId}`} inicial={precarga?.flat} onDatos={setDatosFlat} />
          </div>
        )}
        {(metodo === "real" || metodo === "ambas") && (
          <div className="mt-4">
            {metodo === "ambas" && <p className="mb-2 font-display text-sm font-bold text-[color:var(--teal)]">Método real (amortización)</p>}
            <Real key={`real-${recargaId}`} inicial={precarga?.real} onDatos={setDatosReal} />
          </div>
        )}
      </div>

      {/* Documento formal — esto es lo que se imprime / firma */}
      <p className="text-xs font-medium text-muted-foreground print:hidden">Vista del documento (así se imprime y firma):</p>
      <div id="liq-impreso">
        <EstadoCuentaDoc
          metodo={metodo}
          datos={metodo === "flat" ? datosFlat : (datosReal || datosFlat)}
          expediente={expediente} acreditado={acreditado}
          contador={contador} apoderado={apoderado}
          peritoNombre={peritoNombre} peritoCedula={peritoCedula}
          tipoContrato={tipoContrato} acreedorOriginal={acreedorOriginal}
          instrumentoPublico={instrumentoPublico} fechaInstrumento={fechaInstrumento} notario={notario}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        {msg && <span className={`text-xs font-medium ${msg.startsWith("Guardado") ? "text-emerald-700" : "text-red-700"}`}>{msg}</span>}
        <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--teal)] px-4 py-2 text-sm font-semibold text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10">
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
        </button>
        <button onClick={exportarExcel} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
          <Sheet className="h-4 w-4" /> Excel
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background">
          <FileDown className="h-4 w-4" /> PDF / Imprimir
        </button>
      </div>
      </div>)}
    </div>
  );
}

const fmtN = (v?: number | null) => (v != null && isFinite(v) ? v.toLocaleString("es-MX", { style: "currency", currency: "MXN" }) : "—");

function Renglon({ romano, concepto, monto }: { romano: string; concepto: string; monto: number }) {
  return (
    <tr className="border-b border-gray-300">
      <td className="py-1 pr-2 align-top font-semibold">{romano}</td>
      <td className="py-1">{concepto}</td>
      <td className="py-1 text-right tabular-nums">{fmt(monto)}</td>
    </tr>
  );
}

function EstadoCuentaDoc(props: {
  metodo: string; datos: Record<string, unknown> | null;
  expediente: string; acreditado: string; contador: string; apoderado: string;
  peritoNombre: string; peritoCedula: string; tipoContrato: string; acreedorOriginal: string;
  instrumentoPublico: string; fechaInstrumento: string; notario: string;
}) {
  const { metodo, datos, acreditado, contador, apoderado, peritoNombre, peritoCedula, tipoContrato, acreedorOriginal, instrumentoPublico, fechaInstrumento, notario } = props;
  const d = (datos || {}) as Record<string, unknown>;
  const esReal = metodo !== "flat";
  const capital = Number(esReal ? d.capitalInsoluto : d.suerte) || 0;
  const ordinarios = Number(esReal ? d.interesesOrdVencidos : d.ordTotal) || 0;
  const comision = Number(esReal ? d.comisionVencida : 0) || 0;
  const moratorios = Number(esReal ? d.moratorios : d.morTotal) || 0;
  const total = capital + ordinarios + comision + moratorios;
  const corte = String(d.fechaCorte ?? "");
  const tabla = (d.tabla as { k: number; vence: string; interes: number; capital: number; saldo: number; mora: number }[]) || [];

  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-border bg-white p-6 text-[13px] leading-relaxed text-black print:max-w-none print:rounded-none print:border-0 print:p-0">
      <div className="border-b border-black pb-3 text-center">
        <p className="text-base font-bold">DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V.</p>
        <p className="text-xs">(Inmuebles Accesibles)</p>
        <p className="mt-2 text-lg font-bold">ESTADO DE CUENTA</p>
      </div>

      <p className="mt-4 text-justify">
        El que suscribe, <b>{peritoNombre || "___________"}</b>, Contador facultado, con número de cédula profesional <b>{peritoCedula || "___________"}</b>, facultado por la empresa DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. de C.V., hace constar el adeudo a cargo de <b>{acreditado || "___________"}</b>.
      </p>
      <p className="mt-2 text-justify">
        Para la elaboración del presente Estado de Cuenta se tomó en consideración el <b>{tipoContrato}</b>{acreedorOriginal ? <>, celebrado en su origen por <b>{acreedorOriginal}</b></> : null}{instrumentoPublico ? <>, otorgado en el Instrumento Público No. {instrumentoPublico}</> : null}{fechaInstrumento ? <>, de fecha {fechaInstrumento}</> : null}{notario ? <>, ante la fe de {notario}</> : null}; de lo anterior se desprende el siguiente RESUMEN Y CUANTIFICACIÓN de adeudos{corte ? <> a la fecha de corte del <b>{corte}</b></> : null}.
      </p>

      <p className="mt-5 text-center font-bold">RESUMEN GENERAL{corte ? ` AL ${corte}` : ""}</p>
      <p className="text-center text-xs">Cantidades Pendientes de Pago</p>
      <table className="mt-2 w-full border-collapse">
        <tbody>
          <Renglon romano="(I)" concepto="ADEUDO DE CAPITAL" monto={capital} />
          <Renglon romano="(II)" concepto="SALDO DE INTERESES ORDINARIOS VENCIDOS" monto={ordinarios} />
          {esReal && <Renglon romano="(III)" concepto="SALDO COMISIÓN POR ADMINISTRACIÓN VENCIDA" monto={comision} />}
          <Renglon romano="(IV)" concepto="SALDO DE LOS INTERESES MORATORIOS" monto={moratorios} />
          <tr className="border-t-2 border-black font-bold"><td></td><td className="py-1.5">TOTAL</td><td className="py-1.5 text-right tabular-nums">{fmt(total)}</td></tr>
        </tbody>
      </table>
      <p className="mt-2 font-bold">SON: ({montoEnLetra(total)})</p>

      {esReal && tabla.length > 0 && (
        <>
          <p className="mt-6 text-center font-bold">ANEXO — DESGLOSE DE CUOTAS</p>
          <table className="mt-2 w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-b border-black">
                <th className="p-1 text-left">#</th><th className="p-1 text-left">Vence</th>
                <th className="p-1 text-right">Interés</th><th className="p-1 text-right">Capital</th>
                <th className="p-1 text-right">Saldo</th><th className="p-1 text-right">Mora</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((f) => (
                <tr key={f.k} className={`border-b border-gray-200 ${f.mora ? "font-semibold" : ""}`}>
                  <td className="p-1">{f.k}</td><td className="p-1">{f.vence}</td>
                  <td className="p-1 text-right tabular-nums">{fmt(f.interes)}</td>
                  <td className="p-1 text-right tabular-nums">{fmt(f.capital)}</td>
                  <td className="p-1 text-right tabular-nums">{fmt(f.saldo)}</td>
                  <td className="p-1 text-right tabular-nums">{f.mora ? fmt(f.mora) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="mt-12 grid grid-cols-3 gap-8 text-center text-xs">
        <div><div className="mb-1 border-t border-black pt-1">{contador || "\u00A0"}</div><p>Aprobación del Contador</p></div>
        <div><div className="mb-1 border-t border-black pt-1">{apoderado || "\u00A0"}</div><p>Apoderado Legal</p></div>
        <div><div className="mb-1 border-t border-black pt-1">{peritoNombre || "\u00A0"}</div><p>Perito{peritoCedula ? ` · Céd. ${peritoCedula}` : ""}</p></div>
      </div>
    </div>
  );
}

function RegistroEstados({ onReelaborar }: { onReelaborar: (e: EstadoCuenta) => void }) {
  const [lista, setLista] = useState<EstadoCuenta[]>([]);
  const [archivo, setArchivo] = useState<EstadoCuenta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [verFicha, setVerFicha] = useState<EstadoCuenta | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const recargar = () => {
    setCargando(true);
    Promise.all([listarEstadosCuenta("guardado"), listarEstadosCuenta("archivado")])
      .then(([g, a]) => { setLista(g); setArchivo(a); })
      .finally(() => setCargando(false));
  };
  useEffect(() => { recargar(); }, []);

  const cambiar = async (id: string, estado: string) => { setMenu(null); await actualizarEstadoCuenta(id, { estado }); recargar(); };

  const fila = (e: EstadoCuenta) => (
    <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold"><span className="font-mono text-xs text-muted-foreground">{e.folio}</span> · Exp. {e.expediente || "—"} {e.acreditado ? <span className="font-normal text-muted-foreground">· {e.acreditado}</span> : null}</p>
        <p className="text-xs text-muted-foreground">Método {e.metodo} · {fmtN(e.deuda_total)}{e.fecha_corte ? ` · corte ${e.fecha_corte}` : ""}{e.created_at ? ` · ${new Date(e.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` : ""}</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setVerFicha(e)} title="Vista previa" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>
        <div className="relative">
          <button onClick={() => setMenu(menu === e.id ? null : (e.id || null))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><FileText className="h-4 w-4" /></button>
          {menu === e.id && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-white py-1 shadow-lg">
                <button onClick={() => { setMenu(null); onReelaborar(e); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" /> Reelaborar / editar</button>
                {e.estado === "archivado"
                  ? <button onClick={() => cambiar(e.id!, "guardado")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" /> Restaurar</button>
                  : <button onClick={() => cambiar(e.id!, "archivado")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><Archive className="h-3.5 w-3.5" /> Archivar</button>}
                <button onClick={() => cambiar(e.id!, "papelera")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Mover a papelera</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <h3 className="font-display text-base font-semibold">Estados de cuenta guardados</h3>
        {cargando ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : lista.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aún no hay estados de cuenta. En la Calculadora, calcula y pícale “Guardar”.</p>
        ) : <div className="mt-2">{lista.map(fila)}</div>}
      </div>

      {archivo.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <h3 className="text-sm font-semibold text-muted-foreground">Archivados</h3>
          <div className="mt-2">{archivo.map(fila)}</div>
        </div>
      )}

      {verFicha && <FichaEstado e={verFicha} onCerrar={() => setVerFicha(null)} />}
    </div>
  );
}

function FichaEstado({ e, onCerrar }: { e: EstadoCuenta; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="max-h-[82vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-bold text-[#0B1E3A]">Ficha · {e.folio}</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-1.5 text-sm">
          <p><b>Expediente:</b> {e.expediente || "—"}</p>
          <p><b>Acreditado:</b> {e.acreditado || "—"}</p>
          <p><b>Método:</b> {e.metodo}</p>
          <p><b>Deuda total:</b> {fmtN(e.deuda_total)}</p>
          <p><b>Fecha de corte:</b> {e.fecha_corte || "—"}</p>
          {e.perito_nombre && <p><b>Firma (perito):</b> {e.perito_nombre}</p>}
          {e.perito_cedula_url && <p><b>Cédula:</b> <BotonVerDoc url={e.perito_cedula_url} nombre="Cédula del perito" label="ver archivo" /></p>}
          {e.perito_doc_url && <p><b>Documento:</b> <BotonVerDoc url={e.perito_doc_url} nombre="Documento del perito" label="ver archivo" /></p>}
          <p className="text-xs text-muted-foreground">Guardado {e.created_at ? new Date(e.created_at).toLocaleString("es-MX") : ""}{e.creado_por ? ` · por ${e.creado_por}` : ""}</p>
        </div>
      </div>
    </div>
  );
}

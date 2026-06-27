import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { ESTADOS_URRJ, TIPOS_ACCION } from "@/lib/urrj-motores";
import {
  HITOS_UCP, calcularMotores, resultadoAHito, veredictoJuridico, juridicoCompleto, hitosEvaluados,
  type HitosJuridico, type EstadoHito, type Semaforo, type ClaveHito, type ClaveMotor, type EntradaMotoresUCP,
} from "@/lib/ucp-dictamen";
import {
  ArrowLeft, Building2, Scale, Landmark, CheckCircle2, CircleDashed, Calculator,
  Save, Loader2, ScrollText, FileStack,
} from "lucide-react";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ---------------- Requisitos (puerta de entrada, compartido con el registro) ----------------
export type ClaveReq =
  | "predictamen" | "apartado" | "pago_apartado" | "contrato"
  | "recibo" | "aml" | "pld";

export const REQUISITOS: { clave: ClaveReq; label: string; auto?: boolean }[] = [
  { clave: "predictamen", label: "Pre-dictamen URRJ positivo", auto: true },
  { clave: "apartado", label: "Apartado" },
  { clave: "pago_apartado", label: "Validación del pago del apartado" },
  { clave: "contrato", label: "Contrato" },
  { clave: "recibo", label: "Recibo de pago" },
  { clave: "aml", label: "AML" },
  { clave: "pld", label: "PLD" },
];

export type Requisitos = Record<ClaveReq, boolean>;
export const REQ_VACIOS = (): Requisitos =>
  ({ predictamen: true, apartado: false, pago_apartado: false, contrato: false, recibo: false, aml: false, pld: false });
export const reqCompletos = (r: Requisitos) => REQUISITOS.every((x) => r[x.clave]);
export const reqCuenta = (r: Requisitos) => REQUISITOS.filter((x) => r[x.clave]).length;

// ---------------- Tipo de la fila de la tabla dictamen (compartido con el registro) ----------------
export interface DictamenRow {
  id: string;
  caso_id: string | null;
  predictamen_id: string | null;
  estado: string;
  requisitos: Partial<Requisitos> | null;
  juridico: { hitos?: HitosJuridico; veredicto?: string } | null;
  registral: Record<string, unknown> | null;
  veredicto: string;
  vigente: boolean;
}

// ---------------- Pre-dictamen URRJ del que viene la garantía ----------------
export interface PredFuente {
  datos?: Record<string, any> | null;
  resultados?: Record<string, any> | null;
}

const n = (v: any) => {
  const x = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(x) ? 0 : x;
};

// ---------------- Entradas de los 4 motores (estado local del formulario) ----------------
interface MotorIn {
  ultimoPago: string; emplazado: string; fechaEmplazamiento: string; tipoAccion: string;
  convenioRatificado: string; convenioFecha: string; plazoPrescManual: string;
  ultimaActuacion: string; estado: string; plazoCaducManual: string;
  noAplicaUsucapion: boolean; inicioPosesion: string; buenaFe: string; demandaDespojo: string;
  valorComercial: string; adeudo: string; costos: string; precioCesion: string; margenObjetivo: string;
}

function semillaMotor(pred?: PredFuente): MotorIn {
  const d = pred?.datos || {};
  const res = pred?.resultados || {};
  const adeudo = res?.financiero?.totalDeuda ?? d.capital ?? "";
  const costos = (res?.cargas ?? 0) + n(d.costosOperativos);
  return {
    ultimoPago: d.ultimoPago || "", emplazado: d.emplazado || "no", fechaEmplazamiento: d.fechaEmplazamiento || "",
    tipoAccion: d.tipoAccion || "hipotecaria",
    convenioRatificado: d.convenioRatificado || "no", convenioFecha: d.convenioFecha || "", plazoPrescManual: d.plazoPrescManual || "",
    ultimaActuacion: d.ultimaActuacion || "", estado: ESTADOS_URRJ.includes(d.estado) ? d.estado : "Sinaloa", plazoCaducManual: d.plazoCaducManual || "",
    noAplicaUsucapion: false, inicioPosesion: d.inicioPosesion || "", buenaFe: d.buenaFe || "no", demandaDespojo: d.demandaDespojo || "no",
    valorComercial: String(d.valorComercial || ""), adeudo: String(adeudo || ""), costos: String(costos || ""),
    precioCesion: String(d.precioCesion || ""), margenObjetivo: String(d.margenObjetivo || ""),
  };
}

const SEM_LABEL: Record<Semaforo, string> = { verde: "Verde", amarillo: "Amarillo", naranja: "Naranja", rojo: "Rojo", gris: "Sin evaluar" };
const SEM_BTN: Record<Semaforo, string> = {
  verde: "bg-emerald-600 text-white", amarillo: "bg-amber-500 text-white",
  naranja: "bg-orange-500 text-white", rojo: "bg-red-600 text-white", gris: "bg-muted",
};
function semBg(s?: Semaforo) {
  return s === "rojo" ? "border-red-200 bg-red-50" : s === "naranja" ? "border-orange-200 bg-orange-50"
    : s === "amarillo" ? "border-amber-200 bg-amber-50" : s === "verde" ? "border-emerald-200 bg-emerald-50"
    : "border-border bg-muted/30";
}

interface Props {
  caso: CasoJuridico;
  dictamen: DictamenRow;
  pred?: PredFuente;
  tabInicial?: "requisitos" | "juridico" | "rppc";
  onVolver: () => void;
  onGuardado: () => void;
}

export function FichaUCP({ caso, dictamen, pred, tabInicial = "requisitos", onVolver, onGuardado }: Props) {
  const [tab, setTab] = useState(tabInicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ---- requisitos ----
  const [req, setReq] = useState<Requisitos>({ ...REQ_VACIOS(), ...(dictamen.requisitos || {}) });

  // ---- jurídico: entradas de motor + hitos ----
  const [mi, setMi] = useState<MotorIn>(() => semillaMotor(pred));
  const setM = (k: keyof MotorIn, v: any) => setMi((p) => ({ ...p, [k]: v }));

  // hitos guardados (criterio + lo último calculado)
  const [hitos, setHitos] = useState<HitosJuridico>(() => dictamen.juridico?.hitos || {});

  // resultados de los 4 motores (en vivo)
  const motores = useMemo(() => {
    const entrada: EntradaMotoresUCP = {
      prescripcion: {
        ultimoPago: mi.ultimoPago, emplazado: mi.emplazado === "si", fechaEmplazamiento: mi.fechaEmplazamiento,
        tipoAccion: mi.tipoAccion, convenioRatificadoFecha: mi.convenioRatificado === "si" ? mi.convenioFecha : undefined,
        plazoManualAnios: mi.plazoPrescManual ? n(mi.plazoPrescManual) : undefined,
      },
      caducidad: { ultimaActuacion: mi.ultimaActuacion, estado: mi.estado, plazoManualDias: mi.plazoCaducManual ? n(mi.plazoCaducManual) : undefined },
      usucapion: { inicioPosesion: mi.inicioPosesion, buenaFe: mi.buenaFe === "si", hayDemandaDespojo: mi.demandaDespojo === "si" },
      viabilidad: { valorComercial: n(mi.valorComercial), adeudo: n(mi.adeudo), costos: n(mi.costos), precioCesion: n(mi.precioCesion), margenObjetivo: n(mi.margenObjetivo) },
    };
    return calcularMotores(entrada);
  }, [mi]);

  // estado de cada hito para el veredicto (motor en vivo + criterio guardado)
  const hitosCalculados: HitosJuridico = useMemo(() => {
    const out: HitosJuridico = { ...hitos };
    out.prescripcion = resultadoAHito(motores.prescripcion, hitos.prescripcion?.nota);
    out.caducidad = resultadoAHito(motores.caducidad, hitos.caducidad?.nota);
    out.usucapion = mi.noAplicaUsucapion
      ? { semaforo: "verde", etiqueta: "No aplica", detalle: "El abogado indicó que la usucapión no aplica en este caso.", nota: hitos.usucapion?.nota }
      : resultadoAHito(motores.usucapion, hitos.usucapion?.nota);
    out.viabilidad_economica = resultadoAHito(motores.viabilidad_economica, hitos.viabilidad_economica?.nota);
    return out;
  }, [hitos, motores, mi.noAplicaUsucapion]);

  const veredicto = useMemo(() => veredictoJuridico(hitosCalculados), [hitosCalculados]);
  const completo = juridicoCompleto(hitosCalculados);
  const evaluados = hitosEvaluados(hitosCalculados);

  const setCriterio = (clave: ClaveHito, semaforo: Semaforo) =>
    setHitos((p) => ({ ...p, [clave]: { ...(p[clave] || {}), semaforo } as EstadoHito }));
  const setNota = (clave: ClaveHito, nota: string) =>
    setHitos((p) => ({ ...p, [clave]: { ...(p[clave] || { semaforo: "gris" }), nota } as EstadoHito }));

  // ---- guardar requisitos ----
  const guardarRequisitos = async () => {
    setGuardando(true); setError(null);
    try {
      const estado = reqCompletos(req) ? "borrador" : "requisitos";
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamen.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ requisitos: req, estado, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onGuardado();
    } catch (e: any) { setError("No se pudo guardar requisitos: " + e.message); }
    finally { setGuardando(false); }
  };

  // ---- guardar dictamen jurídico ----
  const guardarJuridico = async () => {
    setGuardando(true); setError(null);
    try {
      const payload = { hitos: hitosCalculados, veredicto: veredicto.txt, actualizado: new Date().toISOString() };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamen.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ juridico: payload, veredicto: veredicto.txt, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setHitos(hitosCalculados);
      onGuardado();
    } catch (e: any) { setError("No se pudo guardar el dictamen jurídico: " + e.message); }
    finally { setGuardando(false); }
  };

  const reqOK = reqCompletos(req);

  return (
    <div className="space-y-4">
      {/* encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="mb-1 -ml-2 h-7 text-muted-foreground" onClick={onVolver}>
            <ArrowLeft className="h-4 w-4" /> Volver al registro
          </Button>
          <h1 className="font-display text-xl font-bold">{caso.expediente || "Sin expediente"}</h1>
          <div className="mt-1 grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
            <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" /> {caso.direccion_garantia || "Garantía s/dirección"}</span>
            <span>{caso.juzgado || "Juzgado s/dato"}</span>
            <span>{caso.cliente_nombre || caso.cliente_codigo || "Cliente s/dato"}</span>
            <span>{caso.entidad || ""} {caso.materia ? `· ${caso.materia}` : ""}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className={`border ${veredicto.color}`}>Jurídico: {veredicto.txt}</Badge>
          <span className="text-xs text-muted-foreground">Requisitos {reqCuenta(req)}/7 · Hitos {evaluados}/10</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="requisitos"><FileStack className="mr-1 h-4 w-4" /> Requisitos</TabsTrigger>
          <TabsTrigger value="juridico"><Scale className="mr-1 h-4 w-4" /> Jurídico</TabsTrigger>
          <TabsTrigger value="rppc"><Landmark className="mr-1 h-4 w-4" /> RPPC / Registral</TabsTrigger>
        </TabsList>

        {/* ---------- REQUISITOS ---------- */}
        <TabsContent value="requisitos" className="mt-4">
          <Card className="legal-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--teal)]">Puerta de entrada · 7 requisitos</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {REQUISITOS.map((r) => {
                  const on = req[r.clave];
                  return (
                    <label key={r.clave}
                      className={`flex items-center gap-2 rounded-md border p-2 text-sm ${r.auto ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-background cursor-pointer"}`}>
                      <Checkbox checked={on} disabled={!!r.auto}
                        onCheckedChange={() => !r.auto && setReq((p) => ({ ...p, [r.clave]: !p[r.clave] }))} />
                      <span className={on ? "" : "text-muted-foreground"}>{r.label}</span>
                      {r.auto && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />}
                    </label>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={guardarRequisitos} disabled={guardando}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar requisitos
                </Button>
                {reqOK
                  ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Completos — ya puedes dictaminar</span>
                  : <span className="flex items-center gap-1 text-xs text-muted-foreground"><CircleDashed className="h-4 w-4" /> Faltan {7 - reqCuenta(req)} requisito(s) para dictaminar</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- JURÍDICO (10 hitos) ---------- */}
        <TabsContent value="juridico" className="mt-4 space-y-4">
          {!reqOK && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Faltan requisitos de entrada. Puedes ir capturando, pero el dictamen no debe cerrarse hasta tener los 7.
            </div>
          )}

          {/* MOTORES (hitos 2,3,4,10) */}
          <Card className="legal-card">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-[color:var(--teal)]" />
                <p className="text-sm font-semibold">Hitos calculados por el motor</p>
                <span className="text-xs text-muted-foreground">(precargados del pre-dictamen, editables)</span>
              </div>

              {/* Prescripción */}
              <MotorCard num={2} titulo="Prescripción" r={motores.prescripcion}>
                <Campo label="Último pago"><input type="date" className={INP} value={mi.ultimoPago} onChange={(e) => setM("ultimoPago", e.target.value)} /></Campo>
                <Campo label="¿Emplazado?"><SiNo v={mi.emplazado} on={(x) => setM("emplazado", x)} /></Campo>
                {mi.emplazado === "si" && <Campo label="Fecha emplazamiento"><input type="date" className={INP} value={mi.fechaEmplazamiento} onChange={(e) => setM("fechaEmplazamiento", e.target.value)} /></Campo>}
                <Campo label="Tipo de acción">
                  <select className={INP} value={mi.tipoAccion} onChange={(e) => setM("tipoAccion", e.target.value)}>
                    {TIPOS_ACCION.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
                  </select>
                </Campo>
                <Campo label="¿Convenio ratificado?"><SiNo v={mi.convenioRatificado} on={(x) => setM("convenioRatificado", x)} /></Campo>
                {mi.convenioRatificado === "si" && <Campo label="Fecha convenio"><input type="date" className={INP} value={mi.convenioFecha} onChange={(e) => setM("convenioFecha", e.target.value)} /></Campo>}
              </MotorCard>

              {/* Caducidad */}
              <MotorCard num={3} titulo="Caducidad" r={motores.caducidad}>
                <Campo label="Última actuación"><input type="date" className={INP} value={mi.ultimaActuacion} onChange={(e) => setM("ultimaActuacion", e.target.value)} /></Campo>
                <Campo label="Estado (plazo)">
                  <select className={INP} value={mi.estado} onChange={(e) => setM("estado", e.target.value)}>
                    {ESTADOS_URRJ.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Campo>
              </MotorCard>

              {/* Usucapión */}
              <MotorCard num={4} titulo="Usucapión" r={mi.noAplicaUsucapion ? hitosCalculados.usucapion : motores.usucapion}>
                <label className="col-span-full flex items-center gap-2 text-sm">
                  <Checkbox checked={mi.noAplicaUsucapion} onCheckedChange={() => setM("noAplicaUsucapion", !mi.noAplicaUsucapion)} />
                  No aplica usucapión en este caso
                </label>
                {!mi.noAplicaUsucapion && <>
                  <Campo label="Inicio de posesión"><input type="date" className={INP} value={mi.inicioPosesion} onChange={(e) => setM("inicioPosesion", e.target.value)} /></Campo>
                  <Campo label="¿Buena fe (justo título)?"><SiNo v={mi.buenaFe} on={(x) => setM("buenaFe", x)} /></Campo>
                  <Campo label="¿Hay demanda de despojo?"><SiNo v={mi.demandaDespojo} on={(x) => setM("demandaDespojo", x)} /></Campo>
                </>}
              </MotorCard>

              {/* Viabilidad económica */}
              <MotorCard num={10} titulo="Viabilidad económica" r={motores.viabilidad_economica}>
                <Campo label="Valor comercial"><input className={INP} inputMode="numeric" value={mi.valorComercial} onChange={(e) => setM("valorComercial", e.target.value)} /></Campo>
                <Campo label="Adeudo total"><input className={INP} inputMode="numeric" value={mi.adeudo} onChange={(e) => setM("adeudo", e.target.value)} /></Campo>
                <Campo label="Costos / cargas"><input className={INP} inputMode="numeric" value={mi.costos} onChange={(e) => setM("costos", e.target.value)} /></Campo>
                <Campo label="Precio de cesión"><input className={INP} inputMode="numeric" value={mi.precioCesion} onChange={(e) => setM("precioCesion", e.target.value)} /></Campo>
                <Campo label="Margen objetivo"><input className={INP} inputMode="numeric" value={mi.margenObjetivo} onChange={(e) => setM("margenObjetivo", e.target.value)} /></Campo>
              </MotorCard>
            </CardContent>
          </Card>

          {/* CRITERIO (hitos 1,5,6,7,8,9) */}
          <Card className="legal-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold">Hitos de criterio del abogado</p>
              {HITOS_UCP.filter((h) => h.tipo === "criterio").map((h) => {
                const est = hitos[h.clave];
                return (
                  <div key={h.clave} className={`rounded-lg border p-3 ${semBg(est?.semaforo)}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{h.num}. {h.label}</p>
                      <div className="flex gap-1">
                        {(["verde", "amarillo", "rojo"] as Semaforo[]).map((s) => (
                          <button key={s} onClick={() => setCriterio(h.clave, s)}
                            className={`rounded px-2 py-0.5 text-xs ${est?.semaforo === s ? SEM_BTN[s] : "bg-background border border-border text-muted-foreground"}`}>
                            {SEM_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{h.ayuda}</p>
                    <Textarea className="mt-2 min-h-[44px] text-sm" placeholder="Justificación / nota del abogado…"
                      value={est?.nota || ""} onChange={(e) => setNota(h.clave, e.target.value)} />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* veredicto + guardar */}
          <Card className="legal-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`border text-sm ${veredicto.color}`}>Dictamen jurídico: {veredicto.txt}</Badge>
                {!completo && <span className="flex items-center gap-1 text-xs text-muted-foreground"><CircleDashed className="h-4 w-4" /> Faltan hitos por evaluar ({evaluados}/10)</span>}
              </div>
              <Button onClick={guardarJuridico} disabled={guardando}>
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar dictamen jurídico
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- RPPC / REGISTRAL (scaffold para el siguiente paso) ---------- */}
        <TabsContent value="rppc" className="mt-4">
          <Card className="legal-card">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <ScrollText className="h-7 w-7 text-[color:var(--teal)]" />
              <p className="font-medium text-foreground">Dictamen registral (RPPC)</p>
              <p className="max-w-md text-xs">
                Aquí van los datos registrales (folio real, propietario, prelación) y la gestoría RPPC
                en sus 3 fases (solicitud → seguimiento → entrega del CLG, que vence a 90 días).
                Se construye en el siguiente entregable.
              </p>
              <Badge variant="outline" className="mt-1">Siguiente paso</Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- piezas reutilizables ----------------
const INP = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SiNo({ v, on }: { v: string; on: (x: string) => void }) {
  return (
    <div className="flex gap-1">
      {["si", "no"].map((o) => (
        <button key={o} onClick={() => on(o)}
          className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${v === o ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-border text-muted-foreground"}`}>
          {o === "si" ? "Sí" : "No"}
        </button>
      ))}
    </div>
  );
}

function MotorCard({ num, titulo, r, children }: {
  num: number; titulo: string;
  r?: { semaforo: Semaforo; etiqueta?: string; detalle?: string; dato?: string };
  children: React.ReactNode;
}) {
  const sem: Semaforo = r?.semaforo ?? "gris";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{num}. {titulo}</p>
        <Badge variant="outline" className={`border ${semBg(sem)}`}>{r?.etiqueta || "—"}{r?.dato ? ` · ${r.dato}` : ""}</Badge>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{children}</div>
      {r?.detalle && <p className="mt-2 text-xs text-muted-foreground">{r.detalle}</p>}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import {
  HITOS_UCP, resultadoAHito, veredictoJuridico, juridicoCompleto, hitosEvaluados,
  type HitosJuridico, type EstadoHito, type Semaforo, type ClaveHito, type ClaveMotor,
} from "@/lib/ucp-dictamen";
import {
  ArrowLeft, Building2, Scale, Landmark, CheckCircle2, CircleDashed, Calculator,
  Save, Loader2, FileStack, CalendarClock, Stamp,
} from "lucide-react";
import { type Precarga } from "@/lib/predictamen-guardar";
import { getAuth } from "@/lib/auth";
import { DictaminadorPosicion, type VistaPosicion } from "@/components/dictaminador-posicion";
import { type ResultadosActor } from "@/components/recorrido-actor";
import { SeccionRPPC } from "@/components/seccion-rppc";
import { SeccionR2 } from "@/components/seccion-r2";
import { SeccionFinal } from "@/components/seccion-final";

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
  contable: Record<string, unknown> | null;
  firmas: Record<string, unknown> | null;
  rppc: Record<string, unknown> | null;
  veredicto: string;
  vigente: boolean;
}

// ---------------- Pre-dictamen URRJ del que viene la garantía ----------------
export interface PredFuente {
  datos?: Record<string, any> | null;
  resultados?: Record<string, any> | null;
}

const SEM_LABEL: Record<Semaforo, string> = { verde: "Verde", amarillo: "Amarillo", naranja: "Naranja", rojo: "Rojo", gris: "Sin evaluar" };
const SEM_CHIP: Record<Semaforo, string> = {
  verde: "bg-emerald-100 text-emerald-800", amarillo: "bg-amber-100 text-amber-800",
  naranja: "bg-orange-100 text-orange-800", rojo: "bg-red-100 text-red-800", gris: "bg-muted text-muted-foreground",
};
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
  tabInicial?: "requisitos" | "juridico" | "rppc" | "r2" | "final";
  onVolver: () => void;
  onGuardado: () => void;
}

export function FichaUCP({ caso, dictamen, pred, tabInicial = "requisitos", onVolver, onGuardado }: Props) {
  const [tab, setTab] = useState(tabInicial);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // ---- requisitos ----
  const [req, setReq] = useState<Requisitos>({ ...REQ_VACIOS(), ...(dictamen.requisitos || {}) });

  // ---- jurídico ----
  // hitos guardados (criterio del abogado + notas + lo que se haya guardado de motor)
  const [hitos, setHitos] = useState<HitosJuridico>(() => dictamen.juridico?.hitos || {});
  // posición confirmada / recorrido embebido
  const [vistaPos, setVistaPos] = useState<VistaPosicion>("elegir");
  // posición tentativa elegida en el banner (antes de confirmar)
  const [posSel, setPosSel] = useState<Exclude<VistaPosicion, "elegir">>("Actor");
  // resultados que el recorrido va calculando en vivo (los 4 motores)
  const [motoresRecorrido, setMotoresRecorrido] = useState<ResultadosActor | null>(null);
  // cambios a mano que hizo el abogado sobre los hitos de motor (ganan al cálculo)
  const [motorOverride, setMotorOverride] = useState<Partial<Record<ClaveMotor, Semaforo>>>({});

  // rol del usuario (para amarrar la sección Administración del recorrido a GAD/DGE)
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        const correo = data.session?.user?.email;
        if (!correo) return;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers });
        const j = r.ok ? await r.json() : [];
        setRolUsuario(j?.[0]?.rol ?? null);
      } catch { /* si falla, queda sin permiso de admin */ }
    })();
  }, []);
  const puedeAdmin = ["GAD", "Super_Admin", "DGE"].includes(rolUsuario || "");

  // precarga del recorrido con los datos del pre-dictamen de esta garantía
  const precargaRecorrido = useMemo<Precarga | null>(() => (pred?.datos ? { datos: pred.datos } : null), [pred]);

  // estado efectivo de cada hito para el veredicto:
  //  - criterio: lo que puso el abogado
  //  - motor: lo reflejado del recorrido (o lo guardado), salvo que el abogado lo haya cambiado a mano
  const hitosCalculados: HitosJuridico = useMemo(() => {
    const out: HitosJuridico = {};
    for (const h of HITOS_UCP) {
      if (h.tipo === "criterio") {
        if (hitos[h.clave]) out[h.clave] = hitos[h.clave];
        continue;
      }
      const c = h.clave as ClaveMotor;
      const reflejado = motoresRecorrido?.[c] ? resultadoAHito(motoresRecorrido[c]) : undefined;
      const base = reflejado ?? hitos[c];           // preferimos el recorrido en vivo; si no, lo guardado
      const ov = motorOverride[c];                  // cambio a mano del abogado
      if (!base && !ov) continue;                   // todavía pendiente
      out[c] = {
        ...(base || {}),
        semaforo: ov ?? base?.semaforo ?? "gris",
        nota: hitos[c]?.nota ?? base?.nota,
      } as EstadoHito;
    }
    return out;
  }, [hitos, motoresRecorrido, motorOverride]);

  const veredicto = useMemo(() => veredictoJuridico(hitosCalculados), [hitosCalculados]);
  const completo = juridicoCompleto(hitosCalculados);
  const evaluados = hitosEvaluados(hitosCalculados);

  const setCriterio = (clave: ClaveHito, semaforo: Semaforo) =>
    setHitos((p) => ({ ...p, [clave]: { ...(p[clave] || {}), semaforo } as EstadoHito }));
  const setNota = (clave: ClaveHito, nota: string) =>
    setHitos((p) => ({ ...p, [clave]: { ...(p[clave] || { semaforo: "gris" }), nota } as EstadoHito }));
  const overrideMotor = (c: ClaveMotor, semaforo: Semaforo) => setMotorOverride((p) => ({ ...p, [c]: semaforo }));
  const autoMotor = (c: ClaveMotor) => setMotorOverride((p) => { const q = { ...p }; delete q[c]; return q; });

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
          <div className="mt-1 grid grid-cols-1 gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
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
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="requisitos"><FileStack className="mr-1 h-4 w-4" /> Requisitos</TabsTrigger>
          <TabsTrigger value="juridico"><Scale className="mr-1 h-4 w-4" /> Jurídico</TabsTrigger>
          <TabsTrigger value="rppc"><Landmark className="mr-1 h-4 w-4" /> RPPC / Registral</TabsTrigger>
          <TabsTrigger value="r2"><CalendarClock className="mr-1 h-4 w-4" /> Seguimiento R2</TabsTrigger>
          <TabsTrigger value="final"><Stamp className="mr-1 h-4 w-4" /> Dictamen final</TabsTrigger>
        </TabsList>

        {/* ---------- REQUISITOS ---------- */}
        <TabsContent value="requisitos" className="mt-4">
          <Card className="legal-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--teal)]">Puerta de entrada · 7 requisitos</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          {/* BARRA FIJA: banner de posición + indicadores (siguen al hacer scroll) */}
          <div className="sticky top-0 z-20 -mx-1 space-y-2 bg-background/95 px-1 pb-2 pt-1 backdrop-blur">
            {/* banner de posición */}
            <div className="rounded-xl border-2 border-[color:var(--teal)]/40 bg-card p-3">
              {vistaPos === "elegir" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--teal)]"><Scale className="h-4 w-4" /> Confirmar posición</span>
                  <select value={posSel} onChange={(e) => setPosSel(e.target.value as Exclude<VistaPosicion, "elegir">)} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                    <option value="Actor">Actor</option>
                    <option value="Demandado">Demandado</option>
                    <option value="Sucesorio">Sucesorio</option>
                    <option value="Contingencia">Contingencia</option>
                    <option value="Tramites">Trámites</option>
                  </select>
                  <button onClick={() => setVistaPos(posSel)} className="rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: "#0C5C46" }}>Confirmar</button>
                  <span className="text-xs text-muted-foreground">Por ahora Actor se engancha a los 10 hitos.</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--teal)]"><Scale className="h-4 w-4" /> Posición confirmada:</span>
                  <span className="rounded-full bg-[color:var(--teal)]/10 px-3 py-1 text-sm font-medium text-[color:var(--teal)]">{vistaPos}</span>
                  <button onClick={() => setVistaPos("elegir")} className="ml-auto rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted">Cambiar posición</button>
                </div>
              )}
            </div>

            {/* indicadores: comparación Sistema → Abogado */}
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold text-[color:var(--teal)]"><Scale className="mr-1 inline h-3.5 w-3.5" /> Indicadores · Sistema → Abogado</p>
              <div className="space-y-2">
                {HITOS_UCP.filter((h) => h.tipo === "motor").map((h) => {
                  const c = h.clave as ClaveMotor;
                  const sistemaSem = motoresRecorrido?.[c]?.semaforo;
                  const ov = motorOverride[c];
                  const est = hitosCalculados[c];
                  const actualSem = est?.semaforo;
                  const tieneValor = !!actualSem && actualSem !== "gris";
                  const cambiado = !!ov && ov !== sistemaSem;
                  return (
                    <div key={c} className={`rounded-lg border p-2.5 ${cambiado ? "border-amber-300 bg-amber-50" : "border-border bg-background"}`}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="basis-full text-sm font-medium sm:flex-1 sm:basis-auto">{h.num}. {h.label}
                          {cambiado ? <span className="ml-1 text-[10px] font-normal text-amber-700">· cambiado</span>
                            : tieneValor ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">· sin cambio</span> : null}
                        </span>
                        {!tieneValor ? (
                          <span className="text-xs text-muted-foreground">pendiente — falta llenar el recorrido</span>
                        ) : sistemaSem ? (
                          <>
                            <span className="text-xs text-muted-foreground">Sistema</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${SEM_CHIP[sistemaSem]}`}>{SEM_LABEL[sistemaSem]}</span>
                            <span className="text-muted-foreground">{cambiado ? "→" : "="}</span>
                            <span className="text-xs text-muted-foreground">Abogado</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${SEM_CHIP[actualSem]} ${cambiado ? "font-medium" : ""}`}>{SEM_LABEL[actualSem]}</span>
                          </>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${SEM_CHIP[actualSem]}`}>{SEM_LABEL[actualSem]}</span>
                        )}
                      </div>
                      {tieneValor && (
                        <div className="mt-2 flex items-center gap-1">
                          {(["verde", "amarillo", "rojo"] as Semaforo[]).map((s) => (
                            <button key={s} onClick={() => overrideMotor(c, s)} className={`rounded px-2 py-0.5 text-xs ${(ov ?? actualSem) === s ? SEM_BTN[s] : "bg-background border border-border text-muted-foreground"}`}>{SEM_LABEL[s]}</button>
                          ))}
                          {ov && <button onClick={() => autoMotor(c)} className="ml-auto rounded border border-border px-2 py-0.5 text-xs text-muted-foreground" title="Volver al cálculo del sistema">Auto</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!motoresRecorrido && (
                  <p className="text-xs text-muted-foreground">Aún no confirmas la posición. Confírmala arriba y llena el recorrido para que estos 4 hitos se calculen solos.</p>
                )}
              </div>
            </div>
          </div>

          {!reqOK && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Faltan requisitos de entrada. Puedes ir capturando, pero el dictamen no debe cerrarse hasta tener los 7.
            </div>
          )}

          {/* RECORRIDO (dictaminador) — debajo del banner */}
          {vistaPos === "elegir" ? (
            <Card className="legal-card">
              <CardContent className="grid min-h-[120px] place-items-center p-6 text-center text-sm text-muted-foreground">
                <span><Calculator className="mx-auto mb-2 h-6 w-6 opacity-40" />Confirma la posición arriba para desplegar el recorrido.</span>
              </CardContent>
            </Card>
          ) : (
            <DictaminadorPosicion
              casos={[caso]}
              vista={vistaPos}
              onVista={setVistaPos}
              precargar={precargaRecorrido}
              onVolver={() => setVistaPos("elegir")}
              puedeAdmin={puedeAdmin}
              onResultados={setMotoresRecorrido}
              modoFicha
            />
          )}

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

        {/* ---------- RPPC / REGISTRAL ---------- */}
        <TabsContent value="rppc" className="mt-4">
          <SeccionRPPC caso={caso} dictamen={dictamen} pred={pred} onGuardado={onGuardado} />
        </TabsContent>

        {/* ---------- SEGUIMIENTO R2 ---------- */}
        <TabsContent value="r2" className="mt-4">
          <SeccionR2 caso={caso} dictamen={dictamen} onGuardado={onGuardado} />
        </TabsContent>

        {/* ---------- DICTAMEN FINAL ---------- */}
        <TabsContent value="final" className="mt-4">
          <SeccionFinal caso={caso} dictamen={dictamen} pred={pred} onGuardado={onGuardado} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

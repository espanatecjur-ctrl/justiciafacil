import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { type Semaforo } from "@/lib/ucp-dictamen";
import { type DictamenRow, type PredFuente } from "@/components/ficha-ucp";
import { FormatoRPPC } from "@/components/formato-rppc";
import {
  Landmark, Save, Loader2, Plus, CheckCircle2, AlertTriangle, Clock, FileCheck2, Trash2,
} from "lucide-react";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ---------- datos registrales que viven en dictamen.registral ----------
interface Registral {
  folio_real: string;
  propietario: string;
  prelacion: string;
  hipoteca_inscrita: string;   // "si" | "no" | ""
  anotaciones: string;
  semaforo: Semaforo;
  nota: string;
}
const REGISTRAL_VACIO = (): Registral =>
  ({ folio_real: "", propietario: "", prelacion: "", hipoteca_inscrita: "", anotaciones: "", semaforo: "gris", nota: "" });

function semilla(reg: any, pred?: PredFuente): Registral {
  const d = pred?.datos || {};
  return {
    ...REGISTRAL_VACIO(),
    folio_real: reg?.folio_real ?? d.folioReal ?? "",
    propietario: reg?.propietario ?? d.propietario ?? "",
    prelacion: reg?.prelacion ?? d.prelacion ?? "",
    hipoteca_inscrita: reg?.hipoteca_inscrita ?? d.hipotecaInscrita ?? "",
    anotaciones: reg?.anotaciones ?? d.anotaciones ?? "",
    semaforo: reg?.semaforo ?? "gris",
    nota: reg?.nota ?? "",
  };
}

function veredictoRegistral(s: Semaforo): string {
  return s === "rojo" ? "NEGATIVO" : s === "amarillo" || s === "naranja" ? "CONDICIONADO" : s === "verde" ? "POSITIVO" : "PENDIENTE";
}
const VER_CLS: Record<string, string> = {
  POSITIVO: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONDICIONADO: "bg-amber-50 text-amber-800 border-amber-200",
  NEGATIVO: "bg-red-50 text-red-800 border-red-200",
  PENDIENTE: "bg-muted text-muted-foreground border-border",
};
const SEM_BTN: Record<Semaforo, string> = {
  verde: "bg-emerald-600 text-white", amarillo: "bg-amber-500 text-white",
  naranja: "bg-orange-500 text-white", rojo: "bg-red-600 text-white", gris: "bg-muted",
};

// ---------- gestoría RPPC (tabla gestoria_rppc) ----------
interface Gestoria {
  id: string;
  dictamen_id: string | null;
  caso_id: string | null;
  folio_real: string | null;
  rppc: string | null;
  documento: string | null;
  fase: string;
  costo_estimado: number | null;
  costo_ciudad: number | null;
  gestor: string | null;
  fecha_solicitud: string | null;
  fecha_entrega: string | null;
  vence: string | null;
  evidencia: string | null;
  validado_dil: boolean;
}

const DOCUMENTOS = ["CLG", "testimonio", "inscripcion", "antecedente"];
const FASES = [
  { clave: "solicitud",   label: "Solicitud",   pago: "$100 + CLG + $300 copias" },
  { clave: "seguimiento", label: "Seguimiento", pago: "$100 (recibo + pantallas)" },
  { clave: "entrega",     label: "Entrega",     pago: "$100 (CLG + escrituras)" },
  { clave: "cerrada",     label: "Cerrada",     pago: "—" },
];
const faseIdx = (f: string) => Math.max(0, FASES.findIndex((x) => x.clave === f));

function hoyISO() { return new Date().toISOString().slice(0, 10); }
function masDias(iso: string, dias: number) {
  const d = new Date(iso); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10);
}
function diasPara(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

interface Props {
  caso: CasoJuridico;
  dictamen: DictamenRow;
  pred?: PredFuente;
  onGuardado: () => void;
}

export function SeccionRPPC({ caso, dictamen, pred, onGuardado }: Props) {
  const [reg, setReg] = useState<Registral>(() => semilla(dictamen.registral, pred));
  const setR = (k: keyof Registral, v: any) => setReg((p) => ({ ...p, [k]: v }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gestorias, setGestorias] = useState<Gestoria[]>([]);
  const [cargandoG, setCargandoG] = useState(true);
  const [nueva, setNueva] = useState({ documento: "CLG", rppc: "", folio_real: "", gestor: "", costo_estimado: "", costo_ciudad: "" });
  const [agregando, setAgregando] = useState(false);

  const ver = veredictoRegistral(reg.semaforo);

  const cargarGestorias = () => {
    setCargandoG(true);
    fetch(`${SUPABASE_URL}/rest/v1/gestoria_rppc?select=*&dictamen_id=eq.${dictamen.id}&order=created_at.asc`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setGestorias)
      .catch(() => setGestorias([]))
      .finally(() => setCargandoG(false));
  };
  useEffect(cargarGestorias, [dictamen.id]);

  // sugerencia de semáforo: hipoteca no inscrita = riesgo grave
  const sugerencia = useMemo(() => (reg.hipoteca_inscrita === "no" ? "La hipoteca no está inscrita/vigente: normalmente es riesgo grave (rojo)." : null), [reg.hipoteca_inscrita]);

  const guardarRegistral = async () => {
    setGuardando(true); setError(null);
    try {
      const payload = { ...reg, veredicto: ver, actualizado: new Date().toISOString() };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamen.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ registral: payload, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onGuardado();
    } catch (e: any) { setError("No se pudo guardar lo registral: " + e.message); }
    finally { setGuardando(false); }
  };

  const agregarGestoria = async () => {
    if (!nueva.documento) return;
    setAgregando(true); setError(null);
    const fsol = hoyISO();
    try {
      const body = {
        dictamen_id: dictamen.id, caso_id: caso.id,
        documento: nueva.documento, rppc: nueva.rppc || null, folio_real: nueva.folio_real || reg.folio_real || null,
        gestor: nueva.gestor || null,
        costo_estimado: nueva.costo_estimado ? Number(nueva.costo_estimado) : null,
        costo_ciudad: nueva.costo_ciudad ? Number(nueva.costo_ciudad) : null,
        fase: "solicitud", fecha_solicitud: fsol,
        vence: nueva.documento === "CLG" ? masDias(fsol, 90) : null,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/gestoria_rppc`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setNueva({ documento: "CLG", rppc: "", folio_real: "", gestor: "", costo_estimado: "", costo_ciudad: "" });
      cargarGestorias();
    } catch (e: any) { setError("No se pudo agregar la gestoría: " + e.message); }
    finally { setAgregando(false); }
  };

  const patchGestoria = async (g: Gestoria, cambios: Partial<Gestoria>) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/gestoria_rppc?id=eq.${g.id}`, {
        method: "PATCH", headers, body: JSON.stringify(cambios),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      cargarGestorias();
    } catch (e: any) { setError("No se pudo actualizar la gestoría: " + e.message); }
  };

  const avanzarFase = (g: Gestoria) => {
    const i = faseIdx(g.fase);
    if (i >= FASES.length - 1) return;
    const siguiente = FASES[i + 1].clave;
    const cambios: Partial<Gestoria> = { fase: siguiente };
    if (siguiente === "entrega") cambios.fecha_entrega = hoyISO();
    patchGestoria(g, cambios);
  };

  const borrarGestoria = async (g: Gestoria) => {
    if (!confirm("¿Quitar esta gestoría?")) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/gestoria_rppc?id=eq.${g.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      cargarGestorias();
    } catch (e: any) { setError("No se pudo quitar: " + e.message); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* ---------- datos registrales ---------- */}
      <Card className="legal-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[color:var(--teal)]" />
            <p className="text-sm font-semibold">Datos registrales</p>
            <Badge variant="outline" className={`ml-auto border ${VER_CLS[ver]}`}>Registral: {ver}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Campo label="Folio real"><Input value={reg.folio_real} onChange={(e) => setR("folio_real", e.target.value)} /></Campo>
            <Campo label="Propietario registral"><Input value={reg.propietario} onChange={(e) => setR("propietario", e.target.value)} /></Campo>
            <Campo label="Prelación / grado"><Input value={reg.prelacion} onChange={(e) => setR("prelacion", e.target.value)} /></Campo>
            <Campo label="¿Hipoteca inscrita y vigente?">
              <div className="flex gap-1">
                {["si", "no"].map((o) => (
                  <button key={o} onClick={() => setR("hipoteca_inscrita", o)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${reg.hipoteca_inscrita === o ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-border text-muted-foreground"}`}>
                    {o === "si" ? "Sí" : "No"}
                  </button>
                ))}
              </div>
            </Campo>
          </div>

          <Campo label="Anotaciones marginales / gravámenes">
            <Textarea className="min-h-[44px]" value={reg.anotaciones} onChange={(e) => setR("anotaciones", e.target.value)} />
          </Campo>

          {sugerencia && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {sugerencia}
            </div>
          )}

          <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Conclusión registral</span>
            <div className="flex gap-1">
              {(["verde", "amarillo", "rojo"] as Semaforo[]).map((s) => (
                <button key={s} onClick={() => setR("semaforo", s)}
                  className={`rounded px-3 py-1 text-xs ${reg.semaforo === s ? SEM_BTN[s] : "bg-background border border-border text-muted-foreground"}`}>
                  {s === "verde" ? "Positivo" : s === "amarillo" ? "Condicionado" : "Negativo"}
                </button>
              ))}
            </div>
          </div>
          <Textarea className="min-h-[44px] text-sm" placeholder="Nota / justificación registral…"
            value={reg.nota} onChange={(e) => setR("nota", e.target.value)} />

          <Button size="sm" onClick={guardarRegistral} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar registral
          </Button>
        </CardContent>
      </Card>

      {/* ---------- gestoría RPPC (3 fases) ---------- */}
      <Card className="legal-card">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Gestoría RPPC</p>
          <p className="text-xs text-muted-foreground">
            Cada documento (CLG, testimonio, inscripción) avanza por 3 fases: solicitud → seguimiento → entrega. El CLG vence a los 90 días.
          </p>

          {/* alta de gestoría */}
          <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-3">
            <Campo label="Documento">
              <select className={INP} value={nueva.documento} onChange={(e) => setNueva((p) => ({ ...p, documento: e.target.value }))}>
                {DOCUMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Campo>
            <Campo label="RPPC / oficina"><Input value={nueva.rppc} onChange={(e) => setNueva((p) => ({ ...p, rppc: e.target.value }))} /></Campo>
            <Campo label="Gestor"><Input value={nueva.gestor} onChange={(e) => setNueva((p) => ({ ...p, gestor: e.target.value }))} /></Campo>
            <Campo label="Folio real"><Input value={nueva.folio_real} onChange={(e) => setNueva((p) => ({ ...p, folio_real: e.target.value }))} /></Campo>
            <Campo label="Costo estimado"><Input inputMode="numeric" value={nueva.costo_estimado} onChange={(e) => setNueva((p) => ({ ...p, costo_estimado: e.target.value }))} /></Campo>
            <Campo label="Costo de ciudad"><Input inputMode="numeric" value={nueva.costo_ciudad} onChange={(e) => setNueva((p) => ({ ...p, costo_ciudad: e.target.value }))} /></Campo>
            <div className="sm:col-span-3">
              <Button size="sm" onClick={agregarGestoria} disabled={agregando}>
                {agregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar gestoría
              </Button>
            </div>
          </div>

          {/* lista de gestorías */}
          {cargandoG ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando gestorías…</div>
          ) : gestorias.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">Aún no hay gestorías. Agrega la primera arriba.</p>
          ) : (
            <div className="space-y-2">
              {gestorias.map((g) => {
                const i = faseIdx(g.fase);
                const dias = diasPara(g.vence);
                const vencido = dias !== null && dias < 0;
                return (
                  <div key={g.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-[color:var(--teal)]" />
                        <span className="text-sm font-medium">{g.documento}</span>
                        {g.rppc && <span className="text-xs text-muted-foreground">· {g.rppc}</span>}
                        {g.folio_real && <span className="text-xs text-muted-foreground">· folio {g.folio_real}</span>}
                      </div>
                      <button className="text-muted-foreground hover:text-red-600" onClick={() => borrarGestoria(g)} title="Quitar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* stepper de fases */}
                    <div className="mt-2 flex items-center gap-1">
                      {FASES.map((f, idx) => (
                        <div key={f.clave} className="flex flex-1 items-center gap-1">
                          <div className={`flex-1 rounded px-2 py-1 text-center text-[11px] ${idx < i ? "bg-emerald-100 text-emerald-800" : idx === i ? "bg-[color:var(--teal)] text-white" : "bg-muted text-muted-foreground"}`}>
                            {f.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>Pago de la fase: <b>{FASES[i].pago}</b></span>
                      {g.vence && (
                        <span className={vencido ? "text-red-600 font-medium" : ""}>
                          <Clock className="mr-1 inline h-3 w-3" />
                          {vencido ? `CLG vencido hace ${Math.abs(dias!)} días` : `CLG vence en ${dias} días (${g.vence})`}
                        </span>
                      )}
                    </div>

                    {/* evidencia + validación DIL en entrega */}
                    {(g.fase === "seguimiento" || g.fase === "entrega" || g.fase === "cerrada") && (
                      <Textarea className="mt-2 min-h-[38px] text-sm" placeholder="Evidencia: pantallas RPPC, recibo del pago, notas…"
                        defaultValue={g.evidencia || ""} onBlur={(e) => { if (e.target.value !== (g.evidencia || "")) patchGestoria(g, { evidencia: e.target.value }); }} />
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {g.fase !== "cerrada" ? (
                        <Button size="sm" variant="outline" onClick={() => avanzarFase(g)}>
                          Avanzar a {FASES[i + 1].label}
                        </Button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Gestoría cerrada</span>
                      )}
                      {(g.fase === "entrega" || g.fase === "cerrada") && (
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={g.validado_dil} onChange={() => patchGestoria(g, { validado_dil: !g.validado_dil })} />
                          Validado por DIL
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <FormatoRPPC caso={caso} dictamen={dictamen} onGuardado={onGuardado} />
    </div>
  );
}

// ---------- piezas ----------
const INP = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

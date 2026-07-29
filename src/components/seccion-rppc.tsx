import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { type Semaforo } from "@/lib/ucp-dictamen";
import { type DictamenRow, type PredFuente } from "@/components/ficha-ucp";
import { FirmasDictamen } from "@/components/firmas-dictamen";
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
  // --- tracto y detalle (mismo nivel que la ficha de URRJ) ---
  fecha_verificacion: string;
  distrito_registral: string;
  p_direccion: string;
  p_fecha_inscripcion: string;
  p_no_escritura: string;
  p_fecha_escritura: string;
  p_titular: string;
  p_notario: string;
  p_superficie: string;
  g_fecha_inscripcion: string;
  g_no_escritura: string;
  g_fecha_escritura: string;
  g_acreedor: string;
  g_notario: string;
  g_monto: string;
}
const REGISTRAL_VACIO = (): Registral => ({
  folio_real: "", propietario: "", prelacion: "", hipoteca_inscrita: "", anotaciones: "", semaforo: "gris", nota: "",
  fecha_verificacion: "", distrito_registral: "",
  p_direccion: "", p_fecha_inscripcion: "", p_no_escritura: "", p_fecha_escritura: "", p_titular: "", p_notario: "", p_superficie: "",
  g_fecha_inscripcion: "", g_no_escritura: "", g_fecha_escritura: "", g_acreedor: "", g_notario: "", g_monto: "",
});

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
    fecha_verificacion: reg?.fecha_verificacion ?? "",
    distrito_registral: reg?.distrito_registral ?? d.estado ?? "",
    p_direccion: reg?.p_direccion ?? d.ubicacion ?? "",
    p_fecha_inscripcion: reg?.p_fecha_inscripcion ?? "",
    p_no_escritura: reg?.p_no_escritura ?? "",
    p_fecha_escritura: reg?.p_fecha_escritura ?? "",
    p_titular: reg?.p_titular ?? reg?.propietario ?? d.propietario ?? "",
    p_notario: reg?.p_notario ?? "",
    p_superficie: reg?.p_superficie ?? "",
    g_fecha_inscripcion: reg?.g_fecha_inscripcion ?? "",
    g_no_escritura: reg?.g_no_escritura ?? "",
    g_fecha_escritura: reg?.g_fecha_escritura ?? "",
    g_acreedor: reg?.g_acreedor ?? "",
    g_notario: reg?.g_notario ?? "",
    g_monto: reg?.g_monto ?? "",
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

      {/* ---------- referencia: lo que ya se llenó en URRJ ---------- */}
      {pred?.datos && (
        <Card className="border-2" style={{ borderColor: "#0C447C33", background: "#0C447C08" }}>
          <CardContent className="space-y-1.5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#0C447C" }}>📎 Referencia — lo ya capturado en URRJ (pre-dictamen)</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
              {pred.datos.folioReal && <p><b className="text-foreground">Folio real:</b> {pred.datos.folioReal}</p>}
              {pred.datos.propietario && <p><b className="text-foreground">Propietario:</b> {pred.datos.propietario}</p>}
              {pred.datos.prelacion && <p><b className="text-foreground">Prelación:</b> {pred.datos.prelacion}</p>}
              {pred.datos.hipotecaInscrita && <p><b className="text-foreground">Hipoteca inscrita:</b> {pred.datos.hipotecaInscrita === "si" ? "Sí" : "No"}</p>}
              {pred.datos.ubicacion && <p><b className="text-foreground">Ubicación:</b> {pred.datos.ubicacion}</p>}
              {pred.datos.estado && <p><b className="text-foreground">Estado:</b> {pred.datos.estado}</p>}
            </div>
            {pred.datos.anotaciones && <p className="mt-1 text-xs italic text-muted-foreground">"{pred.datos.anotaciones}"</p>}
            <p className="pt-1 text-[10px] text-muted-foreground">Ya se copió a los campos de abajo — solo revisa que coincida y agrega lo que falte del RPPC.</p>
          </CardContent>
        </Card>
      )}

      {/* ---------- datos registrales ---------- */}
      <Card className="legal-card border-2" style={{ borderColor: "#0C447C22" }}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4" style={{ color: "#0C447C" }} />
            <p className="text-sm font-semibold">Dictamen registral (RPPC) · UCP</p>
            <Badge variant="outline" className={`ml-auto border ${VER_CLS[ver]}`}>Registral: {ver}</Badge>
          </div>

          {/* cabecera */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Campo label="Fecha de verificación"><Input type="date" value={reg.fecha_verificacion} onChange={(e) => setR("fecha_verificacion", e.target.value)} /></Campo>
            <Campo label="Folio real"><Input value={reg.folio_real} onChange={(e) => setR("folio_real", e.target.value)} /></Campo>
            <Campo label="Distrito registral"><Input value={reg.distrito_registral} onChange={(e) => setR("distrito_registral", e.target.value)} /></Campo>
          </div>

          {/* tracto de propiedad */}
          <p className="pt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#0C447C" }}>Tracto de propiedad</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Campo label="Dirección"><Input value={reg.p_direccion} onChange={(e) => setR("p_direccion", e.target.value)} /></Campo>
            <Campo label="Titular registral"><Input value={reg.p_titular} onChange={(e) => setR("p_titular", e.target.value)} /></Campo>
            <Campo label="Superficie"><Input value={reg.p_superficie} onChange={(e) => setR("p_superficie", e.target.value)} /></Campo>
            <Campo label="No. de escritura"><Input value={reg.p_no_escritura} onChange={(e) => setR("p_no_escritura", e.target.value)} /></Campo>
            <Campo label="Fecha de escritura"><Input type="date" value={reg.p_fecha_escritura} onChange={(e) => setR("p_fecha_escritura", e.target.value)} /></Campo>
            <Campo label="Fecha de inscripción"><Input type="date" value={reg.p_fecha_inscripcion} onChange={(e) => setR("p_fecha_inscripcion", e.target.value)} /></Campo>
            <Campo label="Notario"><Input value={reg.p_notario} onChange={(e) => setR("p_notario", e.target.value)} /></Campo>
            <Campo label="Prelación / grado"><Input value={reg.prelacion} onChange={(e) => setR("prelacion", e.target.value)} /></Campo>
            <Campo label="Propietario registral"><Input value={reg.propietario} onChange={(e) => setR("propietario", e.target.value)} /></Campo>
          </div>

          {/* gravamen */}
          <p className="pt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#0C447C" }}>Gravamen</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Campo label="Acreedor"><Input value={reg.g_acreedor} onChange={(e) => setR("g_acreedor", e.target.value)} /></Campo>
            <Campo label="Monto"><Input value={reg.g_monto} onChange={(e) => setR("g_monto", e.target.value)} /></Campo>
            <Campo label="Notario"><Input value={reg.g_notario} onChange={(e) => setR("g_notario", e.target.value)} /></Campo>
            <Campo label="No. de escritura"><Input value={reg.g_no_escritura} onChange={(e) => setR("g_no_escritura", e.target.value)} /></Campo>
            <Campo label="Fecha de escritura"><Input type="date" value={reg.g_fecha_escritura} onChange={(e) => setR("g_fecha_escritura", e.target.value)} /></Campo>
            <Campo label="Fecha de inscripción"><Input type="date" value={reg.g_fecha_inscripcion} onChange={(e) => setR("g_fecha_inscripcion", e.target.value)} /></Campo>
            <Campo label="¿Hipoteca inscrita y vigente?">
              <div className="flex gap-1">
                {["si", "no"].map((o) => (
                  <button key={o} onClick={() => setR("hipoteca_inscrita", o)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${reg.hipoteca_inscrita === o ? "font-medium" : "border-border text-muted-foreground"}`}
                    style={reg.hipoteca_inscrita === o ? { borderColor: "#0C447C", background: "#0C447C1a", color: "#0C447C" } : undefined}>
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

          <Button size="sm" onClick={guardarRegistral} disabled={guardando} style={{ background: "#0C447C" }}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar registral
          </Button>
        </CardContent>
      </Card>

      <FirmasDictamen
        dictamenId={dictamen.id}
        casoId={caso.id}
        expedienteTexto={caso.expediente || caso.direccion_garantia || "sin expediente"}
        rolValida="UCM"
        firmas={dictamen.firmas as Record<string, any> | null}
        claveElabora="reg_elabora"
        claveValida="reg_ucm"
        tituloElabora="Elabora · dictamen registral"
        tituloValida="Valida · UCM"
        cargoElabora="Abogado / gestor RPPC"
        cargoValida="Unidad de Consolidación Municipal"
        onGuardado={onGuardado}
      />

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

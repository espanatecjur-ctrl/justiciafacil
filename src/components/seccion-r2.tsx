import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import { type Semaforo } from "@/lib/ucp-dictamen";
import { type DictamenRow } from "@/components/ficha-ucp";
import {
  CalendarClock, Save, Loader2, Plus, CheckCircle2, Bot, Hand, Gavel, AlertTriangle, ArrowDownToLine,
} from "lucide-react";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

interface Revision {
  id: string;
  dictamen_id: string | null;
  caso_id: string | null;
  fecha: string | null;
  fuente: string | null;       // 'manual' | 'robot'
  texto: string | null;
  semaforo: string | null;     // verde | amarillo | rojo | gris
  veredicto: string | null;    // 'positivo' | 'seguir' | 'alerta'
  abogado: string | null;
  created_at?: string;
}

interface Acuerdo {
  id: string;
  expediente: string | null;
  juzgado: string | null;
  fecha_acuerdo: string | null;
  tipo_acuerdo: string | null;
  texto: string | null;
  urgente: boolean | null;
  origen?: string | null;
}

const VEREDICTOS = [
  { clave: "positivo", label: "Positivo", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { clave: "seguir",   label: "Seguir en revisión", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  { clave: "alerta",   label: "Alerta", cls: "bg-red-50 text-red-800 border-red-200" },
];
const verCls = (v?: string | null) => VEREDICTOS.find((x) => x.clave === v)?.cls || "bg-muted text-muted-foreground border-border";
const verLabel = (v?: string | null) => VEREDICTOS.find((x) => x.clave === v)?.label || "—";

const SEM_BTN: Record<Semaforo, string> = {
  verde: "bg-emerald-600 text-white", amarillo: "bg-amber-500 text-white",
  naranja: "bg-orange-500 text-white", rojo: "bg-red-600 text-white", gris: "bg-muted",
};
const semDot = (s?: string | null) =>
  s === "rojo" ? "bg-red-500" : s === "amarillo" || s === "naranja" ? "bg-amber-500" : s === "verde" ? "bg-emerald-500" : "bg-muted-foreground";

function hoyISO() { return new Date().toISOString().slice(0, 10); }

interface Props {
  caso: CasoJuridico;
  dictamen: DictamenRow;
  onGuardado: () => void;
}

export function SeccionR2({ caso, dictamen, onGuardado }: Props) {
  const [revs, setRevs] = useState<Revision[]>([]);
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correo, setCorreo] = useState<string | null>(null);

  // formulario de nueva revisión
  const [f, setF] = useState({ fecha: hoyISO(), fuente: "manual", semaforo: "verde" as Semaforo, veredicto: "seguir", texto: "" });
  const setFf = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getAuth().then((a) => a.auth.getSession())
      .then(({ data }: any) => setCorreo(data?.session?.user?.email ?? null)).catch(() => {});
  }, []);

  const cargar = () => {
    setCargando(true);
    const exp = caso.expediente ? encodeURIComponent(caso.expediente) : null;
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/dictamen_seguimiento?select=*&dictamen_id=eq.${dictamen.id}&order=fecha.desc,created_at.desc`, { headers })
        .then((r) => (r.ok ? r.json() : [])),
      exp
        ? fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=id,expediente,juzgado,fecha_acuerdo,tipo_acuerdo,texto,urgente,origen&expediente=eq.${exp}&order=fecha_acuerdo.desc&limit=50`, { headers })
            .then((r) => (r.ok ? r.json() : [])).catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([rv, ac]) => { setRevs(rv); setAcuerdos(ac); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, [dictamen.id, caso.expediente]);

  // estado R2 = veredicto de la última revisión
  const estadoR2 = useMemo(() => revs[0]?.veredicto || null, [revs]);

  const guardarRevision = async () => {
    setGuardando(true); setError(null);
    try {
      const body = {
        dictamen_id: dictamen.id, caso_id: caso.id,
        fecha: f.fecha || hoyISO(), fuente: f.fuente, texto: f.texto || null,
        semaforo: f.semaforo, veredicto: f.veredicto, abogado: correo,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen_seguimiento`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status} — ¿corriste el SQL de la Fase 1?`);
      setF({ fecha: hoyISO(), fuente: "manual", semaforo: "verde", veredicto: "seguir", texto: "" });
      cargar();
      onGuardado();
    } catch (e: any) { setError("No se pudo guardar la revisión: " + e.message); }
    finally { setGuardando(false); }
  };

  const usarAcuerdo = (a: Acuerdo) => {
    const enc = `[${a.fecha_acuerdo || ""}] ${a.tipo_acuerdo || "Acuerdo"}: ${a.texto || ""}`.trim();
    setF((p) => ({ ...p, fuente: "robot", texto: enc }));
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* encabezado R2 */}
      <Card className="legal-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[color:var(--teal)]" />
            <p className="text-sm font-semibold">Seguimiento R2 · revisión mensual del juicio</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{revs.length} revisión(es)</span>
            <Badge variant="outline" className={`border ${verCls(estadoR2)}`}>
              {estadoR2 === "positivo" ? "R2 positivo" : `R2: ${verLabel(estadoR2)}`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* nueva revisión */}
      <Card className="legal-card">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-semibold">Nueva revisión</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Fecha</span>
              <input type="date" className={INP} value={f.fecha} onChange={(e) => setFf("fecha", e.target.value)} />
            </label>
            <div className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Fuente</span>
              <div className="flex gap-1">
                {[{ k: "manual", t: "Manual", I: Hand }, { k: "robot", t: "Robot", I: Bot }].map(({ k, t, I }) => (
                  <button key={k} onClick={() => setFf("fuente", k)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-sm ${f.fuente === k ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-border text-muted-foreground"}`}>
                    <I className="h-3.5 w-3.5" /> {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Semáforo</span>
              <div className="flex gap-1">
                {(["verde", "amarillo", "rojo"] as Semaforo[]).map((s) => (
                  <button key={s} onClick={() => setFf("semaforo", s)}
                    className={`rounded px-3 py-1 text-xs ${f.semaforo === s ? SEM_BTN[s] : "bg-background border border-border text-muted-foreground"}`}>
                    {s === "verde" ? "Verde" : s === "amarillo" ? "Amarillo" : "Rojo"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Veredicto</span>
              <div className="flex flex-wrap gap-1">
                {VEREDICTOS.map((v) => (
                  <button key={v.clave} onClick={() => setFf("veredicto", v.clave)}
                    className={`rounded border px-2 py-1 text-xs ${f.veredicto === v.clave ? v.cls : "bg-background border-border text-muted-foreground"}`}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Textarea className="min-h-[44px] text-sm" placeholder="Qué dijo el boletín / la visita al juzgado…"
            value={f.texto} onChange={(e) => setFf("texto", e.target.value)} />

          <Button size="sm" onClick={guardarRevision} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar revisión
          </Button>
        </CardContent>
      </Card>

      {/* historial de revisiones */}
      <Card className="legal-card">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">Historial de revisiones</p>
          {cargando ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
          ) : revs.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Aún no hay revisiones. Registra la primera arriba.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-4">
              {revs.map((r) => (
                <li key={r.id} className="relative">
                  <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${semDot(r.semaforo)}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.fecha || ""}</span>
                    <Badge variant="outline" className={`border text-[10px] ${verCls(r.veredicto)}`}>{verLabel(r.veredicto)}</Badge>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {r.fuente === "robot" ? <Bot className="h-3 w-3" /> : <Hand className="h-3 w-3" />}{r.fuente}
                    </span>
                    {r.veredicto === "positivo" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                  {r.texto && <p className="mt-0.5 text-xs text-muted-foreground">{r.texto}</p>}
                  {r.abogado && <p className="text-[10px] text-muted-foreground">— {r.abogado}</p>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* acuerdos del juzgado (boletín) */}
      <Card className="legal-card">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-[color:var(--teal)]" />
            <p className="text-sm font-semibold">Acuerdos del juzgado</p>
            <span className="text-xs text-muted-foreground">{caso.expediente ? `exp. ${caso.expediente}` : "sin expediente"}</span>
          </div>
          {!caso.expediente ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Esta garantía no tiene expediente para buscar acuerdos.</p>
          ) : acuerdos.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">El buzón de acuerdos / robot aún no tiene registros para este expediente.</p>
          ) : (
            <div className="space-y-2">
              {acuerdos.map((a) => (
                <div key={a.id} className="rounded-md border border-border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      {a.urgente && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      <span className="font-medium">{a.fecha_acuerdo || "s/f"}</span>
                      <span className="text-muted-foreground">{a.tipo_acuerdo || "Acuerdo"}</span>
                      <Badge variant="outline" className="text-[10px]">{a.origen === "robot" ? "robot" : "manual"}</Badge>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => usarAcuerdo(a)}>
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Usar en revisión
                    </Button>
                  </div>
                  {a.texto && <p className="mt-1 text-xs text-muted-foreground">{a.texto}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const INP = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, StatTile } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import {
  FolderOpen, ChevronDown, ChevronRight, ScrollText, CheckCircle2,
  CircleDashed, Building2, Scale, Loader2, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/ucp")({
  head: () => ({ meta: [{ title: "UCP — SIGA-DIIPA" }] }),
  component: UCP,
});

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ---- Los 7 requisitos de la puerta de entrada a UCP ----
// "predictamen" se da por cumplido al ser elegible (URRJ positivo) y queda bloqueado.
type ClaveReq =
  | "predictamen" | "apartado" | "pago_apartado" | "contrato"
  | "recibo" | "aml" | "pld";

const REQUISITOS: { clave: ClaveReq; label: string; auto?: boolean }[] = [
  { clave: "predictamen", label: "Pre-dictamen URRJ positivo", auto: true },
  { clave: "apartado", label: "Apartado" },
  { clave: "pago_apartado", label: "Validación del pago del apartado" },
  { clave: "contrato", label: "Contrato" },
  { clave: "recibo", label: "Recibo de pago" },
  { clave: "aml", label: "AML" },
  { clave: "pld", label: "PLD" },
];

type Requisitos = Record<ClaveReq, boolean>;
const REQ_VACIOS = (): Requisitos =>
  ({ predictamen: true, apartado: false, pago_apartado: false, contrato: false, recibo: false, aml: false, pld: false });

interface DictamenRow {
  id: string;
  caso_id: string | null;
  predictamen_id: string | null;
  estado: string;
  requisitos: Partial<Requisitos> | null;
  veredicto: string;
  vigente: boolean;
}

interface PredRow { id: string; caso_id: string | null; dictamen_final: string | null; }

// estados del flujo y cómo se ven
const ESTADO_INFO: Record<string, { label: string; cls: string }> = {
  sin_abrir:       { label: "Sin abrir",          cls: "bg-muted text-muted-foreground border-border" },
  requisitos:      { label: "Reuniendo requisitos", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  borrador:        { label: "Lista para dictaminar", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  validacion_dil:  { label: "Validación DIL",      cls: "bg-sky-50 text-sky-800 border-sky-200" },
  contable:        { label: "Relación contable",   cls: "bg-sky-50 text-sky-800 border-sky-200" },
  carta_propuesta: { label: "Carta propuesta",     cls: "bg-sky-50 text-sky-800 border-sky-200" },
  final_firmado:   { label: "Dictamen final (5 firmas)", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  etapa_b:         { label: "Pasó a UCM (Etapa B)", cls: "bg-indigo-50 text-indigo-800 border-indigo-200" },
};

function reqCompletos(r: Requisitos): boolean {
  return REQUISITOS.every((x) => r[x.clave]);
}
function reqCuenta(r: Requisitos): number {
  return REQUISITOS.filter((x) => r[x.clave]).length;
}

function UCP() {
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [preds, setPreds] = useState<PredRow[]>([]);
  const [dicts, setDicts] = useState<DictamenRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [abierto, setAbierto] = useState<string | null>(null); // caso_id expandido
  const [edicion, setEdicion] = useState<Record<string, Requisitos>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    setError(null);
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&order=expediente.asc`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`casos ${r.status}`)))),
      fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,caso_id,dictamen_final&vigente=eq.true&dictamen_final=eq.POSITIVO`, { headers })
        .then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=id,caso_id,predictamen_id,estado,requisitos,veredicto,vigente&vigente=eq.true`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`dictamen ${r.status} — ¿corriste el SQL?`)))),
    ])
      .then(([c, p, d]) => { setCasos(c); setPreds(p); setDicts(d); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  // caso_id -> pre-dictamen positivo (define elegibilidad)
  const predPorCaso = useMemo(() => {
    const m: Record<string, PredRow> = {};
    for (const p of preds) if (p.caso_id) m[p.caso_id] = p;
    return m;
  }, [preds]);

  // caso_id -> dictamen vigente
  const dictPorCaso = useMemo(() => {
    const m: Record<string, DictamenRow> = {};
    for (const d of dicts) if (d.caso_id) m[d.caso_id] = d;
    return m;
  }, [dicts]);

  // casos elegibles = los que tienen un pre-dictamen URRJ positivo vigente
  const elegibles = useMemo(
    () => casos.filter((c) => c.id && predPorCaso[c.id]),
    [casos, predPorCaso],
  );

  const stats = useMemo(() => {
    let sinAbrir = 0, enReq = 0, listos = 0;
    for (const c of elegibles) {
      const d = dictPorCaso[c.id];
      if (!d) { sinAbrir++; continue; }
      const r = { ...REQ_VACIOS(), ...(d.requisitos || {}) };
      if (reqCompletos(r)) listos++; else enReq++;
    }
    return { total: elegibles.length, sinAbrir, enReq, listos };
  }, [elegibles, dictPorCaso]);

  const reqDe = (casoId: string): Requisitos => {
    if (edicion[casoId]) return edicion[casoId];
    const d = dictPorCaso[casoId];
    return { ...REQ_VACIOS(), ...(d?.requisitos || {}) };
  };

  const toggleReq = (casoId: string, clave: ClaveReq) => {
    const base = reqDe(casoId);
    if (REQUISITOS.find((x) => x.clave === clave)?.auto) return; // bloqueado
    setEdicion((p) => ({ ...p, [casoId]: { ...base, [clave]: !base[clave] } }));
  };

  // Crear el dictamen (estado 'requisitos') para un caso elegible
  const abrirDictamen = async (c: CasoJuridico) => {
    setGuardandoId(c.id);
    setError(null);
    try {
      const body = {
        caso_id: c.id,
        predictamen_id: predPorCaso[c.id]?.id ?? null,
        estado: "requisitos",
        requisitos: REQ_VACIOS(),
        veredicto: "PENDIENTE",
        vigente: true,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen`, {
        method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setAbierto(c.id);
      cargar();
    } catch (e: any) {
      setError("No se pudo abrir el dictamen: " + e.message);
    } finally {
      setGuardandoId(null);
    }
  };

  // Guardar los requisitos marcados; si están los 7, el estado pasa a 'borrador'
  const guardarRequisitos = async (casoId: string) => {
    const d = dictPorCaso[casoId];
    if (!d) return;
    const r = reqDe(casoId);
    setGuardandoId(casoId);
    setError(null);
    try {
      const estado = reqCompletos(r) ? "borrador" : "requisitos";
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${d.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ requisitos: r, estado, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setEdicion((p) => { const n = { ...p }; delete n[casoId]; return n; });
      cargar();
    } catch (e: any) {
      setError("No se pudo guardar: " + e.message);
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Jurídico · Dictaminación"
        title="UCP — Unidad de Comité de Procedimientos"
        description="Bandeja de casos vendidos con pre-dictamen positivo. Aquí se reúnen los requisitos de entrada y se abre el dictamen jurídico y registral."
        actions={
          <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
            <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Casos elegibles" value={stats.total} tone="teal" hint="Con pre-dictamen URRJ positivo" />
        <StatTile label="Sin abrir" value={stats.sinAbrir} />
        <StatTile label="Reuniendo requisitos" value={stats.enReq} tone="warning" />
        <StatTile label="Listos para dictaminar" value={stats.listos} tone="legal" />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {cargando ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando casos…
        </div>
      ) : elegibles.length === 0 ? (
        <Card className="legal-card">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <FolderOpen className="h-7 w-7 text-[color:var(--teal)]" />
            <p>No hay casos elegibles todavía.</p>
            <p className="text-xs">Un caso aparece aquí cuando su pre-dictamen URRJ vigente quedó marcado como <b>POSITIVO</b>.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {elegibles.map((c) => {
            const d = dictPorCaso[c.id];
            const r = reqDe(c.id);
            const estadoKey = d ? (reqCompletos(r) ? "borrador" : d.estado) : "sin_abrir";
            const info = ESTADO_INFO[estadoKey] || ESTADO_INFO.sin_abrir;
            const exp = abierto === c.id;
            const completos = reqCompletos(r);
            const dirty = !!edicion[c.id];

            return (
              <Card key={c.id} className="legal-card overflow-hidden">
                <CardContent className="p-0">
                  {/* cabecera del caso */}
                  <button
                    className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/40"
                    onClick={() => setAbierto(exp ? null : c.id)}
                  >
                    <span className="mt-0.5 text-muted-foreground">
                      {exp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold">
                          {c.expediente || "Sin expediente"}
                        </span>
                        <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                          <Scale className="h-3 w-3" /> URRJ POSITIVO
                        </Badge>
                        <Badge variant="outline" className={`border ${info.cls}`}>{info.label}</Badge>
                      </div>
                      <div className="mt-1 grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 shrink-0" /> {c.direccion_garantia || "Garantía s/dirección"}
                        </span>
                        <span>{c.juzgado || "Juzgado s/dato"}</span>
                        <span>{c.cliente_nombre || c.cliente_codigo || "Cliente s/dato"}</span>
                        <span>{c.entidad || ""} {c.materia ? `· ${c.materia}` : ""}</span>
                      </div>
                    </div>
                    {d && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {reqCuenta(r)}/7
                      </span>
                    )}
                  </button>

                  {/* detalle: requisitos */}
                  {exp && (
                    <div className="border-t border-border bg-muted/20 p-4">
                      {!d ? (
                        <div className="flex flex-col items-start gap-3">
                          <p className="text-sm text-muted-foreground">
                            Este caso aún no tiene dictamen abierto. Al abrirlo se crea el expediente de
                            dictaminación y podrás ir marcando los 7 requisitos de entrada.
                          </p>
                          <Button size="sm" onClick={() => abrirDictamen(c)} disabled={guardandoId === c.id}>
                            {guardandoId === c.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <ScrollText className="h-4 w-4" />}
                            Abrir dictamen
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--teal)]">
                            Puerta de entrada · 7 requisitos
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {REQUISITOS.map((req) => {
                              const on = r[req.clave];
                              return (
                                <label
                                  key={req.clave}
                                  className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                                    req.auto ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-background"
                                  } ${req.auto ? "" : "cursor-pointer"}`}
                                >
                                  <Checkbox
                                    checked={on}
                                    disabled={!!req.auto}
                                    onCheckedChange={() => toggleReq(c.id, req.clave)}
                                  />
                                  <span className={on ? "" : "text-muted-foreground"}>{req.label}</span>
                                  {req.auto && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />}
                                </label>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => guardarRequisitos(c.id)}
                              disabled={guardandoId === c.id || !dirty}
                            >
                              {guardandoId === c.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <CheckCircle2 className="h-4 w-4" />}
                              Guardar requisitos
                            </Button>

                            {completos ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" /> Requisitos completos — listo para el dictamen
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CircleDashed className="h-4 w-4" /> Faltan {7 - reqCuenta(r)} requisito(s)
                              </span>
                            )}
                          </div>

                          <div className="border-t border-border pt-3">
                            <Button size="sm" variant="outline" disabled title="Disponible en la Fase 2">
                              <ScrollText className="h-4 w-4" /> Continuar al dictamen jurídico
                            </Button>
                            <span className="ml-2 text-xs text-muted-foreground">Próxima fase</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

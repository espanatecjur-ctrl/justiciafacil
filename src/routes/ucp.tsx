import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, StatTile } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle,
} from "@/components/ui/dialog";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import {
  FichaUCP, REQ_VACIOS, reqCompletos, reqCuenta,
  type Requisitos, type DictamenRow, type PredFuente,
} from "@/components/ficha-ucp";
import {
  Plus, RefreshCw, Loader2, Scale, Landmark, FileStack, Search, FolderOpen,
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

interface PredRow { id: string; caso_id: string | null; dictamen_final: string | null; datos: any; resultados: any; }

const ESTADO_INFO: Record<string, { label: string; cls: string }> = {
  sin_abrir:       { label: "Sin abrir",            cls: "bg-muted text-muted-foreground border-border" },
  requisitos:      { label: "Reuniendo requisitos", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  borrador:        { label: "Lista para dictaminar",cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  etapa_b:         { label: "Etapa B (UCM)",        cls: "bg-indigo-50 text-indigo-800 border-indigo-200" },
};
const VEREDICTO_CLS: Record<string, string> = {
  POSITIVO:       "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONDICIONADO:   "bg-amber-50 text-amber-800 border-amber-200",
  NEGATIVO:       "bg-red-50 text-red-800 border-red-200",
  "FALTAN DATOS": "bg-muted text-muted-foreground border-border",
  PENDIENTE:      "bg-muted text-muted-foreground border-border",
};

// ---- Área actual (a qué unidad pertenece / quién la lleva hoy) ----
const AREA_INFO: Record<string, string> = {
  UCP:  "bg-[color:var(--teal)]/10 text-[color:var(--teal)] border-[color:var(--teal)]/30",
  UCM:  "bg-indigo-50 text-indigo-800 border-indigo-200",
  UDP:  "bg-purple-50 text-purple-800 border-purple-200",
  URRJ: "bg-sky-50 text-sky-800 border-sky-200",
};
function normArea(u?: string | null): string {
  const s = (u || "").toUpperCase();
  if (s.includes("UDP")) return "UDP";
  if (s.includes("UCM")) return "UCM";
  if (s.includes("URRJ")) return "URRJ";
  if (s.includes("UCP")) return "UCP";
  return s.trim();
}
function areaActual(c: CasoJuridico, d?: DictamenRow): string {
  if (d?.estado === "etapa_b") return "UCM";
  const a = normArea(c.unidad);
  return (a && a !== "UCP") ? a : "UCM";
}

const PAGE = 25;

interface Seleccion { caso: CasoJuridico; dictamen: DictamenRow; pred?: PredFuente; tab: "requisitos" | "juridico" | "rppc"; }

function UCP() {
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [preds, setPreds] = useState<PredRow[]>([]);
  const [dicts, setDicts] = useState<DictamenRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<"dictaminables" | "todas">("dictaminables");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  // alta de garantía (folios capturados a mano; después se conectan a SIGA)
  const [dlg, setDlg] = useState(false);
  const [nueva, setNueva] = useState({ expediente: "", no_credito: "", gar_id: "", direccion_garantia: "", juzgado: "", entidad: "", cliente_nombre: "", cliente_codigo: "", materia: "" });
  const [guardandoAlta, setGuardandoAlta] = useState(false);

  const cargar = () => {
    setCargando(true); setError(null);
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&order=expediente.asc`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`casos ${r.status}`)))),
      fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,caso_id,dictamen_final,datos,resultados&vigente=eq.true&dictamen_final=eq.POSITIVO`, { headers })
        .then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=id,caso_id,predictamen_id,estado,requisitos,juridico,registral,contable,firmas,rppc,veredicto,vigente&vigente=eq.true`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`dictamen ${r.status} — ¿corriste el SQL?`)))),
    ])
      .then(([c, p, d]) => { setCasos(c); setPreds(p); setDicts(d); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const predPorCaso = useMemo(() => {
    const m: Record<string, PredRow> = {};
    for (const p of preds) if (p.caso_id) m[p.caso_id] = p;
    return m;
  }, [preds]);

  const dictPorCaso = useMemo(() => {
    const m: Record<string, DictamenRow> = {};
    for (const d of dicts) if (d.caso_id) m[d.caso_id] = d;
    return m;
  }, [dicts]);

  const reqDe = (casoId: string): Requisitos => {
    const d = dictPorCaso[casoId];
    return { ...REQ_VACIOS(), ...(d?.requisitos || {}) };
  };

  const baseUCP = useMemo(() => casos.filter((c) => normArea(c.unidad) !== "UDP"), [casos]);

  const stats = useMemo(() => {
    const elegibles = baseUCP.filter((c) => c.id && predPorCaso[c.id]);
    let sinAbrir = 0, enReq = 0, listos = 0;
    for (const c of elegibles) {
      const d = dictPorCaso[c.id];
      if (!d) { sinAbrir++; continue; }
      reqCompletos(reqDe(c.id)) ? listos++ : enReq++;
    }
    return { total: elegibles.length, sinAbrir, enReq, listos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUCP, predPorCaso, dictPorCaso]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return baseUCP.filter((c) => {
      if (modo === "dictaminables" && !(c.id && predPorCaso[c.id])) return false;
      if (!q) return true;
      return [c.expediente, c.cliente_nombre, c.direccion_garantia, c.juzgado]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [baseUCP, predPorCaso, modo, busca]);

  const totalPag = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const visibles = filtrados.slice(pag * PAGE, pag * PAGE + PAGE);

  const ensureDictamen = async (c: CasoJuridico): Promise<DictamenRow | null> => {
    const ya = dictPorCaso[c.id];
    if (ya) return ya;
    const body = {
      caso_id: c.id, predictamen_id: predPorCaso[c.id]?.id ?? null,
      estado: "requisitos", requisitos: REQ_VACIOS(), veredicto: "PENDIENTE", vigente: true,
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen`, {
      method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const data = await res.json();
    return data?.[0] ?? null;
  };

  const abrir = async (c: CasoJuridico, tab: Seleccion["tab"]) => {
    setAbriendo(c.id); setError(null);
    try {
      const d = await ensureDictamen(c);
      if (!d) throw new Error("sin dictamen");
      const pr = predPorCaso[c.id];
      setSeleccion({ caso: c, dictamen: d, pred: pr ? { datos: pr.datos, resultados: pr.resultados } : undefined, tab });
      cargar();
    } catch (e: any) {
      setError("No se pudo abrir: " + e.message);
    } finally { setAbriendo(null); }
  };

  const agregarGarantia = async () => {
    if (!nueva.expediente.trim() && !nueva.direccion_garantia.trim()) {
      setError("Pon al menos el expediente o la dirección de la garantía."); return;
    }
    setGuardandoAlta(true); setError(null);
    try {
      // Limpia los campos vacíos para no mandar cadenas en blanco a columnas que no aplican
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(nueva)) {
        const val = (v || "").trim();
        if (val) payload[k] = val;
      }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico`, {
        method: "POST", headers, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status} — revisa el permiso de inserción en caso_juridico`);
      setDlg(false);
      setNueva({ expediente: "", no_credito: "", gar_id: "", direccion_garantia: "", juzgado: "", entidad: "", cliente_nombre: "", cliente_codigo: "", materia: "" });
      cargar();
    } catch (e: any) {
      setError("No se pudo agregar la garantía: " + e.message);
    } finally { setGuardandoAlta(false); }
  };

  // ----- vista de ficha -----
  if (seleccion) {
    return (
      <FichaUCP
        caso={seleccion.caso}
        dictamen={seleccion.dictamen}
        pred={seleccion.pred}
        tabInicial={seleccion.tab}
        onVolver={() => setSeleccion(null)}
        onGuardado={cargar}
      />
    );
  }

  // ----- registro -----
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Jurídico · Dictaminación"
        title="UCP — Unidad de Consolidación Patrimonial"
        description="Registro de garantías. Reúne los 7 requisitos de entrada y dictamina cada garantía en sus dos vías: Jurídico y RPPC."
        actions={
          <>
            <Dialog open={dlg} onOpenChange={setDlg}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4" /> Agregar garantía</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Agregar garantía al registro</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  {([
                    ["expediente", "Expediente"],
                    ["no_credito", "No. de crédito"],
                    ["gar_id", "ID garantía / folio (de SIGA)"],
                    ["direccion_garantia", "Dirección de la garantía"],
                    ["juzgado", "Juzgado"], ["entidad", "Estado / entidad"],
                    ["cliente_nombre", "Cliente"],
                    ["cliente_codigo", "Folio del cliente (de SIGA)"],
                    ["materia", "Materia"],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="block text-sm">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
                      <Input value={(nueva as any)[k]} onChange={(e) => setNueva((p) => ({ ...p, [k]: e.target.value }))} />
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Los folios (garantía y cliente) hoy se capturan a mano; más adelante se conectarán con SIGA.
                    La garantía nueva entra al registro; para dictaminarla en UCP primero necesita su pre-dictamen URRJ positivo.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDlg(false)}>Cancelar</Button>
                  <Button onClick={agregarGarantia} disabled={guardandoAlta}>
                    {guardandoAlta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={cargar} disabled={cargando}>
              <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} /> Actualizar
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Garantías dictaminables" value={stats.total} tone="teal" hint="Con pre-dictamen URRJ positivo" />
        <StatTile label="Sin abrir" value={stats.sinAbrir} />
        <StatTile label="Reuniendo requisitos" value={stats.enReq} tone="warning" />
        <StatTile label="Listas para dictaminar" value={stats.listos} tone="legal" />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por expediente, cliente, garantía o juzgado…"
            value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} />
        </div>
        {(["dictaminables", "todas"] as const).map((m) => (
          <button key={m} onClick={() => { setModo(m); setPagina(0); }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${modo === m ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground"}`}>
            {m === "dictaminables" ? "Dictaminables" : "Todas"}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando garantías…
        </div>
      ) : visibles.length === 0 ? (
        <Card className="legal-card">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <FolderOpen className="h-7 w-7 text-[color:var(--teal)]" />
            <p>{modo === "dictaminables" ? "No hay garantías con pre-dictamen positivo todavía." : "No hay garantías que coincidan."}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="legal-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expediente</TableHead>
                  <TableHead>Garantía</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Área actual</TableHead>
                  <TableHead>Pre-dictamen</TableHead>
                  <TableHead>Requisitos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((c) => {
                  const elegible = !!(c.id && predPorCaso[c.id]);
                  const d = dictPorCaso[c.id];
                  const r = reqDe(c.id);
                  const reqOK = !!d && reqCompletos(r);
                  const estadoKey = !d ? "sin_abrir" : d.estado === "etapa_b" ? "etapa_b" : (reqCompletos(r) ? "borrador" : "requisitos");
                  const info = ESTADO_INFO[estadoKey];
                  const ver = d?.veredicto || "PENDIENTE";
                  const cargandoFila = abriendo === c.id;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.expediente || "—"}<div className="text-xs font-normal text-muted-foreground">{c.juzgado || ""}</div></TableCell>
                      <TableCell className="max-w-[200px] text-xs">{c.direccion_garantia || "—"}<div className="text-muted-foreground">{c.entidad || ""}</div></TableCell>
                      <TableCell className="text-xs">{c.cliente_nombre || c.cliente_codigo || "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const a = areaActual(c, d);
                          return (
                            <div className="flex flex-col">
                              <Badge variant="outline" className={`w-fit border ${AREA_INFO[a] || "bg-muted text-muted-foreground border-border"}`}>
                                {a || "—"}{d?.estado === "etapa_b" ? " · antecedente" : ""}
                              </Badge>
                              {c.encargado_unidad && <span className="mt-0.5 text-[10px] text-muted-foreground">{c.encargado_unidad}</span>}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {elegible
                          ? <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"><Scale className="h-3 w-3" /> POSITIVO</Badge>
                          : <span className="text-xs text-muted-foreground">Pendiente URRJ</span>}
                      </TableCell>
                      <TableCell className="text-xs">{d ? `${reqCuenta(r)}/7` : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {info && <Badge variant="outline" className={`border ${info.cls} w-fit`}>{info.label}</Badge>}
                          {d && <Badge variant="outline" className={`border ${VEREDICTO_CLS[ver] || ""} w-fit text-[10px]`}>{ver}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" disabled={cargandoFila} onClick={() => abrir(c, "requisitos")}>
                            {cargandoFila ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />} Abrir
                          </Button>
                          <Button size="sm" variant="outline" disabled={!elegible || !reqOK || cargandoFila}
                            title={!elegible ? "Requiere pre-dictamen URRJ positivo" : !reqOK ? "Faltan requisitos de entrada" : ""}
                            onClick={() => abrir(c, "juridico")}>
                            <Scale className="h-4 w-4" /> Jurídico
                          </Button>
                          <Button size="sm" variant="outline" disabled={!elegible || !reqOK || cargandoFila}
                            title={!elegible ? "Requiere pre-dictamen URRJ positivo" : !reqOK ? "Faltan requisitos de entrada" : ""}
                            onClick={() => abrir(c, "rppc")}>
                            <Landmark className="h-4 w-4" /> RPPC
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {filtrados.length > PAGE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtrados.length} garantías · página {pag + 1} de {totalPag}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pag === 0} onClick={() => setPagina(pag - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={pag >= totalPag - 1} onClick={() => setPagina(pag + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}

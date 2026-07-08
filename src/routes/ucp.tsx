import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { correoActual } from "@/lib/auth";
import { cargarPermisosModulo, puedeAccion } from "@/lib/permisos-acciones";
import { diasSinAvanceLote, DIAS_ALERTA } from "@/lib/alerta-avance";
import {
  FichaUCP, REQ_VACIOS, reqCompletos, reqCuenta,
  type Requisitos, type DictamenRow, type PredFuente,
} from "@/components/ficha-ucp";
import {
  Plus, RefreshCw, Loader2, Scale, Landmark, FileStack, Search, FolderOpen, Eye,
  MoreVertical, UserCheck, Upload, CheckCircle2, FileText,
  Trash2, Copy, Send,
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
  if (d?.estado === "etapa_b") return "UCM"; // ya pasó a Fase B → UCM
  const a = normArea(c.unidad);
  return a || "UCP"; // entrada / por defecto → UCP
}

const PAGE = 25;

// Cuenta cuántas de las 5 firmas del dictamen final ya están puestas.
const SLOTS_UCP = ["elabora", "dil", "gad", "dgc", "dge"];
function firmasUCP(d: any): number {
  const f = d?.firmas || {};
  return SLOTS_UCP.filter((k) => f?.[k]?.fecha).length;
}

interface Seleccion { caso: CasoJuridico; dictamen: DictamenRow; pred?: PredFuente; tab: "requisitos" | "juridico" | "rppc"; }

function UCP() {
  const navigate = useNavigate();
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [diasAvance, setDiasAvance] = useState<Record<string, number>>({});
  const [preds, setPreds] = useState<PredRow[]>([]);
  const [dicts, setDicts] = useState<DictamenRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permUCP, setPermUCP] = useState<string[]>([]);
  const [miCorreo, setMiCorreo] = useState<string>("");
  useEffect(() => { cargarPermisosModulo("ucp").then((p) => setPermUCP(p.acciones)).catch(() => {}); }, []);
  useEffect(() => { correoActual().then((c) => setMiCorreo(c || "")).catch(() => {}); }, []);
  const puedo = (a: string) => puedeAccion(permUCP, a);

  const [modo, setModo] = useState<"dictaminables" | "todas" | "recientes">("dictaminables");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  // menú de 3 puntitos por fila
  const [menuUCP, setMenuUCP] = useState<{ id: string; x: number; y: number } | null>(null);

  // resolución de garantías repetidas (mini banner: conservar todas o eliminar, con motivo)
  const [dupModal, setDupModal] = useState<string[] | null>(null);        // ids del grupo de repetidas
  const [dupDecision, setDupDecision] = useState<Record<string, "conservar" | "eliminar">>({});
  const [dupNota, setDupNota] = useState("");
  const [guardandoDup, setGuardandoDup] = useState(false);

  // alta de garantía (folios capturados a mano; después se conectan a SIGA)
  const [dlg, setDlg] = useState(false);
  const [nueva, setNueva] = useState({ expediente: "", no_credito: "", gar_id: "", direccion_garantia: "", juzgado: "", entidad: "", cliente_nombre: "", cliente_codigo: "", materia: "" });
  const [guardandoAlta, setGuardandoAlta] = useState(false);

  // escoger de URRJ + juicio/derecho de crédito
  const [buscaURRJ, setBuscaURRJ] = useState("");
  const [buscandoURRJ, setBuscandoURRJ] = useState(false);
  const [buscoURRJ, setBuscoURRJ] = useState(false);
  const [resultURRJ, setResultURRJ] = useState<any[]>([]);
  const [sinJuicio, setSinJuicio] = useState(false);
  const [motivoSinJuicio, setMotivoSinJuicio] = useState("");

  // busca garantías que ya pasaron por URRJ (pre-dictámenes)
  const buscarEnURRJ = async () => {
    if (buscaURRJ.trim().length < 2) return;
    setBuscandoURRJ(true); setBuscoURRJ(true);
    try {
      const enc = encodeURIComponent(`%${buscaURRJ.trim()}%`);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,folio,expediente,direccion_garantia,dictamen_final,datos&or=(expediente.ilike.${enc},folio.ilike.${enc})&en_papelera=eq.false&limit=15`, { headers });
      setResultURRJ(r.ok ? await r.json() : []);
    } catch { setResultURRJ([]); }
    setBuscandoURRJ(false);
  };

  // toma una garantía de URRJ y precarga el formulario
  const tomarDeURRJ = (u: any) => {
    setNueva((p) => ({
      ...p,
      expediente: u.expediente || p.expediente,
      gar_id: u.datos?.gar_id || p.gar_id,
      direccion_garantia: u.direccion_garantia || u.datos?.ubicacion || p.direccion_garantia,
    }));
    setResultURRJ([]); setBuscaURRJ("");
  };

  const cargar = () => {
    setCargando(true); setError(null);
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&order=expediente.asc`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`casos ${r.status}`)))),
      fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,caso_id,dictamen_final,pasa_a_ucp,datos,resultados&vigente=eq.true&pasa_a_ucp=eq.true`, { headers })
        .then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=id,caso_id,predictamen_id,estado,requisitos,juridico,registral,contable,firmas,rppc,veredicto,vigente&vigente=eq.true`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`dictamen ${r.status} — ¿corriste el SQL?`)))),
    ])
      .then(([c, p, d]) => {
        setCasos(c); setPreds(p); setDicts(d);
        const ids = (c as CasoJuridico[]).map((x) => x.id).filter(Boolean) as string[];
        diasSinAvanceLote(ids).then(setDiasAvance).catch(() => {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-menu-ucp]")) return;
      setMenuUCP(null);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

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

  const darPorTerminado = async (c: CasoJuridico) => {
    if (!confirm(`¿Dar por TERMINADO el expediente ${c.expediente || "(sin expediente)"}?\n\nSe marca como terminado y se queda en su área (no se mueve a otra).`)) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ terminado: true }),
      });
      cargar();
    } catch { alert("No se pudo marcar como terminado."); }
  };
  
  const moverPapelera = async (c: CasoJuridico) => {
    if (!confirm(`¿Mover a la papelera el expediente ${c.expediente || "(sin expediente)"}?\n\nSale de la lista de UCP. Se puede recuperar después.`)) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ archivado: true }),
      });
      cargar();
    } catch { alert("No se pudo mover a la papelera."); }
  };

  // Mandar a UCM (seguimiento de juicio): crea la copia ligada vía la función mandar_a_ucm.
  const mandarAUcm = async (c: CasoJuridico) => {
    if (c.origen_ucp_id) { alert("Este registro ya es de UCM (seguimiento)."); return; }

    // 1) ¿ya existe esta garantía en UCM? (cualquier coincidencia: crédito, garantía, dirección, expediente o cliente)
    const nz = (s: any) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const PH = new Set(["sinnmerodecrdito", "sinnumerodecredito", "compraaterceros", "nolitigable", "sincliente", "sincredito", "deprueba", "enespera", "espera", "notiene", "na", "sn"]);
    const nCred = nz(c.no_credito), nGar = nz((c as any).gar_id), nDir = nz(c.direccion_garantia), nCli = nz(c.cliente_nombre), nExp = nz(c.expediente);
    const existente = casos.find((x) => {
      if (x.id === c.id) return false;
      if (!x.pasa_a_ucm && !x.origen_ucp_id) return false; // solo lo que ya está en UCM
      const xCred = nz((x as any).no_credito);
      if (nCred && xCred && !PH.has(nCred) && xCred === nCred) return true;
      if (nGar && nz((x as any).gar_id) === nGar) return true;
      if (nDir.length >= 8 && nz(x.direccion_garantia) === nDir) return true;
      if (nExp.length >= 3 && nz(x.expediente) === nExp) return true;
      if (nCli.length >= 4 && nExp.length >= 3 && nz(x.cliente_nombre) === nCli && nz(x.expediente) === nExp) return true;
      return false;
    });

    if (existente) {
      if (!confirm(`Esta garantía (crédito ${c.no_credito || "s/c"}) YA está en UCM:\n\n${existente.expediente || "s/exp"} · ${existente.cliente_nombre || "s/cliente"}\n\nNo se crea copia. ¿Vincularla y marcarla PENDIENTE DE FORMALIZACIÓN?`)) return;
      try {
        const body: any = { estado_ucm: "pendiente_formalizacion", pasa_a_ucm: true };
        if (!existente.origen_ucp_id) body.origen_ucp_id = c.id; // conectar al original de UCP
        const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${existente.id}`, {
          method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`Supabase ${r.status}`);
        cargar();
        navigate({ to: "/ucm-ficha", search: { id: existente.id } as any });
      } catch (e: any) { alert("No se pudo vincular: " + e.message); }
      return;
    }

    // 2) no existe -> crear nueva con indicador PENDIENTE DE FORMALIZACIÓN
    if (!confirm(`¿Mandar a UCM (seguimiento de juicio) el expediente ${c.expediente || "(sin expediente)"}?\n\nSe crea su ficha como PENDIENTE DE FORMALIZACIÓN, con copia de sus sub-juicios y documentos.\nLo que cambies en UCM NO regresa a UCP.`)) return;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mandar_a_ucm`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ p_caso_id: c.id }),
      });
      if (!r.ok) throw new Error(`Supabase ${r.status} — revisa que la función mandar_a_ucm exista`);
      const nuevoId = await r.json();
      cargar();
      if (typeof nuevoId === "string" && confirm("Listo: ya está en UCM como pendiente de formalización.\n\n¿Abrir su ficha de UCM ahora?")) {
        navigate({ to: "/ucm-ficha", search: { id: nuevoId } as any });
      }
    } catch (e: any) {
      alert("No se pudo mandar a UCM: " + e.message);
    }
  };
  // Sirve para detectar garantías reasignadas, clientes con varios juicios o cambios de garantía.
  const dupInfo = useMemo(() => {
    const norm = (s: any) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const buckets: Record<string, string[]> = {};
    const push = (key: string, id: string) => { (buckets[key] ||= []).push(id); };
    for (const c of casos) {
      if (!c.id || c.archivado) continue; // las que ya se movieron a papelera no cuentan como repetidas
      const g = norm((c as any).gar_id); if (g.length >= 3) push("g:" + g, c.id);
      const dir = norm(c.direccion_garantia); if (dir.length >= 6) push("d:" + dir, c.id);
      const exp = norm(c.expediente); if (exp.length >= 3) push("e:" + exp, c.id);
      const cli = c.cliente_id ? "id:" + c.cliente_id : norm(c.cliente_nombre); if (cli.length >= 3) push("c:" + cli, c.id);
    }
    const rel: Record<string, Set<string>> = {};
    for (const key in buckets) {
      const ids = buckets[key];
      if (ids.length > 1) for (const id of ids) { const s = (rel[id] ||= new Set<string>()); for (const o of ids) if (o !== id) s.add(o); }
    }
    const cuenta: Record<string, number> = {};
    const grupo: Record<string, string[]> = {};
    for (const id in rel) { cuenta[id] = rel[id].size; grupo[id] = Array.from(rel[id]); }
    return { cuenta, grupo };
  }, [casos]);
  const coincidencias = dupInfo.cuenta;
  const dupGrupo = dupInfo.grupo;

  // abre el mini banner de resolución para el grupo de repetidas de este caso
  const abrirDup = (c: CasoJuridico) => {
    const ids = Array.from(new Set([c.id, ...(dupGrupo[c.id] || [])])).filter(Boolean) as string[];
    const dec: Record<string, "conservar" | "eliminar"> = {};
    for (const id of ids) dec[id] = "conservar";
    // si ya hay una resolución previa, la precargamos
    for (const id of ids) {
      const prev = (casos.find((x) => x.id === id) as any)?.dup_resolucion;
      if (prev?.estado) dec[id] = prev.estado;
    }
    const notaPrev = (c as any).dup_resolucion?.nota || "";
    setDupDecision(dec);
    setDupNota(notaPrev);
    setDupModal(ids);
  };

  const guardarDup = async () => {
    if (!dupModal) return;
    if (!dupNota.trim()) { alert("Escribe el motivo: por qué se quedan las dos o por qué se elimina una."); return; }
    const aEliminar = dupModal.filter((id) => dupDecision[id] === "eliminar");
    if (aEliminar.length && !puedo("papelera")) { alert("Tu rol no tiene permiso para eliminar (mover a papelera)."); return; }
    if (aEliminar.length >= dupModal.length) { alert("No puedes eliminar todas. Debe quedar al menos una garantía."); return; }
    setGuardandoDup(true);
    const fecha = new Date().toISOString();
    const por = miCorreo || "—";
    try {
      for (const id of dupModal) {
        const estado = dupDecision[id];
        const body: any = { dup_resolucion: { estado, nota: dupNota.trim(), fecha, por } };
        if (estado === "eliminar") body.archivado = true; // se va a la papelera con su motivo registrado
        await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setDupModal(null);
      cargar();
    } catch { alert("No se pudo guardar la decisión."); }
    finally { setGuardandoDup(false); }
  };

  const baseUCP = useMemo(() => casos.filter((c) => normArea(c.unidad) !== "UDP" && !c.archivado), [casos]);

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
    let lista = baseUCP.filter((c) => {
      if (modo === "dictaminables" && !(c.id && predPorCaso[c.id])) return false;
      if (modo === "recientes" && dictPorCaso[c.id]?.estado === "etapa_b") return false; // las que ya están en UCM no
      if (!q) return true;
      return [c.expediente, c.cliente_nombre, c.direccion_garantia, c.juzgado, (c as any).gar_id, (c as any).no_credito, c.cliente_codigo]
        .some((v) => (v || "").toString().toLowerCase().includes(q));
    });
    if (modo === "recientes") {
      lista = [...lista].sort((a, b) => String((b as any).created_at || "").localeCompare(String((a as any).created_at || "")));
    }
    // UCM al final (orden estable: respeta el orden previo dentro de cada grupo)
    lista = [...lista].sort((a, b) => {
      const ua = areaActual(a, dictPorCaso[a.id]) === "UCM" ? 1 : 0;
      const ub = areaActual(b, dictPorCaso[b.id]) === "UCM" ? 1 : 0;
      return ua - ub;
    });
    return lista;
  }, [baseUCP, predPorCaso, dictPorCaso, modo, busca]);

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

    // Aviso anti-duplicado: si coincide en algo (crédito, dirección o cliente+expediente) con algo que ya existe, preguntar.
    const nz = (s: any) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const PLACEHOLDER = new Set(["sinnmerodecrdito", "sinnumerodecredito", "compraaterceros", "nolitigable", "sincliente", "sincredito", "deprueba", "enespera", "espera", "notiene", "na", "sn"]);
    const nCred = nz(nueva.no_credito), nGar = nz(nueva.gar_id), nDir = nz(nueva.direccion_garantia), nCli = nz(nueva.cliente_nombre), nExp = nz(nueva.expediente);
    const coincide = casos.filter((c) => {
      if (c.archivado) return false;
      const cCred = nz((c as any).no_credito);
      if (nCred && cCred && !PLACEHOLDER.has(nCred) && cCred === nCred) return true;              // mismo crédito real
      if (nGar && nz((c as any).gar_id) === nGar) return true;                                     // misma garantía
      if (nDir.length >= 8 && nz(c.direccion_garantia) === nDir) return true;                       // misma dirección
      if (nExp.length >= 3 && nz(c.expediente) === nExp && nCli.length >= 4 && nz(c.cliente_nombre) === nCli) return true; // mismo cliente+expediente
      return false;
    }).slice(0, 8);
    if (coincide.length) {
      const lista = coincide.map((c) => `• ${c.expediente || "s/exp"} · ${(c as any).no_credito || "s/c"} · ${c.cliente_nombre || "s/cliente"}`).join("\n");
      if (!confirm(`⚠ Puede que esto YA EXISTA (coincide en crédito, dirección o cliente+expediente):\n\n${lista}\n\n¿Agregar de todos modos?`)) return;
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
        method: "POST", headers, body: JSON.stringify({ ...payload, ...(sinJuicio ? { nota: `Sin juicio/derecho de crédito: ${motivoSinJuicio || "no especificado"}` } : {}) }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status} — revisa el permiso de inserción en caso_juridico`);
      setDlg(false);
      setNueva({ expediente: "", no_credito: "", gar_id: "", direccion_garantia: "", juzgado: "", entidad: "", cliente_nombre: "", cliente_codigo: "", materia: "" });
      setSinJuicio(false); setMotivoSinJuicio(""); setResultURRJ([]); setBuscaURRJ("");
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

  // ----- helpers de render compartidos entre la tabla (desktop) y las tarjetas (móvil) -----
  const derivar = (c: CasoJuridico) => {
    const elegible = !!(c.id && predPorCaso[c.id]);
    const d = dictPorCaso[c.id];
    const r = reqDe(c.id);
    const estadoKey = !d ? "sin_abrir" : d.estado === "etapa_b" ? "etapa_b" : (reqCompletos(r) ? "borrador" : "requisitos");
    const info = ESTADO_INFO[estadoKey];
    const ver = d?.veredicto || "PENDIENTE";
    return { elegible, d, r, info, ver };
  };

  const avisoSinAvance = (c: CasoJuridico) =>
    (c.id && diasAvance[c.id] !== undefined && diasAvance[c.id] >= DIAS_ALERTA)
      ? <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${diasAvance[c.id] >= DIAS_ALERTA * 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>⚠ {diasAvance[c.id] >= 9999 ? "sin avances" : `${diasAvance[c.id]}d sin avance`}</span>
      : null;

  const areaBadge = (c: CasoJuridico, d?: DictamenRow) => {
    const a = areaActual(c, d);
    return (
      <div className="flex flex-col">
        <Badge variant="outline" className={`w-fit border ${AREA_INFO[a] || "bg-muted text-muted-foreground border-border"}`}>{a || "—"}{d?.estado === "etapa_b" ? " · antecedente" : ""}</Badge>
        {c.encargado_unidad && <span className="mt-0.5 text-[10px] text-muted-foreground">{c.encargado_unidad}</span>}
      </div>
    );
  };

  const preDictamenCell = (elegible: boolean) => elegible
    ? <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"><Scale className="h-3 w-3" /> POSITIVO</Badge>
    : <span className="text-xs text-muted-foreground">Pendiente URRJ</span>;

  const dupBadge = (c: CasoJuridico) => {
    const dr = (c as any).dup_resolucion;
    if (dr?.estado === "conservar") {
      return (
        <button type="button" onClick={(e) => { e.stopPropagation(); abrirDup(c); }} className="text-left" title={`Duplicado revisado — se conserva.\nMotivo: ${dr.nota || "—"}\nPor: ${dr.por || "—"}`}>
          <Badge variant="outline" className="cursor-pointer border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-100">✓ Duplicado revisado</Badge>
        </button>
      );
    }
    if (coincidencias[c.id] > 0) {
      return (
        <button type="button" onClick={(e) => { e.stopPropagation(); abrirDup(c); }} className="text-left" title="Comparte garantía, dirección, expediente o cliente con otro(s). Clic para decidir: conservar las dos o eliminar una.">
          <Badge variant="outline" className="cursor-pointer border-amber-300 bg-amber-100 text-amber-800 text-[10px] font-semibold hover:bg-amber-200">🔁 Repetido ({coincidencias[c.id]}) · resolver</Badge>
        </button>
      );
    }
    return null;
  };

  const badgesEstado = (c: CasoJuridico, d: DictamenRow | undefined, ver: string, info: any) => (
    <div className="flex flex-wrap gap-1">
      {(c as any).terminado && <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800 text-[10px] font-semibold">✓ Terminado</Badge>}
      {info && <Badge variant="outline" className={`border ${info.cls}`}>{info.label}</Badge>}
      {d && <Badge variant="outline" className={`border ${VEREDICTO_CLS[ver] || ""} text-[10px]`}>{ver}</Badge>}
      {d && <Badge variant="outline" className={`border text-[10px] ${firmasUCP(d) >= 5 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground"}`}>✍ {firmasUCP(d)}/5 firmas</Badge>}
      {dupBadge(c)}
      {!c.drive_carpeta_id && <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700 text-[10px] font-medium" title="No tiene carpeta de Drive vinculada">📁 Sin Drive</Badge>}
    </div>
  );

  const menuBtn = (c: CasoJuridico) => {
    const cargandoFila = abriendo === c.id;
    return (
      <div className="relative shrink-0" data-menu-ucp>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); const rr = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenuUCP(menuUCP?.id === c.id ? null : { id: c.id, x: rr.right, y: rr.bottom }); }}>
          {cargandoFila ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
      </div>
    );
  };

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
                  {/* Escoger de URRJ (garantías que ya pasaron pre-dictamen) */}
                  <div className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2.5">
                    <p className="mb-1.5 text-xs font-semibold" style={{ color: "#0C5C46" }}>Escoger de URRJ (ya tiene pre-dictamen)</p>
                    <div className="flex gap-2">
                      <Input placeholder="Buscar por expediente o garantía…" value={buscaURRJ} onChange={(e) => setBuscaURRJ(e.target.value)} className="flex-1 text-sm" />
                      <Button size="sm" variant="outline" onClick={buscarEnURRJ} disabled={buscandoURRJ}>{buscandoURRJ ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}</Button>
                    </div>
                    {resultURRJ.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {resultURRJ.map((u) => (
                          <button key={u.id} onClick={() => tomarDeURRJ(u)} className="block w-full rounded border border-input bg-background px-2 py-1.5 text-left text-xs hover:bg-muted/40">
                            <b>{u.expediente || u.folio || "—"}</b> · {u.datos?.ubicacion || u.direccion_garantia || "sin dirección"}
                            {u.dictamen_final && <span className="ml-1 rounded-full bg-[color:var(--teal)]/10 px-1.5 text-[9px] text-[color:var(--teal)]">{u.dictamen_final}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {buscoURRJ && !buscandoURRJ && resultURRJ.length === 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">No se encontró en URRJ. Puedes capturarla nueva abajo.</p>}
                  </div>

                  <p className="text-center text-[11px] text-muted-foreground">— o captura una nueva —</p>

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

                  {/* Juicio / derecho de crédito */}
                  <div className="rounded-md border border-input p-2.5">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={sinJuicio} onChange={(e) => setSinJuicio(e.target.checked)} />
                      <span>No tiene juicio / derecho de crédito</span>
                    </label>
                    {sinJuicio && (
                      <Input className="mt-2 text-sm" placeholder="¿Por qué no tiene? (motivo)" value={motivoSinJuicio} onChange={(e) => setMotivoSinJuicio(e.target.value)} />
                    )}
                  </div>

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
        {(["dictaminables", "recientes", "todas"] as const).map((m) => (
          <button key={m} onClick={() => { setModo(m); setPagina(0); }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${modo === m ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground"}`}>
            {m === "dictaminables" ? "Dictaminables" : m === "recientes" ? "Recientes (UCP)" : "Todas"}
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
          {/* Desktop: tabla completa */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio / Crédito</TableHead>
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
                  const { elegible, d, r, info, ver } = derivar(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell><div className="text-xs font-semibold text-[color:var(--teal)]">{c.folio || "—"}</div><div className="text-xs text-muted-foreground">Crédito: <span className="font-medium text-foreground">{(c as any).no_credito || "sin crédito"}</span></div></TableCell>
                      <TableCell className="font-medium">{c.expediente || "—"}<div className="text-xs font-normal text-muted-foreground">{c.juzgado || ""}</div>{avisoSinAvance(c) && <div className="mt-0.5">{avisoSinAvance(c)}</div>}</TableCell>
                      <TableCell className="max-w-[200px] text-xs">{c.direccion_garantia || "—"}<div className="text-muted-foreground">{c.entidad || ""}</div></TableCell>
                      <TableCell className="text-xs">{c.cliente_nombre || c.cliente_codigo || "—"}</TableCell>
                      <TableCell>{areaBadge(c, d)}</TableCell>
                      <TableCell>{preDictamenCell(elegible)}</TableCell>
                      <TableCell className="text-xs">{d ? `${reqCuenta(r)}/7` : "—"}</TableCell>
                      <TableCell>{badgesEstado(c, d, ver, info)}</TableCell>
                      <TableCell><div className="flex items-center justify-end">{menuBtn(c)}</div></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Móvil: tarjetas apiladas (para que no se corte en pantallas chicas) */}
          <div className="divide-y divide-border md:hidden">
            {visibles.map((c) => {
              const { elegible, d, r, info, ver } = derivar(c);
              return (
                <div key={c.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{c.expediente || "—"}</p>
                      <p className="text-[11px]"><span className="font-semibold text-[color:var(--teal)]">{c.folio || "sin folio"}</span> · Crédito: {(c as any).no_credito || "—"}</p>
                      {c.juzgado && <p className="break-words text-[11px] text-muted-foreground">{c.juzgado}</p>}
                    </div>
                    {menuBtn(c)}
                  </div>
                  {avisoSinAvance(c) && <div className="mt-1.5">{avisoSinAvance(c)}</div>}
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div className="col-span-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Garantía</span>
                      <p className="break-words">{c.direccion_garantia || "—"}{c.entidad ? <span className="text-muted-foreground"> · {c.entidad}</span> : null}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cliente</span>
                      <p className="break-words">{c.cliente_nombre || c.cliente_codigo || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Área actual</span>
                      <div className="mt-0.5">{areaBadge(c, d)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Pre-dictamen</span>
                      <div className="mt-0.5">{preDictamenCell(elegible)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Requisitos</span>
                      <p className="mt-0.5">{d ? `${reqCuenta(r)}/7` : "—"}</p>
                    </div>
                  </div>
                  <div className="mt-2">{badgesEstado(c, d, ver, info)}</div>
                </div>
              );
            })}
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

      {/* mini banner: resolver garantías repetidas (conservar las dos o eliminar una, con motivo) */}
      <Dialog open={!!dupModal} onOpenChange={(o) => { if (!o) setDupModal(null); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[88vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Copy className="h-4 w-4 shrink-0 text-amber-600" /> Garantías repetidas</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Comparten <b>expediente, dirección, cliente o folio</b>. Marca cuál se queda y cuál se elimina, y escribe el motivo. Lo que elimines se manda a la papelera con su nota (se puede recuperar).
            </p>

            <div className="space-y-2">
              {(dupModal || []).map((id) => {
                const c = casos.find((x) => x.id === id);
                if (!c) return null;
                const dec = dupDecision[id] || "conservar";
                return (
                  <div key={id} className={`rounded-md border p-2.5 ${dec === "eliminar" ? "border-red-200 bg-red-50/60" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 text-xs">
                        <p className="break-words font-semibold">{c.expediente || "(sin expediente)"}</p>
                        <p className="break-words text-muted-foreground">{c.direccion_garantia || "sin dirección"}</p>
                        <p className="break-words text-muted-foreground">{c.cliente_nombre || c.cliente_codigo || "sin cliente"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 self-start overflow-hidden rounded-md border border-input">
                        <button type="button" onClick={() => setDupDecision((p) => ({ ...p, [id]: "conservar" }))}
                          className={`flex-1 px-3 py-1.5 text-[11px] font-medium sm:flex-none ${dec === "conservar" ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>Se queda</button>
                        <button type="button" onClick={() => setDupDecision((p) => ({ ...p, [id]: "eliminar" }))}
                          className={`flex-1 border-l border-input px-3 py-1.5 text-[11px] font-medium sm:flex-none ${dec === "eliminar" ? "bg-red-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>Eliminar</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Motivo (por qué se quedan las dos o por qué se elimina) *</span>
              <Textarea rows={3} value={dupNota} onChange={(e) => setDupNota(e.target.value)}
                className="text-sm"
                placeholder="Ej: Es el mismo inmueble cargado dos veces, se conserva el de exp. 82/26. / Se quedan las dos porque son garantías distintas del mismo cliente." />
            </label>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDupModal(null)} disabled={guardandoDup}>Cancelar</Button>
            <Button className="w-full sm:w-auto" onClick={guardarDup} disabled={guardandoDup}>
              {guardandoDup ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span className="ml-1">Guardar decisión</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* menú flotante de acciones (3 puntitos) */}
      {menuUCP && (() => {
        const c = casos.find((x) => x.id === menuUCP.id);
        if (!c) return null;
        const cerrar = () => setMenuUCP(null);
        const Item = ({ icon: Ic, children, onClick, disabled, title, danger }: any) => (
          <button onClick={onClick} disabled={disabled} title={title}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent ${danger ? "text-red-600" : ""}`}>
            <Ic className="h-4 w-4" /> {children}
          </button>
        );
        return (
          <div data-menu-ucp onClick={(e) => e.stopPropagation()} className="fixed z-50 w-60 rounded-lg border border-border bg-card p-1.5 shadow-xl"
            style={{ top: menuUCP.y + 4, left: Math.max(8, menuUCP.x - 240) }}>
            <Item icon={Eye} onClick={() => { cerrar(); navigate({ to: "/ucp-ficha", search: { id: c.id } as any }); }}>Ver ficha</Item>
            <Item icon={FileStack} disabled={!puedo("requisitos")} title={puedo("requisitos") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); abrir(c, "requisitos"); }}>Abrir requisitos</Item>
            <div className="my-1 border-t border-border" />
            <Item icon={Scale} disabled={!puedo("dictaminar_juridico")} title={puedo("dictaminar_juridico") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); abrir(c, "juridico"); }}>Dictaminar jurídico</Item>
            <Item icon={Landmark} disabled={!puedo("dictaminar_registral")} title={puedo("dictaminar_registral") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); abrir(c, "rppc"); }}>Dictaminar registral (RPPC)</Item>
            <Item icon={RefreshCw} disabled={!puedo("redictaminar")} title={puedo("redictaminar") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); abrir(c, "juridico"); }}>Re-dictaminar jurídico</Item>
            <Item icon={RefreshCw} disabled={!puedo("redictaminar")} title={puedo("redictaminar") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); abrir(c, "rppc"); }}>Re-dictaminar registral</Item>
            <div className="my-1 border-t border-border" />
            <Item icon={UserCheck} disabled={!puedo("asignar_abogado")} title={puedo("asignar_abogado") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); navigate({ to: "/ucp-ficha", search: { id: c.id } as any }); }}>Asignar abogado</Item>
            <Item icon={Upload} onClick={() => { cerrar(); navigate({ to: "/ucp-ficha", search: { id: c.id } as any }); }}>Subir actuaciones</Item>
            <Item icon={FileText} onClick={() => { cerrar(); navigate({ to: "/ucp-ficha", search: { id: c.id } as any }); }}>Escoger boletín judicial</Item>
            <div className="my-1 border-t border-border" />
            <Item icon={CheckCircle2} disabled={!puedo("terminar")} title={puedo("terminar") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); darPorTerminado(c); }}>Dar por terminado</Item>
            <Item icon={Send} onClick={() => { cerrar(); mandarAUcm(c); }}>Mandar a UCM (seguimiento)</Item>
            <div className="my-1 border-t border-border" />
            <Item icon={Trash2} danger disabled={!puedo("papelera")} title={puedo("papelera") ? undefined : "Sin permiso para tu rol"} onClick={() => { cerrar(); moverPapelera(c); }}>Mover a la papelera</Item>
          </div>
        );
      })()}
    </div>
  );
}

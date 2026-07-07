// ============================================================
//  Registro de URRJ · Solicitudes primero, luego el registro de garantías
// ------------------------------------------------------------
//  Pestañas:
//   - Solicitudes → arranca el proceso (nodo que se le pasa)
//   - Registro (garantías) → una fila por expediente; al abrir → ficha vieja (/expediente)
//   - Archivados  → dictámenes "terminados" (nivel dictamen)
//   - Eliminados  → papelera (con restaurar)
//  El Jurídico y el Registral viven DENTRO de la ficha de cada garantía.
// ============================================================
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";
interface RefGarantia { id?: string; expediente?: string; direccion_garantia?: string; juzgado?: string; cliente_nombre?: string; deudor?: string; entidad?: string; }
import { Building2, Archive, Trash2, MoreVertical, RotateCcw, FolderOpen, Loader2, RefreshCw, Gavel, FileText, AlertTriangle } from "lucide-react";
import { FichaURRJ } from "@/components/ficha-urrj";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

type Tab = "solicitudes" | "garantias" | "archivados" | "eliminados";

const fdate = (s?: string) => s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "";
const colorRes = (res: string) => /positivo|pasa/i.test(res) ? "bg-emerald-100 text-emerald-800" : /negativo|no pasa/i.test(res) ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground";

interface Garantia extends RefGarantia {
  clave: string;
  nJur: number;
  nReg: number;
  ultimoResultado: string;
  ultimaFecha: string;
}

interface FilaDic {
  id: string; tipo: "Jurídico" | "Registral"; tabla: "predictamen" | "dictamen_registral";
  titulo: string; sub: string; resultado: string; fecha: string;
}
function mapPred(p: any): FilaDic {
  return { id: p.id, tipo: "Jurídico", tabla: "predictamen", titulo: p.expediente || "Sin expediente", sub: `${p.posicion || "—"}${p.datos?.deudor ? " · " + p.datos.deudor : ""}`, resultado: p.dictamen_final || p.dictamen_sugerido || "—", fecha: p.created_at };
}
function mapReg(r: any): FilaDic {
  return { id: r.id, tipo: "Registral", tabla: "dictamen_registral", titulo: r.expediente || "Sin crédito", sub: r.acreditado || "—", resultado: r.resultado || "—", fecha: r.created_at };
}

export function RegistroURRJ({ onReDictaminar, dictaminar }: { onReDictaminar?: (f: any) => void; dictaminar?: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>(dictaminar ? "solicitudes" : "garantias");
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [filas, setFilas] = useState<FilaDic[]>([]);
  const [cargando, setCargando] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [fichaSel, setFichaSel] = useState<Garantia | null>(null);

  // direcciones repetidas (para marcar ⚠️ en las filas) — lee la vista v_garantia_repetida
  const [repetidos, setRepetidos] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/v_garantia_repetida?select=id,expediente`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        const s = new Set<string>();
        for (const x of rows || []) { if (x.id) s.add(String(x.id)); if (x.expediente) s.add(String(x.expediente)); }
        setRepetidos(s);
      })
      .catch(() => setRepetidos(new Set()));
  }, []);
  const esRepetido = (g: Garantia) => (g.id && repetidos.has(String(g.id))) || (g.expediente && repetidos.has(String(g.expediente)));
  const navigate = useNavigate();

  const cargarGarantias = async () => {
    setCargando(true);
    try {
      const [preds, regs] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,caso_id,expediente,posicion,dictamen_final,dictamen_sugerido,datos,created_at&en_papelera=eq.false&terminado=eq.false&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
        fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=id,expediente,acreditado,resultado,datos,created_at&en_papelera=eq.false&terminado=eq.false&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
      ]);
      const mapa = new Map<string, Garantia>();
      const clave = (exp?: string, caso?: string) => (exp && exp.trim()) ? "exp:" + exp.trim() : caso ? "caso:" + caso : "s/e";
      for (const p of preds) {
        const k = clave(p.expediente, p.caso_id);
        const g = mapa.get(k) || { clave: k, id: p.caso_id || undefined, expediente: p.expediente || "", direccion_garantia: p.datos?.ubicacion || "", juzgado: p.datos?.juzgado || "", deudor: p.datos?.deudor || "", entidad: p.datos?.estado || "", cliente_nombre: p.datos?.deudor || "", nJur: 0, nReg: 0, ultimoResultado: "", ultimaFecha: "" };
        g.nJur++;
        if (!g.ultimaFecha || String(p.created_at) > g.ultimaFecha) { g.ultimaFecha = p.created_at; g.ultimoResultado = p.dictamen_final || p.dictamen_sugerido || ""; }
        if (!g.id && p.caso_id) g.id = p.caso_id;
        mapa.set(k, g);
      }
      for (const r of regs) {
        const k = clave(r.expediente);
        const g = mapa.get(k) || { clave: k, expediente: r.expediente || "", direccion_garantia: "", cliente_nombre: r.acreditado || "", nJur: 0, nReg: 0, ultimoResultado: "", ultimaFecha: "" };
        g.nReg++;
        if (!g.ultimaFecha || String(r.created_at) > g.ultimaFecha) { g.ultimaFecha = r.created_at; g.ultimoResultado = r.resultado || g.ultimoResultado; }
        mapa.set(k, g);
      }
      setGarantias([...mapa.values()].sort((a, b) => String(b.ultimaFecha).localeCompare(String(a.ultimaFecha))));
    } catch { setGarantias([]); }
    setCargando(false);
  };

  const cargarDicts = async (modo: "archivados" | "eliminados") => {
    setCargando(true); setFilas([]);
    try {
      const filtro = modo === "archivados" ? "terminado=eq.true&en_papelera=eq.false" : "en_papelera=eq.true";
      const [p, r] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&${filtro}&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
        fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=*&${filtro}&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
      ]);
      setFilas([...p.map(mapPred), ...r.map(mapReg)].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))));
    } catch { setFilas([]); }
    setCargando(false);
  };

  useEffect(() => {
    if (tab === "solicitudes") return;
    else if (tab === "garantias") cargarGarantias();
    else if (tab === "archivados") cargarDicts("archivados");
    else if (tab === "eliminados") cargarDicts("eliminados");
    /* eslint-disable-next-line */
  }, [tab]);

  const patch = async (f: FilaDic, cuerpo: Record<string, any>) => {
    setMenu(null);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/${f.tabla}?id=eq.${f.id}`, { method: "PATCH", headers, body: JSON.stringify(cuerpo) });
      cargarDicts(tab === "archivados" ? "archivados" : "eliminados");
    } catch { alert("No se pudo completar la acción."); }
  };

  const TABS: { k: Tab; label: string; icon: any }[] = [
    ...(dictaminar ? [{ k: "solicitudes" as Tab, label: "Solicitudes", icon: Gavel }] : []),
    { k: "garantias", label: "Registro (garantías)", icon: Building2 },
    { k: "archivados", label: "Archivados", icon: Archive },
    { k: "eliminados", label: "Eliminados", icon: Trash2 },
  ];

  const recargar = () => { if (tab === "garantias") cargarGarantias(); else if (tab === "archivados") cargarDicts("archivados"); else if (tab === "eliminados") cargarDicts("eliminados"); };

  // Ficha de la garantía: usa el FichaURRJ existente, que se alimenta del
  // pre-dictamen jurídico y del dictamen registral por expediente O por caso_id
  // (por eso abre aunque la garantía todavía no esté vinculada a un caso).
  if (fichaSel) {
    return <FichaURRJ garantia={fichaSel} onVolver={() => { setFichaSel(null); cargarGarantias(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.k ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground hover:bg-muted"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
        {tab !== "solicitudes" && (
          <button onClick={recargar} className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar
          </button>
        )}
      </div>

      {tab === "solicitudes" ? (
        <div>{dictaminar}</div>
      ) : cargando ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>

      ) : tab === "garantias" ? (
        garantias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-sm text-muted-foreground">
            <FolderOpen className="h-6 w-6 text-[color:var(--teal)]" /> Aún no hay garantías dictaminadas.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="divide-y divide-border">
              {garantias.map((g) => (
                <div key={g.clave} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30">
                  <button onClick={() => setFichaSel(g)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {g.expediente || "Sin expediente"}
                      {esRepetido(g) && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="Dirección repetida en otro expediente — validar"><AlertTriangle className="h-3 w-3" /> Repetido</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{g.direccion_garantia || g.cliente_nombre || "—"}{g.entidad ? " · " + g.entidad : ""} · {fdate(g.ultimaFecha)}</p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-[color:var(--teal)]/10 px-2 py-0.5 text-[10px] font-medium text-[color:var(--teal)]">{g.nJur} jur · {g.nReg} reg</span>
                    {g.ultimoResultado && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorRes(g.ultimoResultado)}`}>{g.ultimoResultado}</span>}
                    <div className="relative">
                      <button onClick={() => setMenu(menu === g.clave ? null : g.clave)} className="rounded-md p-1 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
                      {menu === g.clave && (
                        <div className="absolute right-0 top-8 z-20 w-44 rounded-md border border-border bg-white py-1 shadow-lg">
                          <button onClick={() => { setMenu(null); setFichaSel(g); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><FileText className="h-4 w-4" /> Ver ficha</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      ) : filas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-sm text-muted-foreground">
          <FolderOpen className="h-6 w-6 text-[color:var(--teal)]" />
          {tab === "archivados" ? "No hay dictámenes archivados." : "La papelera está vacía."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="divide-y divide-border">
            {filas.map((f) => (
              <div key={f.tabla + f.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{f.titulo}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${f.tipo === "Registral" ? "bg-amber-100 text-amber-800" : "bg-[color:var(--teal)]/10 text-[color:var(--teal)]"}`}>{f.tipo}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{f.sub} · {fdate(f.fecha)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorRes(f.resultado)}`}>{f.resultado}</span>
                  <div className="relative">
                    <button onClick={() => setMenu(menu === f.tabla + f.id ? null : f.tabla + f.id)} className="rounded-md p-1 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
                    {menu === f.tabla + f.id && (
                      <div className="absolute right-0 top-8 z-20 w-48 rounded-md border border-border bg-white py-1 shadow-lg">
                        {tab === "eliminados" ? (
                          <button onClick={() => patch(f, { en_papelera: false })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><RotateCcw className="h-4 w-4" /> Restaurar</button>
                        ) : (
                          <>
                            <button onClick={() => patch(f, { terminado: false })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><RotateCcw className="h-4 w-4" /> Desarchivar</button>
                            <button onClick={() => patch(f, { en_papelera: true, papelera_fecha: new Date().toISOString() })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-muted"><Trash2 className="h-4 w-4" /> Eliminar</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

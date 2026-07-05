// ============================================================
//  Registro de URRJ · dictámenes hechos, ordenados por módulos
// ------------------------------------------------------------
//  Pestañas:
//   - Dictaminar  → hacer un dictamen nuevo (se le pasa como nodo)
//   - Jurídicos   → reusa HistorialPredictamen (tabla predictamen)
//   - Registrales → dictamen_registral
//   - Archivados  → los "terminados" de ambas tablas
//   - Eliminados  → papelera de ambas tablas (con restaurar)
// ============================================================
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { HistorialPredictamen } from "@/components/historial-predictamen";
import { Scale, Landmark, Archive, Trash2, MoreVertical, RotateCcw, FolderOpen, Loader2, RefreshCw, Gavel } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

type Tab = "dictaminar" | "juridicos" | "registrales" | "archivados" | "eliminados";

interface FilaReg {
  id: string;
  tipo: "Jurídico" | "Registral";
  tabla: "predictamen" | "dictamen_registral";
  titulo: string;
  sub: string;
  resultado: string;
  fecha: string;
}

const fdate = (s?: string) => s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "";

function mapPred(p: any): FilaReg {
  return {
    id: p.id, tipo: "Jurídico", tabla: "predictamen",
    titulo: p.expediente || "Sin expediente",
    sub: `${p.posicion || "—"}${p.datos?.deudor ? " · " + p.datos.deudor : ""}`,
    resultado: p.dictamen_final || p.dictamen_sugerido || "—",
    fecha: p.created_at,
  };
}
function mapReg(r: any): FilaReg {
  return {
    id: r.id, tipo: "Registral", tabla: "dictamen_registral",
    titulo: r.expediente || "Sin crédito",
    sub: r.acreditado || "—",
    resultado: r.resultado || "—",
    fecha: r.created_at,
  };
}

export function RegistroURRJ({ onReDictaminar, dictaminar }: { onReDictaminar?: (f: any) => void; dictaminar?: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("juridicos");
  const [filas, setFilas] = useState<FilaReg[]>([]);
  const [cargando, setCargando] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  const cargar = async () => {
    if (tab === "juridicos" || tab === "dictaminar") return; // esas pestañas no cargan lista
    setCargando(true); setFilas([]);
    try {
      if (tab === "registrales") {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=*&en_papelera=eq.false&terminado=eq.false&order=created_at.desc&limit=500`, { headers });
        setFilas((r.ok ? await r.json() : []).map(mapReg));
      } else if (tab === "archivados") {
        const [p, r] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&terminado=eq.true&en_papelera=eq.false&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
          fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=*&terminado=eq.true&en_papelera=eq.false&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
        ]);
        setFilas([...p.map(mapPred), ...r.map(mapReg)].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))));
      } else { // eliminados
        const [p, r] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&en_papelera=eq.true&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
          fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=*&en_papelera=eq.true&order=created_at.desc&limit=500`, { headers }).then((x) => x.ok ? x.json() : []),
        ]);
        setFilas([...p.map(mapPred), ...r.map(mapReg)].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))));
      }
    } catch { setFilas([]); }
    setCargando(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [tab]);

  const patch = async (f: FilaReg, cuerpo: Record<string, any>) => {
    setMenu(null);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/${f.tabla}?id=eq.${f.id}`, { method: "PATCH", headers, body: JSON.stringify(cuerpo) });
      cargar();
    } catch { alert("No se pudo completar la acción."); }
  };

  const TABS: { k: Tab; label: string; icon: any }[] = [
    ...(dictaminar ? [{ k: "dictaminar" as Tab, label: "Dictaminar", icon: Gavel }] : []),
    { k: "juridicos", label: "Jurídicos", icon: Scale },
    { k: "registrales", label: "Registrales (RPPC)", icon: Landmark },
    { k: "archivados", label: "Archivados", icon: Archive },
    { k: "eliminados", label: "Eliminados", icon: Trash2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.k ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground hover:bg-muted"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
        {tab !== "juridicos" && tab !== "dictaminar" && (
          <button onClick={cargar} className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">
            <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar
          </button>
        )}
      </div>

      {tab === "dictaminar" ? (
        <div>{dictaminar}</div>
      ) : tab === "juridicos" ? (
        <HistorialPredictamen onReDictaminar={(f) => { if (dictaminar) setTab("dictaminar"); onReDictaminar?.(f); }} />
      ) : cargando ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : filas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-sm text-muted-foreground">
          <FolderOpen className="h-6 w-6 text-[color:var(--teal)]" />
          {tab === "registrales" ? "No hay dictámenes registrales." : tab === "archivados" ? "No hay dictámenes archivados." : "La papelera está vacía."}
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
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${/positivo|pasa/i.test(f.resultado) ? "bg-emerald-100 text-emerald-800" : /negativo|no pasa/i.test(f.resultado) ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}>{f.resultado}</span>
                  <div className="relative">
                    <button onClick={() => setMenu(menu === f.tabla + f.id ? null : f.tabla + f.id)} className="rounded-md p-1 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
                    {menu === f.tabla + f.id && (
                      <div className="absolute right-0 top-8 z-20 w-48 rounded-md border border-border bg-white py-1 shadow-lg">
                        {tab === "eliminados" ? (
                          <button onClick={() => patch(f, { en_papelera: false })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><RotateCcw className="h-4 w-4" /> Restaurar</button>
                        ) : tab === "archivados" ? (
                          <>
                            <button onClick={() => patch(f, { terminado: false })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><RotateCcw className="h-4 w-4" /> Desarchivar</button>
                            <button onClick={() => patch(f, { en_papelera: true, papelera_fecha: new Date().toISOString() })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-muted"><Trash2 className="h-4 w-4" /> Eliminar</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => patch(f, { terminado: true })} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><Archive className="h-4 w-4" /> Archivar</button>
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

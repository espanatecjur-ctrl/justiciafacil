import { useEffect, useMemo, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { X, Star, Check, Loader2, UserCheck } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const VEN_TODO = ["DGE", "Super_Admin"];

interface Colab { id: string; nombre: string; rol: string | null; especialidad: string | null; foto_url: string | null; activo: boolean; }

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function coincideMateria(especialidad: string | null, materia: string | null) {
  if (!especialidad || !materia) return false;
  const e = norm(especialidad), m = norm(materia);
  if (e.includes(m) || m.includes(e)) return true;
  const palabras = e.split(/\s+/).filter((w) => w.length >= 4);
  return palabras.some((w) => m.includes(w));
}

export function ReasignarModal({ predictamenId, materia, actual, onClose, onAsignado }:
  { predictamenId: string; materia: string | null; actual?: string | null; onClose: () => void; onAsignado?: (nombre: string) => void }) {
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [rolesElaboran, setRolesElaboran] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=id,nombre,rol,especialidad,foto_url,activo&activo=eq.true&order=nombre`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/urrj_permisos?select=config&id=eq.1`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([cs, cfg]) => {
      setColabs(cs);
      const config = cfg?.[0]?.config ?? {};
      const roles = Object.keys(config).filter((r) => (config[r] || []).includes("elaborar"));
      setRolesElaboran([...new Set([...roles, ...VEN_TODO])]);
    }).catch(() => setError("No se pudo cargar (¿corriste los SQL?)")).finally(() => setCargando(false));
  }, []);

  const lista = useMemo(() => {
    const elaboran = colabs.filter((c) => c.rol && rolesElaboran.includes(c.rol));
    return elaboran.map((c) => ({ ...c, sugerido: coincideMateria(c.especialidad, materia) }))
      .sort((a, b) => (b.sugerido ? 1 : 0) - (a.sugerido ? 1 : 0) || a.nombre.localeCompare(b.nombre));
  }, [colabs, rolesElaboran, materia]);

  const asignar = async (c: Colab) => {
    setGuardando(c.id); setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${predictamenId}`, {
        method: "PATCH", headers, body: JSON.stringify({ abogado_id: c.id, abogado_nombre: c.nombre }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onAsignado?.(c.nombre); onClose();
    } catch (e: any) { setError(e.message); } finally { setGuardando(null); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="flex items-center gap-2 font-semibold"><UserCheck className="h-5 w-5" /> Reasignar abogado</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4">
          {materia && <p className="mb-1 text-xs text-muted-foreground">Materia: <b>{materia}</b> · ⭐ = sugerido por especialidad</p>}
          {actual && <p className="mb-3 text-xs text-muted-foreground">Asignado actual: {actual}</p>}
          {error && <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
          {cargando ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando equipo…</p>
            : lista.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No hay colaboradores con permiso de elaborar. Revisa Permisos URRJ y las especialidades en Colaboradores.</p>
            : (
              <div className="max-h-[50vh] space-y-1.5 overflow-auto">
                {lista.map((c) => (
                  <button key={c.id} onClick={() => asignar(c)} disabled={!!guardando}
                    className="flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left hover:bg-muted/50 disabled:opacity-60">
                    {c.foto_url ? <img src={c.foto_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      : <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-semibold">{c.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-sm font-medium">{c.nombre} {c.sugerido && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.rol}{c.especialidad ? ` · ${c.especialidad}` : ""}</p>
                    </div>
                    {guardando === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

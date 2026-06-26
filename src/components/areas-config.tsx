import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Plus, Trash2, UserPlus, Scale, X } from "lucide-react";

const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

interface Area { id: string; nombre: string; orden: number | null; }
interface Colaborador { id: string; nombre: string; sede: string | null; especialidad: string | null; foto_url: string | null; }

function iniciales(n?: string | null) {
  return (n || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function AreasConfig() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [colab, setColab] = useState<Colaborador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevaArea, setNuevaArea] = useState("");
  const [agregando, setAgregando] = useState(false);

  const cargar = () => {
    setCargando(true);
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/area_juridica?select=*&order=orden.asc,nombre.asc`, { headers }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`áreas ${r.status}`)))),
      fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=id,nombre,sede,especialidad,foto_url&order=nombre.asc`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([a, c]) => { setAreas(a); setColab(c); })
      .catch((e) => setError(e.message + " (¿corriste el SQL de area_juridica?)"))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const porArea = useMemo(() => {
    const m: Record<string, Colaborador[]> = {};
    for (const a of areas) m[a.nombre] = [];
    for (const c of colab) {
      const k = c.especialidad || "";
      if (k && m[k]) m[k].push(c);
    }
    return m;
  }, [areas, colab]);

  const agregarArea = async () => {
    const nombre = nuevaArea.trim();
    if (!nombre) return;
    setAgregando(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/area_juridica`, {
        method: "POST", headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ nombre, orden: areas.length + 1 }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setNuevaArea("");
      cargar();
    } catch (e: any) {
      setError("No se pudo agregar: " + e.message);
    } finally {
      setAgregando(false);
    }
  };

  const borrarArea = async (a: Area) => {
    if (!confirm(`¿Quitar el área "${a.nombre}"? (no borra abogados, solo el área del catálogo)`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/area_juridica?id=eq.${a.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      cargar();
    } catch (e: any) {
      setError("No se pudo quitar: " + e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Áreas jurídicas</p>
          <p className="text-xs text-muted-foreground">Cada abogado en su especialidad. Los casos van al experto.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={nuevaArea}
            onChange={(e) => setNuevaArea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && agregarArea()}
            placeholder="Nueva área (ej. Amparo)"
            className="rounded-md border border-input px-3 py-2 text-sm"
          />
          <button onClick={agregarArea} disabled={agregando} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: NAVY }}>
            <Plus className="h-4 w-4" /> Agregar área
          </button>
        </div>
      </div>

      {error && <Card className="legal-card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">{error}</Card>}

      {cargando ? (
        <Card className="legal-card p-8 text-center text-muted-foreground">Cargando áreas…</Card>
      ) : areas.length === 0 ? (
        <Card className="legal-card p-8 text-center text-muted-foreground">
          Aún no hay áreas. Agrega la primera arriba (o corre el SQL que ya trae las áreas base).
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => {
            const gente = porArea[a.nombre] || [];
            return (
              <Card key={a.id} className="legal-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4" style={{ color: GOLD }} />
                    <span className="text-sm font-semibold">{a.nombre}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${gente.length ? "bg-[#0B1E3A]/10 text-[#0B1E3A]" : "bg-muted text-muted-foreground"}`}>{gente.length}</span>
                    <button onClick={() => borrarArea(a)} className="text-muted-foreground hover:text-red-600" title="Quitar área"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                {gente.length === 0 ? (
                  <p className="flex items-center gap-1.5 text-xs italic text-muted-foreground"><UserPlus className="h-3.5 w-3.5" /> Sin abogado asignado</p>
                ) : (
                  <div className="space-y-2">
                    {gente.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--teal)]/15 text-[10px] font-bold text-[color:var(--teal)]">
                          {c.foto_url ? <img src={c.foto_url} alt="" className="h-full w-full object-cover" /> : iniciales(c.nombre)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] leading-tight">{c.nombre}</p>
                          <p className="text-[11px] text-muted-foreground">{c.sede || ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tip: los abogados se asignan a un área desde <b>Colaboradores</b> (campo Especialidad). Aquí solo se agrupan.
      </p>
    </div>
  );
}

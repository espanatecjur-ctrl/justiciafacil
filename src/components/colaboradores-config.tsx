import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES } from "@/lib/roles";
import { UserPlus, Pencil, Trash2, X, Upload, Loader2 } from "lucide-react";

const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";
const SEDES = ["Mazatlán", "Culiacán", "La Paz", "CDMX", "Guadalajara"];
const ESPECIALIDADES = [
  "", "Penal", "Civil y Mercantil", "PROFECO/CONDUSEF", "Laboral",
  "Jurídico Fiscal", "Familiar", "Amparo", "Administrativo", "Hipotecario/Recuperación", "Sucesiones",
];

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

interface Colaborador {
  id: string;
  nombre: string;
  correo: string | null;
  rol: string | null;
  sede: string | null;
  especialidad: string | null;
  foto_url: string | null;
  activo: boolean | null;
}

type Borrador = Partial<Colaborador>;

async function subirFoto(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/colaboradores/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!res.ok) throw new Error("No se pudo subir la foto (" + res.status + "). ¿Creaste el almacén 'colaboradores'?");
  return `${SUPABASE_URL}/storage/v1/object/public/colaboradores/${path}`;
}

function iniciales(n?: string | null) {
  return (n || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function ColaboradoresConfig() {
  const [lista, setLista] = useState<Colaborador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    setCargando(true);
    fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=*&order=nombre.asc`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Supabase ${r.status}`))))
      .then((d) => setLista(d))
      .catch((e) => setError(e.message + " (¿corriste el SQL de colaboradores?)"))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const nombreRol = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of ROLES) m[r.codigo] = r.codigo;
    return m;
  }, []);

  const guardar = async () => {
    if (!editando?.nombre) { setError("El nombre es obligatorio."); return; }
    setGuardando(true);
    setError(null);
    const payload = {
      nombre: editando.nombre,
      correo: editando.correo || null,
      rol: editando.rol || null,
      sede: editando.sede || null,
      especialidad: editando.especialidad || null,
      foto_url: editando.foto_url || null,
      activo: editando.activo ?? true,
    };
    try {
      let res;
      if (editando.id) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?id=eq.${editando.id}`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores`, {
          method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setEditando(null);
      cargar();
    } catch (e: any) {
      setError("No se pudo guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (c: Colaborador) => {
    if (!confirm(`¿Quitar a ${c.nombre}?`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?id=eq.${c.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      cargar();
    } catch (e: any) {
      setError("No se pudo quitar: " + e.message);
    }
  };

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editando) return;
    setSubiendo(true);
    setError(null);
    try {
      const url = await subirFoto(file);
      setEditando({ ...editando, foto_url: url });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cargando ? "Cargando…" : `${lista.length} colaborador(es)`}</p>
        <button onClick={() => setEditando({ activo: true })} className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white" style={{ background: NAVY }}>
          <UserPlus className="h-4 w-4" /> Agregar colaborador
        </button>
      </div>

      {error && <Card className="legal-card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">{error}</Card>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((c) => (
          <Card key={c.id} className="legal-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--teal)]/15 text-sm font-bold text-[color:var(--teal)] ring-1 ring-black/5">
                {c.foto_url ? <img src={c.foto_url} alt="" className="h-full w-full object-cover" /> : iniciales(c.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{c.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{c.correo || "— sin correo —"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.rol && <span className="rounded-full bg-[#0B1E3A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0B1E3A]">{c.rol}</span>}
                  {c.sede && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{c.sede}</span>}
                  {c.especialidad && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${GOLD}22`, color: "#8A6E22" }}>{c.especialidad}</span>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-1">
              <button onClick={() => setEditando(c)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => borrar(c)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </Card>
        ))}
        {!cargando && lista.length === 0 && (
          <Card className="legal-card p-6 text-center text-muted-foreground sm:col-span-2 lg:col-span-3">Aún no hay colaboradores. Agrega el primero.</Card>
        )}
      </div>

      {/* Modal agregar/editar */}
      {editando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setEditando(null)}>
          <Card className="w-full max-w-md p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
              <p className="font-semibold">{editando.id ? "Editar colaborador" : "Nuevo colaborador"}</p>
              <button onClick={() => setEditando(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[color:var(--teal)]/15 text-lg font-bold text-[color:var(--teal)]">
                  {editando.foto_url ? <img src={editando.foto_url} alt="" className="h-full w-full object-cover" /> : iniciales(editando.nombre)}
                </span>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted">
                  {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {subiendo ? "Subiendo…" : "Subir foto"}
                  <input type="file" accept="image/*" className="hidden" onChange={onFoto} disabled={subiendo} />
                </label>
              </div>

              <Campo label="Nombre *"><input value={editando.nombre || ""} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm" /></Campo>
              <Campo label="Correo"><input value={editando.correo || ""} onChange={(e) => setEditando({ ...editando, correo: e.target.value })} placeholder="nombre@diipadesarrollos.com" className="w-full rounded-md border border-input px-3 py-2 text-sm" /></Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Rol">
                  <select value={editando.rol || ""} onChange={(e) => setEditando({ ...editando, rol: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
                    <option value="">—</option>
                    {ROLES.map((r) => <option key={r.codigo} value={r.codigo}>{r.codigo}</option>)}
                  </select>
                </Campo>
                <Campo label="Sede">
                  <select value={editando.sede || ""} onChange={(e) => setEditando({ ...editando, sede: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
                    <option value="">—</option>
                    {SEDES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Campo>
              </div>
              <Campo label="Especialidad">
                <select value={editando.especialidad || ""} onChange={(e) => setEditando({ ...editando, especialidad: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
                  {ESPECIALIDADES.map((s) => <option key={s} value={s}>{s || "—"}</option>)}
                </select>
              </Campo>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditando(null)} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
                <button onClick={guardar} disabled={guardando} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
                  {guardando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

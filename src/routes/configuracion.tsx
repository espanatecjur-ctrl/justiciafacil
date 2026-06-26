import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES, MODULOS, TODOS_MODULOS, rolVeTodo, type ModuloClave } from "@/lib/roles";
import { ShieldCheck, Save, Check, Lock } from "lucide-react";

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "Configuración · Roles y Permisos — JusticiaFácil" }] }),
  component: ConfiguracionPage,
});

const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// Módulos efectivos de un rol: lo guardado en Supabase, o el default del catálogo.
function defaultsDeRol(codigo: string): ModuloClave[] {
  const r = ROLES.find((x) => x.codigo === codigo);
  if (!r) return [];
  return r.modulos === "todos" ? [...TODOS_MODULOS] : [...r.modulos];
}

function ConfiguracionPage() {
  const [modulos, setModulos] = useState<Record<string, ModuloClave[]>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial: lee app_permisos (id=1). Si no hay nada, usa los defaults.
  useEffect(() => {
    const editables = ROLES.filter((r) => !rolVeTodo(r.modulos));
    fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Supabase ${r.status}`))))
      .then((rows: { config?: { modulos?: Record<string, ModuloClave[]> } }[]) => {
        const guardadoCfg = rows?.[0]?.config?.modulos ?? {};
        const inicial: Record<string, ModuloClave[]> = {};
        for (const r of editables) {
          inicial[r.codigo] = guardadoCfg[r.codigo] ?? defaultsDeRol(r.codigo);
        }
        setModulos(inicial);
      })
      .catch((e) => {
        // Si la tabla no existe aún, igual mostramos los defaults (sin romper).
        const inicial: Record<string, ModuloClave[]> = {};
        for (const r of editables) inicial[r.codigo] = defaultsDeRol(r.codigo);
        setModulos(inicial);
        setError("No se pudo leer la configuración guardada; se muestran los valores de fábrica. (¿Falta correr el SQL de app_permisos?)");
      })
      .finally(() => setCargando(false));
  }, []);

  const toggle = (rol: string, mod: ModuloClave) => {
    setGuardado(false);
    setModulos((prev) => {
      const actual = new Set(prev[rol] ?? []);
      if (actual.has(mod)) actual.delete(mod);
      else actual.add(mod);
      return { ...prev, [rol]: TODOS_MODULOS.filter((m) => actual.has(m)) };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_permisos?id=eq.1`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ config: { modulos }, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const data = await res.json();
      if (!data || data.length === 0) {
        throw new Error("No existe la fila (id=1). Corre el SQL de app_permisos.");
      }
      setGuardado(true);
    } catch (e: any) {
      setError("No se pudo guardar: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const porGrupo = useMemo(() => {
    const g: Record<string, typeof ROLES> = {};
    for (const r of ROLES) (g[r.grupo] ??= []).push(r);
    return g;
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuración"
        title="Roles y Permisos"
        description="Define qué módulos ve cada rol. Los cambios se guardan en la base de JusticiaFácil."
      />

      {/* Aviso de guardado / barra de acción */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-white"
        style={{ background: `linear-gradient(120deg, ${NAVY} 0%, #103A3A 60%, #0C5C46 100%)` }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" style={{ color: GOLD }} />
          <p className="text-sm">Activa o desactiva los módulos por rol y guarda los cambios.</p>
        </div>
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0B1E3A] disabled:opacity-60"
          style={{ background: GOLD }}
        >
          {guardado ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar cambios"}
        </button>
      </div>

      {error && (
        <Card className="legal-card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">{error}</Card>
      )}

      {cargando ? (
        <Card className="legal-card p-8 text-center text-muted-foreground">Cargando roles…</Card>
      ) : (
        Object.entries(porGrupo).map(([grupo, roles]) => (
          <div key={grupo} className="space-y-3">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <span className="h-4 w-1 rounded" style={{ background: GOLD }} /> {grupo}
            </h3>
            {roles.map((r) => {
              const veTodo = rolVeTodo(r.modulos);
              const activos = new Set(modulos[r.codigo] ?? []);
              return (
                <Card key={r.codigo} className="legal-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{r.nombre}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.codigo}</p>
                    </div>
                    {veTodo && (
                      <span className="flex items-center gap-1 rounded-full bg-[#0B1E3A] px-2.5 py-1 text-[11px] text-white">
                        <Lock className="h-3 w-3" /> Ve todo
                      </span>
                    )}
                  </div>

                  {veTodo ? (
                    <p className="text-sm text-muted-foreground">Este rol tiene acceso completo a todos los módulos (no editable).</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {MODULOS.map((m) => {
                        const on = activos.has(m.clave);
                        return (
                          <button
                            key={m.clave}
                            onClick={() => toggle(r.codigo, m.clave)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              on
                                ? "border-[#0C5C46] bg-[#0C5C46]/10 text-[#0C5C46]"
                                : "border-input bg-background text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {on ? "● " : "○ "}{m.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

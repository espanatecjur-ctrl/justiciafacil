import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES, MODULOS, TODOS_MODULOS, rolVeTodo, type ModuloClave } from "@/lib/roles";
import { ColaboradoresConfig } from "@/components/colaboradores-config";
import { ApoderadosConfig } from "@/components/apoderados-config";
import { AreasConfig } from "@/components/areas-config";
import { PapeleraConfig } from "@/components/papelera-config";
import { PermisosURRJConfig } from "@/components/permisos-urrj-config";
import { ShieldCheck, Save, Check, Lock, Settings, Users, Network, Bookmark, Trash2, Hammer, Scale, ScrollText } from "lucide-react";

export const Route = createFileRoute("/configuracion")({
  validateSearch: (s: Record<string, unknown>) => ({ tab: typeof s.tab === "string" ? s.tab : undefined }),
  head: () => ({ meta: [{ title: "Configuración — JusticiaFácil" }] }),
  component: ConfiguracionPage,
});

const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const TABS = [
  { key: "roles", label: "Roles y Permisos", icon: ShieldCheck },
  { key: "colaboradores", label: "Colaboradores", icon: Users },
  { key: "apoderados", label: "Apoderados", icon: ScrollText },
  { key: "conectores", label: "Conectores de Juzgados", icon: Network },
  { key: "folios", label: "Folios", icon: Bookmark },
  { key: "areas", label: "Áreas y Equipo", icon: Scale },
  { key: "papelera", label: "Papelera", icon: Trash2 },
];

function ConfiguracionPage() {
  const { tab } = Route.useSearch();
  const [activa, setActiva] = useState<string>(tab && TABS.some((t) => t.key === tab) ? tab : "roles");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sistema" title="Configuración" description="Roles, colaboradores, conectores, folios y papelera." />

      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiva(t.key)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activa === t.key ? "bg-[#0B1E3A] text-white" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {activa === "roles" && <RolesPermisos />}
      {activa === "roles" && <div className="mt-8 border-t border-border pt-6"><PermisosURRJConfig /></div>}
      {activa === "colaboradores" && <ColaboradoresConfig />}
      {activa === "apoderados" && <ApoderadosConfig />}
      {activa === "areas" && <AreasConfig />}
      {activa === "papelera" && <PapeleraConfig />}
      {activa !== "roles" && activa !== "colaboradores" && activa !== "apoderados" && activa !== "areas" && activa !== "papelera" && <Proximamente nombre={TABS.find((t) => t.key === activa)?.label || ""} />}
    </div>
  );
}

function Proximamente({ nombre }: { nombre: string }) {
  return (
    <Card className="legal-card p-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#C2A24C]/15 text-[#8A6E22]">
        <Hammer className="h-6 w-6" />
      </div>
      <p className="font-display text-lg font-semibold">{nombre}</p>
      <p className="mt-1 text-sm text-muted-foreground">Esta sección la construiremos en el siguiente paso. La estructura ya está lista.</p>
    </Card>
  );
}

// ============================ Roles y Permisos ============================
function defaultsDeRol(codigo: string): ModuloClave[] {
  const r = ROLES.find((x) => x.codigo === codigo);
  if (!r) return [];
  return r.modulos === "todos" ? [...TODOS_MODULOS] : [...r.modulos];
}

function RolesPermisos() {
  const [modulos, setModulos] = useState<Record<string, ModuloClave[]>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const editables = ROLES.filter((r) => !rolVeTodo(r.modulos));
    fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Supabase ${r.status}`))))
      .then((rows: { config?: { modulos?: Record<string, ModuloClave[]> } }[]) => {
        const cfg = rows?.[0]?.config?.modulos ?? {};
        const inicial: Record<string, ModuloClave[]> = {};
        for (const r of editables) inicial[r.codigo] = cfg[r.codigo] ?? defaultsDeRol(r.codigo);
        setModulos(inicial);
      })
      .catch(() => {
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
      const s = new Set(prev[rol] ?? []);
      s.has(mod) ? s.delete(mod) : s.add(mod);
      return { ...prev, [rol]: TODOS_MODULOS.filter((m) => s.has(m)) };
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
      if (!data || data.length === 0) throw new Error("No existe la fila id=1. Corre el SQL de app_permisos.");
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-white" style={{ background: `linear-gradient(120deg, ${NAVY} 0%, #103A3A 60%, #0C5C46 100%)` }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" style={{ color: GOLD }} />
          <p className="text-sm">Activa o desactiva los módulos por rol y guarda los cambios.</p>
        </div>
        <button onClick={guardar} disabled={guardando} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[#0B1E3A] disabled:opacity-60" style={{ background: GOLD }}>
          {guardado ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar cambios"}
        </button>
      </div>

      {error && <Card className="legal-card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">{error}</Card>}

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
                    <p className="text-sm text-muted-foreground">Acceso completo a todos los módulos (no editable).</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {MODULOS.map((m) => {
                        const on = activos.has(m.clave);
                        return (
                          <button key={m.clave} onClick={() => toggle(r.codigo, m.clave)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-[#0C5C46] bg-[#0C5C46]/10 text-[#0C5C46]" : "border-input bg-background text-muted-foreground hover:bg-muted"}`}>
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

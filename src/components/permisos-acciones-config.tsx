import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES } from "@/lib/roles";
import { ACCIONES, MATRIZ_DEFAULT, limpiarCachePermisosAcciones, type ModuloPerm } from "@/lib/permisos-acciones";
import { Check, Loader2, ShieldCheck } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const VEN_TODO = ["DGE", "Super_Admin"];

const MODULOS: { clave: ModuloPerm; label: string }[] = [
  { clave: "ucp", label: "UCP" },
  { clave: "ucm", label: "UCM · Seguimiento" },
  { clave: "udp", label: "UDP · Defensa" },
  { clave: "ufc", label: "UFC · Formalización" },
  { clave: "amparos", label: "Amparos / Recursos / Exhortos" },
  { clave: "contratos", label: "Contratos" },
];

type Config = { modulos?: any; acciones?: Record<string, Record<string, string[]>> };

export function PermisosAccionesConfig() {
  const [full, setFull] = useState<Config>({});
  const [modulo, setModulo] = useState<ModuloPerm>("ucp");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setFull(d?.[0]?.config ?? {}))
      .catch(() => setMsg("No se pudo cargar (¿existe la fila id=1 de app_permisos?)"))
      .finally(() => setCargando(false));
  }, []);

  // Lista efectiva de un rol: lo guardado, o el default de la matriz.
  const listaRol = (rol: string): string[] => {
    const saved = full.acciones?.[modulo]?.[rol];
    if (Array.isArray(saved)) return saved;
    return MATRIZ_DEFAULT[modulo][rol] ?? [];
  };
  const tiene = (rol: string, acc: string) => VEN_TODO.includes(rol) || listaRol(rol).includes(acc);

  const toggle = (rol: string, acc: string) => {
    if (VEN_TODO.includes(rol)) return;
    setFull((prev) => {
      const p: Config = JSON.parse(JSON.stringify(prev || {}));
      p.acciones = p.acciones || {};
      p.acciones[modulo] = p.acciones[modulo] || {};
      const base = Array.isArray(p.acciones[modulo][rol]) ? p.acciones[modulo][rol] : (MATRIZ_DEFAULT[modulo][rol] ?? []);
      const set = new Set(base);
      set.has(acc) ? set.delete(acc) : set.add(acc);
      p.acciones[modulo][rol] = [...set];
      return p;
    });
  };

  const guardar = async () => {
    setGuardando(true); setMsg(null);
    try {
      // Merge: releemos la config actual para no pisar "modulos" ni otros módulos.
      const cur = await fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers })
        .then((r) => (r.ok ? r.json() : [])).catch(() => []);
      const base: Config = cur?.[0]?.config ?? {};
      const nuevo: Config = {
        ...base,
        acciones: { ...(base.acciones || {}), ...(full.acciones || {}) },
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/app_permisos?id=eq.1`, {
        method: "PATCH", headers, body: JSON.stringify({ config: nuevo, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setFull(nuevo);
      limpiarCachePermisosAcciones();
      setMsg("Permisos guardados ✓");
    } catch (e: any) { setMsg("No se pudo guardar: " + e.message); }
    finally { setGuardando(false); }
  };

  if (cargando) return <p className="text-sm text-muted-foreground">Cargando permisos…</p>;

  const cols = ACCIONES[modulo];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[color:var(--teal)]" />
          <div>
            <p className="text-sm font-semibold">Permisos de acciones por módulo</p>
            <p className="text-xs text-muted-foreground">Marca qué puede hacer cada rol. DGE y Super_Admin siempre tienen todo.</p>
          </div>
        </div>
        <select value={modulo} onChange={(e) => setModulo(e.target.value as ModuloPerm)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          {MODULOS.map((m) => <option key={m.clave} value={m.clave}>{m.label}</option>)}
        </select>
      </div>

      <Card className="legal-card overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-border bg-muted/70 px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Rol</th>
              {cols.map((a) => (
                <th key={a.clave} className="border-b border-border bg-muted/70 px-2 py-2 text-center text-[10px] font-semibold uppercase text-muted-foreground">{a.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((rol) => (
              <tr key={rol.codigo} className="border-b border-border/60">
                <td className="sticky left-0 z-10 bg-card px-3 py-2">
                  <p className="font-medium">{rol.codigo}</p>
                  <p className="text-[10px] text-muted-foreground">{rol.nombre}</p>
                </td>
                {cols.map((a) => {
                  const on = tiene(rol.codigo, a.clave);
                  const fijo = VEN_TODO.includes(rol.codigo);
                  return (
                    <td key={a.clave} className="px-2 py-2 text-center">
                      <button onClick={() => toggle(rol.codigo, a.clave)} disabled={fijo}
                        className={`grid h-6 w-6 place-items-center rounded border mx-auto ${on ? "border-[color:var(--teal)] bg-[color:var(--teal)] text-white" : "border-input bg-background"} ${fijo ? "opacity-60" : "hover:border-[color:var(--teal)]"}`}>
                        {on && <Check className="h-4 w-4" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center gap-3">
        <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar permisos
        </button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES } from "@/lib/roles";
import { ACCIONES_URRJ, limpiarCachePermisos } from "@/lib/urrj-permisos";
import { Check, Loader2, ShieldCheck } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const VEN_TODO = ["DGE", "Super_Admin"];

export function PermisosURRJConfig() {
  const [config, setConfig] = useState<Record<string, string[]>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/urrj_permisos?select=config&id=eq.1`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setConfig(d?.[0]?.config ?? {}))
      .catch(() => setMsg("No se pudo cargar (¿corriste el SQL de permisos URRJ?)"))
      .finally(() => setCargando(false));
  }, []);

  const tiene = (rol: string, acc: string) => VEN_TODO.includes(rol) || (config[rol] || []).includes(acc);
  const toggle = (rol: string, acc: string) => {
    if (VEN_TODO.includes(rol)) return; // DGE/Super_Admin siempre todo
    setConfig((prev) => {
      const actuales = new Set(prev[rol] || []);
      actuales.has(acc) ? actuales.delete(acc) : actuales.add(acc);
      return { ...prev, [rol]: [...actuales] };
    });
  };

  const guardar = async () => {
    setGuardando(true); setMsg(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/urrj_permisos?id=eq.1`, {
        method: "PATCH", headers, body: JSON.stringify({ config, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      limpiarCachePermisos();
      setMsg("Permisos guardados ✓");
    } catch (e: any) { setMsg("No se pudo guardar: " + e.message); }
    finally { setGuardando(false); }
  };

  if (cargando) return <p className="text-sm text-muted-foreground">Cargando permisos…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[color:var(--teal)]" />
        <div>
          <p className="text-sm font-semibold">Permisos del URRJ (pre-dictamen)</p>
          <p className="text-xs text-muted-foreground">Marca qué puede hacer cada rol. DGE y Super_Admin siempre tienen todo.</p>
        </div>
      </div>

      <Card className="legal-card overflow-x-auto p-0">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-border bg-muted/70 px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Rol</th>
              {ACCIONES_URRJ.map((a) => (
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
                {ACCIONES_URRJ.map((a) => {
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

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { navItems } from "@/lib/nav";
import { Search, Bell, Settings, Users, Network, LogOut, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES, rolVeTodo } from "@/lib/roles";

const NAVY = "#0B1E3A";

// Qué módulo corresponde a cada ruta del menú
const MOD_RUTA: Record<string, string> = {
  "/": "inicio", "/expedientes": "expedientes", "/hitos": "hitos", "/ucm": "ucm", "/udp": "udp",
  "/control-demandas": "control_demandas", "/boletines": "boletines", "/exhortos": "exhortos",
  "/amparos": "amparos", "/recursos": "recursos", "/dictamen-ia": "dictamen_ia",
  "/contratos": "contratos", "/contratos/editor": "contratos", "/tramites": "tramites",
  "/ucp": "ucp", "/urrj": "urrj", "/conectores": "conectores",
};

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [visibles, setVisibles] = useState<Set<string> | null>(null); // null = ver todo
  const [puedeConfig, setPuedeConfig] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        const u = data.session?.user;
        const correo = u?.email ?? null;
        const meta: any = u?.user_metadata ?? {};
        setEmail(correo);
        setNombre(meta.full_name ?? meta.name ?? (correo ? correo.split("@")[0] : null));
        setFoto(meta.avatar_url ?? meta.picture ?? null);

        if (!correo) { setVisibles(null); setPuedeConfig(true); return; }

        const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
        const [colRes, permRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers: h }),
          fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers: h }),
        ]);
        const colData = colRes.ok ? await colRes.json() : [];
        const permData = permRes.ok ? await permRes.json() : [];
        const rol = colData?.[0]?.rol ?? null;

        if (!rol) { setVisibles(null); setPuedeConfig(true); return; } // sin rol asignado = ve todo hasta que lo validen

        const def = ROLES.find((r) => r.codigo === rol);
        if (def && rolVeTodo(def.modulos)) { setVisibles(null); setPuedeConfig(true); return; }

        const cfg = permData?.[0]?.config?.modulos ?? {};
        const mods: string[] = cfg[rol] ?? (def && def.modulos !== "todos" ? (def.modulos as string[]) : ["inicio"]);
        const set = new Set<string>(mods);
        set.add("inicio");
        setVisibles(set);
        setPuedeConfig(set.has("configuracion"));
      } catch {
        // Si algo falla (internet), NO bloqueamos: se ve todo.
        setVisibles(null);
        setPuedeConfig(true);
      }
    })();
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const salir = async () => {
    const auth = await getAuth();
    await auth.auth.signOut();
    window.location.href = "/";
  };

  const iniciales = (nombre || email || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const verRuta = (to: string) => visibles === null || visibles.has(MOD_RUTA[to] ?? "inicio");

  const grouped = useMemo(() => {
    const g: Record<string, typeof navItems> = {};
    for (const it of navItems) {
      if (visibles !== null && !visibles.has(MOD_RUTA[it.to] ?? "inicio")) continue;
      (g[it.group] ??= []).push(it);
    }
    return g;
  }, [visibles]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Link to="/" className="flex items-center gap-2.5 px-5 py-4 border-b border-sidebar-border transition-colors hover:bg-sidebar-accent/40">
          <img src="/justiciafacil-logo.png" alt="JusticiaFácil" className="h-11 w-auto rounded-md shadow-sm" />
          <div className="leading-tight">
            <p className="font-display text-base font-bold tracking-tight">JusticiaFácil</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">DIIPA Desarrollos</p>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">{group}</p>
              <ul className="mt-1 space-y-0.5">
                {items.map((it) => {
                  const active = it.to === "/" ? pathname === "/" : pathname === it.to || pathname.startsWith(it.to + "/");
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-[color:var(--teal)]"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <it.icon className="h-4 w-4" />
                        <span className="flex-1 leading-tight">
                          {it.label}
                          {it.sub && <span className="block text-[10px] font-normal text-sidebar-foreground/55">{it.sub}</span>}
                        </span>
                        {it.badge && (
                          <Badge className="h-4 px-1.5 text-[9px] bg-[color:var(--legal)] text-[color:var(--legal-foreground)] hover:bg-[color:var(--legal)]">
                            {it.badge}
                          </Badge>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar expediente, parte, juzgado, boletín…" className="pl-8 bg-card border-border h-9" />
          </div>

          <div className="flex items-center gap-2">
            <button className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[color:var(--legal)]" />
            </button>

            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuAbierto((v) => !v)} className="flex items-center gap-1.5 rounded-full p-0.5 hover:bg-accent" title={email ?? "Mi cuenta"}>
                <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[color:var(--teal)]/15 text-[11px] font-bold text-[color:var(--teal)] ring-1 ring-black/5">
                  {foto ? <img src={foto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (iniciales || "?")}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {menuAbierto && (
                <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  <div className="flex items-center gap-3 p-3" style={{ background: NAVY }}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-xs font-bold text-white">
                      {foto ? <img src={foto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (iniciales || "?")}
                    </span>
                    <div className="min-w-0 leading-tight text-white">
                      <p className="truncate text-sm font-semibold">{nombre ?? "Colaborador"}</p>
                      <p className="truncate text-[11px] text-white/70">{email ?? ""}</p>
                    </div>
                  </div>

                  <div className="p-1.5">
                    {puedeConfig && (
                      <>
                        <Link to="/configuracion" onClick={() => setMenuAbierto(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent">
                          <Settings className="h-4 w-4 text-muted-foreground" /> Configuración
                        </Link>
                        <Link to="/configuracion" search={{ tab: "colaboradores" } as any} onClick={() => setMenuAbierto(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent">
                          <Users className="h-4 w-4 text-muted-foreground" /> Colaboradores
                        </Link>
                        <Link to="/configuracion" search={{ tab: "conectores" } as any} onClick={() => setMenuAbierto(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent">
                          <Network className="h-4 w-4 text-muted-foreground" /> Conectores de Juzgados
                        </Link>
                        <div className="my-1 border-t border-border" />
                      </>
                    )}
                    <button onClick={salir} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

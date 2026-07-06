import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { navItems } from "@/lib/nav";
import { Search, Bell, Settings, Users, Network, LogOut, ChevronDown, Home, FolderOpen, Newspaper, FileCheck2, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { ROLES, rolVeTodo } from "@/lib/roles";

const NAVY = "#0B1E3A";

// Qué módulo corresponde a cada ruta del menú
const MOD_RUTA: Record<string, string> = {
  "/": "inicio", "/calendario": "inicio", "/direccion": "inicio", "/expedientes": "expedientes", "/ucm": "ucm", "/udp": "udp", "/ufc": "ucm", "/ufc-ficha": "ucm",
  "/boletines": "boletines", "/exhortos": "exhortos",
  "/amparos": "amparos", "/recursos": "recursos", "/dictamen-ia": "dictamen_ia",
  "/contratos": "contratos", "/contratos/editor": "contratos", "/tramites": "tramites",
  "/ucp": "ucp", "/ucp-ficha": "ucp", "/urrj": "urrj", "/conectores": "conectores",
};

// Los 4 accesos fijos de la barra inferior del celular (Inicio va al centro)
const BOTTOM: { to: string; label: string; icon: typeof Home; center?: boolean }[] = [
  { to: "/boletines", label: "Boletines", icon: Newspaper },
  { to: "/expedientes", label: "Expedientes", icon: FolderOpen },
  { to: "/", label: "Inicio", icon: Home, center: true },
  { to: "/tramites", label: "Trámites", icon: FileCheck2 },
];

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const [visibles, setVisibles] = useState<Set<string> | null>(null); // null = ver todo
  const [puedeConfig, setPuedeConfig] = useState(true);
  const [rol, setRol] = useState<string | null>(null);
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

        if (!correo) { setVisibles(null); setRol(null); setPuedeConfig(false); return; }

        const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
        const [colRes, permRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers: h }),
          fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers: h }),
        ]);
        const colData = colRes.ok ? await colRes.json() : [];
        const permData = permRes.ok ? await permRes.json() : [];
        const rolActual = colData?.[0]?.rol ?? null;
        setRol(rolActual);
        const esAdmin = rolActual === "Super_Admin" || rolActual === "DGE";

        if (!rolActual) { setVisibles(null); setPuedeConfig(false); return; } // sin rol: ve módulos (anti-bloqueo) pero NO Configuración

        const def = ROLES.find((r) => r.codigo === rolActual);
        if (def && rolVeTodo(def.modulos)) { setVisibles(null); setPuedeConfig(esAdmin); return; }

        const cfg = permData?.[0]?.config?.modulos ?? {};
        const mods: string[] = cfg[rolActual] ?? (def && def.modulos !== "todos" ? (def.modulos as string[]) : ["inicio"]);
        const set = new Set<string>(mods);
        set.add("inicio");
        setVisibles(set);
        setPuedeConfig(esAdmin);
      } catch {
        // Si algo falla (internet), NO bloqueamos los módulos de trabajo; pero
        // Configuración sí queda cerrada (no anti-bloqueo en Sistema).
        setVisibles(null);
        setRol(null);
        setPuedeConfig(false);
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

  const verRuta = (to: string) => {
    if (to === "/direccion") return rol === "DGE"; // Dirección: SOLO la Directora (DGE). Sobrescribe cualquier "todos".
    return visibles === null || visibles.has(MOD_RUTA[to] ?? "inicio");
  };

  const grouped = useMemo(() => {
    const g: Record<string, typeof navItems> = {};
    for (const it of navItems) {
      if (!verRuta(it.to)) continue;
      (g[it.group] ??= []).push(it);
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, rol]);

  // La página de firma por link se ve sola, sin menú ni barra lateral.
  if (pathname === "/firmar") return <Outlet />;

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
                        search={it.search as any}
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
                        <Link to="/configuracion" search={{ tab: undefined }} onClick={() => setMenuAbierto(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent">
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

        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* ===== Barra inferior estilo app (solo celular) ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-stretch border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {BOTTOM.map((it) => {
          if (!verRuta(it.to)) return null;
          const active = it.to === "/" ? pathname === "/" : pathname === it.to || pathname.startsWith(it.to + "/");
          if (it.center) {
            return (
              <Link key={it.to} to={it.to} className="relative flex flex-1 flex-col items-center justify-end pb-1.5 pt-2">
                <span className="absolute top-0 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border-4 border-background bg-[color:var(--teal)] text-white shadow-md">
                  <it.icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-medium text-[color:var(--teal)]">{it.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
                active ? "text-[color:var(--teal)] font-medium" : "text-muted-foreground"
              }`}
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          );
        })}
        <button onClick={() => setMasAbierto(true)} className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground">
          <MoreHorizontal className="h-5 w-5" />
          Más
        </button>
      </nav>

      {/* ===== Hoja "Todo el menú" (solo celular) ===== */}
      {masAbierto && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMasAbierto(false)} />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <p className="mb-3 text-sm font-semibold">Todo el menú</p>
            <div className="grid grid-cols-3 gap-2">
              {navItems.filter((it) => verRuta(it.to)).map((it) => {
                const active = it.to === "/" ? pathname === "/" : pathname === it.to || pathname.startsWith(it.to + "/");
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    search={it.search as any}
                    onClick={() => setMasAbierto(false)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-[11px] leading-tight ${
                      active ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-foreground"
                    }`}
                  >
                    <it.icon className="h-5 w-5 text-[color:var(--teal)]" />
                    {it.label}
                  </Link>
                );
              })}
              {puedeConfig && (
                <Link
                  to="/configuracion"
                  search={{ tab: undefined }}
                  onClick={() => setMasAbierto(false)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-[11px] leading-tight text-foreground"
                >
                  <Settings className="h-5 w-5 text-[color:var(--teal)]" />
                  Config.
                </Link>
              )}
              <button
                onClick={salir}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-[11px] leading-tight text-red-600"
              >
                <LogOut className="h-5 w-5" />
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { navItems } from "@/lib/nav";
import { Scale, Search, Bell, UserCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const grouped = useMemo(() => {
    const g: Record<string, typeof navItems> = {};
    for (const it of navItems) (g[it.group] ??= []).push(it);
    return g;
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[color:var(--teal)] text-[color:var(--teal-foreground)] shadow-sm">
            <Scale className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-bold tracking-tight">SIGA-DIIPA</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
              Sistema Jurídico
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
                {group}
              </p>
              <ul className="mt-1 space-y-0.5">
                {items.map((it) => {
                  const active =
                    it.to === "/"
                      ? pathname === "/"
                      : pathname === it.to || pathname.startsWith(it.to + "/");
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
                        <span className="flex-1">{it.label}</span>
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

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/40 px-2 py-2 text-xs">
            <UserCircle2 className="h-7 w-7 text-[color:var(--teal)]" />
            <div className="leading-tight">
              <p className="font-medium">Despacho SIGA</p>
              <p className="text-sidebar-foreground/60">Lic. en sesión</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar expediente, parte, juzgado, boletín…"
              className="pl-8 bg-card border-border h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[color:var(--legal)]" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

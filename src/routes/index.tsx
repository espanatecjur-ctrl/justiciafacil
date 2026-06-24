import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import {
  Gavel, Newspaper, FileSearch, AlertTriangle, CalendarClock,
  ChevronRight, ShieldCheck, Bookmark, FileText, BadgeCheck,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Inicio — JusticiaFácil" }] }),
  component: Inicio,
});

// Paleta profesional (tonos del logo): azul marino + verde + dorado
const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";

// ——— Datos de ejemplo (se conectan con el login después) ———
const COLAB = {
  nombre: "Lic. Milton",
  roles: ["DIL · Director Jurídico", "Rol URRJ", "Guadalajara"],
  iniciales: "MC",
};
const VALIDACIONES = [
  { t: "Apartados por revisar", n: 1, icon: Bookmark, to: "/expedientes" },
  { t: "Contratos en revisión", n: 2, icon: FileText, to: "/expedientes" },
  { t: "Dictámenes URRJ pendientes", n: 2, icon: ShieldCheck, to: "/urrj" },
];
const BOLETIN = [
  { exp: "412/2024", juzgado: "Juzgado 2º Civil · Culiacán", nota: "Admisión de pruebas — pasó la fecha sin acuerdo", urgente: true, tag: "Vencida" },
  { exp: "1057/2023", juzgado: "Juzgado 5º Civil · Mazatlán", nota: "Se señala audiencia para el 8 de julio", urgente: false, tag: "Nuevo" },
  { exp: "233/2025", juzgado: "Juzgado 1º Civil · La Paz", nota: "Se tiene por presentada la contestación", urgente: false, tag: "Nuevo" },
];
const AGENDA = [
  { d: "24", m: "jun", t: "Audiencia de pruebas", sub: "Juzgado 2º Civil Culiacán · Exp. 412/2024", hr: "10:00" },
  { d: "26", m: "jun", t: "Vence término de contestación", sub: "Juzgado 1º Civil Mazatlán · Exp. 145/2025", hr: "15:00" },
  { d: "08", m: "jul", t: "Audiencia señalada", sub: "Juzgado 5º Civil Mazatlán · Exp. 1057/2023", hr: "11:00" },
];

function Kpi({ icon: Icon, n, l, tone }: { icon: any; n: string; l: string; tone: string }) {
  return (
    <Card className="legal-card p-4">
      <div className={`grid h-9 w-9 place-items-center rounded-md mb-2 ${tone}`}><Icon className="h-4 w-4" /></div>
      <p className="text-2xl font-bold font-display leading-none">{n}</p>
      <p className="text-xs text-muted-foreground mt-1">{l}</p>
    </Card>
  );
}

function Inicio() {
  return (
    <div className="space-y-6">
      {/* ——— Ficha del colaborador (cabecera profesional) ——— */}
      <Card className="border-0 p-0 overflow-hidden shadow-sm">
        <div
          className="relative flex flex-wrap items-center justify-between gap-4 p-6 text-white"
          style={{ background: `linear-gradient(120deg, ${NAVY} 0%, #103A3A 55%, #0C5C46 100%)` }}
        >
          {/* línea dorada superior */}
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: GOLD }} />
          <div className="flex items-center gap-4">
            {/* Foto (si no existe, se ven las iniciales) */}
            <div
              className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-bold shadow"
              style={{ boxShadow: `0 0 0 2px ${GOLD}` }}
            >
              {COLAB.iniciales}
              <img
                src="/colaborador.jpg"
                alt=""
                onError={(e) => e.currentTarget.remove()}
                className="absolute inset-0 h-full w-full rounded-2xl object-cover"
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>JusticiaFácil · Despacho</p>
              <h1 className="font-display text-2xl font-bold leading-tight">Buen día, {COLAB.nombre}</h1>
              <p className="text-sm text-white/80">Hoy tienes 2 audiencias, 3 acuerdos nuevos del robot y 1 actuación por vencer.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COLAB.roles.map((r) => (
                  <span key={r} className="rounded-full px-2.5 py-0.5 text-[11px] border" style={{ borderColor: `${GOLD}66`, color: "#fff", background: "rgba(255,255,255,.06)" }}>{r}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-white/75">
            Hoy<br /><b className="font-display text-lg text-white">Miércoles 24 jun</b><br />Junio 2026
          </div>
        </div>
      </Card>

      {/* ——— KPIs ——— */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Gavel} n="2" l="Audiencias hoy" tone="bg-[#0B1E3A]/10 text-[#0B1E3A]" />
        <Kpi icon={Newspaper} n="3" l="Acuerdos nuevos" tone="bg-emerald-100 text-emerald-700" />
        <Kpi icon={FileSearch} n="5" l="Pre-dictámenes" tone="bg-[#C2A24C]/20 text-[#8A6E22]" />
        <Kpi icon={AlertTriangle} n="1" l="Actuación por vencer" tone="bg-red-100 text-red-700" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* ——— Izquierda ——— */}
        <div className="space-y-6">
          {/* Boletines de nuestros juicios */}
          <Card className="legal-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded" style={{ background: GOLD }} />
                <h3 className="font-display text-lg font-semibold">Boletines de nuestros juicios</h3>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 3 nuevos · hoy
              </span>
            </div>
            <div className="divide-y divide-border">
              {BOLETIN.map((h) => (
                <div key={h.exp} className="flex gap-3 py-3">
                  <span className={`w-1 rounded ${h.urgente ? "bg-red-500" : "bg-emerald-500"}`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${h.urgente ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{h.tag}</span>
                      <span className="font-mono text-xs">Exp. {h.exp}</span>
                    </div>
                    <p className="text-sm font-semibold">{h.juzgado}</p>
                    <p className="text-xs text-muted-foreground">{h.nota}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Agenda */}
          <Card className="legal-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded" style={{ background: GOLD }} />
                <h3 className="font-display text-lg font-semibold">Mi agenda</h3>
              </div>
              <Link to="/hitos" className="flex items-center gap-1 text-xs text-[#0B1E3A]">Ver todo <ChevronRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="divide-y divide-border">
              {AGENDA.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <div className="w-12 text-center">
                    <p className="font-display text-xl font-bold leading-none">{a.d}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">{a.m}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{a.t}</p>
                    <p className="text-xs text-muted-foreground">{a.sub}</p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{a.hr}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ——— Derecha ——— */}
        <div className="space-y-6">
          {/* Validaciones pendientes */}
          <Card className="legal-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" style={{ color: GOLD }} />
              <h3 className="font-display text-base font-semibold">Validaciones pendientes</h3>
            </div>
            <div className="divide-y divide-border">
              {VALIDACIONES.map((v) => (
                <Link key={v.t} to={v.to} className="flex items-center gap-3 py-2.5 hover:bg-muted/40 rounded-md px-1 -mx-1">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#C2A24C]/15 text-[#8A6E22]"><v.icon className="h-4 w-4" /></div>
                  <p className="flex-1 text-sm">{v.t}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{v.n}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </Card>

          {/* Próximo vencimiento */}
          <Card className="legal-card p-5">
            <div className="mb-2 flex items-center gap-2">
              <CalendarClock className="h-4 w-4" style={{ color: NAVY }} />
              <h3 className="font-display text-base font-semibold">Próximo vencimiento</h3>
            </div>
            <p className="text-sm text-muted-foreground">El <b>26 de junio</b> vence un término de contestación. Si pasa la fecha sin acuerdo, el aviso escala a <b>DIL</b> y <b>DGE</b>.</p>
          </Card>

          {/* Áreas */}
          <Card className="legal-card p-5">
            <h3 className="font-display text-base font-semibold mb-3">Áreas que cubro</h3>
            <div className="flex flex-wrap gap-2">
              {["Jurídico", "URRJ · Pre-dictamen", "Demandas y litigios", "Amparos", "Exhortos"].map((a) => (
                <span key={a} className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: `${GOLD}66`, color: NAVY, background: `${GOLD}10` }}>{a}</span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

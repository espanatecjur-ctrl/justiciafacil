import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { getAuth, rolActual } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { listarAtrasadas, listarAgenda, contarAcuerdosHoy, contarCasos, contarPorUnidad, contarContratosPendientes, contarAudienciasHoy, contarPredictamenes, mapaUnidadPorCaso, type Atrasada, type Cita } from "@/lib/resumen-inicio";
import { listarProximos, ESTILO_EVENTO, type Evento } from "@/lib/evento-agenda";
import { MisTareas } from "@/components/panel-seguimiento";
import { SolicitudesPendientesHome } from "@/components/solicitudes-home";
import {
  Gavel, Newspaper, FileSearch, AlertTriangle, CalendarClock,
  ChevronRight, ShieldCheck, Bookmark, FileText, BadgeCheck,
  Send, Shield, RotateCcw,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Inicio — JusticiaFácil" }] }),
  component: Inicio,
});

// Paleta profesional (tonos del logo): azul marino + verde + dorado
const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";

// ——— Datos de ejemplo (se conectan con los módulos después) ———
const VALIDACIONES = [
  { t: "Apartados por revisar", n: 1, icon: Bookmark, to: "/expedientes" },
  { t: "Contratos en revisión", n: 2, icon: FileText, to: "/expedientes" },
  { t: "Dictámenes URRJ pendientes", n: 2, icon: ShieldCheck, to: "/urrj" },
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

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "·";
}

/** Carga el usuario real: nombre/foto de la FICHA del colaborador; si no,
 *  el nombre/foto de Google; y de última, sus iniciales. */
function useUsuario() {
  const [u, setU] = useState<{ nombre: string; foto: string; rol: string }>({ nombre: "", foto: "", rol: "" });
  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        const meta = (data.session?.user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
        const correo = data.session?.user?.email ?? "";
        const nombreGoogle = meta.full_name || meta.name || correo || "Usuario";
        const fotoGoogle = meta.avatar_url || meta.picture || "";

        // Ficha del colaborador (foto subida + nombre + rol).
        let fotoFicha = "", nombreFicha = "", rol = "";
        if (correo) {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/colaboradores?select=nombre,rol,foto_url&correo=eq.${encodeURIComponent(correo)}&limit=1`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
          );
          const filas = r.ok ? await r.json() : [];
          const c = filas?.[0];
          fotoFicha = c?.foto_url || "";
          nombreFicha = c?.nombre || "";
          rol = c?.rol || "";
        }
        setU({
          nombre: nombreFicha || nombreGoogle,
          foto: fotoFicha || fotoGoogle,   // la ficha manda; si no hay, la de Google
          rol: rol || (await rolActual()),
        });
      } catch { /* nada */ }
    })();
  }, []);
  return u;
}

function Inicio() {
  const usuario = useUsuario();
  const nombre = usuario.nombre || "…";
  const hoy = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "short" });
  const mesAnio = new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });

  const [atrasadas, setAtrasadas] = useState<Atrasada[]>([]);
  const [acuerdosHoy, setAcuerdosHoy] = useState(0);
  const [audienciasHoy, setAudienciasHoy] = useState(0);
  const [predictamenes, setPredictamenes] = useState(0);
  const [conteos, setConteos] = useState({ exhorto: 0, amparo: 0, recurso: 0 });
  const [unidades, setUnidades] = useState({ URRJ: 0, UCP: 0, UCM: 0, UDP: 0 });
  const [contratosPend, setContratosPend] = useState(0);
  const [agenda, setAgenda] = useState<Cita[]>([]);
  const [proximos, setProximos] = useState<Evento[]>([]);
  const [mapaU, setMapaU] = useState<Record<string, string>>({});
  useEffect(() => {
    listarAtrasadas().then(setAtrasadas);
    listarAgenda().then(setAgenda);
    listarProximos(6).then(setProximos);
    mapaUnidadPorCaso().then(setMapaU);
    contarAcuerdosHoy().then(setAcuerdosHoy);
    contarAudienciasHoy().then(setAudienciasHoy);
    contarPredictamenes().then(setPredictamenes);
    Promise.all([contarCasos("exhorto"), contarCasos("amparo"), contarCasos("recurso")])
      .then(([exhorto, amparo, recurso]) => setConteos({ exhorto, amparo, recurso }));
    Promise.all([contarPorUnidad("URRJ"), contarPorUnidad("UCP"), contarPorUnidad("UCM"), contarPorUnidad("UDP")])
      .then(([URRJ, UCP, UCM, UDP]) => setUnidades({ URRJ, UCP, UCM, UDP }));
    contarContratosPendientes().then(setContratosPend);
  }, []);

  // Cuántos atrasados tiene cada unidad (cruzando el expediente con su unidad).
  const atrasoUnidad: Record<string, number> = {};
  for (const a of atrasadas) {
    const u = a.caso_id ? mapaU[a.caso_id] : "";
    if (u) atrasoUnidad[u] = (atrasoUnidad[u] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      {/* ——— Ficha del colaborador (cabecera profesional) ——— */}
      <Card className="border-0 p-0 overflow-hidden shadow-sm">
        <div
          className="relative flex flex-wrap items-center justify-between gap-4 px-8 py-9 text-white"
          style={{ background: `linear-gradient(120deg, ${NAVY} 0%, #103A3A 55%, #0C5C46 100%)` }}
        >
          {/* línea dorada superior */}
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: GOLD }} />
          <div className="flex items-center gap-5">
            {/* Foto redonda grande (ficha del colaborador; si no, iniciales) */}
            <div
              className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full bg-white/15 font-display text-3xl font-bold shadow overflow-hidden"
              style={{ boxShadow: `0 0 0 3px ${GOLD}` }}
            >
              {iniciales(nombre)}
              {usuario.foto && (
                <img
                  src={usuario.foto}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => e.currentTarget.remove()}
                  className="absolute inset-0 h-full w-full rounded-full object-cover"
                />
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: GOLD }}>JusticiaFácil · Despacho</p>
              <h1 className="font-display text-3xl font-bold leading-tight">Buen día, {nombre}</h1>
              <p className="text-sm text-white/80">Este es tu resumen del día.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(usuario.rol ? [usuario.rol] : []).map((r) => (
                  <span key={r} className="rounded-full px-2.5 py-0.5 text-[11px] border" style={{ borderColor: `${GOLD}66`, color: "#fff", background: "rgba(255,255,255,.06)" }}>{r}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-white/75 capitalize">
            Hoy<br /><b className="font-display text-xl text-white capitalize">{hoy}</b><br />{mesAnio}
          </div>
        </div>
      </Card>

      {/* ——— KPIs ——— */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Gavel} n={String(audienciasHoy)} l="Audiencias hoy" tone="bg-[#0B1E3A]/10 text-[#0B1E3A]" />
        <Kpi icon={Newspaper} n={String(acuerdosHoy)} l="Acuerdos nuevos" tone="bg-emerald-100 text-emerald-700" />
        <Kpi icon={FileSearch} n={String(predictamenes)} l="Pre-dictámenes" tone="bg-[#C2A24C]/20 text-[#8A6E22]" />
        <Kpi icon={AlertTriangle} n={String(atrasadas.length)} l="Actuaciones atrasadas" tone="bg-red-100 text-red-700" />
      </div>

      {/* ——— Áreas ——— */}
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded" style={{ background: GOLD }} />
        <h3 className="font-display text-base font-semibold">Áreas</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/exhortos" className="legal-card flex items-center gap-3 p-4 transition hover:border-[color:var(--teal)]">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[#0B1E3A]/10 text-[#0B1E3A]"><Send className="h-5 w-5" /></div>
          <div><p className="font-display text-xl font-bold leading-none">{conteos.exhorto}</p><p className="mt-0.5 text-xs text-muted-foreground">Exhortos</p></div>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to="/amparos" className="legal-card flex items-center gap-3 p-4 transition hover:border-[color:var(--teal)]">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[#C2A24C]/20 text-[#8A6E22]"><Shield className="h-5 w-5" /></div>
          <div><p className="font-display text-xl font-bold leading-none">{conteos.amparo}</p><p className="mt-0.5 text-xs text-muted-foreground">Amparos</p></div>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to="/recursos" className="legal-card flex items-center gap-3 p-4 transition hover:border-[color:var(--teal)]">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-100 text-emerald-700"><RotateCcw className="h-5 w-5" /></div>
          <div><p className="font-display text-xl font-bold leading-none">{conteos.recurso}</p><p className="mt-0.5 text-xs text-muted-foreground">Recursos</p></div>
          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* ——— Pendientes por unidad + Contratos ——— */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="h-4 w-1 rounded" style={{ background: GOLD }} />
          <h3 className="font-display text-base font-semibold">Pendientes por unidad</h3>
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Link to="/urrj" className="legal-card p-4 transition hover:border-[color:var(--teal)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B1E3A]">URRJ</p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">{unidades.URRJ}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">expedientes</p>
            {atrasoUnidad.URRJ > 0 && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">{atrasoUnidad.URRJ} atrasado{atrasoUnidad.URRJ === 1 ? "" : "s"}</span>}
          </Link>
          <Link to="/ucp" className="legal-card p-4 transition hover:border-[color:var(--teal)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B1E3A]">UCP</p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">{unidades.UCP}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">expedientes</p>
            {atrasoUnidad.UCP > 0 && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">{atrasoUnidad.UCP} atrasado{atrasoUnidad.UCP === 1 ? "" : "s"}</span>}
          </Link>
          <Link to="/ucm" className="legal-card p-4 transition hover:border-[color:var(--teal)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B1E3A]">UCM</p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">{unidades.UCM}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">expedientes</p>
            {atrasoUnidad.UCM > 0 && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">{atrasoUnidad.UCM} atrasado{atrasoUnidad.UCM === 1 ? "" : "s"}</span>}
          </Link>
          <Link to="/udp" className="legal-card p-4 transition hover:border-[color:var(--teal)]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B1E3A]">UDP</p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">{unidades.UDP}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">expedientes</p>
            {atrasoUnidad.UDP > 0 && <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">{atrasoUnidad.UDP} atrasado{atrasoUnidad.UDP === 1 ? "" : "s"}</span>}
          </Link>
          <Link to="/contratos" className="legal-card p-4 transition hover:border-[color:var(--teal)]">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#8A6E22]"><FileText className="h-3 w-3" /> Contratos</p>
            <p className="mt-1 font-display text-2xl font-bold leading-none">{contratosPend}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">pendientes</p>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* ——— Izquierda ——— */}
        <div className="space-y-6">
          {/* Juicios atrasados (real) */}
          <Card className="legal-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded" style={{ background: GOLD }} />
                <h3 className="font-display text-lg font-semibold">Juicios atrasados</h3>
              </div>
              {atrasadas.length > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {atrasadas.length} atrasado{atrasadas.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {atrasadas.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Sin actuaciones atrasadas. Todo al día. 🎉</p>
            ) : (
              <div className="divide-y divide-border">
                {atrasadas.slice(0, 8).map((a, i) => (
                  <Link
                    key={i}
                    to="/expedientes/$id"
                    params={{ id: a.caso_id || "" }}
                    className="flex gap-3 py-3 hover:bg-muted/30 -mx-2 px-2 rounded"
                  >
                    <span className="w-1 rounded bg-red-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          Vencida hace {a.diasAtraso} día{a.diasAtraso === 1 ? "" : "s"}
                        </span>
                        <span className="font-mono text-xs">Exp. {a.expediente || "—"}</span>
                      </div>
                      <p className="text-sm font-semibold">{a.proxima_actuacion || "Actuación pendiente"}</p>
                      <p className="text-xs text-muted-foreground">Vencía el {a.fecha_proxima}{a.asignado_a ? ` · ${a.asignado_a}` : ""}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 self-center text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Agenda */}
          <Card className="legal-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded" style={{ background: GOLD }} />
                <h3 className="font-display text-lg font-semibold">Mi agenda</h3>
              </div>
            </div>
            <div className="divide-y divide-border">
              {agenda.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No hay próximas actuaciones agendadas.</p>
              ) : (
                agenda.slice(0, 8).map((a, i) => {
                  const f = a.fecha_proxima ? new Date(a.fecha_proxima) : null;
                  const dia = f ? String(f.getUTCDate()).padStart(2, "0") : "—";
                  const mes = f ? f.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }) : "";
                  return (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <div className="w-12 text-center">
                        <p className="font-display text-xl font-bold leading-none">{dia}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{mes}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{a.proxima_actuacion || "Próxima actuación"}</p>
                        <p className="text-xs text-muted-foreground">Exp. {a.expediente || "—"}{a.asignado_a ? ` · ${a.asignado_a}` : ""}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <SolicitudesPendientesHome />
        </div>

        {/* ——— Derecha ——— */}
        <div className="space-y-6">
          {/* Próximo en tu calendario */}
          <Card className="legal-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" style={{ color: GOLD }} />
                <h3 className="font-display text-base font-semibold">Próximo en tu calendario</h3>
              </div>
              <Link to="/calendario" className="text-xs font-medium text-[color:var(--teal)] hover:underline">Ver todo</Link>
            </div>
            {proximos.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No tienes eventos próximos. <Link to="/calendario" className="text-[color:var(--teal)] hover:underline">Agenda uno</Link>.</p>
            ) : (
              <div className="divide-y divide-border">
                {proximos.map((e) => {
                  const st = ESTILO_EVENTO[e.tipo || "evento"] ?? ESTILO_EVENTO.evento;
                  const f = e.fecha ? new Date(e.fecha) : null;
                  const dia = f ? String(f.getUTCDate()).padStart(2, "0") : "—";
                  const mes = f ? f.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }) : "";
                  return (
                    <Link key={e.id} to="/calendario" className="flex items-center gap-3 py-2.5 hover:bg-muted/40 -mx-1 px-1 rounded-md">
                      <div className="w-11 text-center">
                        <p className="font-display text-lg font-bold leading-none">{dia}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{mes}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{e.titulo || "(sin título)"}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.bg} ${st.text}`}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} /> {st.label}{e.hora ? ` · ${e.hora}` : ""}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Mis tareas (asignadas a mí) */}
          <MisTareas />
        </div>
      </div>
    </div>
  );
}

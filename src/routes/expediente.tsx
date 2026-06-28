import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { EvidenciaSeguimiento } from "@/components/evidencia-seguimiento";
import {
  ArrowLeft, Loader2, AlertTriangle, Landmark, Gavel, Scale,
  DollarSign, Signature, Megaphone, Lightbulb, Lock, Shield, Layers, Send,
} from "lucide-react";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

interface Acuerdo {
  id: string;
  expediente: string | null;
  fecha_acuerdo: string | null;
  texto: string | null;
  tipo_acuerdo: string | null;
  urgente: boolean | null;
}

export const Route = createFileRoute("/expediente")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
    nueva: s.nueva === true || s.nueva === "true",
  }),
  head: () => ({ meta: [{ title: "Ficha del expediente — JusticiaFácil" }] }),
  component: FichaExpedientePage,
});

// Parsea "YYYY-MM-DD" como fecha LOCAL (evita que se vea un día antes)
function parseLocal(s: string | null): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtFecha(s: string | null): string {
  const d = parseLocal(s);
  return d ? d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) : "—";
}
function diasDesde(s: string | null): number | null {
  const d = parseLocal(s);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Sugerencia simple de "qué sigue" según el último acuerdo del boletín
function sugerencia(texto: string | null): string {
  const t = (texto || "").toUpperCase();
  if (!t) return "Aún no hay actuación registrada en el boletín. Verifica que el juzgado esté asignado.";
  if (t.includes("ESCRITURA")) return "Dar seguimiento a la escrituración / otorgamiento en rebeldía.";
  if (t.includes("REMATE") || t.includes("AUDIENCIA")) return "Confirmar la fecha de audiencia/remate y preparar lo necesario.";
  if (t.includes("SENTENCIA")) return "Revisar la sentencia: términos para recurso o para iniciar ejecución.";
  if (t.includes("EJECUCION") || t.includes("EJECUCIÓN")) return "Impulsar el procedimiento de ejecución.";
  if (t.includes("GIRESE OFICIO") || t.includes("GIRENSE OFICIOS")) return "Vigilar la respuesta del oficio girado.";
  if (t.includes("LIQUIDACION") || t.includes("PLANILLA")) return "Dar seguimiento a la planilla de liquidación.";
  if (t.includes("NO HA LUGAR") || t.includes("PREVIENE")) return "Atender la prevención / subsanar lo requerido por el juzgado.";
  return "Registrar la próxima actuación y dar impulso procesal.";
}

// Triangulito rojo cuando falta info
function Faltante({ texto = "Falta información" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700" title={texto}>
      <AlertTriangle className="h-3 w-3" /> {texto}
    </span>
  );
}

// Tarjeta de sección reutilizable
function Seccion({ icon, titulo, falta, children }: { icon: React.ReactNode; titulo: string; falta?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
        {falta && <Faltante />}
      </div>
      {children}
    </div>
  );
}

// Fila de dato: label + valor (marca ⚠️ si vacío y es importante)
function Dato({ label, valor, importante }: { label: string; valor?: string | null; importante?: boolean }) {
  const vacio = !valor || !String(valor).trim();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">
        {vacio ? (importante ? <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> falta</span> : "—") : valor}
      </span>
    </div>
  );
}

// Sección "próximamente" (placeholder de partes 2 y 3)
function Proximamente({ icon, titulo, nota }: { icon: React.ReactNode; titulo: string; nota: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">{icon} {titulo} <Lock className="h-3.5 w-3.5" /></p>
      <p className="mt-1 text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}

function FichaExpedientePage() {
  const { id, nueva } = Route.useSearch();
  const navigate = useNavigate();
  const [caso, setCaso] = useState<CasoJuridico | null>(null);
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${id}`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(async (d) => {
        const c: CasoJuridico | null = d?.[0] ?? null;
        setCaso(c);
        if (c?.expediente) {
          const exp = c.expediente.trim();
          const ra = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=*&expediente=eq.${encodeURIComponent(exp)}&order=fecha_acuerdo.desc&limit=200`, { headers });
          setAcuerdos(ra.ok ? await ra.json() : []);
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [id]);

  const destino = caso?.tipo_registro === "amparo" ? "/amparos" : caso?.tipo_registro === "recurso" ? "/recursos" : caso?.tipo_registro === "exhorto" ? "/exhortos" : "/ucm";
  const volver = () => navigate({ to: destino });

  if (cargando) return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…</div>
  );
  if (!caso) return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">No se encontró el expediente.</p>
      <button onClick={volver} className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver</button>
    </div>
  );

  const c = caso;
  const ultima = acuerdos[0] || null;
  const dias = ultima ? diasDesde(ultima.fecha_acuerdo) : null;
  const sinJuzgado = !(c.nombre_juzgado || c.cve_juzgado || c.juzgado);

  // banderas de faltantes por sección
  const esEspecial = ["amparo", "recurso", "exhorto"].includes(c.tipo_registro || "juicio");
  const faltaAntecedente = !c.proveedor || !c.no_credito || !c.direccion_garantia || !(c.cliente_nombre || c.cliente_codigo);
  const faltaEstatus = esEspecial ? !c.estatus_general : (!c.etapa_actual || !c.estatus_general || !c.prioridad);
  const faltaSeguimiento = sinJuzgado; // solo es "falta" si no hay juzgado; sin actuaciones aún NO es falta (el robot las trae)

  return (
    <div className="space-y-4">
      {/* volver */}
      <button onClick={volver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>

      {/* Encabezado */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
        <p className="text-xs uppercase tracking-wider text-white/60">Ficha del expediente</p>
        <h1 className="mt-0.5 text-2xl font-bold">{c.expediente || "— sin expediente —"}</h1>
        <p className="mt-1 text-sm text-white/85">
          {(c.actor || "—")} <span className="text-white/50">vs</span> {(c.demandado || "—")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {c.materia && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{c.materia}</span>}
          {c.via_procesal && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{c.via_procesal}</span>}
          {c.entidad && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{c.entidad}</span>}
          {c.prioridad && <span className="rounded-full bg-white/15 px-2.5 py-0.5">Prioridad {c.prioridad}</span>}
        </div>
        <p className="mt-2 text-xs text-white/70">{c.nombre_juzgado || c.juzgado || "Juzgado sin asignar"}{c.distrito_judicial ? ` · ${c.distrito_judicial}` : ""}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Antecedente: garantía (juicio) o datos del amparo */}
        {c.tipo_registro === "amparo" ? (
          <Seccion icon={<Shield className="h-4 w-4" style={{ color: TEAL }} />} titulo="Datos del amparo" falta={!c.quejoso || !c.acto_reclamado}>
            <Dato label="Tipo de amparo" valor={c.tipo_amparo} />
            <Dato label="Quejoso" valor={c.quejoso} importante />
            <Dato label="Autoridad responsable" valor={c.autoridad_responsable} importante />
            <Dato label="Acto reclamado" valor={c.acto_reclamado} importante />
          </Seccion>
        ) : c.tipo_registro === "recurso" ? (
          <Seccion icon={<Layers className="h-4 w-4" style={{ color: TEAL }} />} titulo="Datos del recurso" falta={!c.promovente}>
            <Dato label="Tipo de recurso" valor={c.tipo_recurso} />
            <Dato label="Promovente" valor={c.promovente} importante />
            <Dato label="Fecha de interposición" valor={c.fecha_interposicion} />
            <Dato label="Resolución" valor={c.resolucion} />
          </Seccion>
        ) : c.tipo_registro === "exhorto" ? (
          <Seccion icon={<Send className="h-4 w-4" style={{ color: TEAL }} />} titulo="Datos del exhorto" falta={!c.diligencia}>
            <Dato label="Folio" valor={c.folio} />
            <Dato label="Expediente origen" valor={c.expediente_origen} />
            <Dato label="Juzgado origen" valor={c.juzgado_origen} />
            <Dato label="Diligencia" valor={c.diligencia} importante />
            <Dato label="Vence" valor={c.fecha_vence} />
          </Seccion>
        ) : (
          <Seccion icon={<Landmark className="h-4 w-4" style={{ color: TEAL }} />} titulo="Antecedente de la garantía" falta={faltaAntecedente}>
            <Dato label="ID garantía" valor={c.gar_id} />
            <Dato label="Proveedor / Administradora" valor={c.proveedor} importante />
            <Dato label="No. de crédito" valor={c.no_credito} importante />
            <Dato label="Dirección de la garantía" valor={c.direccion_garantia} importante />
            <Dato label="Cliente" valor={c.cliente_nombre || c.cliente_codigo} importante />
            <Dato label="Tipo de proceso" valor={c.tipo_proceso} />
          </Seccion>
        )}

        {/* Estatus actual */}
        <Seccion icon={<Scale className="h-4 w-4" style={{ color: TEAL }} />} titulo="Estatus actual" falta={faltaEstatus}>
          {!esEspecial && <Dato label="Etapa actual" valor={c.etapa_actual} importante />}
          <Dato label={esEspecial ? "Estado" : "Estatus general"} valor={c.estatus_general} importante />
          <Dato label="Prioridad" valor={c.prioridad} importante={!esEspecial} />
          <Dato label="Unidad / Encargado" valor={[c.unidad, c.encargado_unidad].filter(Boolean).join(" · ")} />
          <Dato label="Nota adicional" valor={c.nota_adicional} />
        </Seccion>
      </div>

      {/* Última actuación en el boletín + Qué sigue */}
      <Seccion icon={<Megaphone className="h-4 w-4" style={{ color: TEAL }} />} titulo="Última actuación en el boletín" falta={faltaSeguimiento}>
        {sinJuzgado ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mr-1 inline h-4 w-4" /> Falta asignar el juzgado para que el robot pueda seguir este expediente en el boletín.
          </div>
        ) : ultima ? (
          <>
            <div className="rounded-md bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{fmtFecha(ultima.fecha_acuerdo)}{dias != null && ` · hace ${dias} días`}</span>
                {ultima.urgente && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">urgente</span>}
              </div>
              <p className="mt-1 text-sm">{ultima.texto || "—"}</p>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: TEAL }}>Qué sigue (sugerencia)</p>
                <p className="text-sm">{sugerencia(ultima.texto)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{acuerdos.length} actuaciones registradas en el boletín.</p>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3 text-sm">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
              <div>
                <p className="font-medium" style={{ color: TEAL }}>Listo para el robot — aún sin actuaciones.</p>
                <p className="mt-0.5 text-muted-foreground">El juzgado ya está asignado. El robot revisa el boletín <b>todos los días a las 9:00 AM</b> y, cuando aparezca un acuerdo de este expediente, se llenará aquí solo. No necesitas hacer nada.</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Si después de varios días sigue vacío, revisa que el <b>número de expediente</b> y el <b>juzgado</b> coincidan exactamente con los del boletín (puedes corregirlos en "Asignar juzgado").</p>
          </div>
        )}
      </Seccion>

      {/* Seguimiento (evidencia) — Parte 2 */}
      <EvidenciaSeguimiento casoId={c.id} expediente={c.expediente} abrirNueva={nueva} />

      {/* Secciones que llegan en la siguiente parte */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Proximamente icon={<Gavel className="h-4 w-4" />} titulo="Pre-dictamen y dictámenes" nota="Pre-dictamen URRJ, dictamen jurídico y registral. (Parte 3)" />
        <Proximamente icon={<Signature className="h-4 w-4" />} titulo="Firmas" nota="Estado de firmas del expediente. (Parte 3)" />
        <Proximamente icon={<DollarSign className="h-4 w-4" />} titulo="Precios" nota="Valores de la garantía. (Parte 3)" />
      </div>
    </div>
  );
}

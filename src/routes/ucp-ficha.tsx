import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Loader2, ScrollText, Landmark, CheckCircle2, XCircle, Clock, PenLine, Download, Eye,
  LayoutGrid, GitBranch, FolderOpen, Megaphone, Stamp, Scale, AlertTriangle,
} from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { DocumentosGarantia } from "@/components/documentos-garantia";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { SubJuicios } from "@/components/sub-juicios";
import { BoletinExpediente } from "@/components/boletin-expediente";

export const Route = createFileRoute("/ucp-ficha")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Ficha UCP — JusticiaFácil" }] }),
  component: UCPFicha,
});

const NAVY = "#0B1E3A";
const AZUL = "#0C447C"; // color de UCP

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

type Modulo = "general" | "proceso" | "subjuicios" | "documentos" | "boletin";

interface Acuerdo { id: string; expediente: string | null; fecha_acuerdo: string | null; texto: string | null; tipo_acuerdo: string | null; urgente: boolean | null; }

const fmtFecha = (s: string | null) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
};

function DatoUCP({ label, valor, importante }: { label: string; valor?: string | null; importante?: boolean }) {
  const vacio = !valor || !String(valor).trim();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{vacio ? (importante ? <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> falta</span> : "—") : valor}</span>
    </div>
  );
}

function SeccionUCP({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
      {children}
    </div>
  );
}

function UCPFicha() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [c, setC] = useState<CasoJuridico | null>(null);
  const [dict, setDict] = useState<any>(null);
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modulo, setModulo] = useState<Modulo>("general");

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=*&caso_id=eq.${id}&vigente=eq.true&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(async ([cs, ds]) => {
        const caso: CasoJuridico | null = cs?.[0] || null;
        setC(caso); setDict(ds?.[0] || null);
        if (caso?.expediente) {
          const ra = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=*&expediente=eq.${encodeURIComponent(caso.expediente.trim())}&order=fecha_acuerdo.desc&limit=200`, { headers });
          setAcuerdos(ra.ok ? await ra.json() : []);
        }
      })
      .finally(() => setCargando(false));
  }, [id]);

  const guardarCampos = async (campos: Record<string, string>) => {
    if (!c) return;
    await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(campos) });
    setC({ ...c, ...(campos as any) });
  };

  // arma y descarga el PDF del dictamen usando la función que ya existe
  const armarFirmas = () => {
    const firmasArr: { titulo: string; firma: any }[] = [];
    const fj = dict?.firmas && typeof dict.firmas === "object" ? (dict.firmas.juridico || dict.firmas.juridico_firma) : null;
    const fr = dict?.firmas && typeof dict.firmas === "object" ? (dict.firmas.registral || dict.firmas.registral_firma) : null;
    if (fj) firmasArr.push({ titulo: "Dictamen jurídico", firma: typeof fj === "string" ? { nombre: fj } : fj });
    if (fr) firmasArr.push({ titulo: "Dictamen registral (RPPC)", firma: typeof fr === "string" ? { nombre: fr } : fr });
    return firmasArr;
  };
  const datosPDF = () => ({
    expediente: c?.expediente || undefined,
    juzgado: c?.juzgado || undefined,
    garantia: c?.direccion_garantia || (c as any)?.gar_id || undefined,
    cliente: c?.cliente_nombre || undefined,
    entidad: c?.entidad || undefined,
    veredictoJuridico: dict?.juridico?.veredicto || undefined,
    veredictoRegistral: (typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : undefined),
    veredictoFinal: dict?.veredicto || undefined,
    firmas: armarFirmas(),
  });
  const descargarPDF = async () => {
    if (!c) return;
    const { descargarDictamenFinalPDF } = await import("@/lib/dictamen-final-pdf");
    await descargarDictamenFinalPDF(datosPDF());
  };
  const verDictamenPDF = async () => {
    if (!c) return;
    const { descargarDictamenFinalPDF } = await import("@/lib/dictamen-final-pdf");
    await descargarDictamenFinalPDF(datosPDF(), "ver");
  };

  if (cargando) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…</div>;
  if (!c) return <div className="p-8 text-sm text-muted-foreground">No se encontró el caso. <button onClick={() => navigate({ to: "/ucp" })} className="underline">Volver a UCP</button></div>;

  const firmasN = ["elabora", "dil", "gad", "dgc", "dge"].filter((k) => (dict?.firmas as any)?.[k]?.fecha).length;
  const sinJuzgado = !(c.nombre_juzgado || c.cve_juzgado || c.juzgado);
  const ultima = acuerdos[0] || null;

  const MODULOS: { id: Modulo; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <LayoutGrid className="h-4 w-4" /> },
    { id: "proceso", label: "Proceso", icon: <Stamp className="h-4 w-4" /> },
    { id: "subjuicios", label: "Sub-juicios", icon: <GitBranch className="h-4 w-4" /> },
    { id: "documentos", label: "Documentos", icon: <FolderOpen className="h-4 w-4" /> },
    { id: "boletin", label: "Boletín", icon: <Megaphone className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* barra superior */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate({ to: "/ucp" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Volver a UCP</button>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: AZUL }}>UCP</span>
        <button onClick={descargarPDF} className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}>
          <Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF
        </button>
      </div>

      {/* encabezado (siempre visible) */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${AZUL})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Ficha UCP · Consolidación Patrimonial</p>
        <p className="text-2xl font-bold">{c.expediente || "Sin expediente"}</p>
        <p className="text-sm text-white/80">{c.direccion_garantia || c.cliente_nombre || "—"}</p>
        <p className="mt-1 text-xs text-white/70">{c.juzgado || "Juzgado sin asignar"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${firmasN >= 5 ? "bg-emerald-400/25 text-white" : "bg-white/15 text-white"}`}>✍ {firmasN}/5 firmas del dictamen</div>
      </div>

      {/* pestañas */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {MODULOS.map((m) => (
          <button key={m.id} onClick={() => setModulo(m.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${modulo === m.id ? "text-white" : "text-muted-foreground hover:bg-muted"}`} style={modulo === m.id ? { background: AZUL } : undefined}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* ============ GENERAL ============ */}
      {modulo === "general" && (
        <div className="space-y-4">
          <LineaVidaAreas caso={c} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SeccionUCP icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />} titulo="Antecedente de la garantía">
              <DatoUCP label="ID garantía" valor={(c as any).gar_id} />
              <DatoUCP label="No. de crédito" valor={c.no_credito} importante />
              <DatoUCP label="Dirección de la garantía" valor={c.direccion_garantia} importante />
              <DatoUCP label="Cliente / deudor" valor={c.cliente_nombre || c.demandado} importante />
              <DatoUCP label="Entidad" valor={c.entidad} />
              <DatoUCP label="Tipo de proceso" valor={c.tipo_proceso} />
            </SeccionUCP>
            <SeccionUCP icon={<Scale className="h-4 w-4" style={{ color: AZUL }} />} titulo="Estatus actual">
              <DatoUCP label="Etapa actual" valor={c.etapa_actual || "Dictamen (UCP)"} />
              <DatoUCP label="Estatus general" valor={c.estatus_general} importante />
              <DatoUCP label="Prioridad" valor={c.prioridad} />
              <DatoUCP label="No. de expediente / juicio" valor={c.expediente} />
              <DatoUCP label="No. de juzgado" valor={c.juzgado} />
              <DatoUCP label="Unidad / Encargado" valor={[c.unidad, c.encargado_unidad].filter(Boolean).join(" · ")} />
            </SeccionUCP>
          </div>

          {/* última actuación del boletín (resumen) */}
          <SeccionUCP icon={<Megaphone className="h-4 w-4" style={{ color: AZUL }} />} titulo="Última actuación en el boletín">
            {sinJuzgado ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="mr-1 inline h-4 w-4" /> Falta asignar el juzgado para que el robot pueda seguir este expediente.</div>
            ) : ultima ? (
              <div className="rounded-md bg-muted/40 p-3">
                <span className="text-xs font-medium text-muted-foreground">{fmtFecha(ultima.fecha_acuerdo)}</span>
                <p className="mt-1 text-sm">{ultima.texto || "—"}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin actuaciones todavía. El robot revisa el boletín todos los días a las 9:00 AM.</p>
            )}
          </SeccionUCP>
        </div>
      )}

      {/* ============ PROCESO (dictamen jurídico + registral + PDF + firmas) ============ */}
      {modulo === "proceso" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <BloqueDictamen
            titulo="Dictamen jurídico"
            icon={<ScrollText className="h-4 w-4" style={{ color: AZUL }} />}
            veredicto={dict?.juridico?.veredicto || dict?.veredicto || null}
            firmas={dict?.firmas}
            claveFirma="juridico"
            onAbrir={() => navigate({ to: "/ucp" })}
            onVer={() => verDictamenPDF()}
            onDescargar={() => descargarPDF()}
          />
          <BloqueDictamen
            titulo="Dictamen registral (RPPC)"
            icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />}
            veredicto={typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : (dict?.rppc ? "registrado" : null)}
            firmas={dict?.firmas}
            claveFirma="registral"
            onAbrir={() => navigate({ to: "/ucp" })}
            onVer={() => verDictamenPDF()}
            onDescargar={() => descargarPDF()}
          />
        </div>
      )}

      {/* ============ SUB-JUICIOS ============ */}
      {modulo === "subjuicios" && (
        <div className="rounded-xl border border-border bg-card p-4"><SubJuicios casoId={c.id} /></div>
      )}

      {/* ============ DOCUMENTOS (escoger carpeta de Drive + lista) ============ */}
      {modulo === "documentos" && (
        <div className="space-y-4">
          <CarpetaDriveVinculada caso={c} area="UCP" modulo="ucp" onGuardar={guardarCampos} />
          <DocumentosGarantia area="UCP" caso={c} />
        </div>
      )}

      {/* ============ BOLETÍN ============ */}
      {modulo === "boletin" && (
        <BoletinExpediente acuerdos={acuerdos} expediente={c.expediente} sinJuzgado={sinJuzgado} cargando={cargando} />
      )}
    </div>
  );
}

// Bloque resumen de un dictamen (jurídico o registral) con su veredicto, firma y PDF.
function BloqueDictamen({ titulo, icon, veredicto, firmas, claveFirma, onAbrir, onVer, onDescargar }: {
  titulo: string; icon: React.ReactNode; veredicto: string | null;
  firmas: any; claveFirma: string; onAbrir: () => void; onVer: () => void; onDescargar: () => void;
}) {
  const v = (veredicto || "").toLowerCase();
  const positivo = v.includes("positiv") || v.includes("proceden") || v.includes("registrad") || v.includes("favorable");
  const negativo = v.includes("negativ") || v.includes("improcedent") || v.includes("desfavorable");
  const Icono = positivo ? CheckCircle2 : negativo ? XCircle : Clock;
  const color = positivo ? "#0C5C46" : negativo ? "#A32D2D" : "#B26B00";

  const firma = firmas && typeof firmas === "object" ? (firmas[claveFirma] || firmas[`${claveFirma}_firma`]) : null;
  const firmado = !!firma;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
        <button onClick={onAbrir} className="rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>Abrir proceso</button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Icono className="h-5 w-5" style={{ color }} />
        <span className="text-sm font-medium" style={{ color }}>{veredicto ? veredicto : "Sin dictaminar"}</span>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs">
        <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
        {firmado
          ? <span className="text-[color:var(--teal)]">Firmado{typeof firma === "string" ? `: ${firma}` : (firma?.nombre ? `: ${firma.nombre}` : "")}</span>
          : <span className="text-muted-foreground">Sin firma</span>}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
        <button onClick={onVer} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted"><Eye className="h-3.5 w-3.5" /> Ver PDF</button>
        <button onClick={onDescargar} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-muted" style={{ borderColor: "#C2A24C", color: "#8a7326" }}><Download className="h-3.5 w-3.5" /> Descargar</button>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Loader2, ScrollText, Landmark, CheckCircle2, XCircle, Clock, PenLine, Download, Eye,
  LayoutGrid, GitBranch, FolderOpen, Megaphone, Stamp, Scale, AlertTriangle, Send,
} from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { DocumentosGarantia } from "@/components/documentos-garantia";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { SubJuicios } from "@/components/sub-juicios";
import { BoletinExpediente } from "@/components/boletin-expediente";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { VincularClienteModal } from "@/components/vincular-cliente";
import { CronologiaCaso } from "@/components/cronologia-caso";
import { registrarEvento } from "@/lib/cronologia-caso";
import { TraspasoArea } from "@/components/traspaso-area";
import { BannerCoincidencias } from "@/components/banner-coincidencias";

export const Route = createFileRoute("/ucm-ficha")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Ficha UCM — JusticiaFácil" }] }),
  component: UCMFicha,
});

const NAVY = "#0B1E3A";
const AZUL = "#0F6E56"; // color de UCM (teal)

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const inp = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";

type Modulo = "general" | "proceso" | "subjuicios" | "documentos" | "boletin";

interface Acuerdo { id: string; expediente: string | null; fecha_acuerdo: string | null; texto: string | null; tipo_acuerdo: string | null; urgente: boolean | null; }

const fmtFecha = (s: string | null) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DatoUCP({ label, valor, importante }: { label: string; valor?: string | null; importante?: boolean }) {
  const vacio = !valor || !String(valor).trim();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{vacio ? (importante ? <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> falta</span> : "—") : valor}</span>
    </div>
  );
}

function SeccionUCP({ icon, titulo, accion, children }: { icon: React.ReactNode; titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
        {accion}
      </div>
      {children}
    </div>
  );
}

function UCMFicha() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [c, setC] = useState<CasoJuridico | null>(null);
  const [dict, setDict] = useState<any>(null);
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modulo, setModulo] = useState<Modulo>("general");

  // edición (igual que UCM)
  const [editAnt, setEditAnt] = useState(false);
  const [editEst, setEditEst] = useState(false);
  const [verBoletin, setVerBoletin] = useState(false);
  const [verVincular, setVerVincular] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [recargaCron, setRecargaCron] = useState(0);

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    (async () => {
      const cs = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : []));
      const caso: CasoJuridico | null = cs?.[0] || null;
      setC(caso);
      // el dictamen vive en el ORIGINAL de UCP; si esta ficha es copia, lo leemos de ahí
      const dictCasoId = caso?.origen_ucp_id || id;
      const ds = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=*&caso_id=eq.${dictCasoId}&vigente=eq.true&limit=1`, { headers }).then((r) => (r.ok ? r.json() : []));
      setDict(ds?.[0] || null);
      if (caso?.expediente) {
        const ra = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=*&expediente=eq.${encodeURIComponent(caso.expediente.trim())}&order=fecha_acuerdo.desc&limit=200`, { headers });
        setAcuerdos(ra.ok ? await ra.json() : []);
      }
    })().finally(() => setCargando(false));
  }, [id]);

  const guardarDatos = async (campos: Record<string, string>, cerrar: () => void) => {
    if (!c) return;
    setGuardando(true); setErrorDatos(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(campos),
      });
      if (!r.ok) throw new Error(String(r.status));
      setC({ ...c, ...(campos as any) });
      registrarEvento({ caso_id: c.id, expediente: c.expediente, area: "UCM", tipo: "cambio", texto: "Se actualizó: " + Object.keys(campos).join(", ") });
      setRecargaCron((n) => n + 1);
      cerrar();
    } catch {
      setErrorDatos("No se pudo guardar. Revisa las columnas del caso.");
    } finally { setGuardando(false); }
  };
  const guardarCampos = (campos: Record<string, string>) => guardarDatos(campos, () => {});

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
  if (!c) return <div className="p-8 text-sm text-muted-foreground">No se encontró el caso. <button onClick={() => navigate({ to: "/ucm" })} className="underline">Volver a UCM</button></div>;

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

  const btnEditar = (onClick: () => void) => (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>
      <PenLine className="h-3 w-3" /> Editar / validar
    </button>
  );
  const btnGuardar = (onClick: () => void) => (
    <button onClick={onClick} disabled={guardando} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: AZUL }}>
      {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar
    </button>
  );

  return (
    <div className="space-y-4">
      {/* barra superior */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate({ to: "/ucm" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Volver a UCM</button>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: AZUL }}>UCM</span>
        <button onClick={descargarPDF} className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}>
          <Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF
        </button>
      </div>

      {/* encabezado (siempre visible) */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${AZUL})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Ficha UCM · Seguimiento de juicio</p>
        <p className="text-2xl font-bold">{c.expediente || "Sin expediente"}</p>
        <p className="text-sm text-white/80">{c.direccion_garantia || c.cliente_nombre || "—"}</p>
        <p className="mt-1 text-xs text-white/70">{c.juzgado || "Juzgado sin asignar"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
        {c.estado_ucm && <div className="mt-2 mr-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/25 px-2.5 py-1 text-xs font-medium text-white">{c.estado_ucm === "pendiente_formalizacion" ? "Pendiente de formalización" : c.estado_ucm}</div>}
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
          {c.origen_ucp_id && (
            <div className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: AZUL + "55", background: AZUL + "0d" }}>
              <p className="text-xs" style={{ color: AZUL }}><span className="font-semibold">📋 Viene de UCP.</span> Los datos base se copiaron de UCP y se mantienen al día solos. Lo que cambies aquí NO regresa a UCP.</p>
              <button onClick={() => navigate({ to: "/ucp-ficha", search: { id: c.origen_ucp_id } as any })} className="shrink-0 self-start inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>Ver original en UCP</button>
            </div>
          )}
          <BannerCoincidencias caso={c} onNavegar={(nid) => navigate({ to: "/ucm-ficha", search: { id: nid } as any })} />
          <TraspasoArea caso={c} area="UCM" onGuardarCarpeta={guardarCampos} onTraspaso={() => navigate({ to: "/ucm" })} />
          <LineaVidaAreas caso={c} />
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Antecedente de la garantía (editable) */}
            <SeccionUCP
              icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />}
              titulo="Antecedente de la garantía"
              accion={!editAnt ? btnEditar(() => { setForm({ no_credito: c.no_credito || "", direccion_garantia: c.direccion_garantia || "", entidad: c.entidad || "" }); setErrorDatos(null); setEditAnt(true); }) : undefined}
            >
              {editAnt ? (
                <div className="space-y-2">
                  <Campo label="No. de crédito"><input className={inp} value={form.no_credito} onChange={(e) => setForm({ ...form, no_credito: e.target.value })} /></Campo>
                  <Campo label="Dirección de la garantía"><input className={inp} value={form.direccion_garantia} onChange={(e) => setForm({ ...form, direccion_garantia: e.target.value })} /></Campo>
                  <Campo label="Entidad"><input className={inp} value={form.entidad} onChange={(e) => setForm({ ...form, entidad: e.target.value })} /></Campo>
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                    <span className="text-[11px] text-muted-foreground">Cliente: <b className="text-foreground">{c.cliente_nombre || c.cliente_codigo || "sin vincular"}</b></span>
                    <button onClick={() => setVerVincular(true)} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}><Scale className="h-3 w-3" /> {c.cliente_id ? "Cambiar" : "Vincular"} cliente</button>
                  </div>
                  {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
                  <div className="flex gap-2 pt-1">
                    {btnGuardar(() => guardarDatos({ no_credito: form.no_credito, direccion_garantia: form.direccion_garantia, entidad: form.entidad }, () => setEditAnt(false)))}
                    <button onClick={() => setEditAnt(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <DatoUCP label="ID garantía" valor={(c as any).gar_id} />
                  <DatoUCP label="No. de crédito" valor={c.no_credito} importante />
                  <DatoUCP label="Dirección de la garantía" valor={c.direccion_garantia} importante />
                  <div className="flex items-center justify-between gap-2">
                    <DatoUCP label="Cliente / deudor" valor={c.cliente_nombre || c.demandado} importante />
                    <button onClick={() => setVerVincular(true)} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}><Scale className="h-3 w-3" /> {c.cliente_id ? "Cambiar" : "Vincular"}</button>
                  </div>
                  <DatoUCP label="Entidad" valor={c.entidad} />
                  <DatoUCP label="Tipo de proceso" valor={c.tipo_proceso} />
                </>
              )}
            </SeccionUCP>

            {/* Estatus actual (editable + robotsito) */}
            <SeccionUCP
              icon={<Scale className="h-4 w-4" style={{ color: AZUL }} />}
              titulo="Estatus actual"
              accion={!editEst ? btnEditar(() => { setForm({ etapa_actual: c.etapa_actual || "", estatus_general: c.estatus_general || "", prioridad: c.prioridad || "", expediente: c.expediente || "", juzgado: c.juzgado || "", actor: c.actor || "", demandado: c.demandado || "" }); setErrorDatos(null); setVerBoletin(false); setEditEst(true); }) : undefined}
            >
              {editEst ? (
                <div className="space-y-2">
                  <Campo label="Etapa actual"><input className={inp} value={form.etapa_actual} onChange={(e) => setForm({ ...form, etapa_actual: e.target.value })} /></Campo>
                  <Campo label="Estatus general"><input className={inp} value={form.estatus_general} onChange={(e) => setForm({ ...form, estatus_general: e.target.value })} /></Campo>
                  <Campo label="Prioridad"><input className={inp} value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} placeholder="ALTA / MEDIA / BAJA" /></Campo>
                  <Campo label="No. de expediente / juicio"><input className={inp} value={form.expediente} onChange={(e) => setForm({ ...form, expediente: e.target.value })} placeholder="Ej. 1593/2008" /></Campo>
                  <Campo label="No. de juzgado"><input className={inp} value={form.juzgado} onChange={(e) => setForm({ ...form, juzgado: e.target.value })} placeholder="Ej. Juzgado Segundo…" /></Campo>
                  <Campo label="Actor"><input className={inp} value={form.actor} onChange={(e) => setForm({ ...form, actor: e.target.value })} placeholder="Quien demanda" /></Campo>
                  <Campo label="Demandado"><input className={inp} value={form.demandado} onChange={(e) => setForm({ ...form, demandado: e.target.value })} placeholder="Contra quién" /></Campo>

                  {/* Robotsito del boletín */}
                  <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2.5">
                    <button type="button" onClick={() => setVerBoletin((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-xs font-semibold" style={{ color: AZUL }}>
                      <Send className="h-3.5 w-3.5" /> {verBoletin ? "Ocultar buscador del boletín" : "Buscar en el boletín (jurisdicción, juzgado y expediente)"}
                    </button>
                    {verBoletin && (
                      <div className="mt-2">
                        <p className="mb-2 text-[11px] text-muted-foreground">Elige la jurisdicción y el juzgado, busca el expediente y dale <b>“Guardar hallazgos del boletín”</b>: se rellenan solos. Luego revisa y dale <b>Guardar</b>.</p>
                        <BuscadorBoletin
                          expedienteInicial={form.expediente}
                          onGuardarHallazgos={() => {}}
                          onDatosBoletin={(d) => setForm((f) => ({
                            ...f,
                            expediente: d.expediente || f.expediente,
                            juzgado: d.juzgado || f.juzgado,
                            actor: d.actor || f.actor,
                            demandado: d.demandado || f.demandado,
                            etapa_actual: d.etapa || f.etapa_actual,
                          }))}
                        />
                      </div>
                    )}
                  </div>
                  {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
                  <div className="flex gap-2 pt-1">
                    {btnGuardar(() => guardarDatos({ etapa_actual: form.etapa_actual, estatus_general: form.estatus_general, prioridad: form.prioridad, expediente: form.expediente, juzgado: form.juzgado, actor: form.actor, demandado: form.demandado }, () => setEditEst(false)))}
                    <button onClick={() => setEditEst(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <DatoUCP label="Etapa actual" valor={c.etapa_actual} importante />
                  <DatoUCP label="Estatus general" valor={c.estatus_general} importante />
                  <DatoUCP label="Prioridad" valor={c.prioridad} />
                  <DatoUCP label="No. de expediente / juicio" valor={c.expediente} />
                  <DatoUCP label="No. de juzgado" valor={c.juzgado} />
                  <DatoUCP label="Unidad / Encargado" valor={[c.unidad, c.encargado_unidad].filter(Boolean).join(" · ")} />
                </>
              )}
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

          {/* Cronología del expediente (compartida entre áreas) */}
          <CronologiaCaso casoId={c.id} expediente={c.expediente} recargaId={recargaCron} />
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
            onAbrir={() => navigate({ to: "/ucm" })}
            onVer={() => verDictamenPDF()}
            onDescargar={() => descargarPDF()}
          />
          <BloqueDictamen
            titulo="Dictamen registral (RPPC)"
            icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />}
            veredicto={typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : (dict?.rppc ? "registrado" : null)}
            firmas={dict?.firmas}
            claveFirma="registral"
            onAbrir={() => navigate({ to: "/ucm" })}
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
          <CarpetaDriveVinculada caso={c} area="UCM" modulo="ucm" onGuardar={guardarCampos} />
          <DocumentosGarantia area="UCM" caso={c} />
        </div>
      )}

      {/* ============ BOLETÍN ============ */}
      {modulo === "boletin" && (
        <BoletinExpediente acuerdos={acuerdos} expediente={c.expediente} sinJuzgado={sinJuzgado} cargando={cargando} />
      )}

      {verVincular && <VincularClienteModal caso={c} onClose={() => setVerVincular(false)} onVinculado={(cl) => { setC({ ...c, cliente_nombre: cl.nombre, cliente_codigo: cl.codigo, cliente_id: cl.id }); setVerVincular(false); }} />}
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus, FileText, Loader2, Upload, MoreVertical, Archive, Trash2, Search, X, Landmark, ClipboardList, ScanSearch } from "lucide-react";
import { listarTramites, crearTramite, actualizarTramite, eliminarTramite, subirDocTramite, ESTADOS_TRAMITE, ESTADO_TRAMITE_TONO, etiquetaEstado, type Tramite } from "@/lib/tramite";
import { consultarRobot, PORTAL_OFICIAL, type TipoConsulta } from "@/lib/robot-consultas";
import { usuarioActualEtiqueta } from "@/lib/auth";

export const Route = createFileRoute("/tramites")({
  head: () => ({ meta: [{ title: "Trámites Gob — SIGA-DIIPA" }] }),
  component: Tramites,
});

const catalogo = [
  { tipo: "curp", nombre: "CURP", desc: "Clave Única de Registro de Población", portal: "https://www.gob.mx/curp/" },
  { tipo: "rfc", nombre: "RFC", desc: "Registro Federal de Contribuyentes", portal: "https://www.sat.gob.mx/" },
  { tipo: "cedula", nombre: "Cédula profesional", desc: "Validación ante la SEP (RENAPO/SEP)", portal: "https://www.cedulaprofesional.sep.gob.mx/cedula/" },
  { tipo: "acta_nacimiento", nombre: "Acta de Nacimiento", desc: "Copia certificada en línea", portal: "https://www.gob.mx/ActasNacimiento" },
  { tipo: "acta_matrimonio", nombre: "Acta de Matrimonio", desc: "Copia certificada (algunos estados)", portal: "https://www.gob.mx/" },
  { tipo: "acta_defuncion", nombre: "Acta de Defunción", desc: "Copia certificada", portal: "https://www.gob.mx/" },
  { tipo: "infonavit", nombre: "Estado de cuenta Infonavit", desc: "Saldo, descuentos y avalúo", portal: "https://micuenta.infonavit.org.mx/" },
  { tipo: "imss", nombre: "Constancia IMSS", desc: "Semanas cotizadas, NSS", portal: "https://www.imss.gob.mx/" },
  { tipo: "constancia_situacion_fiscal", nombre: "Constancia Situación Fiscal", desc: "Vigente, opinión positiva", portal: "https://www.sat.gob.mx/" },
];
const nombrePorTipo = (t?: string | null) => catalogo.find((c) => c.tipo === t)?.nombre || t || "Trámite";
const portalPorTipo = (t?: string | null) => catalogo.find((c) => c.tipo === t)?.portal || "";

type TabKey = "mios" | "consultas" | "catalogo";

function Tramites() {
  const [tab, setTab] = useState<TabKey>("mios");
  const [lista, setLista] = useState<Tramite[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState<{ tipo?: string } | null>(null);

  const recargar = () => { setCargando(true); listarTramites().then(setLista).finally(() => setCargando(false)); };
  useEffect(() => { recargar(); }, []);

  const enProceso = lista.filter((t) => t.estado === "en_proceso").length;
  const faltan = lista.filter((t) => t.estado === "documentos_pendientes").length;
  const completos = lista.filter((t) => t.estado === "completado").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trámites de gobierno"
        title="Trámites Gob"
        description="Gestiona y da seguimiento a los trámites desde tu sistema, consulta datos oficiales y abre los portales."
        actions={
          <Button onClick={() => setNuevo({})} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Nueva solicitud
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador n={String(enProceso)} l="En proceso" tono="text-amber-600" />
        <Indicador n={String(faltan)} l="Faltan documentos" tono="text-orange-600" />
        <Indicador n={String(completos)} l="Completados" tono="text-emerald-600" />
        <Indicador n={String(lista.length)} l="Total activos" tono="text-[#0B1E3A]" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        <TabBtn on={tab === "mios"} onClick={() => setTab("mios")} icon={ClipboardList} label="Mis trámites" />
        <TabBtn on={tab === "consultas"} onClick={() => setTab("consultas")} icon={ScanSearch} label="Consultas" />
        <TabBtn on={tab === "catalogo"} onClick={() => setTab("catalogo")} icon={Landmark} label="Catálogo / Portales" />
      </div>

      {tab === "mios" && <PanelMisTramites lista={lista} cargando={cargando} onCambio={recargar} />}
      {tab === "consultas" && <PanelConsultas />}
      {tab === "catalogo" && <PanelCatalogo onSolicitar={(tipo) => setNuevo({ tipo })} />}

      {nuevo && <ModalNuevaSolicitud tipoInicial={nuevo.tipo} onCerrar={() => setNuevo(null)} onCreado={() => { setNuevo(null); recargar(); }} />}
    </div>
  );
}

function Indicador({ n, l, tono }: { n: string; l: string; tono: string }) {
  return (
    <div className="legal-card p-4">
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className={`mt-1 font-display text-2xl font-bold leading-none ${tono}`}>{n}</p>
    </div>
  );
}

function TabBtn({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: typeof Landmark; label: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${on ? "border-[color:var(--teal)] font-semibold text-[color:var(--teal)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
//  MIS TRÁMITES (gestión / seguimiento)
// ---------------------------------------------------------------------------
function PanelMisTramites({ lista, cargando, onCambio }: { lista: Tramite[]; cargando: boolean; onCambio: () => void }) {
  const [menu, setMenu] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const cambiarEstado = async (id: string, estado: string) => { await actualizarTramite(id, { estado }); onCambio(); };
  const subir = async (t: Tramite, file?: File) => {
    if (!file || !t.id) return;
    setSubiendo(t.id);
    try { const r = await subirDocTramite(file); await actualizarTramite(t.id, { doc_url: r.url, doc_nombre: r.nombre, estado: t.estado === "solicitado" ? "en_proceso" : t.estado || "en_proceso" }); onCambio(); }
    catch { /* noop */ }
    setSubiendo(null);
  };
  const archivar = async (id: string) => { setMenu(null); await actualizarTramite(id, { estado: "archivado" }); onCambio(); };
  const borrar = async (id: string) => { setMenu(null); if (window.confirm("¿Eliminar este trámite?")) { await eliminarTramite(id); onCambio(); } };

  if (cargando) return <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  if (lista.length === 0) return <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Aún no hay trámites. Pícale “Nueva solicitud” o entra al Catálogo.</div>;

  return (
    <div className="space-y-2">
      {lista.map((t) => (
        <div key={t.id} className="legal-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[color:var(--teal)]" />
              <span className="font-display text-sm font-bold">{nombrePorTipo(t.tipo)}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{t.folio}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.cliente || "—"}{t.expediente ? ` · Exp. ${t.expediente}` : ""}{t.responsable ? ` · Resp. ${t.responsable}` : ""}
            </p>
            {t.nota && <p className="mt-0.5 text-xs text-muted-foreground">{t.nota}</p>}
            {t.doc_url && <a href={t.doc_url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs text-[color:var(--teal)] underline">{t.doc_nombre || "ver documento"}</a>}
          </div>
          <div className="flex items-center gap-2">
            <select value={t.estado || "solicitado"} onChange={(e) => t.id && cambiarEstado(t.id, e.target.value)} className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-medium ${ESTADO_TRAMITE_TONO[t.estado || "solicitado"] || ""}`}>
              {ESTADOS_TRAMITE.map((e) => <option key={e} value={e}>{etiquetaEstado(e)}</option>)}
            </select>
            {portalPorTipo(t.tipo) && <a href={portalPorTipo(t.tipo)} target="_blank" rel="noreferrer" title="Abrir portal" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>}
            <label title="Subir documento" className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              {subiendo === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <input type="file" className="hidden" onChange={(e) => subir(t, e.target.files?.[0])} />
            </label>
            <div className="relative">
              <button onClick={() => setMenu(menu === t.id ? null : t.id || null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>
              {menu === t.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                  <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-border bg-white py-1 shadow-lg">
                    <button onClick={() => t.id && archivar(t.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><Archive className="h-3.5 w-3.5" /> Archivar</button>
                    <button onClick={() => t.id && borrar(t.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Eliminar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModalNuevaSolicitud({ tipoInicial, onCerrar, onCreado }: { tipoInicial?: string; onCerrar: () => void; onCreado: () => void }) {
  const [tipo, setTipo] = useState(tipoInicial || "curp");
  const [cliente, setCliente] = useState("");
  const [expediente, setExpediente] = useState("");
  const [responsable, setResponsable] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setOcupado(true); setError(null);
    const quien = await usuarioActualEtiqueta();
    const r = await crearTramite({ tipo, nombre_tramite: nombrePorTipo(tipo), cliente: cliente || null, expediente: expediente || null, responsable: responsable || quien || null, nota: nota || null, portal: portalPorTipo(tipo), creado_por: quien });
    setOcupado(false);
    if (r.ok) onCreado();
    else setError("No se pudo guardar (" + (r.error || "") + "). ¿Corriste el SQL de tramite?");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-bold text-[#0B1E3A]">Nueva solicitud de trámite</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Tipo de trámite</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {catalogo.map((c) => <option key={c.tipo} value={c.tipo}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Cliente / persona</label>
              <input value={cliente} onChange={(e) => setCliente(e.target.value)} className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Expediente (opc.)</label>
              <input value={expediente} onChange={(e) => setExpediente(e.target.value)} className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Responsable</label>
            <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Quién lo gestiona" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nota (opc.)</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
          {error && <span className="mr-auto text-[11px] font-medium text-red-700">{error}</span>}
          <Button variant="outline" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button size="sm" disabled={ocupado} onClick={guardar} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">{ocupado ? "Guardando…" : "Crear"}</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  CONSULTAS (estilo Búho: cédula, CURP, RFC vía robot)
// ---------------------------------------------------------------------------
function PanelConsultas() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ConsultaCard
        tipo="cedula" titulo="Cédula profesional" descripcion="Valida ante la SEP por número o por nombre."
        campos={[{ id: "numero", label: "Número de cédula" }, { id: "nombre", label: "o Nombre completo" }]}
      />
      <ConsultaCard
        tipo="curp" titulo="CURP" descripcion="Consulta la CURP por clave o por datos."
        campos={[{ id: "curp", label: "CURP (si la tienes)" }, { id: "nombre", label: "Nombre(s)" }, { id: "apellidoP", label: "Apellido paterno" }, { id: "apellidoM", label: "Apellido materno" }]}
      />
      <ConsultaCard
        tipo="rfc" titulo="RFC" descripcion="Busca el RFC por nombre y datos."
        campos={[{ id: "nombre", label: "Nombre(s)" }, { id: "apellidoP", label: "Apellido paterno" }, { id: "apellidoM", label: "Apellido materno" }, { id: "fecha", label: "Fecha nac. (AAAA-MM-DD)" }]}
      />
    </div>
  );
}

function ConsultaCard({ tipo, titulo, descripcion, campos }: { tipo: TipoConsulta; titulo: string; descripcion: string; campos: { id: string; label: string }[] }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; data?: unknown; error?: string } | null>(null);

  const consultar = async () => {
    setCargando(true); setRes(null);
    const r = await consultarRobot(tipo, vals);
    setRes(r); setCargando(false);
  };

  return (
    <Card className="legal-card p-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-[color:var(--teal)]" />
        <p className="font-display text-sm font-bold">{titulo}</p>
      </div>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
      <div className="space-y-2">
        {campos.map((c) => (
          <input key={c.id} value={vals[c.id] || ""} onChange={(e) => setVals((v) => ({ ...v, [c.id]: e.target.value }))} placeholder={c.label} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={consultar} disabled={cargando} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />} Consultar
        </Button>
        <a href={PORTAL_OFICIAL[tipo]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Portal oficial <ExternalLink className="h-3 w-3" /></a>
      </div>
      {res && (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
          {res.ok
            ? <pre className="max-h-56 overflow-auto whitespace-pre-wrap">{JSON.stringify(res.data, null, 2)}</pre>
            : <span className="text-red-700">{res.error}</span>}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
//  CATÁLOGO / PORTALES
// ---------------------------------------------------------------------------
function PanelCatalogo({ onSolicitar }: { onSolicitar: (tipo: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {catalogo.map((c) => (
        <Card key={c.tipo} className="legal-card p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-[color:var(--teal)]" />
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold">{c.nombre}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onSolicitar(c.tipo)}><Plus className="h-3.5 w-3.5 mr-1" /> Solicitar</Button>
                {c.portal && <a href={c.portal} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline">Abrir portal <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

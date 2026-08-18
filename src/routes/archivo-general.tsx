import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Search, Loader2, Plus, FileText, FolderOpen, ChevronDown, ChevronUp,
  Trash2, AlertTriangle, CheckCircle2, XCircle, X,
} from "lucide-react";
import {
  buscarArchivoGeneral, rolActual, puedeAprobarBajas, solicitarBaja, resolverBaja,
  listarBajasPendientes, type DocumentoArchivo,
} from "@/lib/archivo-general";
import { estadosDisponibles, ciudadesDeEstado } from "@/lib/ciudad-judicial";
import { BotonVerDoc } from "@/components/visor-documento";
import { buscarAsuntos, type AsuntoUnificado } from "@/lib/asuntos-busqueda";
import { RegistrarDocumentoFisico } from "@/components/registrar-documento-fisico";

export const Route = createFileRoute("/archivo-general")({
  head: () => ({ meta: [{ title: "Archivo General de Documentos — JusticiaFácil" }] }),
  component: ArchivoGeneralPage,
});

const TEAL = "#0C5C46";
const NAVY = "#0B1E3A";

const ESTADO_BAJA_UI: Record<string, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  baja_solicitada: { label: "Baja solicitada", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  baja_autorizada: { label: "Baja autorizada", cls: "bg-red-50 text-red-700 border-red-200" },
  baja_rechazada: { label: "Baja rechazada", cls: "bg-muted text-muted-foreground border-border" },
};

function badgeFuente(d: DocumentoArchivo) {
  if (d.digitalizado && d.es_fisico) return { label: "Digital y físico", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (d.digitalizado) return { label: "Digital", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: "Solo físico", cls: "bg-amber-50 text-amber-800 border-amber-200" };
}

function ArchivoGeneralPage() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<DocumentoArchivo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscadoAlgunaVez, setBuscadoAlgunaVez] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroCiudad, setFiltroCiudad] = useState("todas");
  const ciudadesDelEstado = useMemo(() => (filtroEstado === "todas" ? [] : ciudadesDeEstado(filtroEstado)), [filtroEstado]);

  const [rol, setRol] = useState<string | null>(null);
  const puedeAprobar = puedeAprobarBajas(rol);
  useEffect(() => { rolActual().then(setRol); }, []);

  const [pendientes, setPendientes] = useState<DocumentoArchivo[]>([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const cargarPendientes = () => {
    if (!puedeAprobar) return;
    setCargandoPendientes(true);
    listarBajasPendientes().then(setPendientes).finally(() => setCargandoPendientes(false));
  };
  useEffect(() => { cargarPendientes(); }, [puedeAprobar]);

  const [agregarOpen, setAgregarOpen] = useState(false);
  const [solicitarBajaDoc, setSolicitarBajaDoc] = useState<DocumentoArchivo | null>(null);
  const [rechazarDoc, setRechazarDoc] = useState<DocumentoArchivo | null>(null);

  useEffect(() => {
    const termino = q.trim();
    if (termino.length < 2) { setResultados([]); setBuscadoAlgunaVez(false); return; }
    setBuscando(true);
    setError(null);
    const t = setTimeout(() => {
      buscarArchivoGeneral(termino)
        .then((r) => { setResultados(r); setBuscadoAlgunaVez(true); })
        .catch((e) => setError(e.message || "No se pudo buscar."))
        .finally(() => setBuscando(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const filtrados = useMemo(() => {
    return resultados.filter((d) => {
      if (filtroEstado !== "todas") {
        if (!d.ubicacion || d.ubicacion.estado !== filtroEstado) return false;
        if (filtroCiudad !== "todas" && d.ubicacion.ciudad !== filtroCiudad) return false;
      }
      return true;
    });
  }, [resultados, filtroEstado, filtroCiudad]);

  const recargarBusqueda = () => { if (q.trim().length >= 2) buscarArchivoGeneral(q.trim()).then(setResultados); };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Núcleo procesal"
        title="Archivo General de Documentos"
        description="Todo lo digital y lo físico, en un solo lugar — busca por folio, GAR-id, crédito, expediente, dirección o cliente."
        actions={
          <button onClick={() => setAgregarOpen(true)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: TEAL }}>
            <Plus className="h-4 w-4" /> Agregar documento
          </button>
        }
      />

      {/* Solicitudes de baja pendientes — solo visible para quien puede aprobar */}
      {puedeAprobar && (
        <Card className="legal-card border-amber-200 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Solicitudes de baja pendientes
            {pendientes.length > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px]">{pendientes.length}</span>}
          </p>
          {cargandoPendientes ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Cargando…</p>
          ) : pendientes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay solicitudes pendientes.</p>
          ) : (
            <div className="space-y-2">
              {pendientes.map((d) => (
                <div key={`${d.fuente}-${d.id}`} className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-sm font-medium">{d.nombre || "(sin nombre)"}</p>
                  <p className="text-xs text-muted-foreground">{d.cliente || "—"} {d.folio ? `· Folio ${d.folio}` : ""} {d.expediente ? `· Exp. ${d.expediente}` : ""}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Solicitó <b>{d.baja_solicitado_por || "—"}</b>: "{d.baja_motivo || "sin motivo"}"</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={async () => { if (await resolverBaja(d, true)) { cargarPendientes(); recargarBusqueda(); } }}
                      className="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ background: "#B91C1C" }}
                    >
                      Autorizar baja
                    </button>
                    <button onClick={() => setRechazarDoc(d)} className="flex-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium">Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="legal-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Folio, GAR-id, crédito, expediente, dirección, cliente o nombre del documento…" className="pl-8" />
            {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setFiltroCiudad("todas"); }} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Todos los estados</option>
            {estadosDisponibles().map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroCiudad} onChange={(e) => setFiltroCiudad(e.target.value)} disabled={filtroEstado === "todas"} className="rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50">
            <option value="todas">{filtroEstado === "todas" ? "Elige un estado primero" : "Todas las ciudades"}</option>
            {ciudadesDelEstado.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      {error && <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudo buscar: {error}</Card>}
      {q.trim().length > 0 && q.trim().length < 2 && <p className="text-center text-sm text-muted-foreground">Escribe al menos 2 caracteres…</p>}
      {buscadoAlgunaVez && !buscando && filtrados.length === 0 && (
        <Card className="legal-card p-8 text-center text-sm text-muted-foreground">Sin resultados para "{q}".</Card>
      )}

      <div className="space-y-2">
        {filtrados.map((d) => {
          const fu = badgeFuente(d);
          const eb = ESTADO_BAJA_UI[d.estado_baja] || ESTADO_BAJA_UI.activo;
          return (
            <Card key={`${d.fuente}-${d.id}`} className="legal-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {d.nombre || "(sin nombre)"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {d.cliente || "—"} {d.folio ? `· Folio ${d.folio}` : ""} {d.gar_id ? `· ${d.gar_id}` : ""} {d.expediente ? `· Exp. ${d.expediente}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.fuente === "digital" ? `Subió: ${d.subido_por || "—"}` : `Registró: ${d.registrado_por || "—"}`}
                    {d.resguardo_de ? ` · Resguardo: ${d.resguardo_de}` : ""}
                    {d.ubicacion ? ` · ${d.ubicacion.ciudad ? `${d.ubicacion.ciudad}, ` : ""}${d.ubicacion.estado}` : ""}
                  </p>
                  {d.estado_baja === "baja_solicitada" && (
                    <p className="mt-1 text-xs text-amber-800">Baja solicitada por {d.baja_solicitado_por || "—"}: "{d.baja_motivo}"</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${fu.cls}`}>{fu.label}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${eb.cls}`}>{eb.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.fuente === "digital" && <BotonVerDoc url={d.link} driveId={d.drive_id} nombre={d.nombre} label="Ver" />}
                    {d.estado_baja === "activo" && (
                      <button onClick={() => setSolicitarBajaDoc(d)} title="Solicitar baja" className="text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {agregarOpen && <AgregarDocumentoModal onClose={() => setAgregarOpen(false)} onGuardado={recargarBusqueda} />}

      {solicitarBajaDoc && (
        <SolicitarBajaModal
          doc={solicitarBajaDoc}
          onClose={() => setSolicitarBajaDoc(null)}
          onEnviado={() => { setSolicitarBajaDoc(null); recargarBusqueda(); cargarPendientes(); }}
        />
      )}

      {rechazarDoc && (
        <RechazarBajaModal
          doc={rechazarDoc}
          onClose={() => setRechazarDoc(null)}
          onResuelto={() => { setRechazarDoc(null); cargarPendientes(); recargarBusqueda(); }}
        />
      )}
    </div>
  );
}

// ===== Modal: elegir asunto y luego reusar RegistrarDocumentoFisico =====
function AgregarDocumentoModal({ onClose, onGuardado }: { onClose: () => void; onGuardado?: () => void }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<AsuntoUnificado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState<AsuntoUnificado | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setResultados([]); return; }
    setBuscando(true);
    const tm = setTimeout(() => { buscarAsuntos(t).then(setResultados).finally(() => setBuscando(false)); }, 350);
    return () => clearTimeout(tm);
  }, [q]);

  if (elegido) {
    return <RegistrarDocumentoFisico asunto={elegido} onClose={onClose} onGuardado={onGuardado} />;
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><FolderOpen className="h-4 w-4" /> Agregar documento — primero elige el asunto</p>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Crédito, expediente, dirección o cliente…" className="pl-8" />
            {buscando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="space-y-1.5">
            {resultados.map((a) => (
              <button
                key={`${a.unidad}-${a.id}`}
                onClick={() => setElegido(a)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border p-2 text-left text-sm hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.cliente || "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.unidad} · {a.expediente ? `Exp. ${a.expediente}` : "Sin expediente"}</p>
                </div>
              </button>
            ))}
            {q.trim().length >= 2 && !buscando && resultados.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">Sin resultados. Verifica el dato o créalo primero desde la ficha correspondiente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Modal: solicitar baja (cualquiera) =====
function SolicitarBajaModal({ doc, onClose, onEnviado }: { doc: DocumentoArchivo; onClose: () => void; onEnviado: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    if (!motivo.trim()) { setError("Escribe el motivo de la baja."); return; }
    setEnviando(true);
    const ok = await solicitarBaja(doc, motivo.trim());
    setEnviando(false);
    if (ok) onEnviado(); else setError("No se pudo enviar la solicitud.");
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 font-semibold">Solicitar baja</p>
        <p className="mb-3 text-xs text-muted-foreground">{doc.nombre} — no se elimina de inmediato: DIL o DGE deben autorizarla.</p>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Motivo de la baja…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button onClick={enviar} disabled={enviando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Solicitar baja
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Modal: rechazar baja (DIL/DGE) =====
function RechazarBajaModal({ doc, onClose, onResuelto }: { doc: DocumentoArchivo; onClose: () => void; onResuelto: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    const ok = await resolverBaja(doc, false, motivo.trim() || undefined);
    setEnviando(false);
    if (ok) onResuelto();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 font-semibold">Rechazar solicitud de baja</p>
        <p className="mb-3 text-xs text-muted-foreground">{doc.nombre} — el documento vuelve a quedar activo.</p>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo del rechazo (opcional)…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button onClick={enviar} disabled={enviando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#B91C1C" }}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

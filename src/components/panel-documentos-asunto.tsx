import { useEffect, useMemo, useState } from "react";
import {
  FileText, Loader2, Upload, Trash2, Pencil, Check, X, MapPin, AlertTriangle, Lock,
} from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { subirDocumento } from "@/lib/drive";
import { BotonVerDoc } from "@/components/visor-documento";
import { getAuth } from "@/lib/auth";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";
import {
  documentosDeAsunto, rolActual, puedeAprobarBajas, solicitarBaja, resolverBaja,
  TIPOS_COPIA, type DocumentoArchivo, type TipoCopia,
} from "@/lib/archivo-general";
import { infoUsuarioEstado, puedeAbrirContenido, type InfoUsuarioEstado } from "@/lib/permisos-estado";
import { estadosDisponibles, ciudadesDeEstado, detectarUbicacion } from "@/lib/ciudad-judicial";
import { type CarpetaFisica } from "@/lib/carpetas-fisicas";
import { CarpetaFisicaBloque } from "@/components/carpeta-fisica";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const TEAL = "#0C5C46";

const COPIA_UI: Record<TipoCopia, { label: string; cls: string }> = {
  original: { label: "Original", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  copia_certificada: { label: "Copia certificada", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  copia_simple: { label: "Copia simple", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  digital_nativo: { label: "Digital nativo", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

// Azul = identidad visual del sistema de carpetas físicas (mismo tono que las
// carpetas/portada). Verde = solo digital, nunca tuvo ni va a tener papel.
function badgeFuente(d: DocumentoArchivo): { label: string; cls: string } {
  if (d.digitalizado && d.es_fisico) return { label: "Digital y físico", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  if (d.digitalizado) return { label: "Digital", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: "Físico", cls: "bg-blue-50 text-blue-700 border-blue-200" };
}

const ESTADO_BAJA_UI: Record<string, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-muted text-muted-foreground border-border" },
  baja_solicitada: { label: "Baja solicitada", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  baja_autorizada: { label: "Baja autorizada", cls: "bg-red-50 text-red-700 border-red-200" },
};

interface Props {
  asunto: AsuntoUnificado;
}

// Panel "vista en vivo" del inventario completo de UN asunto: todo lo digital
// (subido en la ficha o copiado del Drive) y todo lo físico, con si es original o
// copia, quién lo resguarda, y controles para subir, anotar y solicitar/resolver baja.
// Se usa embebido dentro de cada ficha (UCM/UCP/UFC/UDP) y también se puede llegar
// aquí directo desde el Archivo General o el Buscador de Asuntos.
export function PanelDocumentosAsunto({ asunto }: Props) {
  const [documentos, setDocumentos] = useState<DocumentoArchivo[]>([]);
  const [filtroFuente, setFiltroFuente] = useState<"todos" | "digital" | "fisico" | "en_carpeta">("todos");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroCiudad, setFiltroCiudad] = useState("todas");
  const [filtroResponsable, setFiltroResponsable] = useState("todos");
  const ciudadesDelEstado = useMemo(() => (filtroEstado === "todas" ? [] : ciudadesDeEstado(filtroEstado)), [filtroEstado]);
  const responsablesDisponibles = useMemo(
    () => Array.from(new Set(documentos.map((d) => d.resguardo_de).filter((r): r is string => !!r))).sort(),
    [documentos]
  );
  const documentosFiltrados = useMemo(() => {
    return documentos.filter((d) => {
      if (filtroFuente === "digital" && !d.digitalizado) return false;
      if (filtroFuente === "fisico" && !d.es_fisico) return false;
      if (filtroFuente === "en_carpeta" && !(d as any).carpeta_fisica) return false;
      if (filtroEstado !== "todas") {
        if (!d.ubicacion || d.ubicacion.estado !== filtroEstado) return false;
        if (filtroCiudad !== "todas" && d.ubicacion.ciudad !== filtroCiudad) return false;
      }
      if (filtroResponsable !== "todos" && d.resguardo_de !== filtroResponsable) return false;
      return true;
    });
  }, [documentos, filtroFuente, filtroEstado, filtroCiudad, filtroResponsable]);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState<string | null>(null);
  const puedeAprobar = puedeAprobarBajas(rol);
  const [usuario, setUsuario] = useState<InfoUsuarioEstado | null>(null);

  const cargar = () => {
    setCargando(true);
    documentosDeAsunto(asunto).then(setDocumentos).finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); rolActual().then(setRol); infoUsuarioEstado().then(setUsuario); }, [asunto.id, asunto.unidad]);

  const puedeSubirDigital = asunto.unidad === "UCM" || asunto.unidad === "UCP";
  const [casoCompleto, setCasoCompleto] = useState<CasoJuridico | null>(null);
  useEffect(() => {
    if (!puedeSubirDigital || !asunto.casoJuridicoId) return;
    sbSelect<CasoJuridico>("caso_juridico", `select=*&id=eq.${asunto.casoJuridicoId}`).then((d) => setCasoCompleto(d[0] || null));
  }, [asunto.casoJuridicoId, puedeSubirDigital]);

  const [subiendo, setSubiendo] = useState(false);
  const [tipoCopiaSubida, setTipoCopiaSubida] = useState<TipoCopia>("digital_nativo");
  const [error, setError] = useState<string | null>(null);

  // ===== Carpeta física =====
  // Toda la lógica vive en carpeta-fisica.tsx. Aquí solo guardamos cuál es la
  // carpeta del asunto, porque subir() la necesita para el carpeta_id.
  const [carpeta, setCarpeta] = useState<CarpetaFisica | null>(null);

  async function subir(file: File) {
    if (!casoCompleto || !carpeta) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await subirDocumento(asunto.unidad, casoCompleto, file, "evidencia");
      if (!r.ok || !r.doc) { setError(r.error || "No se pudo subir."); return; }
      await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${r.doc.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ tipo_copia: tipoCopiaSubida, carpeta_id: carpeta.id }),
      });
      cargar();
    } finally {
      setSubiendo(false);
    }
  }

  const [anotando, setAnotando] = useState<string | null>(null); // clave del doc en edición
  const [textoAnotacion, setTextoAnotacion] = useState("");
  const [bajaModal, setBajaModal] = useState<DocumentoArchivo | null>(null);
  const [rechazoModal, setRechazoModal] = useState<DocumentoArchivo | null>(null);

  function abrirAnotar(d: DocumentoArchivo, actual: string) {
    setAnotando(`${d.fuente}-${d.id}`);
    setTextoAnotacion(actual || "");
  }

  async function guardarAnotacion(d: DocumentoArchivo) {
    const tabla = d.fuente === "digital" ? "documento_garantia" : "documento_fisico";
    const campo = d.fuente === "digital" ? "nota_corta" : "descripcion";
    await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${d.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ [campo]: textoAnotacion.trim() || null }),
    });
    setAnotando(null);
    cargar();
  }

  async function cambiarTipoCopia(d: DocumentoArchivo, nuevo: TipoCopia) {
    const tabla = d.fuente === "digital" ? "documento_garantia" : "documento_fisico";
    await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${d.id}`, { method: "PATCH", headers, body: JSON.stringify({ tipo_copia: nuevo }) });
    cargar();
  }

  const inp = "rounded-md border border-input bg-background px-2 py-1.5 text-xs";

  return (
    <div className="space-y-3">
      {puedeSubirDigital && (
        <div className="rounded-md border border-[color:var(--teal,#0C5C46)]/30 bg-[color:var(--teal,#0C5C46)]/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: TEAL }}><Upload className="h-3.5 w-3.5" /> Subir nuevo documento</p>

          <CarpetaFisicaBloque asunto={asunto} compacto onCarpeta={setCarpeta} />

          {carpeta && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select value={tipoCopiaSubida} onChange={(e) => setTipoCopiaSubida(e.target.value as TipoCopia)} className={inp}>
                  {TIPOS_COPIA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="file" disabled={subiendo || !casoCompleto} onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }} className="text-xs" />
                {subiendo && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
            </>
          )}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}

      {documentos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select value={filtroFuente} onChange={(e) => setFiltroFuente(e.target.value as any)} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            <option value="todos">Todos</option>
            <option value="digital">Digital</option>
            <option value="fisico">Físico</option>
            <option value="en_carpeta">En carpeta</option>
          </select>
          <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setFiltroCiudad("todas"); }} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            <option value="todas">Todos los estados</option>
            {estadosDisponibles().map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroCiudad} onChange={(e) => setFiltroCiudad(e.target.value)} disabled={filtroEstado === "todas"} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs disabled:opacity-50">
            <option value="todas">{filtroEstado === "todas" ? "Elige un estado primero" : "Todas las ciudades"}</option>
            {ciudadesDelEstado.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            <option value="todos">Todos los responsables</option>
            {responsablesDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {cargando ? (
        <p className="flex items-center gap-1.5 py-4 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando inventario…</p>
      ) : documentos.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Sin documentos registrados todavía para este asunto.</p>
      ) : documentosFiltrados.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Ningún documento coincide con los filtros.</p>
      ) : (
        <div className="space-y-2">
          {documentosFiltrados.map((d) => {
            const clave = `${d.fuente}-${d.id}`;
            const eb = ESTADO_BAJA_UI[d.estado_baja] || ESTADO_BAJA_UI.activo;
            const cp = d.tipo_copia ? COPIA_UI[d.tipo_copia] : null;
            const abrir = usuario ? puedeAbrirContenido(usuario, d.ubicacion?.estado ?? null) : true;
            return (
              <div key={clave} className="rounded-md border border-border p-2.5 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate font-medium">{d.nombre || "(sin nombre)"}</span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {(() => { const bf = badgeFuente(d); return <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${bf.cls}`}>{bf.label}</span>; })()}
                    {cp && <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cp.cls}`}>{cp.label}</span>}
                    {d.copiaPendiente && <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">copiado del Drive · sin formalizar</span>}
                    {d.estado_baja !== "activo" && <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${eb.cls}`}>{eb.label}</span>}
                  </div>
                </div>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  {d.fuente === "digital" ? `Subió: ${d.subido_por || "—"}` : `Registró: ${d.registrado_por || "—"}`}
                  {d.resguardo_de ? ` · Resguardo: ${d.resguardo_de}` : ""}
                  {d.es_fisico && (d as any).carpeta_fisica ? ` · Carpeta: ${(d as any).carpeta_fisica}` : ""}
                </p>

                {!abrir ? (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Lock className="h-3 w-3" /> Es de {d.ubicacion?.estado || "otro Estado"} — solo puedes ver que existe. No puedes abrirlo, editarlo ni borrarlo.
                  </p>
                ) : (
                  <>
                    {anotando === clave ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input value={textoAnotacion} onChange={(e) => setTextoAnotacion(e.target.value)} className={`${inp} flex-1`} placeholder="Anotación…" autoFocus />
                        <button onClick={() => guardarAnotacion(d)} className="text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setAnotando(null)} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => abrirAnotar(d, "")} className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" /> Agregar anotación
                      </button>
                    )}

                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      {d.fuente === "digital" && <BotonVerDoc url={d.link} driveId={d.drive_id} nombre={d.nombre} label="Ver" className="inline-flex items-center gap-1 text-[color:var(--teal)] hover:underline" />}
                      {!d.copiaPendiente && (
                        <select value={d.tipo_copia || ""} onChange={(e) => cambiarTipoCopia(d, e.target.value as TipoCopia)} className="rounded border border-input bg-background px-1.5 py-0.5 text-[11px]">
                          <option value="">Sin marcar — original/copia</option>
                          {TIPOS_COPIA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      )}
                      {!d.copiaPendiente && d.estado_baja === "activo" && (
                        <button onClick={() => setBajaModal(d)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-600"><Trash2 className="h-3 w-3" /> Solicitar baja</button>
                      )}
                      {!d.copiaPendiente && d.estado_baja === "baja_solicitada" && puedeAprobar && (
                        <>
                          <button onClick={async () => { if (await resolverBaja(d, true)) cargar(); }} className="text-[11px] font-medium text-red-700">Autorizar baja</button>
                          <button onClick={() => setRechazoModal(d)} className="text-[11px] text-muted-foreground">Rechazar</button>
                        </>
                      )}
                    </div>
                  </>
                )}
                {d.estado_baja === "baja_solicitada" && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Solicitada por {d.baja_solicitado_por || "—"}: "{d.baja_motivo}"</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {bajaModal && (
        <SolicitarBajaMini doc={bajaModal} onClose={() => setBajaModal(null)} onEnviado={() => { setBajaModal(null); cargar(); }} />
      )}
      {rechazoModal && (
        <RechazarBajaMini doc={rechazoModal} onClose={() => setRechazoModal(null)} onResuelto={() => { setRechazoModal(null); cargar(); }} />
      )}
    </div>
  );
}

function SolicitarBajaMini({ doc, onClose, onEnviado }: { doc: DocumentoArchivo; onClose: () => void; onEnviado: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 text-sm font-semibold">Solicitar baja</p>
        <p className="mb-3 text-xs text-muted-foreground">{doc.nombre} — DIL o DGE deben autorizarla.</p>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Motivo…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button
            disabled={enviando || !motivo.trim()}
            onClick={async () => { setEnviando(true); const ok = await solicitarBaja(doc, motivo.trim()); setEnviando(false); if (ok) onEnviado(); }}
            className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Solicitar
          </button>
        </div>
      </div>
    </div>
  );
}

function RechazarBajaMini({ doc, onClose, onResuelto }: { doc: DocumentoArchivo; onClose: () => void; onResuelto: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 text-sm font-semibold">Rechazar solicitud de baja</p>
        <p className="mb-3 text-xs text-muted-foreground">{doc.nombre} — vuelve a quedar activo.</p>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo del rechazo (opcional)…" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button
            disabled={enviando}
            onClick={async () => { setEnviando(true); const ok = await resolverBaja(doc, false, motivo.trim() || undefined); setEnviando(false); if (ok) onResuelto(); }}
            className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#B91C1C" }}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { X, FileText, FolderOpen, Upload, Link2, Loader2, CheckCircle2, MapPin } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { listarDocumentos, subirDocumento, type DocumentoGarantia } from "@/lib/drive";
import { getAuth } from "@/lib/auth";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const TEAL = "#0C5C46";
const NAVY = "#0B1E3A";

const TIPOS_ASUNTO = [
  { value: "demanda_penal", label: "Demanda penal" },
  { value: "demanda_civil", label: "Demanda civil" },
  { value: "queja_profeco", label: "Queja PROFECO" },
  { value: "otro", label: "Otro" },
];

interface Props {
  asunto: AsuntoUnificado;
  onClose: () => void;
  onGuardado?: () => void;
}

// Modal para: 1) ver si el documento ya existe digitalizado (documentos fijos) y
// relacionarlo, o 2) subirlo si no existe, y en cualquier caso 3) registrar dónde
// vive físicamente (Mazatlán, qué carpeta) y de qué tipo de asunto se trata.
export function RegistrarDocumentoFisico({ asunto, onClose, onGuardado }: Props) {
  const [tipoAsunto, setTipoAsunto] = useState("demanda_civil");
  const [nombreDocumento, setNombreDocumento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [carpetaFisica, setCarpetaFisica] = useState("");
  const [ubicacion, setUbicacion] = useState("Mazatlán");

  const [digitalizados, setDigitalizados] = useState<DocumentoGarantia[]>([]);
  const [cargandoDigitalizados, setCargandoDigitalizados] = useState(false);
  const [relacionadoId, setRelacionadoId] = useState<string | null>(null);

  const [casoCompleto, setCasoCompleto] = useState<CasoJuridico | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  // Solo UCM/UCP tienen hoy el flujo de subida a Drive ya integrado (usa el mismo
  // mecanismo que el resto de la app). UDP/UFC se registran solo como inventario físico.
  const puedeDigitalizar = asunto.unidad === "UCM" || asunto.unidad === "UCP";

  useEffect(() => {
    if (!puedeDigitalizar || !asunto.casoJuridicoId) return;
    setCargandoDigitalizados(true);
    sbSelect<CasoJuridico>("caso_juridico", `select=*&id=eq.${asunto.casoJuridicoId}`)
      .then((d) => {
        const c = d[0] || null;
        setCasoCompleto(c);
        if (c) return listarDocumentos(c);
        return [] as DocumentoGarantia[];
      })
      .then(setDigitalizados)
      .catch(() => {})
      .finally(() => setCargandoDigitalizados(false));
  }, [asunto.casoJuridicoId, puedeDigitalizar]);

  const docRelacionado = useMemo(() => digitalizados.find((d) => d.id === relacionadoId) || null, [digitalizados, relacionadoId]);

  async function subirYRelacionar(file: File) {
    if (!casoCompleto) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await subirDocumento("UCM", casoCompleto, file, "evidencia");
      if (!r.ok || !r.doc) { setError(r.error || "No se pudo subir el archivo."); return; }
      setDigitalizados((p) => [r.doc!, ...p]);
      setRelacionadoId(r.doc.id);
      if (!nombreDocumento) setNombreDocumento(r.doc.nombre || file.name);
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar() {
    if (!nombreDocumento.trim()) { setError("Escribe el nombre del documento."); return; }
    setGuardando(true);
    setError(null);
    try {
      const solicita = await (async () => { try { const a = await getAuth(); const { data } = await a.auth.getSession(); return data.session?.user?.email || null; } catch { return null; } })();

      const fila: Record<string, any> = {
        unidad: asunto.unidad,
        caso_juridico_id: asunto.unidad === "UCM" || asunto.unidad === "UCP" ? asunto.id : null,
        caso_udp_id: asunto.unidad === "UDP" ? asunto.id : null,
        formalizacion_id: asunto.unidad === "UFC" ? asunto.id : null,
        cliente_nombre: asunto.cliente,
        expediente: asunto.expediente,
        tipo_asunto: tipoAsunto,
        nombre_documento: nombreDocumento.trim(),
        descripcion: descripcion.trim() || null,
        ubicacion: ubicacion.trim() || "Mazatlán",
        carpeta_fisica: carpetaFisica.trim() || null,
        documento_garantia_id: relacionadoId,
        digitalizado: !!relacionadoId,
        registrado_por: solicita,
      };

      const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_fisico`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(fila),
      });
      if (!r.ok) throw new Error(String(r.status));

      setListo(true);
      onGuardado?.();
      setTimeout(onClose, 900);
    } catch (e: any) {
      setError("No se pudo guardar: " + (e?.message || e));
    } finally {
      setGuardando(false);
    }
  }

  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-4 text-white" style={{ background: NAVY }}>
          <div>
            <p className="flex items-center gap-2 font-semibold"><FolderOpen className="h-4 w-4" /> Registrar documento físico</p>
            <p className="text-xs text-white/70">{asunto.cliente || "—"} · {asunto.unidad} · {asunto.expediente || "sin expediente"}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {/* Paso 1: ¿ya existe digitalizado? */}
          {puedeDigitalizar && (
            <div className="rounded-md border border-[color:var(--teal,#0C5C46)]/30 bg-[color:var(--teal,#0C5C46)]/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: TEAL }}>
                <Link2 className="h-3.5 w-3.5" /> ¿Ya existe digitalizado? (documentos fijos)
              </p>
              {cargandoDigitalizados ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando…</p>
              ) : digitalizados.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay documentos digitalizados todavía para este expediente.</p>
              ) : (
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {digitalizados.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
                      <input
                        type="radio"
                        name="relacionar"
                        checked={relacionadoId === d.id}
                        onChange={() => { setRelacionadoId(d.id); if (!nombreDocumento) setNombreDocumento(d.nombre || ""); }}
                      />
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{d.nombre || "(sin nombre)"}</span>
                    </label>
                  ))}
                  {relacionadoId && (
                    <button onClick={() => setRelacionadoId(null)} className="mt-1 text-[11px] text-muted-foreground underline">Quitar relación</button>
                  )}
                </div>
              )}

              <div className="mt-2 border-t border-border pt-2">
                <label className={`${lbl} flex items-center gap-1.5`}><Upload className="h-3.5 w-3.5" /> No existe — subir uno nuevo</label>
                <input
                  type="file"
                  disabled={subiendo || !casoCompleto}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) subirYRelacionar(f); }}
                  className="block w-full text-xs"
                />
                {subiendo && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Subiendo a Drive…</p>}
              </div>
            </div>
          )}
          {!puedeDigitalizar && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              {asunto.unidad} todavía no tiene el flujo de digitalización conectado en esta pantalla — este registro queda solo como inventario físico.
            </p>
          )}

          {/* Paso 2: clasificación */}
          <div>
            <label className={lbl}>Tipo de asunto</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_ASUNTO.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTipoAsunto(t.value)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${tipoAsunto === t.value ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium text-[color:var(--teal)]" : "border-input text-muted-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paso 3: datos del documento físico */}
          <div><label className={lbl}>Nombre del documento</label><input className={inp} value={nombreDocumento} onChange={(e) => setNombreDocumento(e.target.value)} placeholder="Ej. Escrito inicial de demanda" /></div>
          <div><label className={lbl}>Descripción (opcional)</label><input className={inp} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={`${lbl} flex items-center gap-1`}><MapPin className="h-3 w-3" /> Ubicación</label><input className={inp} value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} /></div>
            <div><label className={lbl}>Carpeta física</label><input className={inp} value={carpetaFisica} onChange={(e) => setCarpetaFisica(e.target.value)} placeholder="Ej. Archivero 2, caja 5" /></div>
          </div>

          {docRelacionado && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Se relacionará con "{docRelacionado.nombre}" (ya digitalizado)</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-3">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando || listo}
            className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: TEAL }}
          >
            {listo ? <><CheckCircle2 className="h-4 w-4" /> Guardado</> : guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : "Guardar registro"}
          </button>
        </div>
      </div>
    </div>
  );
}

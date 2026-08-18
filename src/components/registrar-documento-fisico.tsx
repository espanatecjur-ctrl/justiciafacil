import { useEffect, useMemo, useState } from "react";
import { X, FileText, FolderOpen, Upload, Link2, Loader2, CheckCircle2, MapPin } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { listarDocumentos, subirDocumento, type DocumentoGarantia } from "@/lib/drive";
import { listarCopias, firmarCopias, type Copia } from "@/lib/drive-explorar";
import { BotonVerDoc } from "@/components/visor-documento";
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

// Una fila de la lista "¿ya existe digitalizado?" — puede venir de dos fuentes distintas:
// - documento_garantia: algo que se subió/registró como movimiento desde alguna ficha.
// - drive_copia ("documentos fijos"): todo lo que ya está copiado del Drive al sistema,
//   tenga o no un movimiento propio en documento_garantia.
// Un mismo archivo real (mismo drive_id) puede vivir en ambas tablas — aquí se combinan
// y se muestra UNA sola vez, para que la lista esté completa y no haya duplicados.
interface FilaDigitalizado {
  clave: string;             // identificador único dentro de esta lista (id real o "copia:driveId")
  garantiaId: string | null; // id real en documento_garantia, si ya existe
  nombre: string | null;
  link: string | null;       // url visible/firmada, para el visor
  driveId: string | null;
  copiaPendiente: Copia | null; // si viene solo de drive_copia (sin fila en documento_garantia todavía)
}

// Modal para: 1) ver si el documento ya existe digitalizado (documentos fijos, subidos
// o copiados del Drive) y relacionarlo, o 2) subirlo si no existe, y en cualquier caso
// 3) registrar dónde vive físicamente (Mazatlán, qué carpeta) y de qué tipo de asunto se trata.
export function RegistrarDocumentoFisico({ asunto, onClose, onGuardado }: Props) {
  const [tipoAsunto, setTipoAsunto] = useState("demanda_civil");
  const [nombreDocumento, setNombreDocumento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [carpetaFisica, setCarpetaFisica] = useState("");
  const [ubicacion, setUbicacion] = useState("Mazatlán");

  const [filas, setFilas] = useState<FilaDigitalizado[]>([]);
  const [cargandoDigitalizados, setCargandoDigitalizados] = useState(false);
  const [relacionadaClave, setRelacionadaClave] = useState<string | null>(null);

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
      .then(async (d) => {
        const c = d[0] || null;
        setCasoCompleto(c);
        if (!c) return;

        const [movimientos, copiasMapa] = await Promise.all([
          listarDocumentos(c),
          listarCopias(c.id!),
        ]);

        // driveId -> fila de documento_garantia que ya lo representa (para no duplicar).
        const driveIdYaRepresentado = new Set(movimientos.filter((m) => m.drive_id).map((m) => m.drive_id as string));

        const filasMovimientos: FilaDigitalizado[] = movimientos.map((m) => ({
          clave: m.id, garantiaId: m.id, nombre: m.nombre, link: m.link, driveId: m.drive_id, copiaPendiente: null,
        }));

        // Copias del Drive que NO tienen todavía su propio movimiento en documento_garantia.
        const copiasSueltas = Object.values(copiasMapa).filter((cp) => !driveIdYaRepresentado.has(cp.drive_id));
        const urls = copiasSueltas.length > 0 ? await firmarCopias(copiasSueltas.map((cp) => cp.storage_path)) : {};
        const filasCopias: FilaDigitalizado[] = copiasSueltas.map((cp) => ({
          clave: `copia:${cp.drive_id}`, garantiaId: null, nombre: cp.nombre, link: urls[cp.storage_path] || null, driveId: cp.drive_id, copiaPendiente: cp,
        }));

        setFilas([...filasMovimientos, ...filasCopias]);
      })
      .catch(() => {})
      .finally(() => setCargandoDigitalizados(false));
  }, [asunto.casoJuridicoId, puedeDigitalizar]);

  const filaRelacionada = useMemo(() => filas.find((f) => f.clave === relacionadaClave) || null, [filas, relacionadaClave]);

  async function subirYRelacionar(file: File) {
    if (!casoCompleto) return;
    setSubiendo(true);
    setError(null);
    try {
      const r = await subirDocumento("UCM", casoCompleto, file, "evidencia");
      if (!r.ok || !r.doc) { setError(r.error || "No se pudo subir el archivo."); return; }
      const nueva: FilaDigitalizado = { clave: r.doc.id, garantiaId: r.doc.id, nombre: r.doc.nombre, link: r.doc.link, driveId: r.doc.drive_id, copiaPendiente: null };
      setFilas((p) => [nueva, ...p]);
      setRelacionadaClave(nueva.clave);
      if (!nombreDocumento) setNombreDocumento(r.doc.nombre || file.name);
    } finally {
      setSubiendo(false);
    }
  }

  async function correoActual(): Promise<string | null> {
    try { const a = await getAuth(); const { data } = await a.auth.getSession(); return data.session?.user?.email || null; } catch { return null; }
  }

  async function guardar() {
    if (!nombreDocumento.trim()) { setError("Escribe el nombre del documento."); return; }
    setGuardando(true);
    setError(null);
    try {
      const solicita = await correoActual();

      // Si eligieron una "copia suelta" (existe en Drive/documentos fijos pero nunca se
      // registró como movimiento), se formaliza aquí mismo: se crea su fila en
      // documento_garantia para que quede vinculada al asunto, y de ahí sale el id real.
      let garantiaId = filaRelacionada?.garantiaId ?? null;
      if (filaRelacionada?.copiaPendiente && !garantiaId && casoCompleto) {
        const cp = filaRelacionada.copiaPendiente;
        const ins = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({
            caso_id: casoCompleto.id,
            expediente: casoCompleto.expediente || null,
            nombre: cp.nombre || nombreDocumento.trim(),
            link: filaRelacionada.link,
            drive_id: cp.drive_id,
            mime: cp.mime,
            tipo: "otro",
            subido_por: solicita,
            nota: "Formalizado desde Archivo General a partir de una copia ya existente en documentos fijos.",
          }),
        });
        const filasIns = ins.ok ? await ins.json() : [];
        garantiaId = filasIns?.[0]?.id ?? null;
      }

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
        documento_garantia_id: garantiaId,
        digitalizado: !!garantiaId,
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
          {/* Paso 1: ¿ya existe digitalizado? — une lo subido en la ficha y lo copiado del Drive */}
          {puedeDigitalizar && (
            <div className="rounded-md border border-[color:var(--teal,#0C5C46)]/30 bg-[color:var(--teal,#0C5C46)]/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: TEAL }}>
                <Link2 className="h-3.5 w-3.5" /> ¿Ya existe digitalizado? (documentos fijos)
              </p>
              {cargandoDigitalizados ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando…</p>
              ) : filas.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay documentos digitalizados todavía para este expediente.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {filas.map((f) => (
                    <div key={f.clave} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
                      <input
                        type="radio"
                        name="relacionar"
                        checked={relacionadaClave === f.clave}
                        onChange={() => { setRelacionadaClave(f.clave); if (!nombreDocumento) setNombreDocumento(f.nombre || ""); }}
                      />
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.nombre || "(sin nombre)"}</span>
                      {f.copiaPendiente && <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">copiado del Drive</span>}
                      <BotonVerDoc url={f.link} driveId={f.driveId} nombre={f.nombre} label="Ver" className="shrink-0 inline-flex items-center gap-1 text-[color:var(--teal)] hover:underline" />
                    </div>
                  ))}
                  {relacionadaClave && (
                    <button onClick={() => setRelacionadaClave(null)} className="mt-1 text-[11px] text-muted-foreground underline">Quitar relación</button>
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

          {filaRelacionada && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Se relacionará con "{filaRelacionada.nombre}"
              {filaRelacionada.copiaPendiente ? " (se formalizará como movimiento del expediente al guardar)" : " (ya digitalizado)"}
            </p>
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

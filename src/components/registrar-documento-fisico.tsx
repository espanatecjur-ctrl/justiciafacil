import { useEffect, useMemo, useState } from "react";
import { X, FileText, FolderOpen, Upload, Link2, Loader2, CheckCircle2, Plus, ChevronLeft } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { listarDocumentos, subirDocumento, type DocumentoGarantia } from "@/lib/drive";
import { listarCopias, firmarCopias, type Copia } from "@/lib/drive-explorar";
import { BotonVerDoc } from "@/components/visor-documento";
import { getAuth } from "@/lib/auth";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";
import { detectarUbicacion } from "@/lib/ciudad-judicial";
import { nombresSucursales, sucursalJuridicoDe } from "@/lib/archivo-general";
import { carpetaDeAsunto, listarCarpetasDeSucursal, crearCarpeta, type CarpetaFisica } from "@/lib/carpetas-fisicas";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const TEAL = "#0C5C46";
const NAVY = "#0B1E3A";
const AZUL = "#185FA5";
const AZUL_CLARO = "#85B7EB";

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

interface FilaDigitalizado {
  clave: string;
  garantiaId: string | null;
  nombre: string | null;
  link: string | null;
  driveId: string | null;
  copiaPendiente: Copia | null;
}

export function RegistrarDocumentoFisico({ asunto, onClose, onGuardado }: Props) {
  const [casoCompleto, setCasoCompleto] = useState<CasoJuridico | null>(null);
  const [sucursales, setSucursales] = useState<string[]>([]);
  const [sucursalElegida, setSucursalElegida] = useState<string>("");
  const [carpetas, setCarpetas] = useState<CarpetaFisica[]>([]);
  const [cargandoCarpetas, setCargandoCarpetas] = useState(true);
  const [carpeta, setCarpeta] = useState<CarpetaFisica | null>(null);
  const [creandoCarpeta, setCreandoCarpeta] = useState(false);

  const [tipoAsunto, setTipoAsunto] = useState("demanda_civil");
  const [nombreDocumento, setNombreDocumento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacionTexto, setUbicacionTexto] = useState("");

  const [filas, setFilas] = useState<FilaDigitalizado[]>([]);
  const [cargandoDigitalizados, setCargandoDigitalizados] = useState(false);
  const [relacionadaClave, setRelacionadaClave] = useState<string | null>(null);

  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const puedeDigitalizar = asunto.unidad === "UCM" || asunto.unidad === "UCP";

  useEffect(() => {
    let activo = true;
    async function preparar() {
      setCargandoCarpetas(true);
      const [nombres, casoExistente] = await Promise.all([
        nombresSucursales(),
        asunto.casoJuridicoId ? sbSelect<CasoJuridico>("caso_juridico", `select=*&id=eq.${asunto.casoJuridicoId}`) : Promise.resolve([]),
      ]);
      if (!activo) return;
      const caso = casoExistente[0] || null;
      setCasoCompleto(caso);
      setSucursales(nombres);

      let sucursalDetectada = (caso as any)?.sucursal || null;
      if (!sucursalDetectada) {
        const ubic = detectarUbicacion({ distrito_judicial: asunto.direccion, juzgado: null, entidad: null });
        if (ubic?.ciudad) sucursalDetectada = await sucursalJuridicoDe(ubic.ciudad);
      }
      const sucursalFinal = sucursalDetectada || nombres[0] || "";
      setSucursalElegida(sucursalFinal);

      const [carpetaYaAsignada, carpetasDelEstante] = await Promise.all([
        carpetaDeAsunto(asunto),
        sucursalFinal ? listarCarpetasDeSucursal(sucursalFinal) : Promise.resolve([]),
      ]);
      if (!activo) return;
      setCarpetas(carpetasDelEstante);
      if (carpetaYaAsignada) setCarpeta(carpetaYaAsignada);
      setCargandoCarpetas(false);
    }
    preparar();
    return () => { activo = false; };
  }, [asunto.id]);

  async function cambiarSucursal(nueva: string) {
    setSucursalElegida(nueva);
    setCargandoCarpetas(true);
    const lista = await listarCarpetasDeSucursal(nueva);
    setCarpetas(lista);
    setCargandoCarpetas(false);
  }

  async function crearCarpetaNueva() {
    setCreandoCarpeta(true);
    setError(null);
    try {
      const folioSistema = (casoCompleto as any)?.folio || asunto.expediente || asunto.no_credito || null;
      const nueva = await crearCarpeta(asunto, sucursalElegida, folioSistema);
      if (!nueva) { setError("No se pudo crear la carpeta."); return; }
      setCarpetas((p) => [nueva, ...p]);
      setCarpeta(nueva);
    } finally {
      setCreandoCarpeta(false);
    }
  }

  useEffect(() => {
    if (!puedeDigitalizar || !casoCompleto) return;
    setCargandoDigitalizados(true);
    (async () => {
      const [movimientos, copiasMapa] = await Promise.all([
        listarDocumentos(casoCompleto),
        listarCopias(casoCompleto.id!),
      ]);
      const driveIdYaRepresentado = new Set(movimientos.filter((m) => m.drive_id).map((m) => m.drive_id as string));
      const filasMovimientos: FilaDigitalizado[] = movimientos.map((m) => ({
        clave: m.id, garantiaId: m.id, nombre: m.nombre, link: m.link, driveId: m.drive_id, copiaPendiente: null,
      }));
      const copiasSueltas = Object.values(copiasMapa).filter((cp) => !driveIdYaRepresentado.has(cp.drive_id));
      const urls = copiasSueltas.length > 0 ? await firmarCopias(copiasSueltas.map((cp) => cp.storage_path)) : {};
      const filasCopias: FilaDigitalizado[] = copiasSueltas.map((cp) => ({
        clave: `copia:${cp.drive_id}`, garantiaId: null, nombre: cp.nombre, link: urls[cp.storage_path] || null, driveId: cp.drive_id, copiaPendiente: cp,
      }));
      setFilas([...filasMovimientos, ...filasCopias]);
    })().catch(() => {}).finally(() => setCargandoDigitalizados(false));
  }, [casoCompleto, puedeDigitalizar]);

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
      if (carpeta) {
        await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${r.doc.id}`, { method: "PATCH", headers, body: JSON.stringify({ carpeta_id: carpeta.id }) });
      }
    } finally {
      setSubiendo(false);
    }
  }

  async function correoActual(): Promise<string | null> {
    try { const a = await getAuth(); const { data } = await a.auth.getSession(); return data.session?.user?.email || null; } catch { return null; }
  }

  async function guardar() {
    if (!carpeta) { setError("Elige o crea la carpeta física primero."); return; }
    if (!nombreDocumento.trim()) { setError("Escribe el nombre del documento."); return; }
    setGuardando(true);
    setError(null);
    try {
      const solicita = await correoActual();

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
            carpeta_id: carpeta.id,
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
        ubicacion: ubicacionTexto.trim() || sucursalElegida,
        carpeta_fisica: carpeta.folio,
        carpeta_id: carpeta.id,
        sucursal: sucursalElegida,
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
          {!carpeta ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: AZUL }}>Paso 1 · Elige la carpeta</p>
                <select value={sucursalElegida} onChange={(e) => cambiarSucursal(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                  {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {cargandoCarpetas ? (
                <p className="flex items-center gap-1.5 py-4 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando estante…</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {carpetas.map((c) => (
                    <button key={c.id} onClick={() => setCarpeta(c)} className="overflow-hidden rounded-lg border border-input text-left">
                      <div className="flex h-16 items-center justify-center" style={{ background: AZUL_CLARO }}>
                        <FolderOpen className="h-6 w-6" style={{ color: NAVY }} />
                      </div>
                      <p className="truncate bg-muted/50 p-1.5 text-[10px] font-medium">{c.folio}</p>
                    </button>
                  ))}
                  <button onClick={crearCarpetaNueva} disabled={creandoCarpeta || !sucursalElegida} className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-muted-foreground/40 text-muted-foreground disabled:opacity-50">
                    {creandoCarpeta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span className="text-[10px]">Nueva carpeta</span>
                  </button>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">El folio se genera solo — no se escribe a mano.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md p-2.5 text-xs" style={{ background: `${AZUL}14` }}>
              <span className="flex items-center gap-1.5 font-medium" style={{ color: AZUL }}><FolderOpen className="h-3.5 w-3.5" /> {carpeta.folio}</span>
              <button onClick={() => setCarpeta(null)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-3 w-3" /> Cambiar carpeta</button>
            </div>
          )}

          {carpeta && (
            <>
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

              <div><label className={lbl}>Nombre del documento</label><input className={inp} value={nombreDocumento} onChange={(e) => setNombreDocumento(e.target.value)} placeholder="Ej. Escrito inicial de demanda" /></div>
              <div><label className={lbl}>Descripción (opcional)</label><input className={inp} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
              <div><label className={lbl}>Nota de ubicación exacta (opcional)</label><input className={inp} value={ubicacionTexto} onChange={(e) => setUbicacionTexto(e.target.value)} placeholder="Ej. Archivero 2, dentro de la carpeta" /></div>

              {filaRelacionada && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Se relacionará con "{filaRelacionada.nombre}"
                  {filaRelacionada.copiaPendiente ? " (se formalizará como movimiento del expediente al guardar)" : " (ya digitalizado)"}
                </p>
              )}
            </>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-3">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando || listo || !carpeta}
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

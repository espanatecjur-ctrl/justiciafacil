// ============================================================
// CarpetaDriveVinculada · dentro de la ficha del expediente.
//  · Si NO hay carpeta vinculada → botón "Vincular carpeta de Drive".
//  · Si YA hay → muestra el nombre + vista previa de todos sus documentos.
// Guarda la carpeta en el caso (columnas drive_carpeta_id / drive_carpeta_nombre).
// ============================================================
import { useEffect, useState } from "react";
import {
  HardDrive, FolderCheck, FileText, ExternalLink, Maximize2,
  Loader2, RefreshCw, X, Link2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { VisorDocumentoModal } from "@/components/visor-documento";
import { ExploradorDrive } from "@/components/explorador-drive";
import { listarCarpeta, previewDeId, tipoLegible, esCarpeta, sugerirCarpetas, textosDeCaso, type ItemDrive, type Sugerencia } from "@/lib/drive-explorar";
import { type CasoJuridico } from "@/lib/supabase";

export function CarpetaDriveVinculada({
  caso,
  onGuardar,
}: {
  caso: CasoJuridico;
  onGuardar: (campos: Record<string, string>) => void | Promise<void>;
}) {
  const carpetaId = caso.drive_carpeta_id || "";
  const carpetaNombre = caso.drive_carpeta_nombre || "";

  const [eligiendo, setEligiendo] = useState(false);
  const [docs, setDocs] = useState<ItemDrive[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docSel, setDocSel] = useState<ItemDrive | null>(null);
  const [guardando, setGuardando] = useState(false);

  // sugerencias por número (expediente / crédito / gar)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [cargSug, setCargSug] = useState(false);
  const textos = textosDeCaso(caso);
  const cargarSugerencias = () => {
    if (textos.length === 0) return;
    setCargSug(true);
    sugerirCarpetas(textos).then(setSugerencias).finally(() => setCargSug(false));
  };
  useEffect(() => {
    if (!carpetaId && textos.length > 0) cargarSugerencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carpetaId]);

  // paginación de la vista previa (para no cargar muchos iframes a la vez)
  const PAGE = 6;
  const [pagina, setPagina] = useState(0);

  const cargarDocs = () => {
    if (!carpetaId) return;
    setCargando(true); setError(null);
    listarCarpeta(carpetaId)
      .then((r) => {
        if (!r.ok) setError(r.error || "No se pudieron leer los documentos.");
        setDocs((r.items || []).filter((it) => !esCarpeta(it)));
      })
      .finally(() => setCargando(false));
  };
  useEffect(() => { setPagina(0); cargarDocs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [carpetaId]);

  const elegir = async (id: string, nombre: string) => {
    setGuardando(true);
    await onGuardar({ drive_carpeta_id: id, drive_carpeta_nombre: nombre });
    setGuardando(false);
    setEligiendo(false);
  };

  const totalPag = Math.max(1, Math.ceil(docs.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const docsPag = docs.slice(pag * PAGE, pag * PAGE + PAGE);

  return (
    <Card className="legal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)]"><HardDrive className="h-4 w-4" /></div>
        <p className="text-sm font-semibold" style={{ color: "#0B1E3A" }}>Carpeta de Drive</p>
      </div>

      {/* ---- SIN carpeta vinculada ---- */}
      {!carpetaId && !eligiendo && (
        <div className="space-y-3">
          {/* Sugerencias por número (expediente / crédito / gar) */}
          {(cargSug || sugerencias.length > 0) && (
            <div className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
              <p className="mb-2 text-xs font-semibold text-[color:var(--teal)]">
                {cargSug ? "Buscando carpetas que coincidan…" : "¿Es alguna de estas? (coinciden por número)"}
              </p>
              {cargSug ? (
                <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Un momento…</p>
              ) : (
                <div className="space-y-1.5">
                  {sugerencias.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2">
                      <FolderCheck className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                      <span className="min-w-0 flex-1 truncate text-sm" title={s.name}>{s.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">coincide: {s.coincide}</span>
                      <button onClick={() => elegir(s.id, s.name)} className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "#0C5C46" }}>Usar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-dashed border-input p-4 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              {sugerencias.length > 0 ? "¿Ninguna es? Busca la carpeta a mano." : "Este expediente todavía no tiene una carpeta de Drive."}
            </p>
            <button onClick={() => setEligiendo(true)} className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "#0C5C46" }}>
              <Link2 className="h-4 w-4" /> Vincular carpeta de Drive
            </button>
          </div>
        </div>
      )}

      {/* ---- CON carpeta vinculada ---- */}
      {carpetaId && !eligiendo && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FolderCheck className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
            <span className="min-w-0 truncate text-sm font-medium" title={carpetaNombre}>{carpetaNombre || "Carpeta vinculada"}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"><FolderCheck className="h-3 w-3" /> Vinculada</span>
            <span className="flex-1" />
            <button onClick={cargarDocs} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button>
            <button onClick={() => { if (sugerencias.length === 0) cargarSugerencias(); setEligiendo(true); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Cambiar</button>
            <a href={`https://drive.google.com/drive/folders/${carpetaId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir en Drive</a>
          </div>

          {cargando ? (
            <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Cargando documentos…</p>
          ) : error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {error}
              <p className="mt-1 text-xs">Si dice que no hay acceso, agrega la cuenta de servicio como Lector en esa Unidad de Drive.</p>
            </div>
          ) : docs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Esta carpeta no tiene documentos.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {docsPag.map((a) => (
                  <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-white">
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                      <p className="min-w-0 flex-1 truncate text-xs font-medium" title={a.name}>{a.name}</p>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tipoLegible(a.mimeType)}</span>
                    </div>
                    <button onClick={() => setDocSel(a)} className="group relative block h-40 w-full bg-muted" title="Ampliar vista previa">
                      <iframe src={previewDeId(a.id)} title={a.name} loading="lazy" className="pointer-events-none h-full w-full border-0" />
                      <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-foreground"><Maximize2 className="h-3.5 w-3.5" /> Ampliar</span>
                      </span>
                    </button>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <button onClick={() => setDocSel(a)} className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline"><Maximize2 className="h-3.5 w-3.5" /> Vista previa</button>
                      {a.webViewLink && <a href={a.webViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Drive</a>}
                    </div>
                  </div>
                ))}
              </div>
              {docs.length > PAGE && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{docs.length} documentos · pág. {pag + 1} de {totalPag}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPagina(pag - 1)} disabled={pag === 0} className="rounded-md border border-input px-3 py-1.5 disabled:opacity-40">Anterior</button>
                    <button onClick={() => setPagina(pag + 1)} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-3 py-1.5 disabled:opacity-40">Siguiente</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ---- ESCOGER carpeta (buscador de Drive) ---- */}
      {eligiendo && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Escoge la carpeta de Drive para este expediente</p>
            <button onClick={() => setEligiendo(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          {guardando && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Guardando…</p>}

          {sugerencias.length > 0 && (
            <div className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
              <p className="mb-2 text-xs font-semibold text-[color:var(--teal)]">¿Es alguna de estas? (coinciden por número)</p>
              <div className="space-y-1.5">
                {sugerencias.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2">
                    <FolderCheck className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                    <span className="min-w-0 flex-1 truncate text-sm" title={s.name}>{s.name}</span>
                    <button onClick={() => elegir(s.id, s.name)} className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "#0C5C46" }}>Usar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ExploradorDrive mostrarEncabezado={false} onElegirCarpeta={elegir} />
        </div>
      )}

      {docSel && (
        <VisorDocumentoModal url={docSel.webViewLink || ""} driveId={docSel.id} nombre={docSel.name} onCerrar={() => setDocSel(null)} />
      )}
    </Card>
  );
}

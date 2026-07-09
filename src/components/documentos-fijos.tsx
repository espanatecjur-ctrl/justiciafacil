// ============================================================
// DocumentosFijos · panel liviano para quien NO tiene el permiso
// "drive_avanzado". Solo muestra lo que YA está copiado en el
// almacén del sistema (tabla drive_copia) — nunca navega Drive.
//  · Avisa (sin exponer el explorador) si hay documentos nuevos
//    en Drive todavía sin copiar.
//  · Permite agregar un documento individual: lo sube de verdad a
//    la carpeta de Drive vinculada y de inmediato lo copia también
//    al almacén (descarga + carga real, con un clic).
// ============================================================
import { useEffect, useState } from "react";
import { Pin, FileText, Loader2, Maximize2, ExternalLink, UploadCloud, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VisorDocumentoModal } from "@/components/visor-documento";
import { listarCopias, firmarCopias, sincronizarCarpeta, revisarPendientesDrive, type Copia } from "@/lib/drive-explorar";
import { subirDocumento } from "@/lib/drive";
import type { CasoJuridico } from "@/lib/supabase";

export function DocumentosFijos({ caso, area }: { caso: CasoJuridico; area: string }) {
  const carpetaId = caso.drive_carpeta_id || "";

  const [copias, setCopias] = useState<Record<string, Copia>>({});
  const [cargando, setCargando] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [docSel, setDocSel] = useState<{ id: string; nombre: string; url: string } | null>(null);

  const cargar = () => {
    setCargando(true);
    listarCopias(caso.id).then(setCopias).finally(() => setCargando(false));
  };
  useEffect(cargar, [caso.id]);

  const lista = Object.values(copias);

  // Firma los enlaces de lo que ya está copiado (para vista previa/descarga).
  useEffect(() => {
    const paths = lista.map((c) => c.storage_path).filter((p) => p && !urls[p]);
    if (paths.length === 0) return;
    firmarCopias(paths).then((nuevas) => setUrls((prev) => ({ ...prev, ...nuevas })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copias]);

  // Aviso (solo conteo, sin explorar Drive) de documentos nuevos sin copiar.
  const [pendientes, setPendientes] = useState<number | null>(null);
  const revisar = () => {
    if (!carpetaId) { setPendientes(null); return; }
    revisarPendientesDrive(caso.id, carpetaId).then((r) => setPendientes(r.ok ? (r.pendientes ?? 0) : null));
  };
  useEffect(revisar, [carpetaId, caso.id]);

  // Agregar documento individual: sube a Drive (real) y de inmediato lo copia al almacén.
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const agregar = async (file: File) => {
    if (!carpetaId) return;
    setSubiendo(true); setMsg("Subiendo a la carpeta…");
    const r = await subirDocumento(area, caso, file, "otro");
    if (!r.ok) { setMsg("⚠️ " + (r.error || "No se pudo subir el documento.")); setSubiendo(false); return; }
    setMsg("Copiando al sistema…");
    const s = await sincronizarCarpeta(caso.id, carpetaId, area, caso.no_credito || undefined, caso.cliente_nombre || undefined);
    setSubiendo(false);
    setMsg(s.ok ? "Documento agregado y copiado ✅" : "Se subió a Drive, pero faltó copiarlo al sistema — dale a alguien con el explorador que sincronice.");
    cargar();
    revisar();
  };

  // Copiar los documentos nuevos detectados en Drive (sin abrir el explorador — mismo botón para todo el equipo).
  const [copiandoPendientes, setCopiandoPendientes] = useState(false);
  const copiarPendientes = async () => {
    if (!carpetaId) return;
    setCopiandoPendientes(true); setMsg("Copiando documentos nuevos…");
    const s = await sincronizarCarpeta(caso.id, carpetaId, area, caso.no_credito || undefined, caso.cliente_nombre || undefined);
    setCopiandoPendientes(false);
    if (!s.ok) { setMsg("⚠️ " + (s.error || "No se pudieron copiar.")); return; }
    const faltan = s.restantes ?? 0;
    setMsg(faltan > 0 ? `Copiados ${s.copiados ?? 0} · faltan ${faltan}, dale de nuevo` : `Copiados ${s.copiados ?? 0} ✅ todo al día`);
    cargar();
    revisar();
  };

  return (
    <Card className="legal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)]"><Pin className="h-4 w-4" /></div>
        <p className="text-sm font-semibold" style={{ color: "#0B1E3A" }}>Documentos fijos</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-2 py-0.5 text-[11px] font-medium text-[color:var(--teal)]">
          Copia del sistema
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Aquí ves los documentos ya guardados en el sistema (no se navega Drive directamente).</p>

      {pendientes !== null && pendientes > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Hay {pendientes} documento{pendientes === 1 ? "" : "s"} nuevo{pendientes === 1 ? "" : "s"} en Drive sin copiar.</span>
          <button
            onClick={copiarPendientes}
            disabled={copiandoPendientes}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "#0C5C46" }}
          >
            {copiandoPendientes ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />} Copiar
          </button>
        </div>
      )}

      {carpetaId && (
        <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs font-medium ${subiendo ? "opacity-60" : "hover:bg-muted"}`} style={{ borderColor: "var(--teal)", color: "var(--teal)" }}>
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />} Agregar documento
          <input type="file" className="hidden" disabled={subiendo} onChange={(e) => { const f = e.target.files?.[0]; if (f) agregar(f); e.target.value = ""; }} />
        </label>
      )}
      {msg && (
        <div className="flex items-center gap-1.5 rounded-md bg-[color:var(--teal)]/5 px-3 py-1.5 text-xs text-[color:var(--teal)]">
          {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {msg}
        </div>
      )}

      {cargando ? (
        <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Cargando documentos…</p>
      ) : lista.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Todavía no hay documentos copiados al sistema para este expediente.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((c) => (
            <div key={c.drive_id} className="overflow-hidden rounded-lg border border-border bg-white">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                <p className="min-w-0 flex-1 truncate text-xs font-medium" title={c.nombre || ""}>{c.nombre || "Documento"}</p>
              </div>
              <button
                onClick={() => setDocSel({ id: c.drive_id, nombre: c.nombre || "Documento", url: urls[c.storage_path] || "" })}
                className="group relative block h-40 w-full bg-muted"
                title="Ampliar vista previa"
              >
                {urls[c.storage_path] ? (
                  (c.mime || "").includes("pdf") ? (
                    <iframe src={urls[c.storage_path]} title={c.nombre || ""} loading="lazy" className="pointer-events-none h-full w-full border-0" />
                  ) : (c.mime || "").startsWith("image/") ? (
                    <img src={urls[c.storage_path]} alt={c.nombre || ""} loading="lazy" className="h-full w-full object-contain bg-white" />
                  ) : /\.(docx?|xlsx?|pptx?)$/i.test(c.nombre || "") ? (
                    <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(urls[c.storage_path])}`} title={c.nombre || ""} loading="lazy" className="pointer-events-none h-full w-full border-0" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
                      <FileText className="h-8 w-8 text-[color:var(--teal)]/50" />
                      <span className="text-[11px] font-medium text-muted-foreground">Documento copiado</span>
                    </div>
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-foreground"><Maximize2 className="h-3.5 w-3.5" /> Ampliar</span>
                </span>
              </button>
              <div className="flex items-center justify-between px-3 py-1.5">
                <button onClick={() => setDocSel({ id: c.drive_id, nombre: c.nombre || "Documento", url: urls[c.storage_path] || "" })} className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline"><Maximize2 className="h-3.5 w-3.5" /> Vista previa</button>
                {urls[c.storage_path] && <a href={`${urls[c.storage_path]}&download=${encodeURIComponent(c.nombre || "documento")}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Descargar</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {docSel && (
        <VisorDocumentoModal url={docSel.url} driveId={null} nombre={docSel.nombre} onCerrar={() => setDocSel(null)} />
      )}
    </Card>
  );
}

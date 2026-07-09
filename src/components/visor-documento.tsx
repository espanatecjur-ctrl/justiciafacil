// ============================================================
// VisorDocumento · vista previa de un documento DENTRO del sistema.
// - Si el documento está copiado (Supabase Storage): imagen -> <img>,
//   PDF/otros -> iframe en compu y botón "Abrir documento" en celular
//   (los PDF no se embeben en móvil).
// - Si NO está copiado (solo Drive): NO embebe Google; invita a
//   sincronizar y deja un enlace a Drive por si tiene acceso.
// ============================================================
import { useState } from "react";
import { Eye, X, ExternalLink, FileText, CloudUpload } from "lucide-react";

/** Convierte un enlace a su forma embebible (se conserva por compatibilidad). */
export function urlVistaPrevia(url: string, driveId?: string | null): string {
  if (!url && driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  if (!url) return "";
  const m = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m && /drive\.google|docs\.google/.test(url)) return `https://drive.google.com/file/d/${m[1]}/preview`;
  if (/docs\.google\.com\/(document|spreadsheets|presentation)/.test(url)) {
    return url.replace(/\/(edit|view).*$/, "/preview");
  }
  return url;
}

export function VisorDocumentoModal({ url, driveId, nombre, onCerrar }: { url: string; driveId?: string | null; nombre?: string | null; onCerrar: () => void }) {
  const ref = (nombre || url || "").toLowerCase();
  const esImagen = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|&|$)/.test(ref);
  // Word / Excel / PowerPoint: el navegador no los abre solo — se embeben con el visor de Google.
  const esOffice = /\.(docx?|xlsx?|pptx?)(\?|&|$)/.test(ref);
  const enSistema = !!url && !driveId; // hay copia en el sistema (Storage)
  const abrir = url || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : "");
  const urlOffice = enSistema && esOffice ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` : "";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4" onClick={onCerrar}>
      <div className="my-2 flex h-[95vh] w-[98vw] max-w-6xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "#0B1E3A" }}>{nombre || "Documento"}</p>
          {abrir && <a href={abrir} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--teal)] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>}
          <button onClick={onCerrar} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {!enSistema ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <CloudUpload className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">Este documento aún no está copiado al sistema.</p>
            <p className="max-w-sm text-xs text-muted-foreground">Dale <b>«Sincronizar documentos»</b> para verlo aquí y en el celular, sin depender de que tengas acceso al Drive.</p>
            {abrir && <a href={abrir} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"><ExternalLink className="h-4 w-4" /> Abrir en Drive (si tienes acceso)</a>}
          </div>
        ) : esImagen ? (
          <div className="min-h-0 flex-1 overflow-auto bg-muted p-2">
            <img src={url} alt={nombre || "Documento"} className="mx-auto max-h-full max-w-full object-contain" />
          </div>
        ) : esOffice ? (
          <>
            {/* Compu: se embebe con el visor de Google (Word/Excel/PowerPoint no los abre el navegador solo). */}
            <iframe src={urlOffice} title={nombre || "Documento"} className="hidden min-h-0 flex-1 rounded-b-xl border-0 bg-muted sm:block" />
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center sm:hidden">
              <FileText className="h-10 w-10 text-[color:var(--teal)]/50" />
              <p className="text-sm font-medium text-foreground">Documento listo en el sistema</p>
              <p className="max-w-sm text-xs text-muted-foreground">Word / Excel / PowerPoint se abren mejor fuera de la vista previa en el celular.</p>
              <a href={abrir} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--teal)" }}><ExternalLink className="h-4 w-4" /> Abrir documento</a>
            </div>
          </>
        ) : (
          <>
            {/* Compu: se embebe. */}
            <iframe src={url} title={nombre || "Documento"} className="hidden min-h-0 flex-1 rounded-b-xl border-0 bg-muted sm:block" />
            {/* Celular: los PDF no se embeben; botón para abrirlo desde el sistema. */}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center sm:hidden">
              <FileText className="h-10 w-10 text-[color:var(--teal)]/50" />
              <p className="text-sm font-medium text-foreground">Documento listo en el sistema</p>
              <p className="max-w-sm text-xs text-muted-foreground">En el celular se abre a pantalla completa.</p>
              <a href={abrir} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--teal)" }}><ExternalLink className="h-4 w-4" /> Abrir documento</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Botón inline que abre la vista previa. */
export function BotonVerDoc({ url, driveId, nombre, label = "Ver", className, icon = true }: {
  url?: string | null; driveId?: string | null; nombre?: string | null; label?: string; className?: string; icon?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!url && !driveId) return null;
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setAbierto(true); }} className={className || "inline-flex items-center gap-1 text-[color:var(--teal)] hover:underline"}>
        {icon && <Eye className="h-3.5 w-3.5" />} {label}
      </button>
      {abierto && <VisorDocumentoModal url={url || ""} driveId={driveId} nombre={nombre} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

// ============================================================
// VisorDocumento · vista previa de cualquier documento DENTRO del
// sistema (sin entrar a Drive). Convierte enlaces de Google Drive
// a su forma /preview y los embebe en un iframe. Sirve para Drive,
// Supabase Storage, PDFs e imágenes por URL.
//
// Uso rápido (reemplaza un <a target="_blank">):
//   <BotonVerDoc url={doc.url} nombre={doc.nombre} label="ver archivo" />
// ============================================================
import { useState } from "react";
import { Eye, X } from "lucide-react";

/** Convierte un enlace a su forma embebible (vista previa). */
export function urlVistaPrevia(url: string, driveId?: string | null): string {
  if (!url && driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  if (!url) return "";
  // Google Drive: /file/d/ID/...  ó  open?id=ID  ó  uc?id=ID
  const m = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m && /drive\.google|docs\.google/.test(url)) return `https://drive.google.com/file/d/${m[1]}/preview`;
  // Google Docs/Sheets/Slides: usar /preview
  if (/docs\.google\.com\/(document|spreadsheets|presentation)/.test(url)) {
    return url.replace(/\/(edit|view).*$/, "/preview");
  }
  return url; // Supabase Storage u otras URLs directas (PDF/imagen) se embeben tal cual
}

export function VisorDocumentoModal({ url, driveId, nombre, onCerrar }: { url: string; driveId?: string | null; nombre?: string | null; onCerrar: () => void }) {
  const src = urlVistaPrevia(url, driveId);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onCerrar}>
      <div className="my-4 flex h-[88vh] w-[94vw] max-w-4xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <p className="truncate text-sm font-semibold" style={{ color: "#0B1E3A" }}>{nombre || "Documento"}</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {src ? (
          <iframe src={src} title={nombre || "Documento"} className="min-h-0 flex-1 rounded-b-xl border-0 bg-muted" />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">No hay documento para mostrar.</div>
        )}
      </div>
    </div>
  );
}

/** Botón inline que abre la vista previa. Reemplaza a un <a target="_blank">. */
export function BotonVerDoc({ url, driveId, nombre, label = "Ver", className, icon = true }: {
  url?: string | null; driveId?: string | null; nombre?: string | null; label?: string; className?: string; icon?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!url && !driveId) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAbierto(true); }}
        className={className || "inline-flex items-center gap-1 text-[color:var(--teal)] hover:underline"}
      >
        {icon && <Eye className="h-3.5 w-3.5" />} {label}
      </button>
      {abierto && <VisorDocumentoModal url={url || ""} driveId={driveId} nombre={nombre} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

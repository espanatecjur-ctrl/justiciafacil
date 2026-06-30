import { useEffect, useState } from "react";
import { Folder, Eye, FileText, Image as ImageIcon, File as FileIcon, Gavel, Camera, ClipboardList } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { listarDocumentos, type DocumentoGarantia } from "@/lib/drive";

const TIPOS: Record<string, { t: string; bg: string; fg: string; icon: any }> = {
  actuacion: { t: "Actuación", bg: "#E6F1FB", fg: "#0C447C", icon: Gavel },
  evidencia: { t: "Evidencia", bg: "#E1F5EE", fg: "#085041", icon: Camera },
  tarea:     { t: "Tarea",     bg: "#FAEEDA", fg: "#854F0B", icon: ClipboardList },
  otro:      { t: "Documento", bg: "#F1EFE8", fg: "#444441", icon: FileIcon },
};
const tipoDe = (t: string | null) => TIPOS[t || "otro"] || TIPOS.otro;

const fmt = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

function urlPreview(link: string, driveId: string | null): string {
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  const m = link.match(/\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return link;
}

function detalleDe(d: DocumentoGarantia): string {
  const partes: string[] = [];
  if (d.nota) partes.push(d.nota);
  if (d.tipo === "tarea" && d.asignado_a) partes.push(`→ ${d.asignado_a}`);
  if (d.nombre) partes.push(d.nombre);
  return partes.join(" · ") || "—";
}

export function MiniMovimientos({ caso }: { caso: CasoJuridico }) {
  const [docs, setDocs] = useState<DocumentoGarantia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ver, setVer] = useState<DocumentoGarantia | null>(null);

  useEffect(() => {
    setCargando(true);
    listarDocumentos(caso).then(setDocs).finally(() => setCargando(false));
  }, [caso.id]);

  if (cargando) return <p className="mt-3 text-xs text-muted-foreground">Cargando documentos…</p>;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--teal)]">
        <Folder className="h-3.5 w-3.5" /> Documentos y movimientos ({docs.length})
      </p>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin documentos todavía. Se agregan en la ficha.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.slice(0, 6).map((d) => {
            const td = tipoDe(d.tipo);
            const Icono = td.icon;
            return (
              <div key={d.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs">
                <span className="whitespace-nowrap text-muted-foreground">{fmt(d.fecha_mov || d.created_at)}</span>
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: td.bg, color: td.fg }}>
                  <Icono className="h-2.5 w-2.5" /> {td.t}
                </span>
                <span className="min-w-0 flex-1 truncate" title={detalleDe(d)}>{detalleDe(d)}</span>
                {d.link && <button onClick={() => setVer(d)} title="Ver" className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-muted"><Eye className="h-3.5 w-3.5 text-[color:var(--teal)]" /></button>}
              </div>
            );
          })}
          {docs.length > 6 && <p className="text-[10px] text-muted-foreground">… y {docs.length - 6} más (ver todos en la ficha).</p>}
        </div>
      )}

      {ver && ver.link && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={() => setVer(null)}>
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 p-3 text-white" style={{ background: "#0B1E3A" }}>
              <p className="truncate text-sm font-semibold">{ver.nombre || "Documento"}</p>
              <button onClick={() => setVer(null)} className="text-sm">Cerrar ✕</button>
            </div>
            <iframe src={urlPreview(ver.link, ver.drive_id)} title={ver.nombre || "Documento"} className="h-[70vh] w-full border-0 bg-muted" />
          </div>
        </div>
      )}
    </div>
  );
}

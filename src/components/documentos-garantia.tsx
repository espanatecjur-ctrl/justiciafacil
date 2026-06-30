import { useEffect, useRef, useState } from "react";
import { Folder, Upload, Eye, Download, X, Loader2, FileText, Image as ImageIcon, File as FileIcon, Trash2 } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { subirDocumento, listarDocumentos, borrarDocumento, type DocumentoGarantia } from "@/lib/drive";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";

const TIPOS = [
  { v: "actuacion", t: "Actuación" },
  { v: "evidencia", t: "Evidencia" },
  { v: "tarea", t: "Tarea" },
  { v: "otro", t: "Otro" },
];

const fmt = (s: string | null | undefined) => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

function iconoDe(mime: string | null, nombre: string) {
  const m = (mime || "").toLowerCase();
  const n = (nombre || "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) return <FileText className="h-5 w-5" style={{ color: "#A32D2D" }} />;
  if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic)$/.test(n)) return <ImageIcon className="h-5 w-5" style={{ color: "#185FA5" }} />;
  return <FileIcon className="h-5 w-5" style={{ color: "#5F5E5A" }} />;
}

// Convierte el link de Drive a uno que se pueda ver embebido (preview).
function urlPreview(link: string, driveId: string | null): string {
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  const m = link.match(/\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return link;
}

export function DocumentosGarantia({ area, caso }: { area: string; caso: CasoJuridico }) {
  const [docs, setDocs] = useState<DocumentoGarantia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tipo, setTipo] = useState("otro");
  const [ver, setVer] = useState<DocumentoGarantia | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = () => {
    setCargando(true);
    listarDocumentos(caso).then(setDocs).finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [caso.id]);

  const elegir = () => fileRef.current?.click();

  const onArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = ""; // permite volver a elegir el mismo
    if (!file) return;
    setSubiendo(true); setErr(null);
    const r = await subirDocumento(area, caso, file, tipo);
    setSubiendo(false);
    if (!r.ok) { setErr(r.error || "No se pudo subir."); return; }
    if (r.doc) setDocs((p) => [r.doc as DocumentoGarantia, ...p]);
  };

  const borrar = async (d: DocumentoGarantia) => {
    if (!confirm(`¿Quitar "${d.nombre}" de la lista? (el archivo seguirá en Drive)`)) return;
    const ok = await borrarDocumento(d.id);
    if (ok) setDocs((p) => p.filter((x) => x.id !== d.id));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>
          <Folder className="h-4 w-4" style={{ color: TEAL }} /> Documentos de la garantía
        </p>
        <div className="flex items-center gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}
          </select>
          <button onClick={elegir} disabled={subiendo} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
            {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir documento
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={onArchivo} />
        </div>
      </div>

      {err && <p className="mb-2 text-xs text-red-600">{err}</p>}

      {cargando ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Cargando documentos…</p>
      ) : docs.length === 0 ? (
        <p className="rounded-md bg-muted/40 p-3 text-center text-xs text-muted-foreground">Aún no hay documentos. Elige el tipo y sube el primero; se guardará en la carpeta de Drive de esta garantía.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/20 p-2.5">
              <button onClick={() => setVer(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {iconoDe(d.mime, d.nombre)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{fmt(d.created_at)}{d.subido_por ? ` · ${d.subido_por}` : ""}{d.tipo ? ` · ${TIPOS.find((t) => t.v === d.tipo)?.t || d.tipo}` : ""}</p>
                </div>
              </button>
              <button onClick={() => setVer(d)} title="Ver" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><Eye className="h-4 w-4 text-[color:var(--teal)]" /></button>
              <button onClick={() => borrar(d)} title="Quitar de la lista" className="grid h-8 w-8 place-items-center rounded-md hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-600" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Visor flotante */}
      {ver && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setVer(null)}>
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 p-3 text-white" style={{ background: NAVY }}>
              <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">{iconoDe(ver.mime, ver.nombre)} <span className="truncate">{ver.nombre}</span></p>
              <div className="flex shrink-0 items-center gap-3">
                <a href={ver.link} target="_blank" rel="noreferrer" title="Abrir / descargar" className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"><Download className="h-4 w-4" /></a>
                <button onClick={() => setVer(null)} title="Cerrar" className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <iframe src={urlPreview(ver.link, ver.drive_id)} title={ver.nombre} className="h-[70vh] w-full border-0 bg-muted" allow="autoplay" />
          </div>
        </div>
      )}
    </div>
  );
}

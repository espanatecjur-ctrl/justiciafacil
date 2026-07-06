import { useEffect, useRef, useState } from "react";
import { Folder, Plus, Eye, Download, X, Loader2, FileText, Image as ImageIcon, File as FileIcon, Gavel, Camera, ClipboardList, MoreVertical, Edit, Archive, Trash2, Check } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { listarDocumentos, editarMovimiento, moverPapelera, type DocumentoGarantia, type DatosMovimiento } from "@/lib/drive";
import { AgregarMovimientoModal } from "@/components/agregar-movimiento";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";

const TIPOS: Record<string, { t: string; bg: string; fg: string; icon: any }> = {
  actuacion: { t: "Actuación", bg: "#E6F1FB", fg: "#0C447C", icon: Gavel },
  evidencia: { t: "Evidencia", bg: "#E1F5EE", fg: "#085041", icon: Camera },
  tarea:     { t: "Tarea",     bg: "#FAEEDA", fg: "#854F0B", icon: ClipboardList },
  otro:      { t: "Documento", bg: "#F1EFE8", fg: "#444441", icon: FileIcon },
};
const tipoDe = (t: string | null) => TIPOS[t || "otro"] || TIPOS.otro;

const FILTROS = [
  { v: "todos", t: "Todos" },
  { v: "actuacion", t: "Actuaciones" },
  { v: "evidencia", t: "Evidencias" },
  { v: "tarea", t: "Tareas" },
  { v: "otro", t: "Documentos" },
];

const fmt = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

function iconoArchivo(mime: string | null, nombre: string | null) {
  const m = (mime || "").toLowerCase();
  const n = (nombre || "").toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) return <FileText className="h-4 w-4" style={{ color: "#A32D2D" }} />;
  if (m.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic)$/.test(n)) return <ImageIcon className="h-4 w-4" style={{ color: "#185FA5" }} />;
  return <FileIcon className="h-4 w-4" style={{ color: "#5F5E5A" }} />;
}

function urlPreview(link: string, driveId: string | null): string {
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  const m = link.match(/\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return link;
}

function detalleDe(d: DocumentoGarantia): string {
  const partes: string[] = [];
  if (d.nota) partes.push(d.nota);
  if (d.tipo === "tarea" && d.asignado_a) partes.push(`asignada a ${d.asignado_a}`);
  if (d.tipo === "actuacion" && d.proxima_actuacion) partes.push(`sigue: ${d.proxima_actuacion}`);
  if (d.nombre) partes.push(d.nombre);
  return partes.join(" · ") || "—";
}

function MenuFila({ doc, onVer, onEditar, onPapelera }: { doc: DocumentoGarantia; onVer: () => void; onEditar: () => void; onPapelera: () => void }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const ancho = 200;
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)) });
  };
  const cerrar = () => setPos(null);
  return (
    <>
      <button ref={btnRef} onClick={abrir} className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); cerrar(); }} />
          <div className="fixed z-50 w-[200px] overflow-hidden rounded-lg border border-border bg-card shadow-xl" style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
            {doc.link && (
              <button onClick={() => { cerrar(); onVer(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"><Eye className="h-4 w-4 text-[color:var(--teal)]" /> Ver</button>
            )}
            <button onClick={() => { cerrar(); onEditar(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"><Edit className="h-4 w-4 text-[color:var(--teal)]" /> Editar</button>
            <button onClick={() => { cerrar(); onPapelera(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"><Archive className="h-4 w-4" /> Archivar</button>
            <div className="border-t border-border" />
            <button onClick={() => { cerrar(); onPapelera(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Eliminar</button>
          </div>
        </>
      )}
    </>
  );
}

function EditarModal({ doc, onClose, onGuardado }: { doc: DocumentoGarantia; onClose: () => void; onGuardado: (cambios: Partial<DatosMovimiento>) => void }) {
  const [nota, setNota] = useState(doc.nota || "");
  const [fecha, setFecha] = useState((doc.fecha_mov || "").slice(0, 10));
  const [proxima, setProxima] = useState(doc.proxima_actuacion || "");
  const [asignado, setAsignado] = useState(doc.asignado_a || "");
  const [fechaLimite, setFechaLimite] = useState((doc.fecha_limite || "").slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="font-semibold">Editar movimiento</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          <div><label className={lbl}>Fecha</label><input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div><label className={lbl}>Nota / detalle</label><textarea className={inp} rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></div>
          {doc.tipo === "actuacion" && <div><label className={lbl}>Próxima actuación</label><input className={inp} value={proxima} onChange={(e) => setProxima(e.target.value)} /></div>}
          {doc.tipo === "tarea" && <div><label className={lbl}>Asignada a</label><input className={inp} value={asignado} onChange={(e) => setAsignado(e.target.value)} /></div>}
          {doc.tipo === "tarea" && <div><label className={lbl}>Fecha límite</label><input type="date" className={inp} value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} /></div>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button disabled={guardando} onClick={async () => {
              setGuardando(true);
              await onGuardado({
                nota: nota.trim() || null, fecha_mov: fecha || null,
                proxima_actuacion: doc.tipo === "actuacion" ? (proxima.trim() || null) : undefined,
                asignado_a: doc.tipo === "tarea" ? (asignado.trim() || null) : undefined,
                fecha_limite: doc.tipo === "tarea" ? (fechaLimite || null) : undefined,
              });
            }} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocumentosGarantia({ area, caso }: { area: string; caso: CasoJuridico }) {
  const [docs, setDocs] = useState<DocumentoGarantia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [ver, setVer] = useState<DocumentoGarantia | null>(null);
  const [editar, setEditar] = useState<DocumentoGarantia | null>(null);
  const [agregar, setAgregar] = useState(false);

  const cargar = () => {
    setCargando(true);
    listarDocumentos(caso).then(setDocs).finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [caso.id]);

  const papelera = async (d: DocumentoGarantia) => {
    if (!confirm(`¿Enviar este movimiento a la papelera? Se puede recuperar desde Configuración.`)) return;
    const ok = await moverPapelera(d.id, true);
    if (ok) setDocs((p) => p.filter((x) => x.id !== d.id));
  };

  const lista = filtro === "todos" ? docs : docs.filter((d) => (d.tipo || "otro") === filtro);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>
          <Folder className="h-4 w-4" style={{ color: TEAL }} /> Documentos y movimientos
        </p>
        <button onClick={() => setAgregar(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ background: TEAL }}>
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border p-2.5">
        {FILTROS.map((f) => {
          const n = f.v === "todos" ? docs.length : docs.filter((d) => (d.tipo || "otro") === f.v).length;
          const activo = filtro === f.v;
          return (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className={`rounded-full px-3 py-1 text-xs ${activo ? "text-white" : "border border-input text-muted-foreground"}`}
              style={activo ? { background: NAVY } : undefined}>
              {f.t}{n > 0 ? ` ${n}` : ""}
            </button>
          );
        })}
      </div>

      {cargando ? (
        <p className="p-4 text-center text-xs text-muted-foreground">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="m-3 rounded-md bg-muted/40 p-3 text-center text-xs text-muted-foreground">
          {docs.length === 0 ? 'Aún no hay documentos ni movimientos. Toca "Agregar" para subir un archivo o registrar una actuación, evidencia o tarea.' : "Nada en este filtro."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Detalle</th>
                <th className="px-3 py-2 text-left font-medium">Quién</th>
                <th className="px-2 py-2 text-center font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((d) => {
                const td = tipoDe(d.tipo);
                const Icono = td.icon;
                return (
                  <tr key={d.id} className="hover:bg-muted/20">
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{fmt(d.fecha_mov || d.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: td.bg, color: td.fg }}>
                        <Icono className="h-3 w-3" /> {td.t}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {d.link && iconoArchivo(d.mime, d.nombre)}
                        <span className="max-w-[260px] truncate" title={detalleDe(d)}>{detalleDe(d)}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{d.subido_por || "—"}</td>
                    <td className="px-2 py-2.5 text-center">
                      <MenuFila doc={d} onVer={() => setVer(d)} onEditar={() => setEditar(d)} onPapelera={() => papelera(d)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {agregar && (
        <AgregarMovimientoModal area={area} caso={caso}
          onClose={() => setAgregar(false)}
          onCreado={(doc) => { setDocs((p) => [doc, ...p]); setAgregar(false); }} />
      )}

      {editar && (
        <EditarModal doc={editar}
          onClose={() => setEditar(null)}
          onGuardado={async (cambios) => {
            const ok = await editarMovimiento(editar.id, cambios);
            if (ok) setDocs((p) => p.map((x) => x.id === editar.id ? { ...x, ...cambios } as DocumentoGarantia : x));
            setEditar(null);
          }} />
      )}

      {ver && ver.link && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setVer(null)}>
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 p-3 text-white" style={{ background: NAVY }}>
              <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">{iconoArchivo(ver.mime, ver.nombre)} <span className="truncate">{ver.nombre || "Documento"}</span></p>
              <div className="flex shrink-0 items-center gap-3">
                <button onClick={() => setVer(null)} title="Cerrar" className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/10"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <iframe src={urlPreview(ver.link, ver.drive_id)} title={ver.nombre || "Documento"} className="h-[82vh] w-full border-0 bg-muted" allow="autoplay" />
          </div>
        </div>
      )}
    </div>
  );
}

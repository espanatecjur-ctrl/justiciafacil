import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Upload, FileText, Trash2, Loader2, X, ExternalLink } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export const TIPOS_DOC = ["Promoción", "Apelación", "Amparo", "Escritura", "Acuerdo", "Actuación", "Otro"];

export interface DocPre {
  id: string; predictamen_id: string; tipo: string | null; nombre: string | null;
  fecha: string | null; archivo_url: string | null; archivo_nombre: string | null; datos: any; created_at: string;
}

async function subirArchivo(file: File): Promise<{ url: string; nombre: string }> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/predictamen-docs/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("No se pudo subir el archivo (" + res.status + "). ¿Creaste el almacén 'predictamen-docs'?");
  return { url: `${SUPABASE_URL}/storage/v1/object/public/predictamen-docs/${path}`, nombre: file.name };
}

// ---- Lista de documentos de un pre-dictamen (para la ficha) ----
export function ListaDocs({ predictamenId, refresco }: { predictamenId: string; refresco?: number }) {
  const [docs, setDocs] = useState<DocPre[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    fetch(`${SUPABASE_URL}/rest/v1/predictamen_doc?select=*&predictamen_id=eq.${predictamenId}&order=created_at.desc`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setDocs).catch(() => {}).finally(() => setCargando(false));
  };
  useEffect(cargar, [predictamenId, refresco]);

  const borrar = async (d: DocPre) => {
    if (!confirm(`¿Quitar "${d.nombre || d.archivo_nombre}"?`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/predictamen_doc?id=eq.${d.id}`, { method: "DELETE", headers });
    cargar();
  };

  if (cargando) return <p className="text-sm text-muted-foreground">Cargando documentos…</p>;
  if (docs.length === 0) return <p className="text-sm text-muted-foreground">Sin documentos aún.</p>;

  return (
    <div className="space-y-2">
      {docs.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{d.nombre || d.archivo_nombre}</p>
              <p className="text-xs text-muted-foreground">{d.tipo}{d.fecha ? ` · ${new Date(d.fecha).toLocaleDateString("es-MX")}` : ""}</p>
              {d.tipo === "Amparo" && d.datos && (d.datos.numeroAmparo || d.datos.tribunal) && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {d.datos.numeroAmparo ? `Amparo ${d.datos.numeroAmparo}` : ""}{d.datos.tipoAmparo ? ` (${d.datos.tipoAmparo})` : ""}{d.datos.tribunal ? ` · ${d.datos.tribunal}` : ""}{d.datos.estadoAmparo ? ` · ${d.datos.estadoAmparo}` : ""}
                  {d.datos.actoReclamado ? <span className="block">Acto reclamado: {d.datos.actoReclamado}</span> : null}
                </p>
              )}
              {d.tipo === "Apelación" && d.datos && (d.datos.apelante || d.datos.resolucionApelada) && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {d.datos.apelante ? `Apela: ${d.datos.apelante}` : ""}{d.datos.efecto ? ` · efecto ${d.datos.efecto}` : ""}{d.datos.sala ? ` · ${d.datos.sala}` : ""}{d.datos.estadoApelacion ? ` · ${d.datos.estadoApelacion}` : ""}
                  {d.datos.resolucionApelada ? <span className="block">Se apela: {d.datos.resolucionApelada}</span> : null}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            {d.archivo_url && <a href={d.archivo_url} target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><ExternalLink className="h-4 w-4" /></a>}
            <button onClick={() => borrar(d)} className="rounded-md p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Modal para subir un documento ----
export function SubirDocModal({ predictamenId, folio, onClose, onSubido }: { predictamenId: string; folio?: string | null; onClose: () => void; onSubido?: () => void }) {
  const [tipo, setTipo] = useState("Promoción");
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const setE = (k: string, v: string) => setExtra((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!nombre.trim()) { setError("Ponle un nombre al documento."); return; }
    setSubiendo(true); setError(null);
    try {
      let archivo_url: string | null = null, archivo_nombre: string | null = null;
      if (file) { const r = await subirArchivo(file); archivo_url = r.url; archivo_nombre = r.nombre; }
      const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen_doc`, {
        method: "POST", headers, body: JSON.stringify({ predictamen_id: predictamenId, tipo, nombre: nombre.trim(), fecha: fecha || null, archivo_url, archivo_nombre, datos: extra }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onSubido?.(); onClose();
    } catch (e: any) { setError(e.message); } finally { setSubiendo(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="font-semibold">Subir documento / actuación{folio ? ` · ${folio}` : ""}</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          {error && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de documento</label>
            <select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nombre del documento</label>
            <input className={inp} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Promoción impulsora 12-jun" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Fecha del documento (opcional)</label>
            <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          {tipo === "Amparo" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Datos del amparo</p>
              <input className={inp} placeholder="Número de amparo (ej. 123/2026)" value={extra.numeroAmparo || ""} onChange={(e) => setE("numeroAmparo", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className={inp} placeholder="Tribunal / Juzgado de Distrito" value={extra.tribunal || ""} onChange={(e) => setE("tribunal", e.target.value)} />
                <select className={inp} value={extra.tipoAmparo || ""} onChange={(e) => setE("tipoAmparo", e.target.value)}>
                  <option value="">Tipo de amparo</option><option>Indirecto</option><option>Directo</option>
                </select>
              </div>
              <input className={inp} placeholder="Autoridad responsable" value={extra.autoridad || ""} onChange={(e) => setE("autoridad", e.target.value)} />
              <input className={inp} placeholder="Acto reclamado" value={extra.actoReclamado || ""} onChange={(e) => setE("actoReclamado", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className={inp} value={extra.fechaPresentacion || ""} onChange={(e) => setE("fechaPresentacion", e.target.value)} />
                <select className={inp} value={extra.estadoAmparo || ""} onChange={(e) => setE("estadoAmparo", e.target.value)}>
                  <option value="">Estado del amparo</option><option>Admitido</option><option>Suspensión concedida</option><option>Suspensión negada</option><option>Sentencia</option><option>En revisión</option>
                </select>
              </div>
            </div>
          )}

          {tipo === "Apelación" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Datos de la apelación</p>
              <div className="grid grid-cols-2 gap-2">
                <select className={inp} value={extra.apelante || ""} onChange={(e) => setE("apelante", e.target.value)}>
                  <option value="">Apelante</option><option>Actor</option><option>Demandado</option><option>Tercero</option>
                </select>
                <select className={inp} value={extra.efecto || ""} onChange={(e) => setE("efecto", e.target.value)}>
                  <option value="">Efecto</option><option>Devolutivo</option><option>Suspensivo</option>
                </select>
              </div>
              <input className={inp} placeholder="Resolución apelada (qué se apela)" value={extra.resolucionApelada || ""} onChange={(e) => setE("resolucionApelada", e.target.value)} />
              <input className={inp} placeholder="Sala / Tribunal" value={extra.sala || ""} onChange={(e) => setE("sala", e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className={inp} value={extra.fechaInterposicion || ""} onChange={(e) => setE("fechaInterposicion", e.target.value)} />
                <select className={inp} value={extra.estadoApelacion || ""} onChange={(e) => setE("estadoApelacion", e.target.value)}>
                  <option value="">Estado</option><option>Admitida</option><option>En alegatos</option><option>Resuelta</option>
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Archivo</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" /> {file ? file.name : "Elegir archivo (PDF, imagen, Word…)"}
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={subiendo} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
              {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {subiendo ? "Subiendo…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

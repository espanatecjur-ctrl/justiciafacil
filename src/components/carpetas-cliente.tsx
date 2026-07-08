import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { listarTodo, listarCopias, firmarCopias, sincronizarCarpeta, resolverEntrada, type ItemDrive, type Copia } from "@/lib/drive-explorar";
import { FolderOpen, Loader2, X, Plus, CloudUpload, ExternalLink, FileText, Pin, Trash2, RefreshCw } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface Carpeta { id: string; drive_carpeta_id: string; drive_carpeta_nombre: string | null; }

// Carpetas de Drive del cliente (una o varias) con copia fija y vista previa.
export function CarpetasCliente({ casoId, clienteNombre }: { casoId: string; clienteNombre: string }) {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [link, setLink] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = () => fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta?select=id,drive_carpeta_id,drive_carpeta_nombre&caso_id=eq.${casoId}&cliente_nombre=eq.${encodeURIComponent(clienteNombre)}&order=created_at.asc`, { headers })
    .then((r) => (r.ok ? r.json() : [])).then(setCarpetas).catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { setCargando(true); cargar(); }, [casoId, clienteNombre]);

  const agregar = async () => {
    if (!link.trim()) return;
    setAgregando(true); setErr(null);
    const r = await resolverEntrada(link.trim());
    if (!r.ok || !r.item?.id) { setErr(r.error || "No se pudo leer ese enlace de Drive."); setAgregando(false); return; }
    await fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta`, { method: "POST", headers, body: JSON.stringify({ caso_id: casoId, cliente_nombre: clienteNombre, drive_carpeta_id: r.item.id, drive_carpeta_nombre: r.item.name }) });
    setLink(""); setAgregando(false); cargar();
  };
  const quitar = async (id: string) => { await fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta?id=eq.${id}`, { method: "DELETE", headers }); cargar(); };

  return (
    <div className="space-y-3 p-3">
      {cargando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando carpetas…</div>
      ) : (
        <>
          {carpetas.map((c) => <CarpetaViewer key={c.id} casoId={casoId} carpeta={c} onQuitar={() => quitar(c.id)} />)}
          {carpetas.length === 0 && <p className="text-xs text-muted-foreground">Este cliente aún no tiene carpetas de Drive vinculadas. Agrega una abajo.</p>}
        </>
      )}
      <div className="rounded-lg border border-dashed border-border p-2.5">
        <p className="mb-1.5 text-[11px] font-medium">Vincular otra carpeta del cliente</p>
        <div className="flex flex-wrap gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className="min-w-0 flex-1 rounded-md border border-input px-2 py-1.5 text-sm" />
          <button onClick={agregar} disabled={agregando || !link.trim()} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--teal)" }}>{agregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Vincular</button>
        </div>
        {err && <p className="mt-1 text-xs text-amber-700">{err}</p>}
      </div>
    </div>
  );
}

function CarpetaViewer({ casoId, carpeta, onQuitar }: { casoId: string; carpeta: Carpeta; onQuitar: () => void }) {
  const [items, setItems] = useState<ItemDrive[]>([]);
  const [copias, setCopias] = useState<Record<string, Copia>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [sincro, setSincro] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const [it, cp] = await Promise.all([listarTodo(carpeta.drive_carpeta_id), listarCopias(casoId)]);
    setItems(it.ok ? it.items || [] : []);
    setCopias(cp || {});
    const paths = Object.values(cp || {}).map((c) => c.storage_path).filter(Boolean);
    if (paths.length) { try { setUrls(await firmarCopias(paths)); } catch { /* ignore */ } }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, [carpeta.drive_carpeta_id, casoId]);

  const sincronizar = async () => {
    setSincro(true); setMsg(null);
    const r = await sincronizarCarpeta(casoId, carpeta.drive_carpeta_id);
    setSincro(false);
    if (!r.ok) { setMsg("⚠️ " + (r.error || "No se pudo sincronizar.")); return; }
    setMsg(`Copiados: ${r.copiados ?? 0}${(r.restantes ?? 0) > 0 ? ` · faltan ${r.restantes} (dale de nuevo)` : " · todo al día ✓"}`);
    cargar();
  };

  const docs = items.filter((i) => !(i.mimeType || "").includes("folder"));
  const copiados = docs.filter((d) => copias[d.id]).length;
  const urlDe = (id: string) => { const c = copias[id]; return c ? urls[c.storage_path] : undefined; };
  const previsualizable = (id: string) => { const m = (copias[id]?.mime || items.find((x) => x.id === id)?.mimeType || ""); return m.includes("pdf") || m.startsWith("image/"); };

  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <FolderOpen className="h-4 w-4 text-[color:var(--teal)]" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={carpeta.drive_carpeta_nombre || ""}>{carpeta.drive_carpeta_nombre || "Carpeta"}</span>
        {docs.length > 0 && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${copiados >= docs.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}><Pin className="mr-0.5 inline h-3 w-3" />Copia fija {copiados}/{docs.length}</span>}
        <button onClick={cargar} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /></button>
        <button onClick={sincronizar} disabled={sincro} className="inline-flex items-center gap-1 rounded-md border border-[color:var(--teal)]/40 px-2 py-1 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10 disabled:opacity-60">{sincro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />} Sincronizar</button>
        <button onClick={onQuitar} title="Quitar carpeta" className="rounded-md p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {msg && <p className="px-3 pt-2 text-[11px] text-muted-foreground">{msg}</p>}
      {cargando ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando documentos…</div>
      ) : docs.length === 0 ? (
        <p className="p-4 text-center text-xs text-muted-foreground">Esta carpeta no tiene documentos.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-white">
              <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[color:var(--teal)]" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium" title={a.name}>{a.name}</span>
                {copias[a.id] && <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">del sistema</span>}
              </div>
              <div className="h-28 w-full bg-muted">
                {urlDe(a.id) && previsualizable(a.id) ? (
                  <iframe src={urlDe(a.id)} title={a.name} loading="lazy" className="pointer-events-none h-full w-full border-0" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
                    <FileText className="h-6 w-6 text-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground">{urlDe(a.id) ? "No se previsualiza este tipo" : "Aún no copiado — dale Sincronizar"}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5">
                {urlDe(a.id) ? (
                  <a href={`${urlDe(a.id)}&download=${encodeURIComponent(copias[a.id]?.nombre || a.name)}`} className="inline-flex items-center gap-1 text-[11px] text-[color:var(--teal)] hover:underline"><ExternalLink className="h-3 w-3" /> Abrir</a>
                ) : <span className="text-[10px] text-muted-foreground">Sincroniza para verlo</span>}
                {a.webViewLink && <a href={a.webViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">Drive</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

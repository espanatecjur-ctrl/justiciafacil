import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { DocumentosFijos } from "@/components/documentos-fijos";
import { BotonVerDoc } from "@/components/visor-documento";
import { resolverEntrada } from "@/lib/drive-explorar";
import { Loader2, Plus, FileText, Trash2, ExternalLink, FolderOpen } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface Item { id: string; tipo: string; drive_carpeta_id: string; drive_carpeta_nombre: string | null; mime: string | null; }

// Documentos del cliente: las CARPETAS y ARCHIVOS de Drive que quiera (más de uno).
// Carpetas -> módulo completo (CarpetaDriveVinculada: sincronizar, copia fija, vista previa).
// Archivos -> tarjeta con vista previa. Las copias fijas quedan bajo el juicio (visibles al equipo).
export function CarpetasCliente({ casoId, clienteNombre, expediente }: { casoId: string; clienteNombre: string; expediente?: string | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [link, setLink] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = () => fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta?select=id,tipo,drive_carpeta_id,drive_carpeta_nombre,mime&caso_id=eq.${casoId}&cliente_nombre=eq.${encodeURIComponent(clienteNombre)}&order=created_at.asc`, { headers })
    .then((r) => (r.ok ? r.json() : [])).then(setItems).catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { setCargando(true); cargar(); }, [casoId, clienteNombre]);

  const agregar = async () => {
    if (!link.trim()) return;
    setAgregando(true); setErr(null);
    const r = await resolverEntrada(link.trim());
    if (!r.ok || !r.item?.id) { setErr(r.error || "No se pudo leer ese enlace de Drive."); setAgregando(false); return; }
    const esCarpeta = (r.item.mimeType || "").includes("folder");
    await fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta`, { method: "POST", headers, body: JSON.stringify({ caso_id: casoId, cliente_nombre: clienteNombre, tipo: esCarpeta ? "carpeta" : "archivo", drive_carpeta_id: r.item.id, drive_carpeta_nombre: r.item.name, mime: r.item.mimeType }) });
    setLink(""); setAgregando(false); cargar();
  };
  const quitar = async (id: string) => { await fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta?id=eq.${id}`, { method: "DELETE", headers }); cargar(); };

  if (cargando) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;

  return (
    <div className="space-y-3 p-3">
      {items.map((it) => it.tipo === "carpeta"
        ? <CarpetaItem key={it.id} casoId={casoId} expediente={expediente} fila={it} onQuitar={() => quitar(it.id)} />
        : <ArchivoItem key={it.id} fila={it} onQuitar={() => quitar(it.id)} />)}
      {items.length === 0 && <p className="text-xs text-muted-foreground">Este cliente aún no tiene carpetas ni archivos vinculados. Agrega los que quieras abajo.</p>}

      <div className="rounded-lg border border-dashed border-border p-2.5">
        <p className="mb-1.5 text-[11px] font-medium">Vincular carpeta o archivo del cliente</p>
        <div className="flex flex-wrap gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Pega el enlace de una carpeta o un archivo de Drive…" className="min-w-0 flex-1 rounded-md border border-input px-2 py-1.5 text-sm" />
          <button onClick={agregar} disabled={agregando || !link.trim()} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--teal)" }}>{agregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Vincular</button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Detecta solo si es carpeta o archivo. Puedes agregar los que quieras (varias carpetas y varios archivos).</p>
        {err && <p className="mt-1 text-xs text-amber-700">{err}</p>}
      </div>
    </div>
  );
}

// Carpeta -> módulo completo de Drive (reutiliza CarpetaDriveVinculada)
function CarpetaItem({ casoId, expediente, fila, onQuitar }: { casoId: string; expediente?: string | null; fila: Item; onQuitar: () => void }) {
  const casoVirtual = { id: casoId, expediente: expediente ?? null, drive_carpeta_id: fila.drive_carpeta_id, drive_carpeta_nombre: fila.drive_carpeta_nombre } as unknown as CasoJuridico;
  const guardar = async (campos: Record<string, string>) => {
    await fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta?id=eq.${fila.id}`, { method: "PATCH", headers, body: JSON.stringify({ drive_carpeta_id: campos.drive_carpeta_id, drive_carpeta_nombre: campos.drive_carpeta_nombre }) });
  };
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><FolderOpen className="h-3.5 w-3.5 text-[color:var(--teal)]" /> Carpeta del cliente</span>
        <button onClick={onQuitar} title="Quitar carpeta" className="rounded-md p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="p-2 space-y-2">
        <CarpetaDriveVinculada key={fila.drive_carpeta_id} caso={casoVirtual} area="UCM" onGuardar={guardar} />
        <DocumentosFijos caso={casoVirtual} area="UCM" />
      </div>
    </div>
  );
}

// Archivo suelto -> tarjeta con vista previa
function ArchivoItem({ fila, onQuitar }: { fila: Item; onQuitar: () => void }) {
  const drive = `https://drive.google.com/file/d/${fila.drive_carpeta_id}/view`;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-2.5">
      <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
      <span className="min-w-0 flex-1 truncate text-sm" title={fila.drive_carpeta_nombre || ""}>{fila.drive_carpeta_nombre || "Archivo"}</span>
      <BotonVerDoc driveId={fila.drive_carpeta_id} nombre={fila.drive_carpeta_nombre} label="Ver" className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline" />
      <a href={drive} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Drive</a>
      <button onClick={onQuitar} title="Quitar archivo" className="rounded-md p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

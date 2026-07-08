import { useEffect, useState } from "react";
import { listarTodo, type ItemDrive } from "@/lib/drive-explorar";
import { Loader2, ExternalLink, FileText } from "lucide-react";

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Muestra los documentos de la carpeta Drive «CLIENTES» que COINCIDEN con el nombre del cliente.
export function ClienteGeneralesDrive({ clienteNombre, clientesFolderId }: { clienteNombre: string; clientesFolderId: string }) {
  const [items, setItems] = useState<ItemDrive[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCargando(true); setError(null);
    listarTodo(clientesFolderId)
      .then((r) => { if (r.ok) setItems(r.items || []); else setError(r.error || "No se pudo leer la carpeta CLIENTES."); })
      .catch(() => setError("No se pudo leer la carpeta CLIENTES.")).finally(() => setCargando(false));
  }, [clientesFolderId]);

  // coincidencia: al menos 2 tokens del nombre del cliente aparecen en el nombre/ruta del archivo
  const toks = norm(clienteNombre).split(" ").filter((t) => t.length > 2);
  const matches = items.filter((it) => {
    if ((it.mimeType || "").includes("folder")) return false;
    const n = norm(it.name) + " " + norm(it.ruta || "");
    const shared = toks.filter((t) => n.includes(t)).length;
    return toks.length >= 2 ? shared >= 2 : shared >= 1;
  });

  if (cargando) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando generales en Drive…</div>;
  if (error) return <p className="p-4 text-center text-xs text-amber-700">{error}</p>;
  if (matches.length === 0) return <p className="p-4 text-center text-xs text-muted-foreground">No se encontraron documentos que coincidan con este cliente en la carpeta CLIENTES.</p>;

  return (
    <div>
      <p className="px-3 pt-2 text-[11px] text-muted-foreground">{matches.length} documento(s) coinciden por nombre:</p>
      <div className="grid gap-2 p-3 sm:grid-cols-2">
        {matches.map((it) => (
          <a key={it.id} href={it.webViewLink || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-border p-2 hover:bg-muted/40">
            <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium" title={it.name}>{it.name}</span>
              {it.ruta && <span className="block truncate text-[10px] text-muted-foreground" title={it.ruta}>📁 {it.ruta}</span>}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { FolderPlus, Loader2, ExternalLink } from "lucide-react";
import { crearCarpetaDrive } from "@/lib/drive";
import { type CasoJuridico } from "@/lib/supabase";

export function BotonCarpetaDrive({ area, caso, variante = "boton" }: { area: string; caso: CasoJuridico; variante?: "boton" | "menu" }) {
  const [cargando, setCargando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const crear = async () => {
    setCargando(true); setErr(null);
    const r = await crearCarpetaDrive(area, caso);
    setCargando(false);
    if (r.ok && r.link) { setLink(r.link); window.open(r.link, "_blank", "noopener"); }
    else setErr(r.error || "No se pudo crear la carpeta.");
  };

  if (variante === "menu") {
    return (
      <>
        <button onClick={(e) => { e.stopPropagation(); crear(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Carpeta en Drive
        </button>
        {link && <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-[color:var(--teal)] hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /> Abrir carpeta</a>}
        {err && <p className="px-3 py-1.5 text-xs text-red-600">{err}</p>}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={crear} disabled={cargando} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm disabled:opacity-60">
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Carpeta en Drive
      </button>
      {link && <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-[color:var(--teal)] underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

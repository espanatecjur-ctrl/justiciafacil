import { useState } from "react";
import { FolderPlus, Loader2 } from "lucide-react";
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
    if (r.ok && r.link) { setLink(r.link); }
    else setErr(r.error || "No se pudo crear la carpeta.");
  };

  if (variante === "menu") {
    return (
      <>
        <button onClick={(e) => { e.stopPropagation(); crear(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Preparar carpeta de documentos
        </button>
        {link && <span className="px-3 py-1 text-xs text-emerald-700">Lista ✓ (los documentos se ven en el sistema)</span>}
        {err && <p className="px-3 py-1.5 text-xs text-red-600">{err}</p>}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={crear} disabled={cargando} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm disabled:opacity-60">
        {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Preparar carpeta de documentos
      </button>
      {link && <span className="text-xs text-emerald-700">Lista ✓ (se ven en el sistema)</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { FolderPlus, FolderCheck, Loader2 } from "lucide-react";
import { crearCarpetaDrive, verificarCarpeta } from "@/lib/drive";
import { type CasoJuridico } from "@/lib/supabase";

// Botón de expediente/carpeta de la ficha.
//  · Si la carpeta NO existe → "Abrir expediente" (la crea en el área de la ficha).
//  · Si YA existe → "Expediente guardado · abrir carpeta" (link directo).
// Todos los documentos de la ficha se guardan en la carpeta de su área (ej. URRJ).
export function BotonCarpetaDrive({ area, caso, variante = "boton" }: { area: string; caso: CasoJuridico; variante?: "boton" | "menu" }) {
  const [cargando, setCargando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Al abrir la ficha, revisamos si el expediente ya tiene carpeta (sin crearla).
  useEffect(() => {
    let vivo = true;
    verificarCarpeta(area, caso)
      .then((r) => { if (vivo && r.existe && r.link) setLink(r.link); })
      .catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, caso?.id, caso?.expediente]);

  const abrir = async () => {
    setCargando(true); setErr(null);
    const r = await crearCarpetaDrive(area, caso);
    setCargando(false);
    if (r.ok && r.link) setLink(r.link);
    else setErr(r.error || "No se pudo abrir el expediente.");
  };

  if (variante === "menu") {
    return (
      <>
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-emerald-800 hover:bg-muted">
            <FolderCheck className="h-4 w-4" /> Expediente guardado · abrir carpeta
          </a>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); abrir(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Abrir expediente
          </button>
        )}
        {err && <p className="px-3 py-1.5 text-xs text-red-600">{err}</p>}
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" title={`Los documentos de esta ficha se guardan en su carpeta ${area}.`} className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
          <FolderCheck className="h-4 w-4" /> Expediente guardado · abrir carpeta
        </a>
      ) : (
        <button onClick={abrir} disabled={cargando} title={`Crea la carpeta del expediente. Los documentos irán a su carpeta ${area}.`} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm disabled:opacity-60">
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Abrir expediente
        </button>
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

import { useRef, useState } from "react";
import { MoreVertical, ClipboardPlus, Archive, Trash2, Pencil } from "lucide-react";
import { BotonCarpetaDrive } from "@/components/boton-carpeta-drive";
import { type CasoJuridico } from "@/lib/supabase";

export function FilaAcciones({ archivado, onEditar, onEvidencia, onArchivar, onBorrar, area, caso }: {
  archivado: boolean;
  onEditar?: () => void;
  onEvidencia: () => void;
  onArchivar: () => void;
  onBorrar: () => void;
  area?: string;
  caso?: CasoJuridico;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const abrir = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const ancho = 224; // w-56
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8)) });
  };
  const cerrar = () => setPos(null);

  return (
    <>
      <button ref={btnRef} onClick={abrir} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted" title="Acciones">
        <MoreVertical className="h-4 w-4" />
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); cerrar(); }} />
          <div className="fixed z-50 w-56 overflow-hidden rounded-lg border border-border bg-card shadow-xl" style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
            {onEditar && (
              <button onClick={() => { cerrar(); onEditar(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
                <Pencil className="h-4 w-4 text-[color:var(--teal)]" /> Editar / validar
              </button>
            )}
            {area && caso && <BotonCarpetaDrive area={area} caso={caso} variante="menu" />}
            <button onClick={() => { cerrar(); onEvidencia(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
              <ClipboardPlus className="h-4 w-4 text-[color:var(--teal)]" /> Agregar evidencia
            </button>
            <button onClick={() => { cerrar(); onArchivar(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
              <Archive className="h-4 w-4" /> {archivado ? "Desarchivar" : "Archivar"}
            </button>
            <div className="border-t border-border" />
            <button onClick={() => { cerrar(); onBorrar(); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ============================================================
// ValidarJuzgado · indicador + botón para casar el juzgado de un
// expediente con el catálogo del boletín (tabla boletin_juzgado).
// ------------------------------------------------------------
// "Validado" = el expediente ya tiene cve_distrito + cve_juzgado
// (casado con el catálogo) → el robot SÍ lo puede buscar en el boletín.
// Si solo hay texto libre en `juzgado`, está SIN VALIDAR.
// Al hacer clic abre el ConfigBoletinModal que ya tienes (buscar y
// escoger el correcto) y al guardar avisa para refrescar la lista.
// ============================================================
import { useState } from "react";
import { ConfigBoletinModal } from "@/components/config-boletin";
import { type CasoJuridico } from "@/lib/supabase";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export type EstadoJuzgado = "validado" | "sin_validar" | "sin_juzgado";

export function estadoJuzgado(c: CasoJuridico): EstadoJuzgado {
  if (c.cve_juzgado && c.cve_distrito) return "validado";
  if (c.juzgado || c.nombre_juzgado) return "sin_validar"; // hay texto, pero no casado con el catálogo
  return "sin_juzgado";
}

const MAPA: Record<EstadoJuzgado, { txt: string; corto: string; cls: string; Icon: typeof CheckCircle2 }> = {
  validado:    { txt: "Juzgado validado", corto: "Validado ✓", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200", Icon: CheckCircle2 },
  sin_validar: { txt: "Validar juzgado",  corto: "Validar",    cls: "bg-amber-100 text-amber-800 hover:bg-amber-200",     Icon: AlertTriangle },
  sin_juzgado: { txt: "Sin juzgado",      corto: "Sin juzgado", cls: "bg-red-100 text-red-700 hover:bg-red-200",          Icon: AlertTriangle },
};

export function ValidarJuzgado({ caso, onActualizado, compacto }: { caso: CasoJuridico; onActualizado?: () => void; compacto?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const est = estadoJuzgado(caso);
  const { txt, corto, cls, Icon } = MAPA[est];

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setAbierto(true); }}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${cls}`}
        title={est === "validado" ? `${caso.nombre_juzgado || "Validado"} — clic para revisar o cambiar` : "Buscar y escoger el juzgado del catálogo del boletín"}
      >
        <Icon className="h-3 w-3 shrink-0" /> {compacto ? corto : txt}
      </button>
      {abierto && (
        <ConfigBoletinModal
          caso={caso}
          onClose={() => setAbierto(false)}
          onGuardado={() => { setAbierto(false); onActualizado?.(); }}
        />
      )}
    </>
  );
}

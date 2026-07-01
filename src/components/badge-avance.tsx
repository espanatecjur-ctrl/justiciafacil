import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { diasSinAvance, enAlerta, DIAS_ALERTA } from "@/lib/alerta-avance";

// Badge que muestra los "días sin avance" de un caso.
// Rojo/naranja si lleva 15+ días sin nada; verde si está al día.
export function BadgeAvance({ caso, compacto }: { caso: CasoJuridico; compacto?: boolean }) {
  const [dias, setDias] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    diasSinAvance(caso).then((r) => setDias(r.dias)).finally(() => setCargando(false));
  }, [caso.id]);

  if (cargando) return null;

  const alerta = enAlerta(dias);

  if (!alerta) {
    if (compacto) return null; // en listas, si está al día no estorbamos
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--teal)]/10 px-2 py-0.5 text-[10px] font-medium text-[color:var(--teal)]">
        <CheckCircle2 className="h-3 w-3" /> Al día
      </span>
    );
  }

  const texto = dias === null ? "Sin avances aún" : `${dias} días sin avance`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${dias !== null && dias >= DIAS_ALERTA * 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`} title={`No se registra ningún avance (actuación, documento o marca) desde hace ${dias ?? "—"} días`}>
      <AlertTriangle className="h-3 w-3" /> {texto}
    </span>
  );
}

// ============================================================
// ValidarExpediente · indicador + botón para confirmar que el
// número de expediente de un juicio ya fue revisado y es correcto.
// ------------------------------------------------------------
// "Validado" = una persona ya confirmó el expediente (campo
//   expediente_validado = true en la base). Queda en verde.
// "Sin validar" = hay número de expediente cargado, pero nadie
//   lo ha confirmado todavía (ámbar). Un clic lo valida.
// "Sin expediente" = el registro no tiene expediente (rojo).
// El estado se guarda en la base (PATCH), así que se refleja al
// recargar y en cualquier pantalla que lo lea.
// ============================================================
import { useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export type EstadoExpediente = "validado" | "sin_validar" | "sin_expediente";

export function estadoExpediente(c: CasoJuridico): EstadoExpediente {
  if (!c.expediente || !c.expediente.trim()) return "sin_expediente";
  return c.expediente_validado ? "validado" : "sin_validar";
}

const MAPA: Record<EstadoExpediente, { txt: string; corto: string; cls: string; Icon: typeof CheckCircle2 }> = {
  validado:       { txt: "Expediente validado", corto: "Validado ✓",   cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200", Icon: CheckCircle2 },
  sin_validar:    { txt: "Validar expediente",  corto: "Validar",       cls: "bg-amber-100 text-amber-800 hover:bg-amber-200",       Icon: AlertTriangle },
  sin_expediente: { txt: "Sin expediente",      corto: "Sin exp.",      cls: "bg-red-100 text-red-700",                             Icon: AlertTriangle },
};

export function ValidarExpediente({ caso, onActualizado, compacto }: { caso: CasoJuridico; onActualizado?: () => void; compacto?: boolean }) {
  const [guardando, setGuardando] = useState(false);
  const est = estadoExpediente(caso);
  const { txt, corto, cls, Icon } = MAPA[est];

  // Sin expediente no se puede validar: solo se muestra el estado.
  const clickable = est !== "sin_expediente";

  const alternar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clickable || guardando || !caso.id) return;
    const nuevo = est !== "validado"; // valida si está sin validar; permite quitar validación si ya estaba
    if (est === "validado" && !confirm("¿Quitar la validación de este expediente?")) return;
    setGuardando(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${caso.id}`, {
        method: "PATCH",
        headers: wHeaders,
        body: JSON.stringify({ expediente_validado: nuevo }),
      });
      if (!r.ok) throw new Error(String(r.status));
      onActualizado?.();
    } catch (err: any) {
      alert("No se pudo guardar la validación: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <button
      onClick={alternar}
      disabled={!clickable || guardando}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${cls} ${clickable ? "" : "cursor-default"}`}
      title={
        est === "validado"
          ? "Expediente confirmado — clic para quitar la validación"
          : est === "sin_validar"
          ? "Clic para confirmar que el número de expediente es correcto"
          : "Este juicio aún no tiene número de expediente"
      }
    >
      {guardando ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <Icon className="h-3 w-3 shrink-0" />}
      {compacto ? corto : txt}
    </button>
  );
}

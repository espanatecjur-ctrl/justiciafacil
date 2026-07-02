// ============================================================
//  Solicitudes de contrato pendientes — tarjeta para el Inicio
// ------------------------------------------------------------
//  Muestra, como tareas del día en el calendario, las solicitudes
//  que aún no se entregan, con su vencimiento de 24 h hábiles.
//  Las vencidas se marcan en rojo.
// ============================================================
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { ClipboardList, AlertTriangle, ChevronRight } from "lucide-react";
import { listarSolicitudes, type SolicitudContrato } from "@/lib/solicitud-contrato";

const GOLD = "#C2A24C";
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function SolicitudesPendientesHome() {
  const [lista, setLista] = useState<SolicitudContrato[]>([]);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    listarSolicitudes()
      .then((d) => setLista(d.filter((s) => s.estado !== "Entregada")))
      .catch(() => setLista([]))
      .finally(() => setListo(true));
  }, []);

  // No mostramos la tarjeta si no hay pendientes (para no ensuciar el inicio).
  if (!listo || lista.length === 0) return null;

  const ahora = Date.now();

  return (
    <Card className="legal-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded" style={{ background: GOLD }} />
          <h3 className="font-display text-lg font-semibold">Solicitudes de contrato por entregar</h3>
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
          {lista.length} pendientes · 24 h
        </span>
      </div>

      <div className="divide-y divide-border">
        {lista.map((s) => {
          const lim = s.fecha_limite ? new Date(s.fecha_limite) : null;
          const vencida = lim && lim.getTime() < ahora;
          return (
            <Link
              key={s.id}
              to="/contratos"
              className="flex items-center gap-3 py-3 rounded-md px-1 -mx-1 hover:bg-muted/40"
            >
              <div className="w-12 text-center">
                <p className={`font-display text-xl font-bold leading-none ${vencida ? "text-red-600" : ""}`}>
                  {lim ? String(lim.getDate()).padStart(2, "0") : "—"}
                </p>
                <p className="text-[10px] uppercase text-muted-foreground">{lim ? MESES[lim.getMonth()] : ""}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.tipo_documento || "Documento"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.garantia_ref || "—"} · {s.area || "—"}{s.solicitante ? ` · ${s.solicitante}` : ""}
                </p>
              </div>
              {vencida ? (
                <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  <AlertTriangle className="h-3 w-3" /> Vencida
                </span>
              ) : (
                <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                  {lim ? lim.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" /> Ábrelas en Contratos para darles seguimiento.
      </div>
    </Card>
  );
}

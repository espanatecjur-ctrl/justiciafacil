// ============================================================
//  Tabla de Solicitudes de Contrato (tipo Excel) — para Contratos
// ------------------------------------------------------------
//  Muestra lo que las áreas le pidieron a Contratos, con su plazo
//  de 24 h hábiles y seguimiento del estado. Se alimenta de la
//  tabla `solicitud_contrato` de Supabase.
// ============================================================
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, ClipboardList, AlertTriangle } from "lucide-react";
import {
  listarSolicitudes, actualizarEstadoSolicitud, ESTADOS_SOLICITUD,
  type SolicitudContrato,
} from "@/lib/solicitud-contrato";

const tono: Record<string, string> = {
  Pendiente: "bg-amber-100 text-amber-900",
  "En proceso": "bg-sky-100 text-sky-900",
  Entregada: "bg-emerald-100 text-emerald-900",
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SolicitudesContratoTabla() {
  const [lista, setLista] = useState<SolicitudContrato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    listarSolicitudes()
      .then((d) => { setLista(d); setError(null); })
      .catch(() => setError("No se pudieron leer las solicitudes (¿corriste el SQL?)"))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const cambiarEstado = async (id: string, estado: string) => {
    setLista((s) => s.map((x) => (x.id === id ? { ...x, estado } : x))); // optimista
    await actualizarEstadoSolicitud(id, estado);
  };

  const ahora = Date.now();

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-[color:var(--teal)]" />
        <h2 className="font-display text-lg font-bold">Solicitudes de contrato</h2>
        {!cargando && lista.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            {lista.filter((s) => s.estado !== "Entregada").length} pendientes
          </span>
        )}
      </div>

      <Card className="legal-card overflow-hidden">
        {cargando ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : error ? (
          <div className="p-4 text-sm text-red-700">{error}</div>
        ) : lista.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No hay solicitudes por ahora. Las áreas las crean desde su ficha (p. ej. UFC → “Solicitar a Contratos”).</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Garantía</th>
                  <th className="px-4 py-2.5 text-left">Documento</th>
                  <th className="px-4 py-2.5 text-left">Detalle</th>
                  <th className="px-4 py-2.5 text-left">Solicita</th>
                  <th className="px-4 py-2.5 text-left">Área</th>
                  <th className="px-4 py-2.5 text-left">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Límite (24 h)</th>
                  <th className="px-4 py-2.5 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((s) => {
                  const vencida = s.estado !== "Entregada" && s.fecha_limite && new Date(s.fecha_limite).getTime() < ahora;
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{s.garantia_ref || "—"}</td>
                      <td className="px-4 py-3">{s.tipo_documento || "—"}</td>
                      <td className="px-4 py-3 max-w-[240px] text-xs text-muted-foreground">{s.detalle || "—"}</td>
                      <td className="px-4 py-3 text-xs">{s.solicitante || "—"}</td>
                      <td className="px-4 py-3 text-xs">{s.area || "—"}</td>
                      <td className="px-4 py-3 text-xs tabular-nums">{fmt(s.fecha_solicitud)}</td>
                      <td className={`px-4 py-3 text-xs tabular-nums ${vencida ? "font-semibold text-red-700" : ""}`}>
                        {vencida && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                        {fmt(s.fecha_limite)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={s.estado || "Pendiente"}
                          onChange={(e) => s.id && cambiarEstado(s.id, e.target.value)}
                          className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${tono[s.estado || "Pendiente"] || ""}`}
                        >
                          {ESTADOS_SOLICITUD.map((es) => <option key={es} value={es}>{es}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

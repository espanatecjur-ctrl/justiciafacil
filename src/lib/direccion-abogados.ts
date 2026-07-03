import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Loader2, UserCheck } from "lucide-react";
import { listarSolicitudesPredictamen, type SolicitudPredictamen } from "@/lib/solicitud-predictamen";
import {
  listarAbogados, asignarAbogado, avancesPorAbogado,
  AMBAR_DIAS, ROJO_DIAS, type Abogado, type AvanceAbogado,
} from "@/lib/direccion-abogados";

const TONO = {
  verde: { bg: "bg-emerald-100", text: "text-emerald-800", bar: "bg-emerald-500" },
  ambar: { bg: "bg-amber-100", text: "text-amber-800", bar: "bg-amber-500" },
  rojo: { bg: "bg-red-100", text: "text-red-700", bar: "bg-red-500" },
};

function iniciales(n: string) {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "·";
}

export function DireccionAbogados() {
  const [pendientes, setPendientes] = useState<SolicitudPredictamen[]>([]);
  const [abogados, setAbogados] = useState<Abogado[]>([]);
  const [avances, setAvances] = useState<AvanceAbogado[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = () => {
    setCargando(true);
    Promise.all([
      listarSolicitudesPredictamen("pendiente"),
      avancesPorAbogado(),
    ]).then(([p, a]) => { setPendientes(p); setAvances(a); }).finally(() => setCargando(false));
  };
  useEffect(() => { listarAbogados().then(setAbogados); recargar(); }, []);

  const asignar = async (s: SolicitudPredictamen) => {
    const abId = sel[s.id!];
    const ab = abogados.find((a) => a.id === abId);
    if (!ab) return;
    setOcupado(s.id!);
    const ok = await asignarAbogado(s.id!, ab);
    setOcupado(null);
    if (ok) recargar();
  };

  return (
    <div className="space-y-4">
      <Card className="legal-card p-5">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-[color:var(--teal)]" />
          <h3 className="font-display text-base font-semibold">Asignar abogado</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Solicitudes de pre-dictaminación sin abogado.</p>

        {cargando ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : pendientes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No hay solicitudes por asignar.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {pendientes.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold">Exp. {s.expediente || "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.cliente || "Sin cliente"} · {s.documentos?.length || 0} doc(s)</p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={sel[s.id!] || ""} onChange={(e) => setSel((r) => ({ ...r, [s.id!]: e.target.value }))}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">— Abogado —</option>
                    {abogados.map((a) => <option key={a.id} value={a.id}>{a.nombre}{a.rol ? ` · ${a.rol}` : ""}</option>)}
                  </select>
                  <Button size="sm" disabled={ocupado === s.id || !sel[s.id!]} onClick={() => asignar(s)}
                    className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
                    {ocupado === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Asignar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="legal-card p-5">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[color:var(--teal)]" />
          <h3 className="font-display text-base font-semibold">Avances de abogados</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Semáforo por días sin avance (boletín + seguimiento): verde al día · ámbar {AMBAR_DIAS} días · rojo {ROJO_DIAS} días.</p>

        {avances.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aún no hay abogados con expedientes asignados.</p>
        ) : (
          <div className="mt-3 space-y-1">
            {avances.map((a) => {
              const t = TONO[a.semaforo];
              const pct = Math.max(6, Math.min(100, Math.round((a.diasSinAvance / ROJO_DIAS) * 100)));
              return (
                <div key={a.abogado_id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-[#0B1E3A]/10 text-xs font-semibold text-[#0B1E3A]">{iniciales(a.abogado_nombre)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{a.abogado_nombre} · {a.expedientes} expediente{a.expedientes === 1 ? "" : "s"}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${t.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    {a.semaforo !== "verde" && a.expedientePeor && <p className="mt-0.5 text-[11px] text-muted-foreground">Más atorado: exp. {a.expedientePeor}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.bg} ${t.text}`}>
                    {a.semaforo === "verde" ? "Al día" : `${a.diasSinAvance} días sin avance`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

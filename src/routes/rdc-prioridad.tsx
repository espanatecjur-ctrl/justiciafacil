import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Clock } from "lucide-react";
import { listarPrioridadesPendientesJC, resolverPrioridadRdcJF, type SolicitudPrioridadRdc } from "@/lib/rdc-prioridad";
import { getAuth } from "@/lib/auth";

export const Route = createFileRoute("/rdc-prioridad")({
  head: () => ({ meta: [{ title: "Prioridad RDC — JusticiaFácil" }] }),
  component: PrioridadRdcPage,
});

function tiempoDesde(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  return `hace ${dias} días`;
}

function PrioridadRdcPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudPrioridadRdc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [miCorreo, setMiCorreo] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setSolicitudes(await listarPrioridadesPendientesJC());
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    (async () => {
      const auth = await getAuth();
      const { data } = await auth.auth.getSession();
      setMiCorreo(data.session?.user?.email ?? null);
    })();
  }, []);

  async function resolver(id: string, accion: "aprobar" | "rechazar") {
    const aprobadoPor = miCorreo || "GAD (JusticiaFácil)";
    setProcesando(id);
    try {
      const res = await resolverPrioridadRdcJF(id, accion, aprobadoPor);
      if (!res.ok) { alert(res.mensaje || "No se pudo resolver la solicitud."); return; }
      await cargar();
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        eyebrow="JurisConecta · Devolución Compensada"
        title="Prioridad RDC pendiente de validar"
        description="Solicitudes de RAC/SRAC para adelantar a un cliente en la cola de devoluciones. Al aprobar o rechazar, se refleja de inmediato en JurisConecta."
      />

      {cargando ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : solicitudes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No hay solicitudes de prioridad pendientes.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {solicitudes.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-4">
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-medium">{s.clienteNombre}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Solicitada por {s.solicitadoPor} · {tiempoDesde(s.creadoEn)}
                  </p>
                  {s.motivo && <p className="mt-1 text-xs text-muted-foreground">Motivo: {s.motivo}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={procesando === s.id} onClick={() => resolver(s.id, "rechazar")}>
                    <X className="mr-1 h-3.5 w-3.5" /> Rechazar
                  </Button>
                  <Button size="sm" disabled={procesando === s.id} onClick={() => resolver(s.id, "aprobar")}>
                    {procesando === s.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Aprobar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

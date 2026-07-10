import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  clienteJCPorNombre,
  comunicacionesJC,
  tareasJC,
  llamadasJC,
  type ClienteJC,
  type ComunicacionJC,
  type LlamadaJC,
  type TareaJC,
} from "@/lib/juris-clientes";
import { Loader2, Headphones, Mail, MessageCircle, Video, StickyNote, Phone, ListChecks } from "lucide-react";

const ICONO: Record<string, JSX.Element> = {
  correo: <Mail className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
  videollamada: <Video className="h-3.5 w-3.5" />,
  nota: <StickyNote className="h-3.5 w-3.5" />,
};

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export function AtencionClienteJC({ nombreCliente }: { nombreCliente: string }) {
  const [cargando, setCargando] = useState(true);
  const [cliente, setCliente] = useState<ClienteJC | null>(null);
  const [comunicaciones, setComunicaciones] = useState<ComunicacionJC[]>([]);
  const [tareas, setTareas] = useState<TareaJC[]>([]);
  const [llamadas, setLlamadas] = useState<LlamadaJC[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      const c = await clienteJCPorNombre(nombreCliente);
      if (!vivo) return;
      setCliente(c);
      if (c) {
        const [coms, tars, lls] = await Promise.all([
          comunicacionesJC(c.id),
          tareasJC(c.id),
          llamadasJC(c.telefono, c.telefono2),
        ]);
        if (!vivo) return;
        setComunicaciones(coms);
        setTareas(tars);
        setLlamadas(lls);
      }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [nombreCliente]);

  if (cargando) {
    return (
      <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando en JurisConecta…
      </Card>
    );
  }

  if (!cliente) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Este cliente todavía no está registrado en JurisConecta (o el nombre no coincide lo suficiente para encontrarlo).
      </Card>
    );
  }

  // Une comunicaciones + llamadas en una sola línea de tiempo, más nuevo primero.
  type Evento = { fecha: string; icono: JSX.Element; titulo: string; detalle: string | null; autor: string | null };
  const eventos: Evento[] = [
    ...comunicaciones.map((c) => ({
      fecha: c.created_at,
      icono: ICONO[c.tipo] || <StickyNote className="h-3.5 w-3.5" />,
      titulo: c.tipo === "correo" ? "Correo" : c.tipo === "whatsapp" ? "WhatsApp" : c.tipo === "videollamada" ? "Videollamada" : c.tipo === "nota" ? "Nota" : c.tipo,
      detalle: c.detalle,
      autor: c.autor,
    })),
    ...llamadas.map((l) => ({
      fecha: l.fecha,
      icono: <Phone className="h-3.5 w-3.5" />,
      titulo: l.tipo === "saliente" ? "Llamada saliente" : "Llamada entrante",
      detalle: l.resultado,
      autor: null,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <Headphones className="h-4 w-4 text-[color:#2E6DA8]" />
          <h3 className="text-sm font-semibold">Atención al Cliente · JurisConecta</h3>
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">🟢 conectado</span>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 text-xs sm:grid-cols-4">
          <div><span className="text-muted-foreground">Código</span><p className="font-semibold">{cliente.codigo || "—"}</p></div>
          <div><span className="text-muted-foreground">Área</span><p className="font-semibold">{cliente.area || "—"}</p></div>
          <div><span className="text-muted-foreground">Estatus</span><p className="font-semibold capitalize">{cliente.estatus || "—"}</p></div>
          <div><span className="text-muted-foreground">Folio</span><p className="font-semibold">{cliente.folio || "—"}</p></div>
        </div>
      </Card>

      {tareas.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <ListChecks className="h-4 w-4 text-[color:#2E6DA8]" />
            <h3 className="text-sm font-semibold">Tareas pendientes ({tareas.filter((t) => t.estado !== "hecha").length})</h3>
          </div>
          <div className="divide-y divide-border">
            {tareas.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span>{t.titulo || "—"}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{t.asignado_a || ""} {t.fecha_limite ? `· ${fecha(t.fecha_limite)}` : ""}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <StickyNote className="h-4 w-4 text-[color:#2E6DA8]" />
          <h3 className="text-sm font-semibold">Cronología (notas, correos, llamadas, WhatsApp)</h3>
        </div>
        {eventos.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sin contactos registrados todavía en JurisConecta.</p>
        ) : (
          <div className="divide-y divide-border">
            {eventos.map((e, i) => (
              <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 text-sm">
                <span className="mt-0.5 text-[color:#2E6DA8]">{e.icono}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.titulo}{e.autor ? ` · ${e.autor}` : ""}</p>
                  {e.detalle && <p className="text-[13px] text-muted-foreground">{e.detalle}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{fecha(e.fecha)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

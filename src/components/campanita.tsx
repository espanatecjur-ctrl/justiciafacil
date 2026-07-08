// ============================================================
//  Campanita · muestra los avisos del usuario en la barra de arriba
// ============================================================
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { correoActual } from "@/lib/auth";
import { listarMisNotificaciones, marcarLeida, marcarTodasLeidas, type Notificacion } from "@/lib/notificaciones";

function haceCuanto(fecha?: string | null): string {
  if (!fecha) return "";
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function Campanita() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { correoActual().then(setCorreo); }, []);

  const recargar = () => {
    if (!correo) return;
    listarMisNotificaciones(correo).then(setAvisos);
  };
  // Carga al entrar y cada minuto revisa si hay nuevos.
  useEffect(() => {
    if (!correo) return;
    recargar();
    const t = setInterval(recargar, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correo]);

  // Cerrar al hacer clic afuera.
  useEffect(() => {
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const noLeidas = avisos.filter((a) => !a.leida).length;

  const abrirAviso = async (a: Notificacion) => {
    setAbierto(false);
    if (!a.leida) { await marcarLeida(a.id); recargar(); }
    if (a.enlace) navigate({ to: a.enlace }).catch(() => {});
  };

  const todasLeidas = async () => {
    if (!correo) return;
    await marcarTodasLeidas(correo);
    recargar();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        title="Avisos"
      >
        <Bell className="h-4 w-4" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-[color:var(--legal)] px-1 text-[10px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-40 w-80 max-w-[90vw] overflow-hidden rounded-lg border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-[#0B1E3A]">Avisos</p>
            {noLeidas > 0 && (
              <button onClick={todasLeidas} className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline">
                <Check className="h-3.5 w-3.5" /> Marcar todas leídas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {avisos.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tienes avisos.</p>
            ) : (
              avisos.map((a) => (
                <button
                  key={a.id}
                  onClick={() => abrirAviso(a)}
                  className={`flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left hover:bg-muted/50 ${a.leida ? "opacity-70" : ""}`}
                >
                  {!a.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[color:var(--teal)]" />}
                  <span className={`min-w-0 flex-1 ${a.leida ? "pl-4" : ""}`}>
                    <span className="block text-sm text-foreground">{a.texto}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{haceCuanto(a.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

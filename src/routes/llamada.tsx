import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { LlamadaChat } from "@/components/llamada-chat";
import { nombreActual } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/llamada")({
  component: PaginaLlamada,
  validateSearch: (s: Record<string, unknown>) => ({
    sala: String(s.sala || ""),
    audio: s.audio === "1" || s.audio === "true",
  }),
});

function PaginaLlamada() {
  const { sala, audio } = useSearch({ from: "/llamada" });
  const [nombre, setNombre] = useState<string | null>(null);
  useEffect(() => { nombreActual().then((n) => setNombre(n?.nombre || null)); }, []);
  const irInicio = () => { window.location.href = "/"; };

  if (!sala) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 text-center">
        <p className="text-sm text-muted-foreground">Este enlace de llamada no es válido.</p>
        <button onClick={irInicio} className="mt-4 rounded-md bg-[color:var(--teal)] px-4 py-2 text-sm font-semibold text-white">Ir al inicio</button>
      </div>
    );
  }
  if (nombre === null) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!nombre) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 text-center">
        <p className="text-4xl">📞</p>
        <h1 className="mt-2 text-lg font-bold">Te están llamando</h1>
        <p className="mt-2 text-sm text-muted-foreground">Inicia sesión para contestar la llamada.</p>
        <button onClick={irInicio} className="mt-5 rounded-md bg-[color:var(--teal)] px-4 py-2.5 text-sm font-semibold text-white">Entrar</button>
      </div>
    );
  }
  return <LlamadaChat sala={sala} nombre={nombre} soloAudio={audio} onCerrar={irInicio} />;
}

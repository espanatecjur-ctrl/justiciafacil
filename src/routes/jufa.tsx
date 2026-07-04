import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type Precarga } from "@/lib/predictamen-guardar";
import { Bot } from "lucide-react";
import { DictaminadorPosicion, type VistaPosicion } from "@/components/dictaminador-posicion";

export const Route = createFileRoute("/jufa")({
  head: () => ({ meta: [{ title: "JUFA — Simulador de dictamen — JusticiaFácil" }] }),
  component: JUFA,
});

const NAVY = "#0B1E3A";

function JUFA() {
  const [vista, setVista] = useState<VistaPosicion>("elegir");
  const [precargar, setPrecargar] = useState<Precarga | null>(null);
  const volver = () => { setPrecargar(null); setVista("elegir"); };

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, #0C5C46)` }}>
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6" style={{ color: "#C2A24C" }} />
          <div>
            <h1 className="text-xl font-bold">JUFA · Simulador de dictamen</h1>
            <p className="text-sm text-white/70">Practica un dictamen sin garantía vinculada. Es solo para probar: no se vincula a una garantía ni sube a la línea de vida.</p>
          </div>
        </div>
      </div>

      <DictaminadorPosicion
        casos={[]}
        vista={vista}
        onVista={setVista}
        precargar={precargar}
        onVolver={volver}
        puedeElaborar
        puedeFirmarElabora
        puedeValidar
        puedeAdmin
      />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { rolActual } from "@/lib/auth";
import { Briefcase, Upload, Users, BadgeCheck, Wallet, Lock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/direccion")({
  head: () => ({ meta: [{ title: "Dirección — SIGA-DIIPA" }] }),
  component: Direccion,
});

// Solo estos roles entran al módulo de Dirección.
const ROLES_DIRECCION = ["DGE", "Super_Admin"];

type TabKey = "documentos" | "abogados" | "validaciones" | "faseb";

const TABS: { key: TabKey; label: string; icon: typeof Upload }[] = [
  { key: "documentos", label: "Documentos", icon: Upload },
  { key: "abogados", label: "Abogados", icon: Users },
  { key: "validaciones", label: "Validaciones +", icon: BadgeCheck },
  { key: "faseb", label: "Fase B", icon: Wallet },
];

function Direccion() {
  const [rol, setRol] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>("documentos");
  useEffect(() => { rolActual().then((r) => setRol(r || "")); }, []);

  if (rol === undefined) {
    return <div className="grid min-h-[60vh] place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!ROLES_DIRECCION.includes(rol)) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <Card className="legal-card max-w-md p-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700"><Lock className="h-6 w-6" /></div>
          <p className="font-display text-lg font-semibold">Módulo exclusivo de Dirección</p>
          <p className="mt-1 text-sm text-muted-foreground">Esta área es solo para la Dirección General ({ROLES_DIRECCION.join(" / ")}). Tu rol actual ({rol || "sin rol"}) no tiene acceso.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Solo DGE"
        title="Dirección general"
        description="Regularización de abogados: documentos, pre-dictamen, avances, validaciones y pase a Fase B."
      />

      {/* Indicadores que llevan a su pestaña */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador n="—" l="Docs por enviar" onClick={() => setTab("documentos")} activo={tab === "documentos"} tono="text-[#0B1E3A]" />
        <Indicador n="—" l="Abogados sin avance" onClick={() => setTab("abogados")} activo={tab === "abogados"} tono="text-red-600" />
        <Indicador n="—" l="Validaciones +" onClick={() => setTab("validaciones")} activo={tab === "validaciones"} tono="text-emerald-600" />
        <Indicador n="—" l="Fase B pendientes" onClick={() => setTab("faseb")} activo={tab === "faseb"} tono="text-[#8A6E22]" />
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${on ? "border-[color:var(--teal)] font-semibold text-[color:var(--teal)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Contenido de la pestaña (se conecta en las siguientes partes) */}
      {tab === "documentos" && <PanelPlaceholder titulo="Documentos → pre-dictamen" desc="Subir documentos de una garantía y mandarlos a pre-dictaminar." icon={Upload} />}
      {tab === "abogados" && <PanelPlaceholder titulo="Abogados — asignar y avances" desc="Asignar abogados y ver el semáforo de avance (verde · ámbar 7 días · rojo 14 días)." icon={Users} />}
      {tab === "validaciones" && <PanelPlaceholder titulo="Validaciones positivas" desc="Dictámenes positivos de UCP con ficha, resumen y el porqué, listos para compra." icon={BadgeCheck} />}
      {tab === "faseb" && <PanelPlaceholder titulo="Fase B — cuentas y carta" desc="Solicitar por correo, llenar lo recibido y enviar a contabilidad para el pre-cobro." icon={Wallet} />}
    </div>
  );
}

function Indicador({ n, l, onClick, activo, tono }: { n: string; l: string; onClick: () => void; activo: boolean; tono: string }) {
  return (
    <button onClick={onClick} className={`legal-card p-4 text-left transition hover:border-[color:var(--teal)] ${activo ? "border-[color:var(--teal)] ring-1 ring-[color:var(--teal)]/30" : ""}`}>
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className={`mt-1 font-display text-2xl font-bold leading-none ${tono}`}>{n}</p>
    </button>
  );
}

function PanelPlaceholder({ titulo, desc, icon: Icon }: { titulo: string; desc: string; icon: typeof Upload }) {
  return (
    <Card className="legal-card p-6">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-[color:var(--teal)]" />
        <h3 className="font-display text-base font-semibold">{titulo}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        En construcción — lo conectamos con tus datos en la siguiente parte.
      </div>
    </Card>
  );
}

import {
  QrCode, HelpCircle, Check, Clock, Gavel, FileText, ShieldCheck, Landmark,
  Briefcase, Users, AlertTriangle, FileCheck, FileX, Cloud, Plus, Loader2,
} from "lucide-react";
import type { CarpetaConDistintivo } from "@/lib/estante-datos";

const ICONOS: Record<string, any> = {
  qrcode: QrCode, help: HelpCircle, check: Check, "clock-hour-4": Clock,
  gavel: Gavel, "file-text": FileText, "shield-check": ShieldCheck, "building-bank": Landmark,
  briefcase: Briefcase, users: Users, "alert-triangle": AlertTriangle,
  "file-check": FileCheck, "file-x": FileX,
};

const MADERA = "#B8967A";
const MADERA_BASE = "#8A6B3C";

interface PropsLomo {
  item: CarpetaConDistintivo;
  onClick: () => void;
}

function Lomo({ item, onClick }: PropsLomo) {
  const d = item.distintivo;
  const Icono = ICONOS[d.icono] || QrCode;
  const nombreCorto = (item.cliente || "Sin nombre").split(" ").slice(0, 3).join(" ");

  return (
    <button
      onClick={onClick}
      className="group relative flex h-[150px] w-[130px] shrink-0 flex-col overflow-hidden rounded-lg text-left shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md"
      style={{ background: d.colorFondo, opacity: d.soloDigital ? 0.8 : 1, outline: d.soloDigital ? "2px dashed rgba(255,255,255,0.55)" : "none" }}
      title={`${d.etiqueta} · ${item.cliente || "sin cliente"}${d.soloDigital ? " · Solo digital, sin abrir físicamente" : ""}`}
    >
      {/* pestaña de carpeta, arriba a la izquierda */}
      <div className="flex items-center justify-between rounded-t-md px-2.5 py-1.5" style={{ background: "rgba(0,0,0,0.18)" }}>
        <span className="truncate text-[11px] font-semibold" style={{ color: d.colorTexto }}>{d.etiqueta}</span>
        {d.posicion && (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: d.posicion === "actor" ? "#639922" : "#D85A30", color: d.posicion === "actor" ? "#173404" : "#4A1B0C" }}
          >
            {d.posicion === "actor" ? "A" : "D"}
          </span>
        )}
      </div>

      {d.franjaRoja && <div className="absolute left-0 top-0 h-full w-2" style={{ background: "#D85A30" }} />}
      {d.soloDigital && (
        <span className="absolute right-1.5 top-9 rounded-full bg-white/90 p-1">
          <Cloud className="h-3.5 w-3.5 text-slate-500" />
        </span>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 pb-3">
        <Icono className="h-8 w-8 shrink-0" style={{ color: d.colorTexto }} />
        <p className="line-clamp-2 text-center text-[12px] font-medium leading-tight" style={{ color: d.colorTexto }}>
          {nombreCorto}
        </p>
      </div>
    </button>
  );
}

interface Props {
  grupos: Record<string, CarpetaConDistintivo[]>;
  onClickCarpeta: (item: CarpetaConDistintivo) => void;
  cargando?: boolean;
}

export function EstanteCarpetas({ grupos, onClickCarpeta, cargando }: Props) {
  const nombresGrupo = Object.keys(grupos).sort();

  if (cargando) {
    return <p className="flex items-center gap-1.5 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando el estante…</p>;
  }
  if (nombresGrupo.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin carpetas para mostrar aquí todavía.</p>;
  }

  return (
    <div className="space-y-6">
      {nombresGrupo.map((nombre) => (
        <div key={nombre}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{nombre} · {grupos[nombre].length} carpetas</p>
          <div className="rounded-lg pb-1.5 pl-3 pr-3 pt-4" style={{ background: MADERA }}>
            <div className="flex flex-wrap items-end gap-3">
              {grupos[nombre].map((item) => (
                <Lomo key={item.carpeta.id} item={item} onClick={() => onClickCarpeta(item)} />
              ))}
            </div>
          </div>
          <div className="h-2 rounded-b-lg" style={{ background: MADERA_BASE }} />
        </div>
      ))}
    </div>
  );
}

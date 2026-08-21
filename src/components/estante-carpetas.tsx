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
  const nombreCorto = (item.cliente || "Sin nombre").split(" ").slice(0, 2).join(" ");

  return (
    <button
      onClick={onClick}
      className="relative flex h-[110px] w-9 shrink-0 flex-col items-center rounded-t-sm pt-3"
      style={{ background: d.colorFondo, opacity: d.soloDigital ? 0.75 : 1, outline: d.soloDigital ? "1px dashed rgba(255,255,255,0.5)" : "none" }}
      title={`${d.etiqueta} · ${item.cliente || "sin cliente"}${d.soloDigital ? " · Solo digital, sin abrir físicamente" : ""}`}
    >
      {d.franjaRoja && <div className="absolute left-0 top-0 h-full w-1 rounded-tl-sm" style={{ background: "#D85A30" }} />}
      {d.posicion && (
        <span
          className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-semibold"
          style={{ background: d.posicion === "actor" ? "#639922" : "#D85A30", color: d.posicion === "actor" ? "#173404" : "#4A1B0C" }}
        >
          {d.posicion === "actor" ? "A" : "D"}
        </span>
      )}
      {d.soloDigital && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white/90 p-0.5">
          <Cloud className="h-2.5 w-2.5 text-slate-500" />
        </span>
      )}
      <Icono className="h-3.5 w-3.5 shrink-0" style={{ color: d.colorTexto }} />
      <p className="mt-1.5 max-w-[80px] truncate text-[7px] leading-tight" style={{ color: d.colorTexto, writingMode: "vertical-rl" }}>
        {d.etiqueta} · {nombreCorto}
      </p>
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
            <div className="flex items-end gap-1.5 overflow-x-auto pb-0.5">
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

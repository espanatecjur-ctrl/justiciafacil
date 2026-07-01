import { useEffect, useState } from "react";
import { Check, X as XIcon, Clock, Circle } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import { AREAS_LINEA, COLOR, colorDeArea, textoDictamen, obtenerRecorrido, marcarArea, type PasoRecorrido, type Dictamen } from "@/lib/recorrido";

const NAVY = "#0B1E3A";

// Línea de Vida: por cuáles ÁREAS ha pasado el expediente.
// Cada área tiene DOS dictámenes (registral + jurídico). El color de la bolita
// sale de ambos (los dos positivos = verde). Al tocar la bolita se despliega el detalle.
export function LineaVidaAreas({ caso }: { caso: CasoJuridico }) {
  const [pasos, setPasos] = useState<Record<string, PasoRecorrido>>({});
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);

  // edición del área abierta
  const [reg, setReg] = useState<Dictamen>(null);
  const [jur, setJur] = useState<Dictamen>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = () => { obtenerRecorrido(caso).then(setPasos).finally(() => setCargando(false)); };
  useEffect(cargar, [caso.id]);

  // al abrir un área, precarga sus dictámenes actuales
  const abrir = (area: string) => {
    if (abierta === area) { setAbierta(null); return; }
    const p = pasos[area];
    setReg(p?.dic_registral ?? null);
    setJur(p?.dic_juridico ?? null);
    setNota(p?.nota ?? "");
    setAbierta(area);
  };

  const guardar = async () => {
    if (!abierta) return;
    setGuardando(true);
    let email: string | null = null;
    try { const a = await getAuth(); const { data } = await a.auth.getSession(); email = data.session?.user?.email ?? null; } catch { /* opcional */ }
    const ok = await marcarArea(caso, abierta, reg, jur, nota || null, email);
    setGuardando(false);
    if (ok) { setAbierta(null); cargar(); }
  };

  const iconoColor = (c: string) => {
    if (c === "verde") return <Check className="h-4 w-4" style={{ color: COLOR.verde.color }} />;
    if (c === "rojo") return <XIcon className="h-4 w-4" style={{ color: COLOR.rojo.color }} />;
    if (c === "naranja") return <Clock className="h-4 w-4" style={{ color: COLOR.naranja.color }} />;
    return <Circle className="h-3.5 w-3.5" style={{ color: COLOR.gris.color }} />;
  };

  if (cargando) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold" style={{ color: NAVY }}>Línea de vida · recorrido por áreas <span className="font-normal text-muted-foreground">· toca una bolita para ver/marcar su dictamen</span></p>

      {/* fila de áreas */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {AREAS_LINEA.map((area, i) => {
          const esSVT = area === "SVT";
          const paso = pasos[area];
          const c = esSVT ? "gris" : colorDeArea(paso);
          const col = COLOR[c];
          const ultimo = i === AREAS_LINEA.length - 1;
          const activa = abierta === area;
          return (
            <div key={area} className="flex min-w-[64px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className="h-0.5 flex-1" style={{ background: i === 0 ? "transparent" : "#e5e7eb" }} />
                <button
                  onClick={() => !esSVT && abrir(area)}
                  disabled={esSVT}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${activa ? "ring-2 ring-offset-1" : ""}`}
                  style={{ borderColor: col.color, background: col.bg }}
                  title={esSVT ? "SVT — no aplica todavía" : `${area}: ${col.texto}`}
                >
                  {iconoColor(c)}
                </button>
                <div className="h-0.5 flex-1" style={{ background: ultimo ? "transparent" : "#e5e7eb" }} />
              </div>
              <span className="mt-1 text-center text-[10px] font-semibold" style={{ color: col.color }}>{area}</span>
              <span className="text-center text-[8px] text-muted-foreground">{esSVT ? "no aplica aún" : col.texto}</span>
            </div>
          );
        })}
      </div>

      {/* detalle desplegado del área abierta */}
      {abierta && (
        <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-semibold" style={{ color: NAVY }}>{abierta} — dictamen</p>

          {/* dictamen registral */}
          <div className="mb-2">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Dictamen registral</p>
            <div className="flex flex-wrap gap-1.5">
              <BotonDic activo={reg === "positivo"} color={COLOR.verde.color} onClick={() => setReg("positivo")}>✓ Positivo</BotonDic>
              <BotonDic activo={reg === "negativo"} color={COLOR.rojo.color} onClick={() => setReg("negativo")}>✗ Negativo</BotonDic>
              <BotonDic activo={reg === "espera"} color={COLOR.naranja.color} onClick={() => setReg("espera")}>⏳ En espera</BotonDic>
            </div>
          </div>

          {/* dictamen jurídico */}
          <div className="mb-2">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Dictamen jurídico</p>
            <div className="flex flex-wrap gap-1.5">
              <BotonDic activo={jur === "positivo"} color={COLOR.verde.color} onClick={() => setJur("positivo")}>✓ Positivo</BotonDic>
              <BotonDic activo={jur === "negativo"} color={COLOR.rojo.color} onClick={() => setJur("negativo")}>✗ Negativo</BotonDic>
              <BotonDic activo={jur === "espera"} color={COLOR.naranja.color} onClick={() => setJur("espera")}>⏳ En espera</BotonDic>
            </div>
          </div>

          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)…" className="mb-2 w-full rounded border border-input bg-background px-2 py-1 text-xs" />

          {/* resumen del color que quedará */}
          <p className="mb-2 text-[11px]">Quedará: <b style={{ color: COLOR[colorDeArea({ ...pasos[abierta], area: abierta, caso_id: caso.id, expediente: caso.expediente, dic_registral: reg, dic_juridico: jur, nota, marcado_por: null } as PasoRecorrido)].color }}>{COLOR[colorDeArea({ dic_registral: reg, dic_juridico: jur } as PasoRecorrido)].texto}</b> {reg === "positivo" && jur === "positivo" ? "(ambos positivos → verde)" : ""}</p>

          {pasos[abierta]?.marcado_por && <p className="mb-2 text-[10px] text-muted-foreground">Última marca: {pasos[abierta].marcado_por} · {pasos[abierta].updated_at ? new Date(pasos[abierta].updated_at!).toLocaleDateString("es-MX") : ""}</p>}

          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando} className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>{guardando ? "Guardando…" : "Guardar dictamen"}</button>
            <button onClick={() => setAbierta(null)} className="rounded-md border border-input px-3 py-1.5 text-xs">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonDic({ activo, color, onClick, children }: { activo: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition"
      style={activo ? { background: color, color: "white", borderColor: color } : { borderColor: "#d1d5db", color: "#444" }}>
      {children}
    </button>
  );
}

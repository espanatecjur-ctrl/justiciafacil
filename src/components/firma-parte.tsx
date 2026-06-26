import { useRef, useState, useEffect } from "react";
import { Signature, Eraser, Check, Pencil } from "lucide-react";

const TEAL = "#0C5C46";

export interface DatosFirma {
  nombre: string;
  cargo: string;
  fecha: string;        // ISO cuando firmó
  dibujo: string | null; // dataURL del trazo (opcional)
}

interface Props {
  titulo: string;        // "Elabora · abogado URRJ"
  valor: DatosFirma | null;
  onFirmar: (f: DatosFirma) => void;
  cargoSugerido?: string;
}

export function FirmaParte({ titulo, valor, onFirmar, cargoSugerido }: Props) {
  const [nombre, setNombre] = useState(valor?.nombre || "");
  const [cargo, setCargo] = useState(valor?.cargo || cargoSugerido || "");
  const [modoDibujo, setModoDibujo] = useState(false);
  const [hayTrazo, setHayTrazo] = useState(!!valor?.dibujo);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);

  const firmado = !!valor?.fecha;

  // preparar canvas
  useEffect(() => {
    if (!modoDibujo) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0B1E3A";
    if (valor?.dibujo) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = valor.dibujo;
    }
  }, [modoDibujo, valor?.dibujo]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e: React.PointerEvent) => {
    dibujando.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!dibujando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHayTrazo(true);
  };
  const end = () => { dibujando.current = false; };

  const limpiar = () => {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
  };

  const confirmar = () => {
    if (!nombre.trim()) return;
    const dibujo = modoDibujo && hayTrazo ? canvasRef.current!.toDataURL("image/png") : (valor?.dibujo || null);
    onFirmar({ nombre: nombre.trim(), cargo: cargo.trim(), fecha: new Date().toISOString(), dibujo });
  };

  const fechaBonita = valor?.fecha ? new Date(valor.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Signature className="h-3.5 w-3.5" /> {titulo}
      </p>

      {firmado ? (
        <div className="space-y-2">
          {valor?.dibujo && <img src={valor.dibujo} alt="firma" className="h-16 w-auto rounded border border-border bg-white" />}
          <div className="border-t border-border pt-1.5">
            <p className="text-sm font-semibold leading-tight" style={{ color: TEAL }}>{valor!.nombre}</p>
            {valor!.cargo && <p className="text-xs text-muted-foreground">{valor!.cargo}</p>}
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Check className="h-3 w-3 text-emerald-600" /> Firmado · {fechaBonita}</p>
          </div>
          <button onClick={() => onFirmar({ nombre: "", cargo: "", fecha: "", dibujo: null })} className="text-[11px] text-muted-foreground underline">Volver a firmar</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (ej. Abogado URRJ)" className="w-full rounded-md border border-input px-3 py-2 text-sm" />

          {!modoDibujo ? (
            <button onClick={() => setModoDibujo(true)} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Dibujar firma (opcional)
            </button>
          ) : (
            <div>
              <canvas
                ref={canvasRef} width={420} height={120}
                onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
                className="w-full touch-none rounded-md border border-input bg-white"
                style={{ height: 120 }}
              />
              <div className="mt-1 flex gap-2">
                <button onClick={limpiar} className="flex items-center gap-1 text-[11px] text-muted-foreground"><Eraser className="h-3 w-3" /> Limpiar</button>
                <button onClick={() => setModoDibujo(false)} className="text-[11px] text-muted-foreground underline">Ocultar</button>
              </div>
            </div>
          )}

          <button onClick={confirmar} disabled={!nombre.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: TEAL }}>
            <Check className="h-4 w-4" /> Firmar
          </button>
        </div>
      )}
    </div>
  );
}

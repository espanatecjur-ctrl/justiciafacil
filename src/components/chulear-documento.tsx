import { useEffect, useState } from "react";
import { X, Loader2, Check, Upload, Paperclip, FolderPlus, AlertTriangle } from "lucide-react";
import { type CasoJuridico } from "@/lib/supabase";
import { guardarMovimiento, verificarCarpeta, crearCarpetaDrive } from "@/lib/drive";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";
const hoy = () => new Date().toISOString().slice(0, 10);

// tipos de acto que pediste: Acuerdo, Promoción, Amparo, Recurso, Acta, Sentencia, Otro
const ACTOS = [
  { v: "acuerdo", t: "Acuerdo" },
  { v: "promocion", t: "Promoción" },
  { v: "amparo", t: "Amparo" },
  { v: "recurso", t: "Recurso" },
  { v: "acta", t: "Acta" },
  { v: "sentencia", t: "Sentencia" },
  { v: "otro", t: "Otro" },
];

// Mini-modal para chulear un documento del checklist: pide tipo de acto + fecha + archivo (obligatorio).
// Si la carpeta de Drive no existe, bloquea con aviso + botón "Generar carpeta".
export function ChulearDocumentoModal({ area, caso, etapaClave, docNombre, onClose, onListo }: {
  area: string; caso: CasoJuridico; etapaClave: string; docNombre: string;
  onClose: () => void; onListo: () => void;
}) {
  const [acto, setActo] = useState("acuerdo");
  const [fecha, setFecha] = useState(hoy());
  const [file, setFile] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // estado de la carpeta de Drive
  const [carpeta, setCarpeta] = useState<"verificando" | "existe" | "falta">("verificando");
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    verificarCarpeta(area, caso).then((r) => setCarpeta(r.existe ? "existe" : "falta")).catch(() => setCarpeta("falta"));
    // eslint-disable-next-line
  }, []);

  const generarCarpeta = async () => {
    setGenerando(true); setError(null);
    const r = await crearCarpetaDrive(area, caso);
    setGenerando(false);
    if (r.ok) setCarpeta("existe");
    else setError(r.error || "No se pudo generar la carpeta.");
  };

  const guardar = async () => {
    if (!file) { setError("Sube el documento para poder chulear (es obligatorio)."); return; }
    if (carpeta !== "existe") { setError("Primero genera la carpeta del expediente."); return; }
    setGuardando(true); setError(null);
    const r = await guardarMovimiento(area, caso, {
      tipo: "otro",
      fecha_mov: fecha || null,
      nota: `${docNombre} (${ACTOS.find((a) => a.v === acto)?.t || acto})`,
      etapa: etapaClave,
    }, file);
    setGuardando(false);
    if (!r.ok) { setError(r.error || "No se pudo guardar."); return; }
    onListo();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex min-w-0 items-center gap-2 font-semibold"><Check className="h-4 w-4" /> <span className="truncate">{docNombre}</span></p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 p-4">
          {/* aviso de carpeta */}
          {carpeta === "verificando" && (
            <p className="flex items-center gap-2 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando la carpeta del expediente…</p>
          )}
          {carpeta === "falta" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> No hay expediente generado en Drive</p>
              <p className="mt-1">Antes de subir el documento, genera la carpeta de esta garantía. Se creará así: <b>{area} → tu rol · correo → {caso.gar_id || caso.expediente || "garantía"}</b>.</p>
              <button onClick={generarCarpeta} disabled={generando} className="mt-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                {generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />} Generar carpeta ahora
              </button>
            </div>
          )}
          {carpeta === "existe" && (
            <p className="flex items-center gap-1.5 rounded-md bg-[color:var(--teal)]/5 p-2 text-[11px] text-[color:var(--teal)]"><Check className="h-3.5 w-3.5" /> Carpeta del expediente lista.</p>
          )}

          {/* tipo de acto */}
          <div>
            <label className={lbl}>¿Qué tipo de documento es?</label>
            <select className={inp} value={acto} onChange={(e) => setActo(e.target.value)}>
              {ACTOS.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}
            </select>
          </div>

          {/* fecha en que se presentó */}
          <div>
            <label className={lbl}>Fecha en que se presentó</label>
            <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          {/* archivo obligatorio */}
          <div>
            <label className={lbl}>Documento (obligatorio)</label>
            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2"><Paperclip className="h-4 w-4 shrink-0 text-[color:var(--teal)]" /> <span className="truncate">{file.name}</span></span>
                <button onClick={() => setFile(null)} className="shrink-0 text-xs text-red-600">Quitar</button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="h-4 w-4" /> Elegir archivo…
                <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={!file || carpeta !== "existe" || guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: TEAL }}>
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : <><Check className="h-4 w-4" /> Chulear y subir</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

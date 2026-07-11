import { useRef, useState } from "react";
import { Mic, X } from "lucide-react";

export function GrabadorVoz({ onAudio, disabled }: { onAudio: (blob: Blob) => void; disabled?: boolean }) {
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function iniciar() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) onAudio(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      rec.start();
      recRef.current = rec;
      setGrabando(true);
      setSeg(0);
      timerRef.current = window.setInterval(() => setSeg((s) => s + 1), 1000);
    } catch {
      alert("No se pudo usar el micrófono. Revisa los permisos del navegador.");
    }
  }

  function detener() {
    recRef.current?.stop();
    recRef.current = null;
    setGrabando(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function cancelar() {
    const rec = recRef.current;
    if (rec) {
      rec.onstop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
      rec.stop();
    }
    recRef.current = null;
    chunksRef.current = [];
    setGrabando(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  const mmss = `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;

  if (grabando) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2 py-1.5">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
        <span className="text-xs font-medium tabular-nums text-red-600">{mmss}</span>
        <button type="button" onClick={cancelar} title="Cancelar" className="rounded-md px-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={detener} title="Enviar nota de voz" className="rounded-md bg-[color:var(--teal)] px-2 py-1 text-xs font-semibold text-white hover:bg-[color:var(--teal)]/90">Enviar ▶</button>
      </div>
    );
  }

  return (
    <button type="button" onClick={iniciar} disabled={disabled} title="Grabar nota de voz"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted disabled:opacity-50">
      <Mic className="h-4 w-4" />
    </button>
  );
}

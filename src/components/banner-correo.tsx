// ============================================================
// BannerCorreo · modal de envío reutilizable (mismo estilo que
// el banner de Contratos). Envía por Gmail del asesor con
// enviarCorreo(); también deja abrir en Gmail/Outlook o Copiar.
// NADA de mailto por defecto.
// ============================================================
import { useState } from "react";
import { enviarCorreo } from "@/lib/enviar-correo";
import { Mail, X, Check } from "lucide-react";

export interface BannerCorreoProps {
  titulo?: string;
  paraInicial?: string;
  asuntoInicial?: string;
  mensajeInicial?: string;
  ccInicial?: string;
  folio?: string | null;
  /** Contenido extra (ej. campos de Administración/precio) arriba del formulario. */
  extra?: React.ReactNode;
  onCerrar: () => void;
  onEnviado?: () => void;
}

export function BannerCorreo({
  titulo = "Enviar por correo",
  paraInicial = "", asuntoInicial = "", mensajeInicial = "", ccInicial = "",
  folio = null, extra, onCerrar, onEnviado,
}: BannerCorreoProps) {
  const [para, setPara] = useState(paraInicial);
  const [asunto, setAsunto] = useState(asuntoInicial);
  const [cc, setCc] = useState(ccInicial);
  const [cco, setCco] = useState("");
  const [mensaje, setMensaje] = useState(mensajeInicial);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const enviarDesdeSistema = async () => {
    if (!para.trim()) { setResultado("Escribe al menos un correo en 'Para'."); return; }
    setEnviando(true); setResultado(null);
    const r = await enviarCorreo({ para, cc: cc || undefined, cco: cco || undefined, asunto, mensaje, folio: folio || undefined });
    setEnviando(false);
    if (r.ok) { setResultado("Enviado ✓"); onEnviado?.(); }
    else setResultado(`No se pudo enviar: ${r.error || "revisa el permiso de Google"}`);
  };

  const linkGmail = () => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(para)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
  const linkOutlook = () => `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(para)}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(`Para: ${para}\nAsunto: ${asunto}\n\n${mensaje}`); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* nada */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => !enviando && onCerrar()}>
      <div className="my-4 w-[94vw] max-w-3xl rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-base font-bold text-[#0B1E3A]"><Mail className="h-5 w-5" /> {titulo}</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {extra && <div className="mb-4">{extra}</div>}

        <div className="grid content-start gap-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Para (correo)</label>
            <input type="email" value={para} onChange={(e) => setPara(e.target.value)} placeholder="correo@diipadesarrollos.com" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Asunto</label>
            <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Copia (CC)</label>
              <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="opcional" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Copia oculta (CCO)</label>
              <input value={cco} onChange={(e) => setCco(e.target.value)} placeholder="escondidos" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Mensaje</label>
            <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={10} className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button onClick={enviarDesdeSistema} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--teal)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
            <Mail className="h-4 w-4" /> {enviando ? "Enviando…" : "Enviar desde el sistema"}
          </button>
          {resultado && <span className={`text-xs font-medium ${resultado.startsWith("Enviado") ? "text-emerald-700" : "text-red-700"}`}>{resultado.startsWith("Enviado") && <Check className="mr-0.5 inline h-3.5 w-3.5" />}{resultado}</span>}
          <span className="flex-1" />
          <span className="text-[11px] text-muted-foreground">o abrir en:</span>
          <button onClick={() => window.open(linkGmail(), "_blank")} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">Gmail</button>
          <button onClick={() => window.open(linkOutlook(), "_blank")} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">Outlook</button>
          <button onClick={copiar} className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">{copiado ? "Copiado ✓" : "Copiar"}</button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { crearFormalizacion, TIPOS_CONTRATO } from "@/lib/formalizacion";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { FileSignature, Loader2, X, Check } from "lucide-react";

// Tipos de Contratos existentes + Escritura (que no había)
export const TIPOS_FORMALIZACION = [...TIPOS_CONTRATO, "Escritura pública de cesión"];

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface ClienteMin {
  id: string; nombre: string | null; domicilio_garantia: string | null; folio: string | null;
}

export function SolicitarFormalizacion({ cliente, casoId, onClose, onHecho }: {
  cliente: ClienteMin; casoId: string; onClose: () => void; onHecho?: () => void;
}) {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState(TIPOS_FORMALIZACION[TIPOS_FORMALIZACION.length - 1]); // Escritura por defecto
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const enviar = async () => {
    setGuardando(true); setErr(null);
    try {
      const nf = await crearFormalizacion({
        caso_id: casoId,
        tipo_contrato: tipo,
        tipo_proceso: "Venta",
        direccion_garantia: cliente.domicilio_garantia || null,
        id_interno: cliente.folio || null,
        nombre_cesionario: cliente.nombre || null,
        observaciones: `Cliente: ${cliente.nombre || "—"} · Folio ${cliente.folio || "—"} · Solicitud de formalización desde el CRM`,
        estado_tramite: "En proceso",
        en_papelera: false,
      });
      if (!nf?.id) throw new Error("sin id");
      await fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?id=eq.${cliente.id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ formalizacion_solicitada: true, formalizacion_tipo: tipo, formalizacion_id: nf.id }),
      });
      onHecho?.();
      navigate({ to: "/ufc-ficha", search: { id: nf.id } as any });
    } catch {
      setErr("No se pudo solicitar. Intenta de nuevo.");
    } finally { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-[color:var(--teal)]" />
            <h3 className="text-sm font-semibold">Solicitar formalización</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">{cliente.nombre || "—"}</b><br />
            <span className="text-xs">{cliente.domicilio_garantia || ""}</span>
          </p>
          <div>
            <p className="mb-1.5 text-xs font-medium">¿Qué tipo de formalización?</p>
            <div className="space-y-1.5">
              {TIPOS_FORMALIZACION.map((t) => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${tipo === t ? "border-[color:var(--teal)] bg-[color:var(--teal)]/5 font-medium" : "border-input hover:bg-muted"}`}>
                  <span className={`grid h-4 w-4 place-items-center rounded-full border ${tipo === t ? "border-[color:var(--teal)] bg-[color:var(--teal)] text-white" : "border-muted-foreground"}`}>
                    {tipo === t && <Check className="h-3 w-3" />}
                  </span>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <p className="text-[11px] text-muted-foreground">Se creará el trámite en UFC como “En proceso” y te llevaré a su ficha para continuar.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button onClick={enviar} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--teal)" }}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Enviar a UFC
          </button>
        </div>
      </div>
    </div>
  );
}

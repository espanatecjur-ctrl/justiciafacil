import { useState } from "react";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { CheckCircle2, Clock } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// Bloque de firmas de UN dictamen (jurídico o registral).
// Cada dictamen lleva 2 firmas: Elabora + Valida (DIL).
// Cuando el DIL valida, el dictamen queda "listo".
// Las firmas se guardan en dictamen.firmas con claves propias (ej. jur_elabora, jur_dil).
export function FirmasDictamen({ dictamenId, firmas, claveElabora, claveValida, tituloElabora, tituloValida, cargoElabora, cargoValida, onGuardado }: {
  dictamenId: string;
  firmas: Record<string, any> | null;
  claveElabora: string;   // ej. "jur_elabora"
  claveValida: string;    // ej. "jur_dil"
  tituloElabora: string;
  tituloValida: string;
  cargoElabora: string;
  cargoValida: string;
  onGuardado?: () => void;
}) {
  const [f, setF] = useState<Record<string, any>>(() => firmas || {});
  const [error, setError] = useState<string | null>(null);

  const firmar = async (clave: string, datos: DatosFirma) => {
    const nuevo = { ...f, [clave]: datos.fecha ? datos : null };
    setF(nuevo);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamenId}`, {
        method: "PATCH", headers, body: JSON.stringify({ firmas: nuevo, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      onGuardado?.();
    } catch (e: any) { setError("No se pudo guardar la firma: " + e.message); }
  };

  const elaboraOK = !!f[claveElabora]?.fecha;
  const validaOK = !!f[claveValida]?.fecha;
  const listo = elaboraOK && validaOK;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Firmas de este dictamen</p>
        {listo
          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Listo (validado por DIL)</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"><Clock className="h-3.5 w-3.5" /> {elaboraOK ? "Falta validación del DIL" : "Falta elaborar"}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FirmaParte
          titulo={tituloElabora}
          valor={f[claveElabora] || null}
          cargoSugerido={cargoElabora}
          onFirmar={(datos) => firmar(claveElabora, datos)}
        />
        <FirmaParte
          titulo={tituloValida}
          valor={f[claveValida] || null}
          cargoSugerido={cargoValida}
          bloqueado={!elaboraOK}
          onFirmar={(datos) => firmar(claveValida, datos)}
        />
      </div>
      {!elaboraOK && <p className="mt-2 text-[11px] text-muted-foreground">El DIL valida después de que se elabore el dictamen.</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

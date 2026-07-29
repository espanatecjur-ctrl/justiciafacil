// ============================================================
// JusticiaFácil · Dictamen Legal Final (UCP)
// ------------------------------------------------------------
// Consolida el veredicto final (jurídico + registral) y guarda
// el "Informe de cierre" — por qué se decidió lo que se decidió.
// Al guardar, el informe también se copia a cliente_juicio.observaciones
// (JurisConecta) para que el cliente lo vea del otro lado, sin
// duplicar la captura: se llena una vez aquí y se refleja allá.
// ============================================================
import { useState } from "react";
import { Gavel, Save, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { correoActual } from "@/lib/auth";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export function DictamenLegalFinal({ dictamenId, casoId, clienteJcId, veredicto, informeInicial, onGuardado }: {
  dictamenId: string;
  casoId: string;
  clienteJcId: number | string | null | undefined;
  veredicto: string | null;
  informeInicial: string | null;
  onGuardado?: () => void;
}) {
  const [informe, setInforme] = useState(informeInicial || "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const v = (veredicto || "").toLowerCase();
  const positivo = v.includes("positiv");
  const negativo = v.includes("negativ");
  const Icono = positivo ? CheckCircle2 : negativo ? XCircle : Clock;
  const color = positivo ? "#0C5C46" : negativo ? "#A32D2D" : "#B26B00";

  const guardar = async () => {
    setGuardando(true); setError(null); setGuardado(null);
    try {
      const correo = await correoActual().catch(() => "");
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamenId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ informe_cierre: informe, informe_cierre_por: correo || null, informe_cierre_en: new Date().toISOString() }),
      });
      if (!r1.ok) throw new Error(`dictamen ${r1.status}`);

      // Alimenta al cliente en JurisConecta (una sola captura, se refleja allá).
      if (clienteJcId) {
        const rc = await fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=id&caso_id=eq.${casoId}&limit=1`, { headers });
        const fila = (rc.ok ? await rc.json() : [])?.[0];
        const patchCliente = { observaciones: informe, estado: veredicto ? `Dictamen legal final: ${veredicto}` : null };
        if (fila?.id) {
          await fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?id=eq.${fila.id}`, { method: "PATCH", headers, body: JSON.stringify(patchCliente) });
        }
      }
      setGuardado("Guardado y reflejado en JurisConecta ✅");
      onGuardado?.();
    } catch (e: any) {
      setError("No se pudo guardar: " + e.message);
    } finally { setGuardando(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2 lg:col-span-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#0B1E3A" }}>
          <Gavel className="h-4 w-4" style={{ color: "#0C447C" }} /> Dictamen Legal Final
        </p>
        <div className="flex items-center gap-2">
          <Icono className="h-5 w-5" style={{ color }} />
          <span className="text-sm font-medium" style={{ color }}>{veredicto || "Sin dictaminar"}</span>
        </div>
      </div>

      <label className="mb-1 block text-xs font-medium text-muted-foreground">Informe de cierre — por qué se llegó a este veredicto (se le comparte al cliente)</label>
      <textarea
        className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="Explica por qué el caso se cerró así: qué se encontró, qué pasó con los pagos si aplica, y la aclaración para el cliente…"
        value={informe}
        onChange={(e) => setInforme(e.target.value)}
      />

      {!clienteJcId && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Este caso no tiene cliente vinculado todavía — el informe se guarda aquí, pero no se puede reflejar en JurisConecta hasta que se conecte un cliente.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={guardar} disabled={guardando || !informe.trim()}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#0C447C" }}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar informe de cierre
        </button>
        {guardado && <span className="text-xs font-medium text-emerald-700">{guardado}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

// ============================================================
// IndicadorRepetido · muestra ⚠️ "Repetido" cuando la dirección de la
// garantía coincide con la de otro(s) expediente(s) — en cualquier área.
// Lee la vista v_garantia_repetida (solo lectura, no borra nada).
// ============================================================
import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

interface Otro {
  id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  unidad: string | null;
}

export function IndicadorRepetido({ casoId }: { casoId: string }) {
  const [otros, setOtros] = useState<Otro[]>([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!casoId) { setOtros([]); return; }
    let vivo = true;
    (async () => {
      try {
        // 1) ¿esta garantía está repetida? tomo su dir_norm
        const r1 = await fetch(`${SUPABASE_URL}/rest/v1/v_garantia_repetida?select=dir_norm&id=eq.${encodeURIComponent(casoId)}&limit=1`, { headers });
        const yo = r1.ok ? await r1.json() : [];
        const dir = yo?.[0]?.dir_norm;
        if (!dir) { if (vivo) setOtros([]); return; }
        // 2) los otros expedientes con la misma dirección
        const r2 = await fetch(`${SUPABASE_URL}/rest/v1/v_garantia_repetida?select=id,expediente,cliente_nombre,unidad&dir_norm=eq.${encodeURIComponent(dir)}&id=neq.${encodeURIComponent(casoId)}`, { headers });
        const lista = r2.ok ? await r2.json() : [];
        if (vivo) setOtros(lista || []);
      } catch { if (vivo) setOtros([]); }
    })();
    return () => { vivo = false; };
  }, [casoId]);

  if (otros.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50">
      <button onClick={() => setAbierto((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="flex-1 font-medium text-amber-900">
          Dirección repetida — validar datos ({otros.length} más)
        </span>
        {abierto ? <ChevronUp className="h-4 w-4 text-amber-700" /> : <ChevronDown className="h-4 w-4 text-amber-700" />}
      </button>
      {abierto && (
        <div className="space-y-1 border-t border-amber-200 px-3 py-2 text-xs text-amber-900">
          <p className="text-[11px] text-amber-700">Esta misma dirección de garantía también aparece en:</p>
          {otros.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded border border-amber-200 bg-white px-2 py-1">
              <span className="font-medium">{o.expediente || "sin expediente"}</span>
              <span className="text-amber-700">·</span>
              <span>{o.cliente_nombre || "sin cliente"}</span>
              {o.unidad && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px]">{o.unidad}</span>}
            </div>
          ))}
          <p className="pt-1 text-[10px] text-amber-600">Revisa si es un traspaso/cambio (válido) o un dato mal capturado. No se borra nada automáticamente.</p>
        </div>
      )}
    </div>
  );
}

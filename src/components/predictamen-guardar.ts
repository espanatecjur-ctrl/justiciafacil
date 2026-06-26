// ============================================================
// URRJ · Guardado con control de versiones
// Guarda el pre-dictamen; si viene de un "re-pre-dictaminar",
// crea la versión nueva (vigente) y marca la anterior como
// antecedente (vigente=false). Devuelve el id nuevo.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface Precarga {
  datos?: any;
  antecedenteId?: string;  // id del pre-dictamen anterior
  version?: number;        // versión del anterior
  cambios?: string;        // qué cambió (lo llena el recorrido)
}

export async function guardarPredictamen(payload: any, precargar?: Precarga | null): Promise<string | null> {
  const version = precargar ? (precargar.version || 1) + 1 : 1;
  const body = { ...payload, version, vigente: true, antecedente_de: null };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen`, {
    method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const data = await res.json();
  const nuevoId: string | null = data?.[0]?.id ?? null;

  // marcar el anterior como antecedente
  if (precargar?.antecedenteId && nuevoId) {
    await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${precargar.antecedenteId}`, {
      method: "PATCH", headers, body: JSON.stringify({ vigente: false, antecedente_de: nuevoId, cambios: precargar.cambios || null }),
    });
  }
  return nuevoId;
}

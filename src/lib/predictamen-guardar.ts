// ============================================================
// URRJ · Guardado con control de versiones
// Guarda el pre-dictamen; si viene de un "re-pre-dictaminar",
// crea la versión nueva (vigente) y marca la anterior como
// antecedente (vigente=false). Devuelve el id nuevo.
// ============================================================
import { reflejarDictamen, decisionADictamen } from "@/lib/recorrido";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface Precarga {
  datos?: any;
  antecedenteId?: string;  // id del pre-dictamen anterior
  version?: number;        // versión del anterior
  cambios?: string;        // nota del abogado (qué cambió)
}

const ETIQUETAS: Record<string, string> = {
  ubicacion: "Dirección / garantía", deudor: "Deudor", deCujus: "De cujus", expediente: "Expediente",
  juzgado: "Juzgado", estado: "Estado", valorComercial: "Valor comercial", suertePrincipal: "Suerte principal",
  interesMoratorio: "Interés moratorio", acreedor: "Acreedor", heredero: "Heredero", caso: "Caso sucesorio",
  anotaciones: "Anotaciones", anotacionesHumanas: "Anotaciones",
};

// Detecta qué campos cambiaron entre el anterior y el nuevo
export function diffDatos(viejo: any, nuevo: any): { campo: string; antes: string; ahora: string }[] {
  const out: { campo: string; antes: string; ahora: string }[] = [];
  if (!viejo || !nuevo) return out;
  const claves = new Set([...Object.keys(viejo), ...Object.keys(nuevo)]);
  for (const k of claves) {
    const a = viejo[k], b = nuevo[k];
    if (typeof a === "object" || typeof b === "object") continue;
    const sa = (a ?? "").toString(), sb = (b ?? "").toString();
    if (sa !== sb) out.push({ campo: ETIQUETAS[k] || k, antes: sa, ahora: sb });
  }
  return out;
}

export async function guardarPredictamen(payload: any, precargar?: Precarga | null): Promise<string | null> {
  const version = precargar ? (precargar.version || 1) + 1 : 1;
  let cambiosTxt: string | null = null;
  if (precargar) {
    const campos = diffDatos(precargar.datos, payload.datos);
    cambiosTxt = JSON.stringify({ campos, nota: precargar.cambios || "" });
  }
  const body = { ...payload, version, vigente: true, antecedente_de: null, cambios: cambiosTxt };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen`, {
    method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const data = await res.json();
  const nuevoId: string | null = data?.[0]?.id ?? null;

  // marcar el anterior como antecedente
  if (precargar?.antecedenteId && nuevoId) {
    await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${precargar.antecedenteId}`, {
      method: "PATCH", headers, body: JSON.stringify({ vigente: false, antecedente_de: nuevoId }),
    });
  }
  try {
    if (payload.caso_id && payload.dictamen_final) {
      await reflejarDictamen({ id: payload.caso_id, expediente: payload.expediente } as any, "URRJ", "juridico", decisionADictamen(payload.dictamen_final), payload.solicitado_por || null);
    }
  } catch { /* la línea de vida no debe romper el guardado */ }

  return nuevoId;
}

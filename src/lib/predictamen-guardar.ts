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

export interface PredictamenExistente { id: string; folio: string | null; posicion: string | null; caso_id: string | null; expediente: string | null; }

/** Busca un pre-dictamen VIGENTE (no en papelera) por caso o por expediente.
 *  Sirve para no duplicar: si ya hay uno, se avisa y se ofrece ir a ese. */
export async function buscarPredictamenVigente(expediente?: string | null, casoId?: string | null): Promise<PredictamenExistente | null> {
  const conds: string[] = [];
  if (casoId) conds.push(`caso_id.eq.${casoId}`);
  if (expediente && expediente.trim()) conds.push(`expediente.eq.${encodeURIComponent(expediente.trim())}`);
  if (conds.length === 0) return null;
  const filtro = conds.length === 1 ? conds[0].replace(".eq.", "=eq.") : `or=(${conds.join(",")})`;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,folio,posicion,caso_id,expediente&vigente=eq.true&en_papelera=eq.false&${filtro}&limit=1`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
  } catch { return null; }
}

// Regla de oro (URRJ): no se pueden crear garantías repetidas.
// Bloquea si el crédito, expediente, dirección o cliente ya existe en otra
// garantía vigente. Devuelve el motivo (texto) o null si no hay repetido.
const normRO = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
export async function motivoRepetidoURRJ(payload: any): Promise<string | null> {
  const cred = normRO(payload?.datos?.numeroCredito);
  const exp = normRO(payload?.expediente);
  const dir = normRO(payload?.datos?.ubicacion);
  const cli = normRO(payload?.datos?.deudor);
  if (!cred && !exp && !dir && !cli) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=expediente,datos&vigente=eq.true&en_papelera=eq.false&limit=1000`, { headers });
    const rows: any[] = r.ok ? await r.json() : [];
    for (const x of rows) {
      if (cred && cred === normRO(x?.datos?.numeroCredito)) return `el número de crédito "${payload.datos.numeroCredito}"`;
      if (exp && exp === normRO(x?.expediente)) return `el expediente "${payload.expediente}"`;
      if (dir && dir === normRO(x?.datos?.ubicacion)) return `la dirección "${payload.datos.ubicacion}"`;
      if (cli && cli === normRO(x?.datos?.deudor)) return `el cliente "${payload.datos.deudor}"`;
    }
  } catch { /* si falla la consulta, no bloqueamos el guardado */ }
  return null;
}

export async function guardarPredictamen(payload: any, precargar?: Precarga | null, datosPDF?: any, opts?: { reglaOroURRJ?: boolean }): Promise<string | null> {
  // Regla de oro: solo al crear una garantía NUEVA (no al re-dictaminar).
  if (opts?.reglaOroURRJ && !precargar) {
    const motivo = await motivoRepetidoURRJ(payload);
    if (motivo) throw new Error(`REGLA DE ORO (URRJ): ya existe una garantía con ${motivo}. No se pueden subir repetidos.`);
  }
  const version = precargar ? (precargar.version || 1) + 1 : 1;
  let cambiosTxt: string | null = null;
  if (precargar) {
    const campos = diffDatos(precargar.datos, payload.datos);
    cambiosTxt = JSON.stringify({ campos, nota: precargar.cambios || "" });
  }
  const body = { ...payload, version, vigente: true, antecedente_de: null, cambios: cambiosTxt, pasa_a_ucp: /pasa a ucp/i.test(String(payload.dictamen_final || "")) };
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

  // Archivar el PDF por fase (Camino 1): genera el PDF una vez, lo sube a Storage
  // y guarda su URL en pdf_url. Import dinámico para no crear ciclos. Si algo
  // falla, el pre-dictamen igual quedó guardado (el PDF se puede generar luego).
  if (datosPDF && nuevoId) {
    try {
      const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
      const url = await descargarPredictamenPDF(datosPDF, "archivar");
      if (typeof url === "string") {
        await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${nuevoId}`, {
          method: "PATCH", headers, body: JSON.stringify({ pdf_url: url }),
        });
      }
    } catch { /* el PDF se puede archivar después desde el proceso */ }
  }

  return nuevoId;
}

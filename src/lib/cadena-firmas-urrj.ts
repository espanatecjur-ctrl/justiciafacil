// ============================================================
// JusticiaFácil · Cadena de firmas del dictamen URRJ
// ------------------------------------------------------------
// Orden fijo: elabora -> DIL -> UCM -> DGE (DGE solo si el
// dictamen quedó Positivo). Si alguien rechaza, se regresa
// UN SOLO PASO (no hasta el inicio) — esa persona anterior
// tiene que volver a revisar/firmar para que la cadena siga.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { crearYEnviarSolicitudFirma } from "@/lib/firma-solicitud";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export type EtapaFirma = "elabora" | "dil" | "ucm" | "dge" | "completo";

export const ORDEN_ETAPAS: EtapaFirma[] = ["elabora", "dil", "ucm", "dge"];

export const TITULO_ETAPA: Record<string, string> = {
  elabora: "Elabora · Abogado URRJ",
  dil: "Valida jurídico · DIL",
  ucm: "Valida · UCM",
  dge: "Autoriza · DGE",
};

// El rol en perfil_usuario que corresponde a cada etapa (para autocompletar el correo).
export const ROL_ETAPA: Record<string, string> = { dil: "DIL", ucm: "UCM", dge: "DGE" };

/** Etapa siguiente en la cadena. DGE se salta si el dictamen no quedó Positivo. */
export function siguienteEtapa(actual: EtapaFirma, dictamenFinal: string | null | undefined): EtapaFirma {
  const i = ORDEN_ETAPAS.indexOf(actual as any);
  if (i === -1 || i >= ORDEN_ETAPAS.length - 1) return "completo";
  const sig = ORDEN_ETAPAS[i + 1];
  if (sig === "dge" && String(dictamenFinal || "").toLowerCase() !== "positivo" && String(dictamenFinal || "").toLowerCase() !== "sí pasa" && String(dictamenFinal || "").toLowerCase() !== "si pasa") {
    return "completo"; // no positivo -> no pasa por DGE, la cadena termina en UCM
  }
  return sig;
}

/** Un paso hacia atrás (para cuando alguien rechaza). */
export function etapaAnterior(actual: EtapaFirma): EtapaFirma {
  const i = ORDEN_ETAPAS.indexOf(actual as any);
  if (i <= 0) return "elabora";
  return ORDEN_ETAPAS[i - 1];
}

/** Busca el correo de la persona con ese rol (DIL/UCM/DGE) en perfil_usuario. */
export async function correoDelRol(rol: string): Promise<{ correo: string; nombre: string }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/perfil_usuario?select=email,nombre&rol=eq.${encodeURIComponent(rol)}&activo=eq.true&limit=1`, { headers });
    const rows = r.ok ? await r.json() : [];
    return { correo: rows?.[0]?.email || "", nombre: rows?.[0]?.nombre || rol };
  } catch { return { correo: "", nombre: rol }; }
}

/** Crea (y prepara el correo de) la solicitud de firma para una etapa del predictamen URRJ. */
export async function mandarAEtapa(params: {
  etapa: "dil" | "ucm" | "dge";
  predictamenId: string;
  casoId: string;
  expedienteTexto: string;
  motivoRechazoPrevio?: string;
}): Promise<{ ok: boolean; link?: string; enviado?: boolean; correo?: string; error?: string }> {
  const { correo, nombre } = await correoDelRol(ROL_ETAPA[params.etapa]);
  if (!correo) return { ok: false, error: `No hay nadie con rol ${ROL_ETAPA[params.etapa]} activo en perfil_usuario.` };
  const r = await crearYEnviarSolicitudFirma({
    area: "URRJ",
    predictamenId: params.predictamenId,
    casoId: params.casoId,
    slot: params.etapa,
    correoEsperado: correo,
    tituloSlot: TITULO_ETAPA[params.etapa] + (params.motivoRechazoPrevio ? " (corrección solicitada)" : ""),
    expedienteTexto: params.expedienteTexto,
  });
  return { ...r, correo };
}

/** Avanza la cadena: guarda etapa_firma = siguiente y, si no se completó, crea la solicitud de esa siguiente etapa. */
export async function avanzarCadena(params: {
  predictamenId: string; casoId: string; expedienteTexto: string; etapaQueAcabaDeFirmar: EtapaFirma; dictamenFinal: string | null;
}): Promise<{ ok: boolean; siguiente: EtapaFirma; correo?: string; link?: string; error?: string }> {
  const siguiente = siguienteEtapa(params.etapaQueAcabaDeFirmar, params.dictamenFinal);
  await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${params.predictamenId}`, {
    method: "PATCH", headers, body: JSON.stringify({ etapa_firma: siguiente }),
  });
  if (siguiente === "completo") return { ok: true, siguiente };
  const r = await mandarAEtapa({ etapa: siguiente as any, predictamenId: params.predictamenId, casoId: params.casoId, expedienteTexto: params.expedienteTexto });
  return { ok: r.ok, siguiente, correo: r.correo, link: r.link, error: r.error };
}

/** Registra el rechazo y regresa la cadena un paso, avisando a esa persona anterior. */
export async function rechazarYRetroceder(params: {
  predictamenId: string; casoId: string; expedienteTexto: string; etapaQueRechaza: EtapaFirma; motivo: string;
}): Promise<{ ok: boolean; anterior: EtapaFirma; correo?: string; error?: string }> {
  const anterior = etapaAnterior(params.etapaQueRechaza);
  // Limpia la firma de la etapa anterior (tiene que volver a revisar/firmar) y la de esta etapa (aún no firmó, rechazó).
  const patch: any = { etapa_firma: anterior, rechazo_motivo: params.motivo, rechazo_etapa: params.etapaQueRechaza, rechazo_fecha: new Date().toISOString() };
  if (anterior === "dil") { patch.firma_dil = null; patch.firma_dil_fecha = null; }
  if (anterior === "ucm") { patch.firma_ucm = null; patch.firma_ucm_fecha = null; }
  if (anterior === "elabora") { /* el elaborador corrige directo en su pantalla, no hace falta borrar su firma aquí */ }
  await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${params.predictamenId}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
  if (anterior === "elabora") return { ok: true, anterior };
  const r = await mandarAEtapa({ etapa: anterior as any, predictamenId: params.predictamenId, casoId: params.casoId, expedienteTexto: params.expedienteTexto, motivoRechazoPrevio: params.motivo });
  return { ok: r.ok, anterior, correo: r.correo, error: r.error };
}

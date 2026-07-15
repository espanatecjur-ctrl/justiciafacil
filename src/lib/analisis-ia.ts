// ============================================================
//  Análisis de documentos con IA (una sola vez por caso+posición)
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface DocumentoRef { nombre: string; url: string }

export interface AnalisisIA {
  clave: string;
  posicion: string;
  documento_nombre?: string | null;
  documento_tipo?: string | null;
  acto_que_resuelve?: string | null;
  respuestas: any;
  documentos_analizados: (DocumentoRef & { error?: string })[];
  modelo?: string | null;
  created_at?: string;
}

/** Arma la clave única del caso: usa lo primero que exista (crédito,
 *  expediente, o caso_id) — es lo que ya viene en cada recorrido. */
export function claveAnalisis(d: { numeroCredito?: string; expediente?: string; caso_id?: string }): string {
  return (d.numeroCredito || d.expediente || d.caso_id || "").trim();
}

export async function obtenerAnalisisCacheado(clave: string, posicion: string): Promise<AnalisisIA | null> {
  if (!clave) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/analisis_documental_ia?select=*&clave=eq.${encodeURIComponent(clave)}&posicion=eq.${encodeURIComponent(posicion)}&limit=1`, { headers });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

/** Genera el análisis (llama a la IA) y lo guarda en caché. Si ya existe
 *  y `forzar` no es true, mejor usar obtenerAnalisisCacheado primero —
 *  esta función SIEMPRE gasta IA cuando se llama. */
export async function generarAnalisisIA(clave: string, posicion: string, documentos: DocumentoRef[]): Promise<{ ok: boolean; error?: string; analisis?: AnalisisIA }> {
  if (!clave) return { ok: false, error: "No hay número de crédito ni expediente para identificar el caso." };
  if (!documentos.length) return { ok: false, error: "No hay documentos para analizar." };
  try {
    const r = await fetch("/.netlify/functions/analizar-documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentos, posicion }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) return { ok: false, error: data.error || `Error ${r.status}` };

    const fila: AnalisisIA = {
      clave, posicion,
      documento_nombre: data.respuestas?.documento_principal?.nombre || null,
      documento_tipo: data.respuestas?.documento_principal?.tipo || null,
      acto_que_resuelve: data.respuestas?.documento_principal?.acto_que_resuelve || null,
      respuestas: data.respuestas,
      documentos_analizados: data.documentos_analizados || [],
      modelo: data.modelo || null,
    };
    await guardarAnalisisEnCache(fila);
    return { ok: true, analisis: fila };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

/** Solo GUARDA en caché (sin llamar a la IA) — se usa para reaprovechar el
 *  mismo análisis en otra posición (ej. Actor y Demandado comparten hoy el
 *  mismo cuestionario) sin gastar IA dos veces. */
export async function guardarAnalisisEnCache(fila: AnalisisIA): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/analisis_documental_ia`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(fila),
    });
  } catch { /* si falla, se queda solo la posición original — no es grave */ }
}

/** Arma un texto legible (para descargar) con todas las respuestas del cuestionario. */
export function textoAnalisis(a: AnalisisIA): string {
  const r = a.respuestas || {};
  const dp = r.documento_principal || {};
  const ea = r.estado_actual || {};
  const rr = r.resoluciones_y_recursos || {};
  const pr = r.prescripcion || {};
  const ds = r.documentos_solicitados || {};
  const cv = r.convenios || {};
  const demandas = Array.isArray(ea.demandas) ? ea.demandas : [];

  const L: string[] = [];
  L.push(`ANÁLISIS DE DOCUMENTOS · ${a.posicion}`);
  L.push(`Generado: ${a.created_at ? new Date(a.created_at).toLocaleString("es-MX") : new Date().toLocaleString("es-MX")}`);
  L.push("");
  L.push("== DOCUMENTO PRINCIPAL ==");
  L.push(`Nombre: ${dp.nombre || "—"}`);
  L.push(`Tipo: ${dp.tipo || "—"}`);
  L.push(`Acto que resuelve: ${dp.acto_que_resuelve || "—"}`);
  L.push("");
  L.push("== ESTADO ACTUAL DE LA CARPETA ==");
  L.push(`¿Jurisdicción voluntaria?: ${ea.es_jurisdiccion_voluntaria || "—"}`);
  L.push(`Expediente/juzgado (JV): ${ea.expediente_juzgado_jv || "—"}`);
  L.push(`Fecha de presentación (JV): ${ea.fecha_presentacion_jv || "—"}`);
  L.push(`¿Emplazamiento (JV)?: ${ea.emplazamiento_jv || "—"}`);
  L.push(`¿Notificación de inicio?: ${ea.notificacion_inicio_jv || "—"}`);
  L.push(`Última actuación: ${ea.ultima_actuacion?.fecha || "—"} — pidió: ${ea.ultima_actuacion?.que_se_pidio || "—"} — resolvió: ${ea.ultima_actuacion?.que_se_resolvio || "—"}`);
  L.push(`Fecha del último pago del acreditado: ${ea.fecha_ultimo_pago_acreditado || "—"}`);
  L.push(`Demandas encontradas: ${demandas.length}`);
  demandas.forEach((d: any, i: number) => {
    L.push(`  ${i + 1}) Exp./juzgado: ${d.expediente_juzgado || "—"} · Presentación: ${d.fecha_presentacion || "—"} · Emplazamiento: ${d.emplazamiento || "—"} · Afecta recuperación: ${d.afecta_recuperacion_credito || "—"}`);
  });
  L.push("");
  L.push("== RESOLUCIONES Y RECURSOS ==");
  L.push(`Sentencia: ${rr.sentencia || "—"}`);
  L.push(`Apelación: ${rr.apelacion || "—"}`);
  L.push(`Amparo: ${rr.amparo || "—"}`);
  L.push("");
  L.push("== PRESCRIPCIÓN ==");
  L.push(`¿Prescrita?: ${pr.esta_prescrita || "—"} — ${pr.motivo || ""}`);
  L.push("");
  L.push("== DOCUMENTOS SOLICITADOS ==");
  L.push(ds.detalle || "—");
  L.push("");
  L.push("== CONVENIOS ==");
  L.push(`Notificados/firmados/ratificados: ${cv.notificados_firmados_ratificados || "—"}`);
  L.push(`Estado de cuenta con firma del perito: ${cv.estado_cuenta_firma_perito || "—"}`);
  L.push("");
  L.push("== DOCUMENTOS ANALIZADOS ==");
  a.documentos_analizados.forEach((d) => L.push(`- ${d.nombre}${d.error ? ` (⚠️ ${d.error})` : ""}`));
  return L.join("\n");
}

export function descargarAnalisisTxt(a: AnalisisIA) {
  const blob = new Blob([textoAnalisis(a)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement("a");
  a2.href = url;
  a2.download = `Analisis-${a.posicion}-${a.clave}.txt`;
  a2.click();
  URL.revokeObjectURL(url);
}

/** Arma un párrafo corto (3-6 renglones) resumiendo el cuestionario de estado
 *  actual, para mostrarlo como introducción al empezar el recorrido. */
export function introAnalisis(a: any): string {
  if (!a) return "";
  const ea = a.estado_actual || {};
  const rr = a.resoluciones_y_recursos || {};
  const pr = a.prescripcion || {};
  const cv = a.convenios || {};
  const demandas = Array.isArray(ea.demandas) ? ea.demandas : [];
  const partes: string[] = [];

  if (ea.es_jurisdiccion_voluntaria === "sí") {
    partes.push(`Este caso se tramita bajo jurisdicción voluntaria (${ea.expediente_juzgado_jv || "expediente no identificado"}, presentada ${ea.fecha_presentacion_jv || "en fecha no determinada"}).`);
  } else if (ea.es_jurisdiccion_voluntaria === "no") {
    partes.push("No se identificó jurisdicción voluntaria en los documentos.");
  }

  if (demandas.length === 0) {
    partes.push("No se detectaron demandas en los documentos revisados.");
  } else if (demandas.length === 1) {
    partes.push(`Hay 1 demanda: ${demandas[0].expediente_juzgado || "expediente no identificado"}, presentada ${demandas[0].fecha_presentacion || "en fecha no determinada"}${demandas[0].afecta_recuperacion_credito ? ` — afecta la recuperación: ${demandas[0].afecta_recuperacion_credito}` : ""}.`);
  } else {
    partes.push(`Se detectaron ${demandas.length} demandas distintas — revisa el aviso de abajo para elegir cuál usar como principal.`);
  }

  if (ea.ultima_actuacion?.fecha) {
    partes.push(`La última actuación registrada es del ${ea.ultima_actuacion.fecha}: se pidió "${ea.ultima_actuacion.que_se_pidio || "no especificado"}" y se resolvió "${ea.ultima_actuacion.que_se_resolvio || "no especificado"}".`);
  }
  if (ea.fecha_ultimo_pago_acreditado) partes.push(`Último pago del acreditado: ${ea.fecha_ultimo_pago_acreditado}.`);

  const recursos: string[] = [];
  if (rr.sentencia) recursos.push(`sentencia (${rr.sentencia})`);
  if (rr.apelacion) recursos.push(`apelación (${rr.apelacion})`);
  if (rr.amparo) recursos.push(`amparo (${rr.amparo})`);
  if (recursos.length) partes.push(`Recursos/resoluciones encontrados: ${recursos.join("; ")}.`);

  if (pr.esta_prescrita && pr.esta_prescrita !== "no determinado") {
    partes.push(`Prescripción: ${pr.esta_prescrita}${pr.motivo ? ` (${pr.motivo})` : ""}.`);
  }
  if (cv.notificados_firmados_ratificados && cv.notificados_firmados_ratificados !== "no aplica") {
    partes.push(`Convenios notificados/firmados/ratificados: ${cv.notificados_firmados_ratificados}. Estado de cuenta con firma del perito: ${cv.estado_cuenta_firma_perito || "no determinado"}.`);
  }

  return partes.join(" ");
}

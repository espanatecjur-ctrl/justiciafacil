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
  antecedenteId?: string;
  version?: number;
  cambios?: string;
  solicitudId?: string;
  antecedenteTerminado?: boolean;
}

const ETIQUETAS: Record<string, string> = {
  ubicacion: "Dirección / garantía", deudor: "Deudor", deCujus: "De cujus", expediente: "Expediente",
  juzgado: "Juzgado", estado: "Estado", valorComercial: "Valor comercial", suertePrincipal: "Suerte principal",
  interesMoratorio: "Interés moratorio", acreedor: "Acreedor", heredero: "Heredero", caso: "Caso sucesorio",
  anotaciones: "Anotaciones", anotacionesHumanas: "Anotaciones",
};

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

export interface PredictamenExistente {
  id: string; folio: string | null; posicion: string | null; caso_id: string | null; expediente: string | null;
  esBorrador?: boolean;
  datos?: any;
}

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

export async function buscarPredictamenVigenteCompleto(expediente?: string | null, casoId?: string | null): Promise<(PredictamenExistente & { datos?: any; version?: number; terminado?: boolean }) | null> {
  const conds: string[] = [];
  if (casoId) conds.push(`caso_id.eq.${casoId}`);
  if (expediente && expediente.trim()) conds.push(`expediente.eq.${encodeURIComponent(expediente.trim())}`);
  if (conds.length === 0) return null;
  const filtro = conds.length === 1 ? conds[0].replace(".eq.", "=eq.") : `or=(${conds.join(",")})`;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,folio,posicion,caso_id,expediente,datos,version,terminado&vigente=eq.true&en_papelera=eq.false&${filtro}&limit=1`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
  } catch { return null; }
}

const normRO = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export async function sincronizarSolicitud(
  solicitudId: string | undefined | null,
  campos: { numero_credito?: string; expediente?: string; caso_id?: string },
): Promise<void> {
  if (!solicitudId) return;
  const patch: Record<string, string> = {};
  if (campos.numero_credito?.trim()) patch.numero_credito = campos.numero_credito.trim();
  if (campos.expediente?.trim()) patch.expediente = campos.expediente.trim();
  if (campos.caso_id?.trim()) patch.caso_id = campos.caso_id.trim();
  if (Object.keys(patch).length === 0) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?id=eq.${solicitudId}`, {
      method: "PATCH", headers, body: JSON.stringify(patch),
    });
  } catch { /* se reintenta solo en la siguiente captura */ }
}

export async function adjuntarDocumentosAPredictamen(id: string, documentos: { nombre: string; url: string }[]): Promise<void> {
  if (!id || !documentos.length) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${id}&select=datos`, { headers });
    if (!res.ok) return;
    const rows = await res.json();
    const datosActuales = rows?.[0]?.datos || {};
    const previos: any[] = Array.isArray(datosActuales.documentos) ? datosActuales.documentos : [];
    const combinados = [...previos, ...documentos.filter((d) => !previos.some((p) => p.url === d.url))];
    await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ datos: { ...datosActuales, documentos: combinados } }),
    });
  } catch { /* si falla, los documentos igual quedan en la solicitud */ }
}

async function buscarBorradorExistentePorClave(numeroCredito?: string, expediente?: string): Promise<string | null> {
  const clave = (numeroCredito || "").trim() || (expediente || "").trim();
  if (!clave) return null;
  try {
    const filtro = numeroCredito
      ? `datos->>numeroCredito.eq.${encodeURIComponent(clave)}`
      : `expediente.eq.${encodeURIComponent(clave)}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id&${filtro}&posicion=is.null&vigente=eq.true&en_papelera=eq.false&order=created_at.desc&limit=1`, { headers });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.id ?? null;
  } catch { return null; }
}

export async function guardarBorrador(datos: {
  numeroCredito?: string; administradora?: string; direccion?: string; expediente?: string;
  deudor?: string; juzgado?: string; hallazgos?: string[];
  ultimaActuacion?: string; ultimaActuacionTexto?: string;
}): Promise<string | null> {
  const body = {
    posicion: null, tipo_juicio: null, expediente: datos.expediente || null,
    juzgado: datos.juzgado || null, estado: null, dictamen_sugerido: null, dictamen_final: null,
    datos: {
      numeroCredito: datos.numeroCredito || "", quienCede: datos.administradora || "", ubicacion: datos.direccion || "",
      deudor: datos.deudor || "", hallazgos: datos.hallazgos || [],
      ultimaActuacion: datos.ultimaActuacion || "", ultimaActuacionTexto: datos.ultimaActuacionTexto || "",
      borrador: true,
    },
    resultados: null, vigente: true, en_papelera: false, version: 1,
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen`, {
      method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (res.status === 409) {
        const idExistente = await buscarBorradorExistentePorClave(datos.numeroCredito, datos.expediente);
        if (idExistente) await actualizarBorrador(idExistente, datos);
        return idExistente;
      }
      return null;
    }
    const data = await res.json();
    return data?.[0]?.id ?? null;
  } catch { return null; }
}

export async function actualizarBorrador(id: string, cambios: {
  expediente?: string; deudor?: string; juzgado?: string; hallazgos?: string[];
  ultimaActuacion?: string; ultimaActuacionTexto?: string;
  numeroCredito?: string; administradora?: string; direccion?: string;
}): Promise<void> {
  if (!id) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${id}&select=datos`, { headers });
    if (!res.ok) return;
    const rows = await res.json();
    const datosActuales = rows?.[0]?.datos || {};
    const datosNuevos: any = { ...datosActuales, ...cambios };
    if (cambios.numeroCredito !== undefined) datosNuevos.numeroCredito = cambios.numeroCredito;
    if (cambios.administradora !== undefined) datosNuevos.quienCede = cambios.administradora;
    if (cambios.direccion !== undefined) datosNuevos.ubicacion = cambios.direccion;
    delete datosNuevos.administradora;
    delete datosNuevos.direccion;
    const patch: any = { datos: datosNuevos };
    if (cambios.expediente) patch.expediente = cambios.expediente;
    if (cambios.juzgado) patch.juzgado = cambios.juzgado;
    await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
  } catch { /* si falla, se queda solo en memoria — no es grave */ }
}

export async function guardarDatosBasicos(
  borradorIdActual: string | null,
  datos: {
    numeroCredito?: string; administradora?: string; direccion?: string; expediente?: string;
    deudor?: string; juzgado?: string; hallazgos?: string[];
    ultimaActuacion?: string; ultimaActuacionTexto?: string;
  },
  solicitudId?: string | null,
): Promise<{ ok: boolean; borradorId: string | null }> {
  let id = borradorIdActual;
  try {
    if (!id) {
      id = await guardarBorrador(datos);
    } else {
      await actualizarBorrador(id, datos);
    }
    await sincronizarSolicitud(solicitudId, { numero_credito: datos.numeroCredito, expediente: datos.expediente });
    return { ok: !!id, borradorId: id };
  } catch {
    return { ok: false, borradorId: id };
  }
}

export async function guardarProgreso(
  idActual: string | null,
  expediente: string | null | undefined,
  juzgado: string | null | undefined,
  datosCompletos: any,
): Promise<string | null> {
  try {
    if (!idActual) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          posicion: null, tipo_juicio: null, expediente: expediente || null, juzgado: juzgado || null,
          estado: null, dictamen_sugerido: null, dictamen_final: null,
          datos: { ...datosCompletos, borrador: true }, resultados: null, vigente: true, en_papelera: false, version: 1,
        }),
      });
      if (!res.ok) {
        if (res.status === 409) {
          const idExistente = await buscarBorradorExistentePorClave(datosCompletos?.numeroCredito, expediente || undefined);
          if (idExistente) {
            await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${idExistente}`, {
              method: "PATCH", headers, body: JSON.stringify({ datos: { ...datosCompletos, borrador: true } }),
            });
          }
          return idExistente;
        }
        return null;
      }
      const data = await res.json();
      return data?.[0]?.id ?? null;
    }
    const patch: any = { datos: { ...datosCompletos, borrador: true } };
    if (expediente) patch.expediente = expediente;
    if (juzgado) patch.juzgado = juzgado;
    await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${idActual}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
    return idActual;
  } catch { return idActual; }
}

export async function descartarBorrador(id?: string | null): Promise<void> {
  if (!id) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${id}`, {
      method: "PATCH", headers, body: JSON.stringify({ en_papelera: true, vigente: false }),
    });
  } catch { /* si falla, el borrador se puede limpiar después a mano */ }
}

export async function buscarPredictamenPorCredito(numeroCredito?: string | null): Promise<PredictamenExistente | null> {
  const cred = normRO(numeroCredito);
  if (!cred) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,folio,posicion,caso_id,expediente,datos&vigente=eq.true&en_papelera=eq.false&limit=1000`, { headers });
    if (!res.ok) return null;
    const rows: any[] = await res.json();
    const row = rows.find((x) => cred === normRO(x?.datos?.numeroCredito));
    return row ? { id: row.id, folio: row.folio, posicion: row.posicion, caso_id: row.caso_id, expediente: row.expediente, esBorrador: !!row?.datos?.borrador, datos: row?.datos } : null;
  } catch { return null; }
}
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

export interface PredictamenOpcion {
  id: string; caso_id: string | null; expediente: string | null; folio: string | null;
  cliente: string | null; juzgado: string | null; no_credito: string | null; direccion: string | null;
  borrador?: boolean;
}

export async function listarPredictamenesParaSelector(): Promise<PredictamenOpcion[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,folio,caso_id,expediente,juzgado,datos&vigente=eq.true&en_papelera=eq.false&order=created_at.desc&limit=500`, { headers });
    if (!res.ok) return [];
    const rows: any[] = await res.json();
    return rows.map((p) => ({
      id: p.id, caso_id: p.caso_id || null, expediente: p.expediente || null, folio: p.folio || null,
      cliente: p.datos?.deudor || p.datos?.deCujus || null, juzgado: p.juzgado || null,
      no_credito: p.datos?.numeroCredito || null, direccion: p.datos?.ubicacion || null,
      borrador: !!p.datos?.borrador,
    }));
  } catch { return []; }
}

export interface FilaCartera {
  estado?: string;
  cartera?: string;
  numeroCredito: string;
  deudor?: string;
  terreno?: number | string;
  construccion?: number | string;
  calle?: string;
  colonia?: string;
  ciudad?: string;
  estadoPropiedad?: string;
  cp?: string;
  gps?: string;
  adeudoInicial?: number | string;
  valorGarantia?: number | string;
  etapaProcesal?: string;
  creditoInfonavit?: number | string;
  saldoInfonavit?: number | string;
  minimo?: number | string;
  administradoraCodigo?: string;
}

export async function listarCreditosExistentes(): Promise<Set<string>> {
  const norm = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=datos&vigente=eq.true&en_papelera=eq.false&limit=5000`, { headers });
    if (!res.ok) return new Set();
    const rows: any[] = await res.json();
    return new Set(rows.map((r) => norm(r?.datos?.numeroCredito)).filter(Boolean));
  } catch { return new Set(); }
}

export async function crearBorradoresEnLote(filas: FilaCartera[]): Promise<{ ok: boolean; error?: string; creados: number }> {
  if (!filas.length) return { ok: true, creados: 0 };
  const cuerpo = filas.map((f) => ({
    posicion: null, tipo_juicio: null, expediente: null, juzgado: null,
    estado: f.estado || null, dictamen_sugerido: null, dictamen_final: null,
    datos: {
      numeroCredito: f.numeroCredito, cartera: f.cartera || "", deudor: f.deudor || "",
      terreno: f.terreno ?? null, construccion: f.construccion ?? null,
      calle: f.calle || "", colonia: f.colonia || "", ciudad: f.ciudad || "",
      estadoPropiedad: f.estadoPropiedad || "", cp: f.cp || "", gps: f.gps || "",
      ubicacion: [f.calle, f.colonia, f.ciudad, f.estadoPropiedad, f.cp].filter(Boolean).join(", "),
      adeudoInicial: f.adeudoInicial ?? null, valorGarantia: f.valorGarantia ?? null,
      etapaProcesal: f.etapaProcesal || "", creditoInfonavit: f.creditoInfonavit ?? null,
      saldoInfonavit: f.saldoInfonavit ?? null, minimo: f.minimo ?? null,
      administradoraCodigo: f.administradoraCodigo || "", borrador: true, origenImportacion: true,
    },
    resultados: null, vigente: true, en_papelera: false, version: 1,
  }));
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(cuerpo),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}`, creados: res.ok ? cuerpo.length : 0 };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e), creados: 0 };
  }
}

export async function guardarPredictamen(payload: any, precargar?: Precarga | null, datosPDF?: any, opts?: { reglaOroURRJ?: boolean }): Promise<string | null> {
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
  const terminado = !!payload.dictamen_final;
  const reusaMismaFila = !!precargar?.antecedenteId && !precargar?.antecedenteTerminado;

  let nuevoId: string | null = null;
  if (reusaMismaFila) {
    const body = { ...payload, vigente: true, terminado, cambios: cambiosTxt, pasa_a_ucp: /pasa a ucp/i.test(String(payload.dictamen_final || "")) };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${precargar!.antecedenteId}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const data = await res.json();
    nuevoId = data?.[0]?.id ?? precargar!.antecedenteId ?? null;
  } else {
    const body = { ...payload, version, vigente: true, terminado, antecedente_de: null, cambios: cambiosTxt, pasa_a_ucp: /pasa a ucp/i.test(String(payload.dictamen_final || "")) };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen`, {
      method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const data = await res.json();
    nuevoId = data?.[0]?.id ?? null;

    if (precargar?.antecedenteId && nuevoId) {
      await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${precargar.antecedenteId}`, {
        method: "PATCH", headers, body: JSON.stringify({ vigente: false, antecedente_de: nuevoId }),
      });
    }
  }
  try {
    if (payload.caso_id && payload.dictamen_final) {
      await reflejarDictamen({ id: payload.caso_id, expediente: payload.expediente } as any, "URRJ", "juridico", decisionADictamen(payload.dictamen_final), payload.solicitado_por || null);
    }
  } catch { /* la línea de vida no debe romper el guardado */ }

  await sincronizarSolicitud(precargar?.solicitudId, {
    numero_credito: payload?.datos?.numeroCredito,
    expediente: payload?.expediente,
    caso_id: payload?.caso_id,
  });

  if (precargar?.solicitudId && payload.dictamen_final) {
    const { actualizarEstadoSolicitud } = await import("@/lib/solicitud-predictamen");
    actualizarEstadoSolicitud(precargar.solicitudId, "terminado");
  }

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

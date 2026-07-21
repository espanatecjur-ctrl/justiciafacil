// ============================================================
// JusticiaFácil · Carpeta en Drive
// Llama a la Netlify Function /.netlify/functions/crear-carpeta
// que crea (o reutiliza) la ruta:  Área → "ROL · correo" → garantía
// ============================================================
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// "ROL · correo" del usuario que está usando la app (de la sesión + colaboradores)
async function quienSolicita(): Promise<string> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) return "SIN-SESION";
    let rol = "";
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers });
      const d = r.ok ? await r.json() : [];
      rol = d?.[0]?.rol || "";
    } catch { /* sin rol */ }
    return rol ? `${rol} · ${correo}` : correo;
  } catch {
    return "SIN-SESION";
  }
}

// Nombre de la carpeta de la garantía: folio (gar_id) y si no hay, expediente.
export function nombreGarantia(caso: { gar_id?: string | null; expediente?: string | null; id?: string }): string {
  const base = (caso.gar_id || caso.expediente || caso.id || "garantia").toString().trim();
  return base.replace(/[\\/]/g, "-"); // las diagonales no van en nombres de carpeta
}

export type ResultadoCarpeta = { ok: boolean; link?: string; carpetaId?: string; error?: string };

export async function crearCarpetaDrive(area: string, caso: CasoJuridico): Promise<ResultadoCarpeta> {
  const solicita = await quienSolicita();
  const garantia = nombreGarantia(caso);
  try {
    const r = await fetch("/.netlify/functions/crear-carpeta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, solicita, garantia }),
    });
    const data = await r.json();
    if (!data.ok) return { ok: false, error: data.error || "No se pudo crear la carpeta." };
    return { ok: true, link: data.link, carpetaId: data.carpetaId };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Verifica si la carpeta de la garantía YA existe en Drive (no la crea).
export async function verificarCarpeta(area: string, caso: CasoJuridico): Promise<{ existe: boolean; link?: string | null }> {
  const solicita = await quienSolicita();
  const garantia = nombreGarantia(caso);
  try {
    const r = await fetch("/.netlify/functions/crear-carpeta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, solicita, garantia, soloVerificar: true }),
    });
    const data = await r.json();
    if (!data.ok) return { existe: false };
    return { existe: !!data.existe, link: data.link };
  } catch {
    return { existe: false };
  }
}

// ===== Documentos de la garantía =====

export type DocumentoGarantia = {
  id: string;
  caso_id: string | null;
  expediente: string | null;
  nombre: string | null;
  link: string | null;
  drive_id: string | null;
  mime: string | null;
  tipo: string | null;       // actuacion | evidencia | tarea | otro
  subido_por: string | null; // "ROL · correo"
  created_at: string;
  // registro central de movimientos
  fecha_mov: string | null;
  nota: string | null;
  proxima_actuacion: string | null;
  fecha_proxima: string | null;
  asignado_a: string | null;
  fecha_limite: string | null;
  estado: string | null;
  en_papelera: boolean | null;
  papelera_fecha: string | null;
  etapa: string | null;       // a qué etapa del juicio pertenece
};

// convierte un File del navegador a base64 (sin el prefijo data:)
function archivoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || "");
      const coma = s.indexOf(",");
      resolve(coma >= 0 ? s.slice(coma + 1) : s);
    };
    fr.onerror = () => reject(new Error("No se pudo leer el archivo."));
    fr.readAsDataURL(file);
  });
}

export type ResultadoSubida = { ok: boolean; doc?: DocumentoGarantia; error?: string };

// Sube el archivo a Drive (carpeta de la garantía) y registra la fila en documento_garantia.
export async function subirDocumento(area: string, caso: CasoJuridico, file: File, tipo: string = "otro"): Promise<ResultadoSubida> {
  try {
    const solicita = await quienSolicita();
    const garantia = nombreGarantia(caso);
    const archivo = await archivoABase64(file);

    // 1) subir a Drive
    const r = await fetch("/.netlify/functions/subir-documento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, solicita, garantia, archivo, nombre: file.name, mime: file.type || "application/octet-stream", carpetaId: caso.drive_carpeta_id || undefined }),
    });
    const data = await r.json();
    if (!data.ok) return { ok: false, error: data.error || "No se pudo subir a Drive." };

    // 2) registrar en la base para listarlo en la ficha
    const fila = {
      caso_id: caso.id || null,
      expediente: caso.expediente || null,
      nombre: data.nombre || file.name,
      link: data.link,
      drive_id: data.id || null,
      mime: file.type || null,
      tipo,
      subido_por: solicita,
    };
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fila),
    });
    const filas = ins.ok ? await ins.json() : [];
    const doc: DocumentoGarantia = filas?.[0] || { id: data.id, created_at: new Date().toISOString(), ...fila } as DocumentoGarantia;
    return { ok: true, doc };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Lista los movimientos de un expediente (más recientes primero, sin papelera).
export async function listarDocumentos(caso: CasoJuridico): Promise<DocumentoGarantia[]> {
  try {
    const filtro = caso.id
      ? `caso_id=eq.${caso.id}`
      : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=*&${filtro}&en_papelera=eq.false&order=created_at.desc`, { headers });
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

// Borra el registro de la base (no borra el archivo de Drive).
export async function borrarDocumento(id: string): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${id}`, { method: "DELETE", headers });
    return r.ok;
  } catch {
    return false;
  }
}

// ===== Movimiento (registro central: actuación / evidencia / tarea / documento) =====

export type DatosMovimiento = {
  tipo: string;                 // actuacion | evidencia | tarea | otro
  fecha_mov?: string | null;    // fecha del movimiento
  nota?: string | null;
  proxima_actuacion?: string | null;
  fecha_proxima?: string | null;
  asignado_a?: string | null;
  fecha_limite?: string | null;
  estado?: string | null;       // tarea: pendiente / hecha
  etapa?: string | null;        // a qué etapa del juicio pertenece
};

// Guarda un movimiento. Si trae archivo, lo sube a Drive primero.
export async function guardarMovimiento(
  area: string,
  caso: CasoJuridico,
  datos: DatosMovimiento,
  file?: File | null
): Promise<ResultadoSubida> {
  try {
    const solicita = await quienSolicita();

    // 1) si hay archivo, súbelo a Drive
    let archivoInfo: { nombre: string; link: string; drive_id: string | null; mime: string | null } | null = null;
    if (file) {
      const garantia = nombreGarantia(caso);
      const archivo = await archivoABase64(file);
      const r = await fetch("/.netlify/functions/subir-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, solicita, garantia, archivo, nombre: file.name, mime: file.type || "application/octet-stream", carpetaId: caso.drive_carpeta_id || undefined }),
      });
      const data = await r.json();
      if (!data.ok) return { ok: false, error: data.error || "No se pudo subir a Drive." };
      archivoInfo = { nombre: data.nombre || file.name, link: data.link, drive_id: data.id || null, mime: file.type || null };
    }

    // 2) registrar la fila (registro central)
    const fila: any = {
      caso_id: caso.id || null,
      expediente: caso.expediente || null,
      tipo: datos.tipo || "otro",
      subido_por: solicita,
      fecha_mov: datos.fecha_mov || null,
      nota: datos.nota || null,
      proxima_actuacion: datos.proxima_actuacion || null,
      fecha_proxima: datos.fecha_proxima || null,
      asignado_a: datos.asignado_a || null,
      fecha_limite: datos.fecha_limite || null,
      estado: datos.estado || (datos.tipo === "tarea" ? "pendiente" : null),
      etapa: datos.etapa || null,
      en_papelera: false,
      nombre: archivoInfo?.nombre || null,
      link: archivoInfo?.link || null,
      drive_id: archivoInfo?.drive_id || null,
      mime: archivoInfo?.mime || null,
    };
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fila),
    });
    if (!ins.ok) return { ok: false, error: "No se pudo guardar el movimiento (" + ins.status + ")." };
    const filas = await ins.json();
    return { ok: true, doc: filas?.[0] as DocumentoGarantia };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Edita un movimiento existente.
export async function editarMovimiento(id: string, cambios: Partial<DatosMovimiento>): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Manda a la papelera (no borra) / restaura.
export async function moverPapelera(id: string, aPapelera: boolean): Promise<boolean> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ en_papelera: aPapelera, papelera_fecha: aPapelera ? new Date().toISOString() : null }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ===== Traslado: de la Solicitud (bucket temporal) → Drive real + ficha =====

// Descarga un archivo desde una URL pública (ej. bucket temporal de la
// solicitud) y lo convierte a base64, listo para mandarlo a la función que
// sube a Drive (misma que usa subirDocumento).
async function urlABase64(url: string): Promise<{ base64: string; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar el documento (${r.status}).`);
  const blob = await r.blob();
  const mime = blob.type || "application/octet-stream";
  const base64 = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = String(fr.result || "");
      const coma = s.indexOf(",");
      resolve(coma >= 0 ? s.slice(coma + 1) : s);
    };
    fr.onerror = () => reject(new Error("No se pudo leer el documento descargado."));
    fr.readAsDataURL(blob);
  });
  return { base64, mime };
}

export type DocResumenIA = { nombre: string; tipo?: string; resumen?: string };

export type ResultadoTraslado = {
  ok: boolean;
  trasladados: number;
  saltados: number;
  errores: string[];
};

/**
 * Traslada documentos que llegaron por la Solicitud (bucket temporal
 * `predictamen-docs`) a la carpeta REAL de Drive de la garantía, y los
 * registra en `documento_garantia` (la misma tabla que alimenta la pestaña
 * "Documentos" de la ficha formal). Se nombran "{numeroCredito}-{area}-{nombre
 * original}". Si el documento ya tenía análisis de IA hecho en Solicitudes,
 * se copia como nota — así no se pierde el trabajo ya hecho. No repite
 * documentos que ya se hayan trasladado antes (se detecta por nombre final).
 */
export async function trasladarDocumentosSolicitud(
  area: string,
  caso: CasoJuridico,
  numeroCredito: string,
  documentos: { nombre: string; url: string }[],
  resumenes: DocResumenIA[] = [],
): Promise<ResultadoTraslado> {
  const resultado: ResultadoTraslado = { ok: true, trasladados: 0, saltados: 0, errores: [] };
  if (!documentos.length) return resultado;
  if (!caso.id && !caso.expediente) {
    resultado.ok = false;
    resultado.errores.push("Este caso todavía no tiene expediente ni id — falta formalizarlo antes de trasladar documentos.");
    return resultado;
  }

  // 1) qué ya existe en la ficha, para no duplicar si se corre dos veces.
  const existentes = await listarDocumentos(caso);
  const nombresExistentes = new Set(existentes.map((d) => (d.nombre || "").trim().toLowerCase()));

  const solicita = await quienSolicita();
  const garantia = nombreGarantia(caso);
  const prefijo = (numeroCredito || garantia || "SIN-CREDITO").toString().trim();

  for (const doc of documentos) {
    const nombreFinal = `${prefijo}-${area}-${doc.nombre}`.replace(/\s+/g, " ").trim();
    if (nombresExistentes.has(nombreFinal.toLowerCase())) { resultado.saltados++; continue; }
    try {
      const { base64, mime } = await urlABase64(doc.url);
      const r = await fetch("/.netlify/functions/subir-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, solicita, garantia, archivo: base64, nombre: nombreFinal, mime, carpetaId: caso.drive_carpeta_id || undefined }),
      });
      const data = await r.json();
      if (!data.ok) { resultado.errores.push(`${doc.nombre}: ${data.error || "no se pudo subir a Drive."}`); continue; }

      const resumen = resumenes.find((x) => x.nombre === doc.nombre);
      const nota = resumen?.resumen
        ? `IA: ${resumen.tipo ? resumen.tipo + " — " : ""}${resumen.resumen}`
        : "Trasladado desde la solicitud de pre-dictamen.";

      const fila = {
        caso_id: caso.id || null,
        expediente: caso.expediente || null,
        nombre: data.nombre || nombreFinal,
        link: data.link,
        drive_id: data.id || null,
        mime,
        tipo: "otro",
        subido_por: solicita,
        nota,
      };
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(fila),
      });
      if (!ins.ok) { resultado.errores.push(`${doc.nombre}: se subió a Drive pero no se pudo registrar en la ficha.`); continue; }
      resultado.trasladados++;
    } catch (e: any) {
      resultado.errores.push(`${doc.nombre}: ${String(e?.message || e)}`);
    }
  }
  resultado.ok = resultado.errores.length === 0;
  return resultado;
}

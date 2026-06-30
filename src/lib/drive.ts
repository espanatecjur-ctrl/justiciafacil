// JusticiaFácil · Carpeta y Documentos en Drive
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

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

export function nombreGarantia(caso: { gar_id?: string | null; expediente?: string | null; id?: string }): string {
  const base = (caso.gar_id || caso.expediente || caso.id || "garantia").toString().trim();
  return base.replace(/[\\/]/g, "-");
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

// ===== Documentos de la garantía =====

export type DocumentoGarantia = {
  id: string;
  caso_id: string | null;
  expediente: string | null;
  nombre: string;
  link: string;
  drive_id: string | null;
  mime: string | null;
  tipo: string | null;       // actuacion | evidencia | tarea | otro
  subido_por: string | null; // "ROL · correo"
  created_at: string;
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
      body: JSON.stringify({ area, solicita, garantia, archivo, nombre: file.name, mime: file.type || "application/octet-stream" }),
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

// Lista los documentos de un expediente (más recientes primero).
export async function listarDocumentos(caso: CasoJuridico): Promise<DocumentoGarantia[]> {
  try {
    const filtro = caso.id
      ? `caso_id=eq.${caso.id}`
      : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=*&${filtro}&order=created_at.desc`, { headers });
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

// ============================================================
//  Dirección · Fase B (cuentas, carta y contabilidad)
// ------------------------------------------------------------
//  Reusa el envío por Gmail. Requiere las tablas `fase_b` y
//  `correo_contabilidad` y el bucket `predictamen-docs`.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

/** Lee un archivo del disco y lo deja listo para adjuntar al correo. */
export function archivoABase64(file: File): Promise<{ nombre: string; tipo: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result);
      const base64 = res.includes(",") ? res.split(",")[1] : res;
      resolve({ nombre: file.name, tipo: file.type || "application/octet-stream", base64 });
    };
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

/** Descarga un archivo por URL y lo deja en base64 para adjuntarlo. */
export async function urlABase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve(s.includes(",") ? s.split(",")[1] : s); };
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(blob);
  });
}

/** Sube la carta al almacén y devuelve su URL. */
export async function subirCarta(file: File): Promise<{ url: string; nombre: string }> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `carta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/predictamen-docs/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`No se pudo subir (${res.status}).`);
  return { url: `${SUPABASE_URL}/storage/v1/object/public/predictamen-docs/${path}`, nombre: file.name };
}

export interface FaseB {
  id?: string;
  caso_id?: string | null;
  expediente?: string | null;
  cliente?: string | null;
  banco?: string | null;
  clabe?: string | null;
  titular?: string | null;
  carta_url?: string | null;
  carta_nombre?: string | null;
  estado?: string | null;
}

/** Trae (o crea) la Fase B de un expediente. */
export async function obtenerFaseB(casoId: string, expediente: string | null, cliente: string | null): Promise<FaseB | null> {
  try {
    const filas = await sbSelect<FaseB>("fase_b", `select=*&caso_id=eq.${encodeURIComponent(casoId)}&order=created_at.desc&limit=1`);
    if (filas[0]) return filas[0];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fase_b`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ caso_id: casoId, expediente, cliente, estado: "solicitado" }),
    });
    const data = res.ok ? await res.json() : [];
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function guardarDatosFaseB(id: string, cambios: Partial<FaseB>): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fase_b?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(cambios),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function marcarEnviadoContabilidad(id: string): Promise<boolean> {
  return guardarDatosFaseB(id, { estado: "enviado" } as Partial<FaseB> & Record<string, unknown>);
}

// ————————————————————— Correos de contabilidad —————————————————————
export interface CorreoCont { id?: string; correo: string; tipo: string }

export async function listarCorreosContabilidad(): Promise<CorreoCont[]> {
  try {
    return await sbSelect<CorreoCont>("correo_contabilidad", "select=*&order=created_at.asc");
  } catch {
    return [];
  }
}

export async function agregarCorreoContabilidad(correo: string, tipo: "para" | "cco"): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/correo_contabilidad`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ correo, tipo }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function eliminarCorreoContabilidad(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/correo_contabilidad?id=eq.${id}`, { method: "DELETE", headers });
    return res.ok;
  } catch {
    return false;
  }
}

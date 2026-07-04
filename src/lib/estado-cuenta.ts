// ============================================================
//  Registro de estados de cuenta (Liquidación de Intereses)
//  Requiere la tabla `estado_cuenta` y el bucket `predictamen-docs`.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY, sbSelect } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface EstadoCuenta {
  id?: string;
  folio?: string | null;
  expediente?: string | null;
  acreditado?: string | null;
  metodo?: string | null;
  deuda_total?: number | null;
  fecha_corte?: string | null;
  datos?: Record<string, unknown> | null;
  perito_nombre?: string | null;
  perito_cedula_url?: string | null;
  perito_doc_url?: string | null;
  estado?: string | null;
  creado_por?: string | null;
  created_at?: string | null;
}

/** Sube un archivo (cédula o documento) y devuelve su URL pública. */
export async function subirArchivoEC(file: File, prefijo = "ec"): Promise<{ url: string; nombre: string }> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/predictamen-docs/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`No se pudo subir (${res.status}).`);
  return { url: `${SUPABASE_URL}/storage/v1/object/public/predictamen-docs/${path}`, nombre: file.name };
}

export async function listarEstadosCuenta(estado = "guardado"): Promise<EstadoCuenta[]> {
  try {
    return await sbSelect<EstadoCuenta>("estado_cuenta", `select=*&estado=eq.${estado}&order=created_at.desc`);
  } catch {
    return [];
  }
}

export async function crearEstadoCuenta(d: Omit<EstadoCuenta, "id" | "created_at">): Promise<{ ok: boolean; error?: string }> {
  try {
    const folio = d.folio || `EC-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/estado_cuenta`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ ...d, folio, estado: "guardado" }),
    });
    return { ok: res.ok, error: res.ok ? undefined : `Supabase ${res.status}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

export async function actualizarEstadoCuenta(id: string, cambios: Partial<EstadoCuenta>): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/estado_cuenta?id=eq.${id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(cambios),
    });
    return res.ok;
  } catch {
    return false;
  }
}

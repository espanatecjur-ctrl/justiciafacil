// ============================================================
// JusticiaFácil · Solicitudes de firma (compartido entre URRJ y UCP/UCM)
// ------------------------------------------------------------
// Antes esto vivía SOLO dentro de seccion-final.tsx (UCP). Se saca a un
// lugar compartido para que URRJ también pueda "Mandar a validar" con el
// mismo mecanismo (link por correo + aparece en "Mis validaciones" si la
// persona tiene usuario).
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { enviarGmail } from "@/lib/enviar-gmail";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export type Area = "URRJ" | "UCP" | "UCM";

export interface CrearSolicitudInput {
  area: Area;
  predictamenId?: string;   // URRJ (tabla predictamen)
  dictamenId?: string;      // UCP/UCM (tabla dictamen)
  casoId: string;
  slot: string;             // "elabora" | "dil" | "ucm" | "gad" | "dgc" | "dge"
  correoEsperado: string;
  tituloSlot: string;       // para el asunto/cuerpo del correo
  expedienteTexto: string;  // para el asunto/cuerpo del correo
}

/** Correo del colaborador dueño de un rol (para autocompletar el destinatario). */
export async function correoDeRol(rol: string): Promise<string> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=correo&rol=eq.${encodeURIComponent(rol)}&limit=1`, { headers });
    const rows = r.ok ? await r.json() : [];
    return rows?.[0]?.correo || "";
  } catch { return ""; }
}

/** Crea el link único de firma (token) y, si se puede, manda el correo por Gmail de una vez.
 *  Si Gmail falla, regresa el link para copiar/mandar a mano (mailto:). */
export async function crearYEnviarSolicitudFirma(input: CrearSolicitudInput): Promise<{ ok: boolean; link?: string; enviado?: boolean; error?: string }> {
  try {
    const body: any = {
      caso_id: input.casoId, slot: input.slot, correo_esperado: input.correoEsperado, area: input.area,
    };
    if (input.predictamenId) body.predictamen_id = input.predictamenId;
    if (input.dictamenId) body.dictamen_id = input.dictamenId;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/firma_solicitud`, {
      method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `Supabase ${res.status}` };
    const row = (await res.json())?.[0];
    const link = `${window.location.origin}/firmar?token=${row.token}`;
    const asunto = `Firma/validación requerida · ${input.expedienteTexto} · ${input.tituloSlot}`;
    const cuerpo = `Hola,\n\nSe requiere tu firma/validación (${input.tituloSlot}) en el dictamen de ${input.expedienteTexto}.\n\nEntra a este link con tu cuenta de DIIPA para revisar los documentos, el PDF, y firmar o rechazar:\n${link}\n\nSi tienes usuario en JusticiaFácil, también lo vas a ver en "Mis validaciones" al entrar.\n\nGracias.`;
    let enviado = false;
    if (input.correoEsperado) {
      const r = await enviarGmail(input.correoEsperado, asunto, cuerpo);
      enviado = r.ok;
      if (!r.ok) window.location.href = `mailto:${input.correoEsperado}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    }
    return { ok: true, link, enviado };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export interface ValidacionPendiente {
  token: string;
  area: Area | string;
  slot: string;
  caso_id: string;
  predictamen_id: string | null;
  dictamen_id: string | null;
  created_at: string;
  expediente?: string | null;
  direccion_garantia?: string | null;
  cliente_nombre?: string | null;
}

/** Todo lo que le falta firmar/validar a ESTE correo — para "Mis validaciones" en Inicio.
 *  Cruza con caso_juridico para traer expediente/dirección/cliente de una vez. */
export async function misValidacionesPendientes(correo: string): Promise<ValidacionPendiente[]> {
  if (!correo) return [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/firma_solicitud?select=token,area,slot,caso_id,predictamen_id,dictamen_id,created_at&correo_esperado=eq.${encodeURIComponent(correo)}&firmado=eq.false&rechazado=eq.false&order=created_at.desc&limit=50`,
      { headers },
    );
    const filas: ValidacionPendiente[] = r.ok ? await r.json() : [];
    if (!filas.length) return filas;
    const casoIds = Array.from(new Set(filas.map((f) => f.caso_id).filter(Boolean)));
    if (!casoIds.length) return filas;
    const cr = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,direccion_garantia,cliente_nombre&id=in.(${casoIds.join(",")})`, { headers });
    const casos = cr.ok ? await cr.json() : [];
    const mapa: Record<string, any> = {};
    for (const c of casos) mapa[c.id] = c;
    return filas.map((f) => ({ ...f, ...(mapa[f.caso_id] ? { expediente: mapa[f.caso_id].expediente, direccion_garantia: mapa[f.caso_id].direccion_garantia, cliente_nombre: mapa[f.caso_id].cliente_nombre } : {}) }));
  } catch { return []; }
}

/** Marca una solicitud como rechazada (para el flujo de "se regresa" cuando algo sale negativo). */
export async function rechazarSolicitud(token: string, motivo: string, correo: string | null): Promise<{ ok: boolean }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/firma_solicitud?token=eq.${encodeURIComponent(token)}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ rechazado: true, rechazado_motivo: motivo, rechazado_at: new Date().toISOString(), firmado_por: correo }),
    });
    return { ok: r.ok };
  } catch { return { ok: false }; }
}

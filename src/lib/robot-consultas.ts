// ============================================================
//  Consultas al robot (estilo Búho): cédula, CURP, RFC.
//  Reusa la misma base del robot que ya usa el sistema.
//  El robot debe exponer los endpoints:
//    GET /cedula?numero=...   ó  /cedula?nombre=...
//    GET /curp?curp=...       ó  /curp?nombre=&apellidoP=&apellidoM=&fecha=&sexo=&estado=
//    GET /rfc?nombre=&apellidoP=&apellidoM=&fecha=...
//  Devuelve { ok, data } o un mensaje claro si el endpoint aún no existe.
// ============================================================
import { ROBOT } from "@/lib/jalisco-juzgados";

export type TipoConsulta = "cedula" | "curp" | "rfc";

export async function consultarRobot(
  tipo: TipoConsulta,
  params: Record<string, string>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v && v.trim())),
    ).toString();
    const res = await fetch(`${ROBOT}/${tipo}?${qs}`);
    if (res.status === 404) {
      return { ok: false, error: `El robot aún no tiene el endpoint /${tipo}. Pídele a Jhon que lo agregue.` };
    }
    if (!res.ok) return { ok: false, error: `El robot respondió ${res.status}.` };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: "No se pudo conectar con el robot: " + String((e as Error)?.message || e) };
  }
}

// Portales oficiales (respaldo / referencia)
export const PORTAL_OFICIAL: Record<TipoConsulta, string> = {
  cedula: "https://www.cedulaprofesional.sep.gob.mx/cedula/",
  curp: "https://www.gob.mx/curp/",
  rfc: "https://www.sat.gob.mx/aplicacion/login/43824/consulta-tu-informacion-fiscal",
};

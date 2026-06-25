// Conexión SOLO para el login (puerta de Google que ya usa JurisConecta).
// Los DATOS de JusticiaFácil siguen saliendo de su propia base (supabase.ts).
import { createClient } from "@supabase/supabase-js";

const AUTH_URL = "https://xzvtgjtumvwftulqxiao.supabase.co";
const AUTH_KEY = "sb_publishable_AGnhscb_RlHSwXVtv1Gfow_xN6mxG9A";

export const auth = createClient(AUTH_URL, AUTH_KEY);

// Solo se permite este dominio de correo:
export const DOMINIO_PERMITIDO = "diipadesarrollos.com";

export function correoPermitido(email?: string | null) {
  return !!email && email.toLowerCase().endsWith("@" + DOMINIO_PERMITIDO);
}

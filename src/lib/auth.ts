const AUTH_URL = "https://xzvtgjtumvwftulqxiao.supabase.co";
const AUTH_KEY = "sb_publishable_AGnhscb_RlHSwXVtv1Gfow_xN6mxG9A";

export const DOMINIO_PERMITIDO = "diipadesarrollos.com";

export function correoPermitido(email?: string | null) {
  return !!email && email.toLowerCase().endsWith("@" + DOMINIO_PERMITIDO);
}

let _client: any = null;
export async function getAuth() {
  if (_client) return _client;
  const url = "https://esm.sh/@supabase/supabase-js@2";
  const mod: any = await import(/* @vite-ignore */ url);
  _client = mod.createClient(AUTH_URL, AUTH_KEY);
  return _client;
}

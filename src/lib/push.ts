// ============================================================
//  Notificaciones push (Web Push / VAPID) — avisan aunque la
//  app esté cerrada, con vibración fuerte para lo importante.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// La llave PÚBLICA puede ir aquí (no es secreta). La privada vive en el servidor (Netlify env).
export const VAPID_PUBLIC = "BGbC2mWLl7l1-vWYfCVPVPtQDV8JyMgyc-1TG8IgZhy4De6t2l4jpSOu4hPLDr0qhwH9-3ZkeUVX7C_tEicw0Tc";

export function pushSoportado(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function permisoActual(): NotificationPermission | "no-soportado" {
  if (!pushSoportado()) return "no-soportado";
  return Notification.permission;
}

function base64ToUint8(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Pide permiso, suscribe el navegador y guarda el "buzón" en Supabase. */
export async function activarNotificaciones(nombre: string, correo?: string): Promise<{ ok: boolean; msg: string }> {
  if (!pushSoportado()) return { ok: false, msg: "Este navegador no soporta notificaciones." };
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== "granted") return { ok: false, msg: "No diste permiso de notificaciones." };
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8(VAPID_PUBLIC) as BufferSource,
      });
    }
    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh || "";
    const auth = json.keys?.auth || "";
    if (!endpoint || !p256dh || !auth) return { ok: false, msg: "No se pudo crear la suscripción." };
    const fila: Record<string, string> = { nombre, endpoint, p256dh, auth };
    if (correo && correo.trim()) fila.correo = correo.trim().toLowerCase();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subs?on_conflict=endpoint`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(fila),
    });
    if (!res.ok) return { ok: false, msg: "No se pudo guardar la suscripción." };
    return { ok: true, msg: "¡Notificaciones activadas! Te avisaremos aunque la app esté cerrada." };
  } catch (e: any) {
    return { ok: false, msg: "Error: " + (e?.message || "desconocido") };
  }
}

export async function desactivarNotificaciones(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${SUPABASE_URL}/rest/v1/push_subs?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
        method: "DELETE", headers: { ...headers, Prefer: "return=minimal" },
      }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* no-op */ }
}

/** ¿Ya está suscrito este navegador? (para no mostrar el botón "Activar" de más) */
export async function yaEstaSuscrito(): Promise<boolean> {
  if (!pushSoportado()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

/** Manda la notificación push (fire-and-forget — si falla, no rompe nada). */
export function enviarPush(correo: string, titulo: string, cuerpo: string, url?: string, importante = false): void {
  if (!correo) return;
  fetch("/.netlify/functions/notificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, titulo, cuerpo, url, importante }),
  }).catch(() => {});
}

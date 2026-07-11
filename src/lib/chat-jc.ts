// ============================================================
// JusticiaFácil · Chat interno (Parte 1: texto + archivos + grupos + directos)
// ------------------------------------------------------------
// El chat VIVE en el Supabase de JurisConecta (chat_canales,
// chat_mensajes, chat_perfiles, chat_miembros, lecturas_chat,
// bucket chat-archivos). JusticiaFácil lee/escribe ahí mismo por
// REST, así que un mismo canal se ve idéntico desde los dos
// sistemas — no hay nada que sincronizar.
// Actualización casi en vivo por sondeo cada 3s (igual que el
// respaldo que ya usa JurisConecta), sin agregar librerías nuevas.
// ============================================================
import { JC_URL, jcHeaders } from "@/lib/juris-clientes";

export type Canal = {
  id: string; nombre: string; area: string; color: string; emoji: string;
  foto_url: string | null; tipo: string; dm_a: string | null; dm_b: string | null; orden: number;
};
export type Mensaje = {
  id: string; canal_id: string; autor_nombre: string; autor_area: string | null;
  texto: string | null; archivo_url: string | null; archivo_tipo: string | null;
  archivo_nombre: string | null; created_at: string; eliminado?: boolean;
};
export type UltimoMsg = { canal_id: string; texto: string | null; archivo_tipo: string | null; autor_nombre: string; created_at: string };

const slug = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const GROSERIAS = ["pendejo", "pendeja", "puto", "puta", "mierda", "cabron", "cabrón", "chinga", "chingada", "verga", "culero", "pinche", "imbecil", "imbécil"];
export function limpiarGroserias(texto: string): string {
  let limpio = texto;
  for (const p of GROSERIAS) limpio = limpio.replace(new RegExp(`\\b${p}\\w*\\b`, "gi"), (m) => "*".repeat(m.length));
  return limpio;
}

async function jcGet<T>(path: string): Promise<T> {
  const r = await fetch(`${JC_URL}/rest/v1/${path}`, { headers: jcHeaders });
  if (!r.ok) throw new Error(`JurisConecta ${r.status}`);
  return r.json();
}

// ===== Canales (grupos + directos) =====
export async function fetchCanales(): Promise<Canal[]> {
  try { return await jcGet<Canal[]>("chat_canales?select=*&order=orden.asc"); } catch { return []; }
}

export async function crearCanal(p: { nombre: string; emoji: string; color: string }): Promise<Canal | null> {
  const area = `${slug(p.nombre) || "grupo"}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    const r = await fetch(`${JC_URL}/rest/v1/chat_canales`, {
      method: "POST", headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ nombre: p.nombre, area, emoji: p.emoji || "💬", color: p.color || "#64748B", orden: 100, tipo: "grupo" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0] || null;
  } catch { return null; }
}

async function correoCanonico(idStr: string): Promise<string> {
  const x = (idStr || "").trim();
  if (!x) return "";
  if (x.includes("@")) return x.toLowerCase();
  try {
    const porNombre = await jcGet<any[]>(`colaboradores?select=correo&nombre=eq.${encodeURIComponent(x)}&limit=1`);
    if (porNombre?.[0]?.correo) return String(porNombre[0].correo).toLowerCase();
    const porPrefijo = await jcGet<any[]>(`colaboradores?select=correo&correo=ilike.${encodeURIComponent(x)}@*&limit=1`);
    if (porPrefijo?.[0]?.correo) return String(porPrefijo[0].correo).toLowerCase();
  } catch { /* sigue con el texto tal cual */ }
  return x.toLowerCase();
}

/** Busca o crea el chat directo (1 a 1); misma llave (por correo) que usa JurisConecta, así ambos caen en el mismo canal. */
export async function buscarOCrearDirecto(yoCorreo: string, yoNombre: string, otroCorreo: string, otroNombre: string): Promise<Canal | null> {
  const correoA = await correoCanonico(yoCorreo || yoNombre);
  const correoB = await correoCanonico(otroCorreo || otroNombre);
  const key = "dm_" + [correoA, correoB].map(slug).sort().join("__");
  try {
    const existentes = await jcGet<Canal[]>(`chat_canales?select=*&area=eq.${encodeURIComponent(key)}&limit=1`);
    if (existentes?.[0]) return existentes[0];
    const par = [yoNombre, otroNombre].sort();
    const r = await fetch(`${JC_URL}/rest/v1/chat_canales`, {
      method: "POST", headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ nombre: otroNombre, area: key, emoji: "👤", color: "#1E50A0", orden: 0, tipo: "directo", dm_a: par[0], dm_b: par[1] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0] || null;
  } catch { return null; }
}

export async function fetchUltimosMensajes(): Promise<Record<string, UltimoMsg>> {
  try {
    const d = await jcGet<UltimoMsg[]>("chat_ultimo_mensaje?select=*");
    const mapa: Record<string, UltimoMsg> = {};
    for (const r of d) mapa[r.canal_id] = r;
    return mapa;
  } catch { return {}; }
}

// ===== Mensajes =====
export async function fetchMensajes(canalId: string): Promise<Mensaje[]> {
  try {
    const d = await jcGet<Mensaje[]>(`chat_mensajes?select=*&canal_id=eq.${canalId}&order=created_at.asc`);
    return d.filter((m) => !m.eliminado);
  } catch { return []; }
}

export async function enviarMensaje(p: {
  canalId: string; autorNombre: string; autorArea?: string | null;
  texto?: string; archivoUrl?: string | null; archivoTipo?: string | null; archivoNombre?: string | null;
}): Promise<Mensaje | null> {
  const textoLimpio = limpiarGroserias((p.texto || "").trim());
  if (!textoLimpio && !p.archivoUrl) return null;
  try {
    const r = await fetch(`${JC_URL}/rest/v1/chat_mensajes`, {
      method: "POST", headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        canal_id: p.canalId, autor_nombre: p.autorNombre, autor_area: p.autorArea ?? null,
        texto: textoLimpio || null, archivo_url: p.archivoUrl ?? null, archivo_tipo: p.archivoTipo ?? null, archivo_nombre: p.archivoNombre ?? null,
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0] || null;
  } catch { return null; }
}

export async function eliminarMensaje(id: string, valor: boolean): Promise<boolean> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/chat_mensajes?id=eq.${id}`, {
      method: "PATCH", headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ eliminado: valor }),
    });
    return r.ok;
  } catch { return false; }
}

/** Sube un archivo/imagen al bucket compartido "chat-archivos" (Storage REST, sin librerías). */
export async function subirArchivoChat(file: File): Promise<{ url: string; tipo: string; nombre: string } | null> {
  const ext = file.name.split(".").pop() || "bin";
  const ruta = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    const r = await fetch(`${JC_URL}/storage/v1/object/chat-archivos/${ruta}`, {
      method: "POST",
      headers: { ...jcHeaders, "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!r.ok) return null;
    const url = `${JC_URL}/storage/v1/object/public/chat-archivos/${ruta}`;
    let tipo = "archivo";
    if (file.type.startsWith("image/")) tipo = "imagen";
    else if (file.type === "application/pdf") tipo = "pdf";
    return { url, tipo, nombre: file.name };
  } catch { return null; }
}

/** Sondeo cada 3s (misma técnica de respaldo que ya usa JurisConecta) — sin WebSockets, sin librerías nuevas. */
export function suscribirCanalPolling(canalId: string, onNuevo: (m: Mensaje) => void): () => void {
  let ultimaFecha: string | null = null;
  let activo = true;
  async function revisar() {
    if (!activo) return;
    try {
      const d = await jcGet<Mensaje[]>(`chat_mensajes?select=*&canal_id=eq.${canalId}&order=created_at.asc`);
      if (!activo) return;
      if (ultimaFecha !== null) for (const m of d) { if (!m.eliminado && m.created_at > ultimaFecha) onNuevo(m); }
      if (d.length) ultimaFecha = d[d.length - 1].created_at;
    } catch { /* se reintenta en el siguiente tick */ }
  }
  revisar();
  const reloj = setInterval(revisar, 3000);
  return () => { activo = false; clearInterval(reloj); };
}

// ===== Lecturas (no leídos) =====
const normU = (s: string) => (s || "").trim().toLowerCase();

export async function marcarLeidoServidor(canalId: string, usuarioNombre: string): Promise<void> {
  const usuario = normU(usuarioNombre);
  if (!usuario || !canalId) return;
  try {
    await fetch(`${JC_URL}/rest/v1/lecturas_chat`, {
      method: "POST", headers: { ...jcHeaders, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ canal_id: canalId, usuario, leido_hasta: new Date().toISOString() }),
    });
  } catch { /* silencioso: no debe romper el chat */ }
}

export async function fetchConteosNoLeidos(yoNombre: string): Promise<Record<string, number>> {
  const yo = normU(yoNombre);
  try {
    const [msgs, lec] = await Promise.all([
      jcGet<any[]>("chat_mensajes?select=canal_id,created_at,autor_nombre&order=created_at.desc&limit=1000"),
      jcGet<any[]>(`lecturas_chat?select=canal_id,leido_hasta&usuario=eq.${encodeURIComponent(yo)}`),
    ]);
    const leido = new Map<string, number>();
    for (const r of lec) leido.set(String(r.canal_id), new Date(r.leido_hasta).getTime());
    const out: Record<string, number> = {};
    for (const m of msgs) {
      if (normU(m.autor_nombre) === yo) continue;
      const lh = leido.get(String(m.canal_id));
      if (lh == null || new Date(m.created_at).getTime() > lh) out[String(m.canal_id)] = (out[String(m.canal_id)] || 0) + 1;
    }
    return out;
  } catch { return {}; }
}

// ===== Perfiles (fotos) =====
export async function fetchPerfiles(): Promise<Record<string, string>> {
  try {
    const d = await jcGet<any[]>("chat_perfiles?select=nombre,foto_url");
    const mapa: Record<string, string> = {};
    for (const p of d) if (p.foto_url) mapa[p.nombre] = p.foto_url;
    return mapa;
  } catch { return {}; }
}

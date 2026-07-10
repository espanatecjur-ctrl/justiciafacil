// ============================================================
// JusticiaFácil · Lectura de clientes desde JurisConecta
// ------------------------------------------------------------
// JurisConecta es el sistema donde viven los clientes (atención,
// cartas de cambio, RDC, seguimiento). JusticiaFácil SOLO LEE de aquí
// para: (1) buscar un cliente al vincularlo a una garantía, y
// (2) verificar que no haya doble venta.
// NO escribe nada en JurisConecta. Es solo lectura (llave anon).
// ============================================================

// Proyecto Supabase de JurisConecta (distinto al de JusticiaFácil).
const JC_URL = "https://xzvtgjtumvwftulqxiao.supabase.co";
const JC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dnRnanR1bXZ3ZnR1bHF4aWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDU0NzUsImV4cCI6MjA5NzAyMTQ3NX0.W1CwPHCop68e0z_lCiX85EaIUoaJPG3huy2OjlZlSy4";
const jcHeaders = { apikey: JC_KEY, Authorization: `Bearer ${JC_KEY}` };

// Un cliente tal como lo guarda JurisConecta (solo los campos que nos importan aquí).
export interface ClienteJC {
  id: string;
  nombre: string | null;
  curp_rfc: string | null;
  ine: string | null;
  email: string | null;
  telefono: string | null;
  telefono2: string | null;
  domicilio: string | null;
  folio: string | null;              // folio único del cliente
  codigo: string | null;            // SVT, RV, R1, R2, R2C, R3, RDC
  area: string | null;              // Comercial, RAC, Admin, Jurídico, UFC
  estatus: string | null;
  garantia: string | null;          // garantía vinculada (texto)
  gar_id: string | null;            // id de garantía si existe
  expediente: string | null;
}

const SELECT = "id,nombre,curp_rfc,ine,email,telefono,telefono2,domicilio,folio,codigo,area,estatus,garantia,expediente";

// Busca clientes en JurisConecta por CUALQUIER dato: nombre, CURP/RFC, correo,
// teléfono o folio. Devuelve TODAS las coincidencias (para detectar duplicados).
export async function buscarClientesJC(texto: string): Promise<ClienteJC[]> {
  const q = (texto || "").trim();
  if (q.length < 2) return [];
  const enc = encodeURIComponent(`%${q}%`);
  // or=() busca en varias columnas a la vez
  const filtro = `or=(nombre.ilike.${enc},curp_rfc.ilike.${enc},email.ilike.${enc},telefono.ilike.${enc},telefono2.ilike.${enc},folio.ilike.${enc})`;
  try {
    const r = await fetch(`${JC_URL}/rest/v1/clientes?select=${SELECT}&${filtro}&eliminado=eq.false&limit=25`, { headers: jcHeaders });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

// Trae un cliente por su id exacto.
export async function clienteJCPorId(id: string): Promise<ClienteJC | null> {
  try {
    const r = await fetch(`${JC_URL}/rest/v1/clientes?select=${SELECT}&id=eq.${id}&limit=1`, { headers: jcHeaders });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.[0] || null;
  } catch {
    return null;
  }
}

// Trae TODOS los clientes de JurisConecta (para comparar contra los de aquí).
// Pagina de 1000 en 1000 por si acaso, aunque hoy no se necesite.
export async function todosClientesJC(): Promise<ClienteJC[]> {
  const out: ClienteJC[] = [];
  let desde = 0;
  const PAGINA = 1000;
  for (;;) {
    try {
      const r = await fetch(
        `${JC_URL}/rest/v1/clientes?select=${SELECT}&eliminado=eq.false&order=nombre.asc&offset=${desde}&limit=${PAGINA}`,
        { headers: jcHeaders }
      );
      if (!r.ok) break;
      const lote: ClienteJC[] = await r.json();
      out.push(...lote);
      if (lote.length < PAGINA) break;
      desde += PAGINA;
    } catch {
      break;
    }
  }
  return out;
}

// ============================================================
// Atención al Cliente (JurisConecta) — para mostrarla dentro de
// la ficha de cliente de JusticiaFácil. Todo de solo lectura.
// ============================================================

export interface ComunicacionJC {
  id: string;
  tipo: string; // 'whatsapp' | 'correo' | 'llamada' | 'videollamada' | 'nota'
  detalle: string | null;
  autor: string | null;
  created_at: string;
}

export interface LlamadaJC {
  id: string;
  fecha: string;
  tipo: string | null; // 'entrante' | 'saliente'
  resultado: string | null;
  telefono: string | null;
}

export interface TareaJC {
  id: string;
  titulo: string | null;
  estado: string | null;
  fecha_limite: string | null;
  asignado_a: string | null;
}

const soloDigitos = (s: string | null | undefined) => (s || "").replace(/\D/g, "").slice(-10);

// Busca el cliente de JurisConecta que mejor empata por nombre (comparación
// tolerante: sin acentos/mayúsculas). Si no hay match razonable, regresa null.
export async function clienteJCPorNombre(nombre: string): Promise<ClienteJC | null> {
  const candidatos = await buscarClientesJC(nombre);
  if (candidatos.length === 0) return null;
  const norm = (s: string) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const objetivo = norm(nombre);
  const exacto = candidatos.find((c) => norm(c.nombre || "") === objetivo);
  if (exacto) return exacto;
  const palabrasObjetivo = new Set(objetivo.split(" ").filter((w) => w.length > 2));
  let mejor: ClienteJC | null = null;
  let mejorScore = 0;
  for (const c of candidatos) {
    const palabrasC = new Set(norm(c.nombre || "").split(" ").filter((w) => w.length > 2));
    let compartidas = 0;
    for (const w of palabrasObjetivo) if (palabrasC.has(w)) compartidas++;
    if (compartidas > mejorScore) { mejorScore = compartidas; mejor = c; }
  }
  return mejorScore >= 2 ? mejor : null;
}

export async function comunicacionesJC(clienteId: string): Promise<ComunicacionJC[]> {
  try {
    const r = await fetch(
      `${JC_URL}/rest/v1/comunicaciones_cliente?select=id,tipo,detalle,autor,created_at&cliente_id=eq.${encodeURIComponent(clienteId)}&order=created_at.desc&limit=50`,
      { headers: jcHeaders }
    );
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export async function tareasJC(clienteId: string): Promise<TareaJC[]> {
  try {
    const r = await fetch(
      `${JC_URL}/rest/v1/tareas?select=id,titulo,estado,fecha_limite,asignado_a&cliente_id=eq.${encodeURIComponent(clienteId)}&order=fecha_limite.asc.nullslast&limit=50`,
      { headers: jcHeaders }
    );
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export async function llamadasJC(telefono: string | null, telefono2: string | null): Promise<LlamadaJC[]> {
  const t1 = soloDigitos(telefono);
  const t2 = soloDigitos(telefono2);
  const tels = Array.from(new Set([t1, t2].filter((t) => t.length >= 8)));
  if (tels.length === 0) return [];
  try {
    const filtro = tels.map((t) => `telefono.ilike.*${t}`).join(",");
    const r = await fetch(
      `${JC_URL}/rest/v1/llamadas?select=id,fecha,tipo,resultado,telefono&or=(${filtro})&order=fecha.desc&limit=50`,
      { headers: jcHeaders }
    );
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export interface ChequeoDobleVenta {
  garantiaOcupada: ClienteJC[];   // clientes que ya tienen esta garantía
  clienteConGarantia: ClienteJC[]; // esta persona ya tiene otra garantía
}


// Verifica posible doble venta ANTES de vincular:
//  1) ¿esta garantía (gar_id) ya está tomada por otro cliente?
//  2) ¿este cliente ya tiene otra garantía?
export async function verificarDobleVentaJC(garId: string | null, clienteId: string | null): Promise<ChequeoDobleVenta> {
  const res: ChequeoDobleVenta = { garantiaOcupada: [], clienteConGarantia: [] };
  try {
    if (garId) {
      const r = await fetch(`${JC_URL}/rest/v1/clientes?select=${SELECT}&gar_id=eq.${encodeURIComponent(garId)}&eliminado=eq.false`, { headers: jcHeaders });
      if (r.ok) res.garantiaOcupada = await r.json();
    }
    if (clienteId) {
      const r = await fetch(`${JC_URL}/rest/v1/clientes?select=${SELECT}&id=eq.${clienteId}&eliminado=eq.false`, { headers: jcHeaders });
      if (r.ok) {
        const c = (await r.json())?.[0];
        // si ese cliente ya tiene una garantía distinta, se reporta
        if (c && (c.gar_id || c.garantia)) res.clienteConGarantia = [c];
      }
    }
  } catch { /* silencioso: si falla la lectura, no bloquea */ }
  return res;
}

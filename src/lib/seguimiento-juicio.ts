// JusticiaFácil · Seguimiento procesal del juicio (lectura/guardado)
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export interface SeguimientoJuicio {
  id: string;
  caso_id: string | null;
  expediente: string | null;
  tipo_juicio: string | null;
  posicion: string | null;
  etapa_actual: string | null;
  etapas_hechas: string[];
  nota: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeguimientoProcesal {
  id: string;
  caso_id: string | null;
  expediente: string | null;
  etapa: string | null;
  fecha: string | null;
  nota: string | null;
  tipo_acto: string | null;
  created_at: string;
}

// Trae el seguimiento del juicio (o null si todavía no se ha configurado).
export async function obtenerSeguimiento(caso: CasoJuridico): Promise<SeguimientoJuicio | null> {
  try {
    const filtro = caso.id ? `caso_id=eq.${caso.id}` : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/seguimiento_juicio?select=*&${filtro}&limit=1`, { headers });
    const d = r.ok ? await r.json() : [];
    return d?.[0] || null;
  } catch {
    return null;
  }
}

// Crea o actualiza el seguimiento (1 por expediente).
export async function guardarSeguimiento(
  caso: CasoJuridico,
  existenteId: string | null,
  cambios: Partial<Pick<SeguimientoJuicio, "tipo_juicio" | "posicion" | "etapa_actual" | "etapas_hechas" | "nota">>
): Promise<SeguimientoJuicio | null> {
  try {
    if (existenteId) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/seguimiento_juicio?id=eq.${existenteId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ ...cambios, updated_at: new Date().toISOString() }),
      });
      const d = r.ok ? await r.json() : [];
      return d?.[0] || null;
    }
    const fila = {
      caso_id: caso.id || null,
      expediente: caso.expediente || null,
      tipo_juicio: cambios.tipo_juicio || null,
      posicion: cambios.posicion || null,
      etapa_actual: cambios.etapa_actual || null,
      etapas_hechas: cambios.etapas_hechas || [],
      nota: cambios.nota || null,
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/seguimiento_juicio`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fila),
    });
    const d = r.ok ? await r.json() : [];
    return d?.[0] || null;
  } catch {
    return null;
  }
}

// Lista los seguimientos procesales sueltos (notas del juicio que agregas a mano).
export async function listarProcesal(caso: CasoJuridico): Promise<SeguimientoProcesal[]> {
  try {
    const filtro = caso.id ? `caso_id=eq.${caso.id}` : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/seguimiento_procesal?select=*&${filtro}&order=fecha.desc.nullslast,created_at.desc`, { headers });
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

// Agrega un seguimiento procesal suelto.
export async function agregarProcesal(
  caso: CasoJuridico,
  datos: { etapa?: string | null; fecha?: string | null; nota: string; tipo_acto?: string | null }
): Promise<SeguimientoProcesal | null> {
  try {
    const fila = {
      caso_id: caso.id || null,
      expediente: caso.expediente || null,
      etapa: datos.etapa || null,
      fecha: datos.fecha || null,
      nota: datos.nota,
      tipo_acto: datos.tipo_acto || null,
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/seguimiento_procesal`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fila),
    });
    const d = r.ok ? await r.json() : [];
    return d?.[0] || null;
  } catch {
    return null;
  }
}

// ===== Checklist de documentos por etapa =====

export interface MarcaChecklist {
  id: string;
  etapa: string | null;
  doc_nombre: string | null;
  hecho: boolean;
}

// Trae: (1) las etapas que ya tienen documento subido, (2) los docs con link por etapa, y (3) los palomeos manuales.
export async function estadoChecklist(caso: CasoJuridico): Promise<{ etapasConDoc: Set<string>; docsPorEtapa: Record<string, { nombre: string | null; link: string | null; drive_id: string | null; mime: string | null }[]>; marcas: MarcaChecklist[] }> {
  const filtro = caso.id ? `caso_id=eq.${caso.id}` : `expediente=eq.${encodeURIComponent(caso.expediente || "")}`;
  let etapasConDoc = new Set<string>();
  let docsPorEtapa: Record<string, { nombre: string | null; link: string | null; drive_id: string | null; mime: string | null }[]> = {};
  let marcas: MarcaChecklist[] = [];
  try {
    // documentos subidos que tienen etapa (con su link para verlos)
    const rd = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=etapa,nombre,link,drive_id,mime&${filtro}&en_papelera=eq.false&etapa=not.is.null`, { headers });
    const docs = rd.ok ? await rd.json() : [];
    for (const d of docs) {
      if (!d.etapa) continue;
      etapasConDoc.add(d.etapa);
      (docsPorEtapa[d.etapa] ||= []).push({ nombre: d.nombre, link: d.link, drive_id: d.drive_id, mime: d.mime });
    }
  } catch { /* nada */ }
  try {
    const rm = await fetch(`${SUPABASE_URL}/rest/v1/checklist_etapa?select=id,etapa,doc_nombre,hecho&${filtro}`, { headers });
    marcas = rm.ok ? await rm.json() : [];
  } catch { /* nada */ }
  return { etapasConDoc, docsPorEtapa, marcas };
}

// Palomea/despalomea un documento esperado a mano.
export async function marcarChecklist(
  caso: CasoJuridico,
  etapa: string,
  docNombre: string,
  existenteId: string | null,
  hecho: boolean
): Promise<MarcaChecklist | null> {
  try {
    if (existenteId) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/checklist_etapa?id=eq.${existenteId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ hecho }),
      });
      const d = r.ok ? await r.json() : [];
      return d?.[0] || null;
    }
    const fila = {
      caso_id: caso.id || null,
      expediente: caso.expediente || null,
      etapa, doc_nombre: docNombre, hecho,
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/checklist_etapa`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(fila),
    });
    const d = r.ok ? await r.json() : [];
    return d?.[0] || null;
  } catch {
    return null;
  }
}

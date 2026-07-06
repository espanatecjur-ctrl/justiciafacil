// ============================================================
// Permisos por acción · unificado para todos los módulos
// ------------------------------------------------------------
// Calca la lógica de urrj-permisos (que ya funciona), pero para
// varios módulos. NO crea tabla nueva: reusa la app_permisos que ya
// existe (la de "Módulos por rol"), agregándole una llave `acciones`:
//   app_permisos.config = { modulos: {...}, acciones: { ucp:{UCP:[...]}, ucm:{...} } }
// URRJ NO está aquí (usa su propia urrj-permisos). Este cubre:
//   ucp · ucm · udp · ufc · amparos · contratos
//
// Reglas:
//  · DGE / Super_Admin = pueden todo.
//  · Rol NO definido para ese módulo = ve todo (anti-bloqueo) hasta cuadrarlo.
//  · La tabla se SIEMBRA con MATRIZ_DEFAULT (abajo). Si la config no tiene
//    ese rol, cae al default; si el default tampoco, ve todo.
// ============================================================
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const VEN_TODO = ["DGE", "Super_Admin"];

export type ModuloPerm = "ucp" | "ucm" | "udp" | "ufc" | "amparos" | "contratos";

// ---- Catálogo de acciones por módulo (clave + label para la pantalla) ----
export const ACCIONES: Record<ModuloPerm, { clave: string; label: string }[]> = {
  ucp: [
    { clave: "requisitos", label: "Requisitos (7)" },
    { clave: "dictaminar_juridico", label: "Dictaminar jurídico (10 hitos)" },
    { clave: "dictaminar_registral", label: "Dictaminar RPPC / Registral" },
    { clave: "firma_elabora", label: "Firma 1 · Elabora" },
    { clave: "firma_dil", label: "Firma 2 · Valida jurídico (DIL)" },
    { clave: "firma_gad", label: "Firma 3 · Administrativo (GAD)" },
    { clave: "firma_dgc", label: "Firma 4 · Comercial (DGC)" },
    { clave: "firma_dge", label: "Firma 5 · Dirección (cierra)" },
    { clave: "asignar_abogado", label: "Asignar abogado" },
    { clave: "pasar_etapa_b", label: "Pasar a Etapa B (a UCM)" },
    { clave: "redictaminar", label: "Re-dictaminar" },
    { clave: "pdf", label: "Ver / Descargar PDF" },
    { clave: "terminar", label: "Dar por terminado" },
    { clave: "papelera", label: "Papelera / eliminar" },
    { clave: "carpeta", label: "Abrir expediente / carpeta" },
    { clave: "vincular_drive", label: "Vincular carpetas de Drive" },
    { clave: "abrir_drive", label: "Abrir en Drive (salir a Drive)" },
  ],
  ucm: [
    { clave: "crear", label: "Crear expediente" },
    { clave: "editar", label: "Editar expediente" },
    { clave: "asignar_juzgado", label: "Asignar / validar juzgado" },
    { clave: "config_seguimiento", label: "Configurar seguimiento del juicio" },
    { clave: "actuacion", label: "Registrar actuación" },
    { clave: "subir_evidencia", label: "Subir evidencia / tarea / documento" },
    { clave: "ver_robot", label: "Ver última actuación (robot)" },
    { clave: "asignar_abogado", label: "Asignar / reasignar abogado" },
    { clave: "archivar", label: "Archivar" },
    { clave: "borrar", label: "Borrar / papelera" },
    { clave: "ver", label: "Ver (solo lectura)" },
    { clave: "carpeta", label: "Abrir expediente / carpeta" },
    { clave: "vincular_drive", label: "Vincular carpetas de Drive" },
    { clave: "abrir_drive", label: "Abrir en Drive (salir a Drive)" },
  ],
  udp: [
    { clave: "crear", label: "Crear caso de defensa" },
    { clave: "editar", label: "Editar caso" },
    { clave: "estrategia", label: "Definir estrategia / posición" },
    { clave: "actuacion", label: "Registrar actuación / avance" },
    { clave: "subir_evidencia", label: "Subir evidencia / documento" },
    { clave: "vincular", label: "Vincular a Amparo / Recurso" },
    { clave: "validar_dil", label: "Validar el caso (DIL)" },
    { clave: "asignar_abogado", label: "Asignar / reasignar abogado" },
    { clave: "archivar", label: "Archivar" },
    { clave: "borrar", label: "Borrar / papelera" },
    { clave: "ver", label: "Ver (solo lectura)" },
    { clave: "carpeta", label: "Abrir expediente / carpeta" },
    { clave: "vincular_drive", label: "Vincular carpetas de Drive" },
    { clave: "abrir_drive", label: "Abrir en Drive (salir a Drive)" },
  ],
  ufc: [
    { clave: "contrato_crear", label: "Crear / editar contrato (plantillas, paquetes)" },
    { clave: "contrato_generar", label: "Generar contrato para cliente" },
    { clave: "firma_elabora", label: "Firma 1 · Elabora (UFC)" },
    { clave: "firma_dgc", label: "Firma 2 · Visto bueno Comercial (DGC)" },
    { clave: "firma_dge", label: "Firma 3 · Autoriza Dirección (DGE)" },
    { clave: "apoderados", label: "Gestionar apoderados" },
    { clave: "notaria", label: "Enviar a notaría / escrituración" },
    { clave: "tramites_rppc", label: "Trámites RPPC / gestorías" },
    { clave: "entrega_finiquito", label: "Entrega-recepción / finiquito" },
    { clave: "pdf", label: "Ver / Descargar PDF" },
    { clave: "papelera", label: "Papelera / eliminar" },
    { clave: "carpeta", label: "Abrir expediente / carpeta" },
    { clave: "vincular_drive", label: "Vincular carpetas de Drive" },
    { clave: "abrir_drive", label: "Abrir en Drive (salir a Drive)" },
  ],
  amparos: [
    { clave: "crear", label: "Crear amparo / recurso / exhorto" },
    { clave: "editar", label: "Editar" },
    { clave: "actuacion", label: "Registrar actuación / resolución" },
    { clave: "subir_documento", label: "Subir documento / evidencia" },
    { clave: "vincular", label: "Vincular al juicio / caso de origen" },
    { clave: "vencimiento", label: "Marcar vencimiento / plazo" },
    { clave: "asignar_abogado", label: "Asignar / reasignar abogado" },
    { clave: "archivar", label: "Archivar" },
    { clave: "borrar", label: "Borrar / papelera" },
    { clave: "ver", label: "Ver (solo lectura)" },
    { clave: "carpeta", label: "Abrir expediente / carpeta" },
    { clave: "vincular_drive", label: "Vincular carpetas de Drive" },
    { clave: "abrir_drive", label: "Abrir en Drive (salir a Drive)" },
  ],
  contratos: [
    { clave: "plantilla_maestra", label: "Crear / editar plantilla maestra" },
    { clave: "paquetes", label: "Crear / editar paquetes / grupos" },
    { clave: "generar", label: "Generar contrato para cliente" },
    { clave: "editar_generado", label: "Editar contrato generado (marcadores)" },
    { clave: "kpis", label: "Ver KPIs / indicadores" },
    { clave: "exportar", label: "Descargar / exportar" },
    { clave: "enviar_notaria", label: "Enviar a firma / notaría (a UFC)" },
    { clave: "papelera", label: "Papelera / eliminar" },
    { clave: "ver", label: "Ver (solo lectura)" },
  ],
};

// ---- Matriz aprobada (default y semilla). Solo se listan las acciones ✓. ----
// Los roles no listados para un módulo = ve todo (anti-bloqueo).
export const MATRIZ_DEFAULT: Record<ModuloPerm, Record<string, string[]>> = {
  ucp: {
    UCP: ["requisitos", "dictaminar_juridico", "dictaminar_registral", "firma_elabora", "pasar_etapa_b", "redictaminar", "pdf", "carpeta", "vincular_drive"],
    DIL: ["requisitos", "dictaminar_juridico", "dictaminar_registral", "firma_dil", "asignar_abogado", "pasar_etapa_b", "redictaminar", "pdf", "terminar", "papelera", "carpeta", "vincular_drive"],
    GAD: ["requisitos", "firma_gad", "asignar_abogado", "pdf", "papelera", "carpeta", "vincular_drive"],
    DGC: ["firma_dgc", "pdf", "carpeta", "vincular_drive"],
  },
  ucm: {
    UCM: ["crear", "editar", "asignar_juzgado", "config_seguimiento", "actuacion", "subir_evidencia", "ver_robot", "archivar", "ver", "carpeta", "vincular_drive"],
    DIL: ["crear", "editar", "asignar_juzgado", "config_seguimiento", "actuacion", "subir_evidencia", "ver_robot", "asignar_abogado", "archivar", "borrar", "ver", "carpeta", "vincular_drive"],
    GAD: ["ver_robot", "asignar_abogado", "borrar", "ver", "carpeta", "vincular_drive"],
  },
  udp: {
    UDP: ["crear", "editar", "estrategia", "actuacion", "subir_evidencia", "vincular", "archivar", "ver", "carpeta", "vincular_drive"],
    DIL: ["crear", "editar", "estrategia", "actuacion", "subir_evidencia", "vincular", "validar_dil", "asignar_abogado", "archivar", "borrar", "ver", "carpeta", "vincular_drive"],
    GAD: ["asignar_abogado", "borrar", "ver", "carpeta", "vincular_drive"],
  },
  ufc: {
    UFC: ["contrato_crear", "contrato_generar", "firma_elabora", "notaria", "tramites_rppc", "entrega_finiquito", "pdf", "carpeta", "vincular_drive"],
    DGC: ["contrato_crear", "contrato_generar", "firma_dgc", "notaria", "entrega_finiquito", "pdf", "papelera", "carpeta", "vincular_drive"],
    DIL: ["contrato_crear", "apoderados", "pdf", "papelera", "carpeta", "vincular_drive"],
    GAD: ["tramites_rppc", "pdf", "carpeta", "vincular_drive"],
  },
  amparos: {
    DIL: ["crear", "editar", "actuacion", "subir_documento", "vincular", "vencimiento", "asignar_abogado", "archivar", "borrar", "ver", "carpeta", "vincular_drive"],
    UCM: ["crear", "editar", "actuacion", "subir_documento", "vincular", "vencimiento", "archivar", "ver", "carpeta", "vincular_drive"],
    UDP: ["crear", "editar", "actuacion", "subir_documento", "vincular", "vencimiento", "archivar", "ver", "carpeta", "vincular_drive"],
    GAD: ["asignar_abogado", "borrar", "ver", "carpeta", "vincular_drive"],
  },
  contratos: {
    UFC: ["paquetes", "generar", "editar_generado", "kpis", "exportar", "enviar_notaria", "ver"],
    DGC: ["paquetes", "generar", "editar_generado", "kpis", "exportar", "enviar_notaria", "papelera", "ver"],
    DIL: ["plantilla_maestra", "paquetes", "kpis", "exportar", "papelera", "ver"],
  },
};

const todas = (modulo: ModuloPerm) => ACCIONES[modulo].map((a) => a.clave);

// cache por módulo
const cache: Partial<Record<ModuloPerm, { rol: string | null; acciones: string[] }>> = {};

export async function cargarPermisosModulo(modulo: ModuloPerm): Promise<{ rol: string | null; acciones: string[] }> {
  if (cache[modulo]) return cache[modulo]!;
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) { cache[modulo] = { rol: null, acciones: todas(modulo) }; return cache[modulo]!; }

    const [colRes, cfgRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers }),
    ]);
    const col = colRes.ok ? await colRes.json() : [];
    const rol: string | null = col?.[0]?.rol ?? null;
    if (!rol || VEN_TODO.includes(rol)) { cache[modulo] = { rol, acciones: todas(modulo) }; return cache[modulo]!; }

    const cfg = cfgRes.ok ? await cfgRes.json() : [];
    const config = cfg?.[0]?.config?.acciones?.[modulo] ?? {};
    // 1º la config guardada; si no, el default de la matriz; si tampoco, ve todo.
    const acciones: string[] = Array.isArray(config[rol])
      ? config[rol]
      : (MATRIZ_DEFAULT[modulo][rol] ?? todas(modulo));
    cache[modulo] = { rol, acciones };
    return cache[modulo]!;
  } catch {
    cache[modulo] = { rol: null, acciones: todas(modulo) };
    return cache[modulo]!;
  }
}

export function puedeAccion(acciones: string[], accion: string): boolean {
  return acciones.length === 0 || acciones.includes(accion);
}

export function limpiarCachePermisosAcciones() {
  (Object.keys(cache) as ModuloPerm[]).forEach((k) => delete cache[k]);
}

// ============================================================
// Permiso ESTRICTO "Abrir en Drive" (salir a Drive).
// Negado por defecto para TODOS. Solo lo tienen:
//   · DGE y Super_Admin (siempre), y
//   · los roles a los que la DGE/Super_Admin se lo enciendan
//     explícitamente en la pantalla de permisos.
// No usa la regla anti-bloqueo (a diferencia de las demás acciones),
// justo para que nadie lo tenga "por default".
// ============================================================
export async function puedeAbrirDrive(modulo?: ModuloPerm): Promise<boolean> {
  try {
    const auth = await getAuth();
    const { data } = await auth.auth.getSession();
    const correo = data?.session?.user?.email ?? null;
    if (!correo) return false; // sin sesión → no

    const colRes = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers });
    const col = colRes.ok ? await colRes.json() : [];
    const rol: string | null = col?.[0]?.rol ?? null;
    if (!rol) return false;
    if (VEN_TODO.includes(rol)) return true; // DGE / Super_Admin siempre

    if (!modulo) return false; // sin módulo, solo DGE/Super_Admin

    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/app_permisos?select=config&id=eq.1`, { headers });
    const cfg = cfgRes.ok ? await cfgRes.json() : [];
    const lista = cfg?.[0]?.config?.acciones?.[modulo]?.[rol];
    // Solo si la config lo incluye EXPLÍCITAMENTE (nada de "ve todo").
    return Array.isArray(lista) && lista.includes("abrir_drive");
  } catch {
    return false; // ante cualquier error → no mostrar (seguro)
  }
}

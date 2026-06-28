// ============================================================
// JusticiaFácil · Catálogo de roles (mismos del jurídico de Juris)
// Define qué MÓDULOS ve cada ROL. Editable desde Configuración.
// ============================================================

export type ModuloClave =
  | "inicio" | "expedientes" | "ucm" | "udp" | "control_demandas"
  | "boletines" | "exhortos" | "amparos" | "recursos"
  | "contratos" | "tramites" | "ucp" | "urrj" | "conectores" | "configuracion";

export const MODULOS: { clave: ModuloClave; label: string }[] = [
  { clave: "inicio", label: "Inicio" },
  { clave: "expedientes", label: "Expedientes" },
  { clave: "ucm", label: "UCM · Seguimiento" },
  { clave: "udp", label: "UDP · Defensa y Protección" },
  { clave: "control_demandas", label: "Control de demandas" },
  { clave: "boletines", label: "Boletines" },
  { clave: "exhortos", label: "Exhortos" },
  { clave: "amparos", label: "Amparos" },
  { clave: "recursos", label: "Recursos" },
  { clave: "contratos", label: "Contratos" },
  { clave: "tramites", label: "Trámites Gob." },
  { clave: "ucp", label: "UCP" },
  { clave: "urrj", label: "URRJ" },
  { clave: "conectores", label: "Conectores Juzgados" },
  { clave: "configuracion", label: "Configuración" },
];

export const TODOS_MODULOS: ModuloClave[] = MODULOS.map((m) => m.clave);

export type DefinicionRol = {
  codigo: string;
  nombre: string;
  grupo: string;
  modulos: ModuloClave[] | "todos";
};

const BASE: ModuloClave[] = ["inicio", "expedientes", "boletines"];

export const ROLES: DefinicionRol[] = [
  { codigo: "Super_Admin", nombre: "Super Admin (DGE + Tecnología)", grupo: "Sistema", modulos: "todos" },
  { codigo: "DGE", nombre: "Dirección General", grupo: "Dirección", modulos: "todos" },
  { codigo: "DGC", nombre: "Dirección Comercial", grupo: "Dirección", modulos: [...BASE, "ucp", "contratos"] },
  { codigo: "DIL", nombre: "Dirección Jurídica (cubre URRJ)", grupo: "Jurídico", modulos: "todos" },
  { codigo: "URRJ", nombre: "Unidad de Resolución Jurídica (pre-dictamen)", grupo: "Jurídico", modulos: [...BASE, "urrj"] },
  { codigo: "UCP", nombre: "Unidad de Consolidación Patrimonial", grupo: "Jurídico", modulos: [...BASE, "ucp", "ucm", "contratos"] },
  { codigo: "UCM", nombre: "Unidad UCM (seguimiento a juicios)", grupo: "Jurídico", modulos: [...BASE, "ucm", "control_demandas"] },
  { codigo: "UDP", nombre: "Unidad UDP (Defensa y Protección)", grupo: "Jurídico", modulos: [...BASE, "udp"] },
  { codigo: "UFC", nombre: "Unidad UFC (formalización)", grupo: "Jurídico", modulos: [...BASE, "contratos", "tramites", "conectores"] },
  { codigo: "GAD", nombre: "Gerencia Administrativa", grupo: "Administración", modulos: [...BASE, "urrj"] },
  { codigo: "Consulta", nombre: "Solo consulta", grupo: "Sistema", modulos: ["inicio", "expedientes"] },
];

export const GRUPOS = ["Sistema", "Dirección", "Jurídico"];

export function rolVeTodo(modulos: ModuloClave[] | "todos"): boolean {
  return modulos === "todos";
}

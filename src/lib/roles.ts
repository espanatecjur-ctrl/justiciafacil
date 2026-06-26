// ============================================================
// JusticiaFácil · Catálogo de roles (mismos del jurídico de Juris)
// Define qué MÓDULOS ve cada ROL. Editable desde Configuración.
// ============================================================

export type ModuloClave =
  | "inicio" | "expedientes" | "hitos" | "ucm" | "udp" | "control_demandas"
  | "boletines" | "exhortos" | "amparos" | "recursos" | "dictamen_ia"
  | "contratos" | "tramites" | "ucp" | "urrj" | "conectores" | "configuracion";

export const MODULOS: { clave: ModuloClave; label: string }[] = [
  { clave: "inicio", label: "Inicio" },
  { clave: "expedientes", label: "Expedientes" },
  { clave: "hitos", label: "Hitos & Agenda" },
  { clave: "ucm", label: "UCM · Seguimiento" },
  { clave: "udp", label: "UDP · Defensa y Protección" },
  { clave: "control_demandas", label: "Control de demandas" },
  { clave: "boletines", label: "Boletines" },
  { clave: "exhortos", label: "Exhortos" },
  { clave: "amparos", label: "Amparos" },
  { clave: "recursos", label: "Recursos" },
  { clave: "dictamen_ia", label: "Robot Pre-Dictaminador" },
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

const BASE: ModuloClave[] = ["inicio", "expedientes", "hitos", "boletines"];

export const ROLES: DefinicionRol[] = [
  { codigo: "Super_Admin", nombre: "Super Admin (DGE + Tecnología)", grupo: "Sistema", modulos: "todos" },
  { codigo: "DGE", nombre: "Dirección General", grupo: "Dirección", modulos: "todos" },
  { codigo: "DIL", nombre: "Dirección Jurídica (cubre URRJ)", grupo: "Jurídico", modulos: "todos" },
  { codigo: "URRJ", nombre: "Revisión y Riesgo Jurídico (pre-dictamen)", grupo: "Jurídico", modulos: [...BASE, "dictamen_ia", "urrj"] },
  { codigo: "UCP", nombre: "Unidad UCP", grupo: "Jurídico", modulos: [...BASE, "ucp", "ucm", "contratos"] },
  { codigo: "UCM", nombre: "Unidad UCM (seguimiento a juicios)", grupo: "Jurídico", modulos: [...BASE, "ucm", "control_demandas"] },
  { codigo: "UDP", nombre: "Unidad UDP (Defensa y Protección)", grupo: "Jurídico", modulos: [...BASE, "udp"] },
  { codigo: "UFC", nombre: "Unidad UFC (formalización)", grupo: "Jurídico", modulos: [...BASE, "contratos", "tramites", "conectores"] },
  { codigo: "Consulta", nombre: "Solo consulta", grupo: "Sistema", modulos: ["inicio", "expedientes"] },
];

export const GRUPOS = ["Sistema", "Dirección", "Jurídico"];

export function rolVeTodo(modulos: ModuloClave[] | "todos"): boolean {
  return modulos === "todos";
}
